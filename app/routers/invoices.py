from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.services.ai import extract_metadata
from app.services.fuzzyMatch import assign_compartment
from app.services.qbo import qbo

router = APIRouter(prefix="/invoices", tags=["invoices"])

@router.post("/ingest")
async def ingest_invoice(
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

    metadata = await extract_metadata(input_data, 'invoice')

    match_result = assign_compartment(
        metadata.get('compartmentHint'),
        metadata.get('vendorName', ''),
        None
    )

    invoice_data = {**metadata}
    invoice_data['compartmentId'] = match_result.compartment.id
    invoice_data['compartmentName'] = match_result.compartment.name

    return {
        "success": True,
        "invoice": invoice_data
    }

class ValidateRequest(BaseModel):
    vendorName: str
    amount: float

@router.post("/validate")
async def validate_invoice(req: ValidateRequest):
    accrual = qbo.find_matching_accrual(req.vendorName, req.amount)

    if accrual:
        return {
            "status": "VALIDATED",
            "accrualId": accrual.id,
            "message": "Matching accrual found."
        }
    else:
        return {
            "status": "MISMATCH",
            "message": "No matching accrual found within tolerance."
        }

class PayInvoiceModel(BaseModel):
    vendorName: str
    amount: float

class PayRequest(BaseModel):
    invoice: PayInvoiceModel
    accrualId: str

@router.post("/pay")
async def pay_invoice(req: PayRequest):
    bill = qbo.create_bill(req.invoice.vendorName, req.invoice.amount)
    qbo.pay_bill(bill.id)
    reversed_accrual = qbo.reverse_accrual(req.accrualId)

    # find bill locally to return matching status
    for b in qbo.bills:
        if b.id == bill.id:
            bill_status = b.status
            break
    else:
        bill_status = "PENDING"

    return {
        "success": True,
        "bill": {
            "id": bill.id,
            "vendorName": bill.vendor_name,
            "amount": bill.amount,
            "status": bill_status
        },
        "accrualReversed": reversed_accrual
    }
