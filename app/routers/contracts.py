from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.services.ai import extract_metadata
from app.services.fuzzyMatch import assign_compartment
from app.services.qbo import qbo

router = APIRouter(prefix="/contracts", tags=["contracts"])

@router.post("/upload")
async def upload_contract(
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

    print("[Contracts] Extracting metadata...")
    metadata = await extract_metadata(input_data, 'contract')
    print("[Contracts] Metadata:", metadata)

    match_result = assign_compartment(
        metadata.get('compartmentHint'),
        metadata.get('vendorName', ''),
        metadata.get('serviceType')
    )
    print(f"[Contracts] Compartment Match: {match_result.compartment.name}")

    accrual = qbo.create_accrual(
        metadata.get('vendorName', ''),
        float(metadata.get('amount', 0)),
        match_result.compartment.id
    )

    contract_data = {**metadata}
    contract_data['compartmentId'] = match_result.compartment.id
    contract_data['compartmentName'] = match_result.compartment.name
    contract_data['matchStrategy'] = match_result.strategy

    return {
        "success": True,
        "contract": contract_data,
        "accrual": {
            "id": accrual.id,
            "vendorName": accrual.vendor_name,
            "amount": accrual.amount,
            "compartmentId": accrual.compartment_id,
            "status": accrual.status
        }
    }
