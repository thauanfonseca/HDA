import polars as pl
from datetime import datetime
from models import CleansingConfig
import io
import re

def process_file(file_content: bytes, filename: str, config: CleansingConfig) -> (pl.DataFrame, dict):
    # Load Data
    try:
        if filename.endswith(".xlsx"):
            df = pl.read_excel(io.BytesIO(file_content))
        elif filename.endswith(".xls"):
            # Polars doesn't support .xls directly, use xlsx2csv workaround
            import xlrd
            workbook = xlrd.open_workbook(file_contents=file_content)
            sheet = workbook.sheet_by_index(0)
            data = []
            headers = [str(cell.value) for cell in sheet.row(0)]
            for row_idx in range(1, sheet.nrows):
                row_data = {}
                for col_idx, header in enumerate(headers):
                    row_data[header] = sheet.cell_value(row_idx, col_idx)
                data.append(row_data)
            df = pl.DataFrame(data)
        else:
            raise ValueError("Unsupported file format. Use .xlsx or .xls")
    except Exception as e:
        raise ValueError(f"Error reading file: {str(e)}")

    # Normalize Columns
    mapping = config.mapping
    
    # Validation: Check if columns exist
    required_cols = [mapping.debt_id, mapping.taxpayer_name, mapping.due_date, mapping.amount]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in file: {', '.join(missing)}")

    # Helper function to parse dates
    def parse_date(val):
        if val is None:
            return None
        try:
            if isinstance(val, datetime):
                return val
            if isinstance(val, str):
                # Try common formats
                for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"]:
                    try:
                        return datetime.strptime(val, fmt)
                    except:
                        continue
            return None
        except:
            return None

    # Helper for Amount
    def parse_amount(val):
        if val is None:
            return 0.0
        try:
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                x = val.replace('R$', '').replace(' ', '')
                if ',' in x and '.' in x:
                    x = x.replace('.', '').replace(',', '.')
                elif ',' in x:
                    x = x.replace(',', '.')
                return float(x)
            return 0.0
        except:
            return 0.0

    # Process with Polars - convert to Python for complex logic
    data = df.to_dicts()
    
    for row in data:
        row['_temp_date'] = parse_date(row.get(mapping.due_date))
        row['_temp_amount'] = parse_amount(row.get(mapping.amount))
        row['_temp_name'] = str(row.get(mapping.taxpayer_name) or '').upper()
        
        if mapping.cpf_cnpj and mapping.cpf_cnpj in df.columns:
            doc = str(row.get(mapping.cpf_cnpj) or '')
            row['_temp_doc'] = re.sub(r'[^0-9]', '', doc)
        else:
            row['_temp_doc'] = ''
            
        if mapping.tribute_type and mapping.tribute_type in df.columns:
            row['_temp_tribute'] = str(row.get(mapping.tribute_type) or '').upper()
        else:
            row['_temp_tribute'] = ''
        
        row['Status_Higienizacao'] = 'Válido'
        row['Motivo_Higienizacao'] = ''

    # --- RULES PROCESSING ---
    
    # 1. Prescription
    if config.prescription.enabled:
        ref_date = datetime.now()
        if config.prescription.reference_date:
            try:
                ref_date = datetime.strptime(config.prescription.reference_date, "%Y-%m-%d")
            except:
                pass
        
        cutoff_date = ref_date.replace(year=ref_date.year - config.prescription.years)
        
        for row in data:
            if row['Status_Higienizacao'] == 'Válido':
                temp_date = row['_temp_date']
                if temp_date and temp_date < cutoff_date:
                    row['Status_Higienizacao'] = 'Prescrito'
                    row['Motivo_Higienizacao'] = f'Vencimento anterior a {cutoff_date.strftime("%d/%m/%Y")}'

    # 2. Immunity
    if config.immunity.enabled:
        keywords = [k.upper() for k in config.immunity.keywords]
        pattern = re.compile('|'.join(map(re.escape, keywords)))
        
        for row in data:
            if row['Status_Higienizacao'] == 'Válido':
                if pattern.search(row['_temp_name']):
                    row['Status_Higienizacao'] = 'Imune'
                    row['Motivo_Higienizacao'] = 'Entidade Imune identificada por palavra-chave'

    # 3. Exemption
    if config.exemption.enabled:
        if config.exemption.amount_threshold > 0:
            for row in data:
                if row['Status_Higienizacao'] == 'Válido':
                    if row['_temp_amount'] < config.exemption.amount_threshold:
                        row['Status_Higienizacao'] = 'Isento'
                        row['Motivo_Higienizacao'] = f'Valor abaixo de R$ {config.exemption.amount_threshold}'
        
        if config.exemption.tributes:
            tributes = [t.upper() for t in config.exemption.tributes]
            for row in data:
                if row['Status_Higienizacao'] == 'Válido':
                    if row['_temp_tribute'] in tributes:
                        row['Status_Higienizacao'] = 'Isento'
                        row['Motivo_Higienizacao'] = 'Tributo Isento'

    # 4. Incomplete
    if config.incomplete.enabled:
        keywords = [k.upper() for k in config.incomplete.keywords]
        pattern = re.compile('|'.join(map(re.escape, keywords)))
        
        for row in data:
            if row['Status_Higienizacao'] == 'Válido':
                bad_name = pattern.search(row['_temp_name']) or len(row['_temp_name']) < 3
                bad_doc = config.incomplete.check_cpf_cnpj and row['_temp_doc'] == ''
                
                if bad_name or bad_doc:
                    row['Status_Higienizacao'] = 'Dados Incompletos'
                    row['Motivo_Higienizacao'] = 'Nome ou CPF/CNPJ inválido/genérico'

    # Clean up temp columns
    for row in data:
        del row['_temp_date']
        del row['_temp_amount']
        del row['_temp_name']
        del row['_temp_doc']
        del row['_temp_tribute']

    # Convert back to Polars DataFrame
    result_df = pl.DataFrame(data)

    # Calculate summary
    status_counts = {}
    total_removed = 0.0
    total_valid = 0.0
    
    for row in data:
        status = row['Status_Higienizacao']
        status_counts[status] = status_counts.get(status, 0) + 1
        
        amount = parse_amount(row.get(mapping.amount))
        if status != 'Válido':
            total_removed += amount
        else:
            total_valid += amount

    summary = {
        "total_records": len(data),
        "processed_records": len(data), 
        "prescribed_count": status_counts.get('Prescrito', 0),
        "immune_count": status_counts.get('Imune', 0),
        "exempt_count": status_counts.get('Isento', 0),
        "incomplete_count": status_counts.get('Dados Incompletos', 0),
        "valid_count": status_counts.get('Válido', 0),
        "total_amount_removed": total_removed,
        "total_amount_valid": total_valid
    }

    return result_df, summary
