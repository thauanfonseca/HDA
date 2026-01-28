import pandas as pd
from datetime import datetime
from models import CleansingConfig
import io
import re

def process_file(file_content: bytes, filename: str, config: CleansingConfig) -> (pd.DataFrame, dict):
    # Load Data
    try:
        if filename.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
        elif filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(file_content), engine='xlrd')
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
    def parse_date(x):
        try:
            return pd.to_datetime(x, dayfirst=True, errors='coerce')
        except:
            return pd.NaT

    # Helper for Amount
    def parse_amount(x):
        try:
            if isinstance(x, str):
                x = x.replace('R$', '').replace(' ', '')
                if ',' in x and '.' in x:
                     x = x.replace('.', '').replace(',', '.')
                elif ',' in x:
                    x = x.replace(',', '.')
            return float(x)
        except:
            return 0.0

    # Create standardized working columns
    df['_temp_date'] = df[mapping.due_date].apply(parse_date)
    df['_temp_amount'] = df[mapping.amount].apply(parse_amount)
    df['_temp_name'] = df[mapping.taxpayer_name].fillna('').astype(str).str.upper()
    
    if mapping.cpf_cnpj and mapping.cpf_cnpj in df.columns:
        df['_temp_doc'] = df[mapping.cpf_cnpj].fillna('').astype(str).str.replace(r'[^0-9]', '', regex=True)
    else:
        df['_temp_doc'] = ''

    if mapping.tribute_type and mapping.tribute_type in df.columns:
        df['_temp_tribute'] = df[mapping.tribute_type].fillna('').astype(str).str.upper()
    else:
        df['_temp_tribute'] = ''

    # Initialize Status
    df['Status_Higienizacao'] = 'Válido'
    df['Motivo_Higienizacao'] = ''

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
        mask_prescribed = (df['_temp_date'] < cutoff_date) & (df['_temp_date'].notnull())
        
        df.loc[mask_prescribed, 'Status_Higienizacao'] = 'Prescrito'
        df.loc[mask_prescribed, 'Motivo_Higienizacao'] = f'Vencimento anterior a {cutoff_date.strftime("%d/%m/%Y")}'

    # 2. Immunity
    if config.immunity.enabled:
        mask_valid = df['Status_Higienizacao'] == 'Válido'
        keywords = [k.upper() for k in config.immunity.keywords]
        pattern = '|'.join(map(re.escape, keywords))
        
        mask_immune_name = df.loc[mask_valid, '_temp_name'].str.contains(pattern, regex=True)
        ids_immune = df.loc[mask_valid][mask_immune_name].index
        df.loc[ids_immune, 'Status_Higienizacao'] = 'Imune'
        df.loc[ids_immune, 'Motivo_Higienizacao'] = 'Entidade Imune identificada por palavra-chave'

    # 3. Exemption
    if config.exemption.enabled:
        mask_valid = df['Status_Higienizacao'] == 'Válido'
        
        if config.exemption.amount_threshold > 0:
            mask_low_value = df.loc[mask_valid, '_temp_amount'] < config.exemption.amount_threshold
            ids_low = df.loc[mask_valid][mask_low_value].index
            df.loc[ids_low, 'Status_Higienizacao'] = 'Isento'
            df.loc[ids_low, 'Motivo_Higienizacao'] = f'Valor abaixo de R$ {config.exemption.amount_threshold}'

        mask_valid = df['Status_Higienizacao'] == 'Válido'
        if config.exemption.tributes:
            tributes = [t.upper() for t in config.exemption.tributes]
            mask_tribute = df.loc[mask_valid, '_temp_tribute'].isin(tributes)
            ids_tribute = df.loc[mask_valid][mask_tribute].index
            df.loc[ids_tribute, 'Status_Higienizacao'] = 'Isento'
            df.loc[ids_tribute, 'Motivo_Higienizacao'] = 'Tributo Isento'

    # 4. Incomplete
    if config.incomplete.enabled:
        mask_valid = df['Status_Higienizacao'] == 'Válido'
        keywords = [k.upper() for k in config.incomplete.keywords]
        pattern = '|'.join(map(re.escape, keywords))
        
        mask_bad_name = df.loc[mask_valid, '_temp_name'].str.contains(pattern, regex=True) | (df.loc[mask_valid, '_temp_name'].str.len() < 3)
        mask_bad_doc = pd.Series(False, index=df.index)
        if config.incomplete.check_cpf_cnpj:
             mask_bad_doc = df.loc[mask_valid, '_temp_doc'] == ''
        
        ids_incomplete = df.loc[mask_valid][mask_bad_name | mask_bad_doc].index
        df.loc[ids_incomplete, 'Status_Higienizacao'] = 'Dados Incompletos'
        df.loc[ids_incomplete, 'Motivo_Higienizacao'] = 'Nome ou CPF/CNPJ inválido/genérico'

    # Clean up
    df.drop(columns=['_temp_date', '_temp_amount', '_temp_name', '_temp_doc', '_temp_tribute'], inplace=True, errors='ignore')

    summary = {
        "total_records": len(df),
        "processed_records": len(df), 
        "prescribed_count": int((df['Status_Higienizacao'] == 'Prescrito').sum()),
        "immune_count": int((df['Status_Higienizacao'] == 'Imune').sum()),
        "exempt_count": int((df['Status_Higienizacao'] == 'Isento').sum()),
        "incomplete_count": int((df['Status_Higienizacao'] == 'Dados Incompletos').sum()),
        "valid_count": int((df['Status_Higienizacao'] == 'Válido').sum()),
        "total_amount_removed": float(df.loc[df['Status_Higienizacao'] != 'Válido', mapping.amount].apply(parse_amount).sum()),
        "total_amount_valid": float(df.loc[df['Status_Higienizacao'] == 'Válido', mapping.amount].apply(parse_amount).sum())
    }

    return df, summary
