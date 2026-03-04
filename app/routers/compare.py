from fastapi import APIRouter, HTTPException
import os
import asyncio
from app.services.ai import extract_metadata, compare_extractions

router = APIRouter(prefix="/compare", tags=["compare"])

@router.get("/")
async def compare_files():
    contract_path = os.path.join(os.getcwd(), 'contract2.pdf')
    annex_path = os.path.join(os.getcwd(), 'annex.pdf')
    invoice_path = os.path.join(os.getcwd(), 'invoice2.pdf')

    if not os.path.exists(contract_path) or not os.path.exists(invoice_path):
        raise HTTPException(status_code=404, detail="contract2.pdf or invoice2.pdf not found in root directory.")

    try:
        inputs_contract = [contract_path]
        if os.path.exists(annex_path):
            inputs_contract.append(annex_path)

        contract_data, invoice_data = await asyncio.gather(
            extract_metadata(inputs_contract, 'contract'),
            extract_metadata(invoice_path, 'invoice')
        )

        result = compare_extractions(contract_data, invoice_data)
        return result

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error: {str(error)}")
