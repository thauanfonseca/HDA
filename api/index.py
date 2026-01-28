from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
import json
import io
import polars as pl
from starlette.responses import StreamingResponse

from cleaner import process_file
from models import CleansingConfig, CleansingResult

app = FastAPI(title="Higienizador de Dívida Ativa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze-headers")
async def analyze_headers(file: UploadFile = File(...)):
    """Reads the first few rows to return column headers for mapping."""
    try:
        content = await file.read()
        if file.filename.endswith(".xlsx"):
            df = pl.read_excel(io.BytesIO(content))
        elif file.filename.endswith(".xls"):
            import xlrd
            workbook = xlrd.open_workbook(file_contents=content)
            sheet = workbook.sheet_by_index(0)
            headers = [str(cell.value) for cell in sheet.row(0)]
            return {"columns": headers}
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
        return {"columns": df.columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@app.post("/process")
async def process_debt_file(
    file: UploadFile = File(...),
    config: str = Form(...) # serialized JSON
):
    """Processes the file with the given configuration."""
    try:
        config_dict = json.loads(config)
        clean_config = CleansingConfig(**config_dict)
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid configuration: {str(e)}")

    content = await file.read()
    
    try:
        processed_df, summary = process_file(content, file.filename, clean_config)
        
        # Convert preview to dict
        preview = processed_df.head(100).to_dicts()
        
        return {
            "summary": summary,
            "preview": preview,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/export")
async def export_debt_file(
    file: UploadFile = File(...),
    config: str = Form(...)
):
    """Re-processes and returns the full Excel file."""
    try:
        config_dict = json.loads(config)
        clean_config = CleansingConfig(**config_dict)
        content = await file.read()
        processed_df, _ = process_file(content, file.filename, clean_config)
        
        output = io.BytesIO()
        processed_df.write_excel(output)
        output.seek(0)
        
        return StreamingResponse(
            output, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=higienizado_{file.filename}"}
        )
        
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
