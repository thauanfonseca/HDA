import pandas as pd
import os

files = [
    "Higienização da Dívida Ativa - Brumado.xlsx",
    "higienização da divida ativa - tanhaçu.xlsx"
]

for f in files:
    if os.path.exists(f):
        print(f"--- Processing {f} ---")
        try:
            df = pd.read_excel(f, nrows=5)
            print("Columns:", df.columns.tolist())
            print("Types:", df.dtypes)
            print("Sample Data:\n", df.head())
        except Exception as e:
            print(f"Error reading {f}: {e}")
    else:
        print(f"File not found: {f}")
