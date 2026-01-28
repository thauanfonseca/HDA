from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
import json
import io
import pandas as pd
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
            df = pd.read_excel(io.BytesIO(content), nrows=0, engine='openpyxl')
        elif file.filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content), nrows=0, engine='xlrd')
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
        return {"columns": df.columns.tolist()}
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
        
        # Save processed DF to a temporary memory buffer to return (or just return summary and wait for download request?)
        # For simplicity in this turn, I'll return the summary and a 'preview' of the first 100 rows.
        # User can request full download in a separate endpoint or we stream it here?
        # Usually better to separate, but for an MVP, returning JSON preview is good for the UI grid.
        
        # Convert preview to dict
        preview = processed_df.head(100).fillna('').to_dict(orient='records')
        
        return {
            "summary": summary,
            "preview": preview,
            # In a real app we might cache the result ID and allow download. 
            # For now, we will handle the download by re-processing (simple stateless) or client-side export if data is small. 
            # Given size (25MB+), client-side export might crash. 
            # Let's add a download endpoint that streams the result.
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/export")
async def export_debt_file(
    file: UploadFile = File(...),
    config: str = Form(...)
):
    """Re-processes and returns the full Excel file."""
    # Note: Optimization would be to cache the processed dataframe from the previous step.
    # But for simplicity/statelessness, we re-process here.
    try:
        config_dict = json.loads(config)
        clean_config = CleansingConfig(**config_dict)
        content = await file.read()
        processed_df, _ = process_file(content, file.filename, clean_config)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            processed_df.to_excel(writer, index=False)
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
