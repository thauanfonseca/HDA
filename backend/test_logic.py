import pandas as pd
import sys
import os
import glob

# Add current directory to path so we can import modules
sys.path.append(os.getcwd())

from cleaner import process_file
from models import CleansingConfig, ColumnMapping, PrescriptionRules, ImmunityRules, ExemptionRules, IncompleteRules

def test_on_file(filepath):
    print(f"\n--- Testing on {os.path.basename(filepath)} ---")
    
    # Simple heuristic to guess mapping based on filename or content columns
    # In the real app, the user does this via UI. Here we hardcode for the test.
    
    try:
        # Read header to guess columns
        df_head = pd.read_excel(filepath, nrows=0)
        cols = set(df_head.columns)
        
        mapping = None
        if "Numero da Dívida" in cols or "Numero da Dvida" in cols: # Brumado likely
            print("Detected Brumado format")
            # Handle potential encoding weirdness in column names
            debt_id = "Numero da Dívida" if "Numero da Dívida" in cols else [c for c in cols if "Numero da D" in c][0]
            
            mapping = ColumnMapping(
                debt_id=debt_id,
                taxpayer_name="Nome Contribuinte",
                cpf_cnpj="CPF/CNPJ",
                due_date="Data Vencto",
                amount="Total"
            )
        elif "Nº Dívida Ativa" in cols or "N Dvida Ativa" in cols: # Tanhacu likely
            print("Detected Tanhacu format")
            debt_id = "Nº Dívida Ativa" if "Nº Dívida Ativa" in cols else [c for c in cols if "D" in c and "vida" in c and "Ativa" in c][0]
            due_date = "Vencimento" if "Vencimento" in cols else "Data Inscrição" # Fallback
            
            mapping = ColumnMapping(
                debt_id=debt_id,
                taxpayer_name="Contribuinte",
                due_date="Vencimento",
                amount="Valor Corrigido",
                tribute_type="Tributo"
            )
        else:
            print(f"Unknown format. Columns: {cols}")
            return

        with open(filepath, 'rb') as f:
            content = f.read()

        config = CleansingConfig(
            mapping=mapping,
            prescription=PrescriptionRules(enabled=True, years=5),
            immunity=ImmunityRules(enabled=True),
            exemption=ExemptionRules(enabled=True, amount_threshold=50.0),
            incomplete=IncompleteRules(enabled=True)
        )

        df, summary = process_file(content, filepath, config)
        print("Summary:", summary)
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Find xlsx files in the PARENT directory (project root)
    # The CWD when running this script via run_command is the project root.
    files = glob.glob("*.xlsx")
    print(f"Found {len(files)} files: {files}")
    
    for f in files:
        test_on_file(f)
