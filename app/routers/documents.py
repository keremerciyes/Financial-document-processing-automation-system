from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.services.processor import process_document

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/process")
async def process_doc(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None)
):
    if file:
        file_bytes = await file.read()
        input_data = file_bytes
    elif text:
        input_data = text
    else:
        raise HTTPException(status_code=400, detail="No file or text provided")

    try:
        print("Processing document...")
        result = await process_document(input_data)
        print("Processing complete:", result.classification.primaryClass)

        return {
            "success": True,
            "data": result.model_dump()
        }

    except Exception as error:
        print("Error processing document:", error)
        raise HTTPException(status_code=500, detail=str(error) or "Internal Server Error")
