import asyncio
from typing import Dict, Any, List, Optional, Union
from .classification import classify_document, DocumentClassification
from .extraction import extract_document_data
from .ai import parse_pdf

# --- Types for Processor Result ---

class ProcessResult:
    def __init__(
        self,
        classification: DocumentClassification,
        extraction: Dict[str, Any],
        validationErrors: List[str],
        routeTo: str,
        proposal: Optional[Any] = None
    ):
        self.classification = classification
        self.extraction = extraction
        self.validationErrors = validationErrors
        self.routeTo = routeTo
        self.proposal = proposal

    def model_dump(self):
        return {
            "classification": self.classification.model_dump(),
            "extraction": self.extraction,
            "validationErrors": self.validationErrors,
            "routeTo": self.routeTo,
            "proposal": self.proposal
        }

# --- Mock Database / Registry Helpers (Placeholders) ---

async def resolve_vendor(name: str, vat_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    # In real app: lookup vendor in DB by name/VAT
    return {"id": "vendor_123", "name": name, "defaultCurrency": "EUR"}

async def find_best_contract(vendor_id: str, service_type: str, compartment: Optional[str] = None, currency: Optional[str] = None) -> Optional[Dict[str, Any]]:
    # Mocking finding a contract for simplicity
    return {
        "id": "contract_abc",
        "vendorId": vendor_id,
        "serviceType": service_type,
        "feeModel": "FIXED",
        "amount": 1000,
        "currency": "EUR",
        "autoApprove": False,
        "tolerancePct": 0.05
    }

async def get_commitment(investor: str, fund: str, compartment: Optional[str] = None) -> Optional[Dict[str, Any]]:
    return {
        "id": "commit_xyz",
        "investor": investor,
        "fund": fund,
        "totalCommitment": 1000000,
        "calledToDate": 200000,
        "remainingUncalled": 800000
    }

async def get_facility(lender: str, compartment: Optional[str] = None, borrower: Optional[str] = None) -> Optional[Dict[str, Any]]:
    return {
        "id": "fac_789",
        "lender": lender,
        "borrower": borrower,
        "facilityLimit": 5000000,
        "drawnToDate": 1000000,
        "currency": "EUR"
    }

# --- Processing Logic ---

async def process_document(file_input: Union[bytes, str, List[Union[bytes, str]]]) -> ProcessResult:
    # 0. Extract Text
    doc_text = await parse_pdf(file_input)

    # 1. Classify
    cls = await classify_document(doc_text)
    if not cls.primaryClass:
        return ProcessResult(
            classification=cls,
            extraction={},
            validationErrors=["Could not classify document"],
            routeTo="HUMAN_REVIEW"
        )

    # 2. Extract Schema
    payload = {}
    if cls.primaryClass != "OTHER":
        print(f"[Processor] Class: {cls.primaryClass}, extracting schema...")
        payload = await extract_document_data(doc_text, cls.primaryClass)
    else:
        print("[Processor] Class is OTHER, skipping extraction.")

    # 2.5 Compartment Check
    if not cls.compartmentName and cls.primaryClass != "REPORTING_ONLY" and cls.primaryClass != "OTHER" and not cls.isUmbrellaContract:
        return route("WAITING_FOR_COMPARTMENT", payload, cls, ["Missing compartment info; please select compartment"])

    # 3. Route & Match based on Class
    pc = cls.primaryClass
    if pc == "OPERATIONAL_EXPENSE":
        return await handle_operational_expense(payload, cls)
    elif pc == "CAPITAL_CALL":
        return await handle_capital_call(payload, cls)
    elif pc == "LOAN_AGREEMENT_DRAWDOWN":
        return await handle_drawdown(payload, cls)
    elif pc == "EQUITY_ACQUISITION_SPA":
        return await handle_spa(payload, cls)
    elif pc == "SUBSCRIPTION_AGREEMENT":
        return await handle_subscription_agreement(payload, cls)
    elif pc == "CONTRACT_ANNEX":
        return await handle_annex(payload, cls)
    elif pc in ["LOAN_AGREEMENT", "SIDE_LETTER", "NOTE_ISSUANCE_FINAL_TERMS", "REPORTING_ONLY"]:
        return await handle_non_ap_payment_docs(payload, cls)
    else:
        return route("HUMAN_REVIEW", payload, cls, ["Class is OTHER or Unknown"])

# --- Handlers ---

def route(target: str, payload: Dict[str, Any], cls: DocumentClassification, errors: List[str] = None, proposal: Any = None) -> ProcessResult:
    if errors is None:
        errors = []
    return ProcessResult(
        classification=cls,
        extraction=payload,
        validationErrors=errors,
        routeTo=target,
        proposal=proposal
    )

async def handle_operational_expense(p: Dict[str, Any], cls: DocumentClassification) -> ProcessResult:
    vendor_data = p.get('vendor', {})
    vendor = await resolve_vendor(vendor_data.get('legalName', ''), vendor_data.get('vatId'))
    if not vendor:
        return route("ACCOUNTING_AP_REVIEW", p, cls, ["Vendor not found"])

    service_data = p.get('service', {})
    billing_data = p.get('billing', {})
    contract = await find_best_contract(
        vendor['id'],
        service_data.get('serviceType', ''),
        service_data.get('compartmentName'),
        billing_data.get('currency')
    )

    if not contract:
        return route("ACCOUNTING_AP_REVIEW", p, cls, ["No contract match found"])

    # Amount Logic with tolerances (FX, wire fees, rounding)
    matching_config = {
        'tolerancePct': contract.get('tolerancePct', 0.05),
        'wireFeeMaxAmount': 50,
        'roundingDiffMax': 1.00,
        'maxFxDifference': 0
    }

    inv_amount = float(billing_data.get('grossAmount') or billing_data.get('netAmount') or 0)
    contract_amt = float(contract.get('amount', 0))
    diff = abs(inv_amount - contract_amt)

    base_allowed_diff = contract_amt * matching_config['tolerancePct']
    total_allowed_diff = base_allowed_diff + matching_config['wireFeeMaxAmount'] + matching_config['roundingDiffMax'] + matching_config['maxFxDifference']

    if diff > total_allowed_diff:
        return route("ACCOUNTING_AP_REVIEW", p, cls, [f"Amount mismatch: Invoice {inv_amount} vs Contract {contract_amt}. Allowed diff including FX/wire/rounding: {total_allowed_diff:.2f}"])

    payment_data = p.get('payment', {})
    proposal = {
        "type": "PAYMENT",
        "payeeVendorId": vendor['id'],
        "iban": payment_data.get('iban'),
        "amount": inv_amount,
        "currency": billing_data.get('currency'),
        "dueDate": payment_data.get('dueDate'),
        "matchedContractId": contract['id'],
        "autoApprove": contract.get('autoApprove', False)
    }

    if service_data.get('includedInBoundlessAdminFee'):
        proposal["receivable"] = {
            "fromEntity": "Boundless",
            "amount": inv_amount,
            "currency": billing_data.get('currency'),
            "notes": "Year-end reconciliation adjustment for Admin Fee"
        }

    return route("ACCOUNTING_AP", p, cls, [], proposal)

async def handle_capital_call(p: Dict[str, Any], cls: DocumentClassification) -> ProcessResult:
    investor_data = p.get('investor', {})
    fund_data = p.get('fund', {})
    commitment = await get_commitment(
        investor_data.get('investorName', ''),
        fund_data.get('fundName', ''),
        investor_data.get('compartmentName')
    )

    if not commitment:
        return route("INVESTMENT_OPS_REVIEW", p, cls, ["No commitment found"])

    call_data = p.get('call', {})
    total_due = float(call_data.get('totalAmountDue') or call_data.get('contributionAmount') or 0)

    remaining_uncalled = float(commitment.get('remainingUncalled', 0))
    if total_due > remaining_uncalled * 1.001:
        return route("INVESTMENT_OPS_REVIEW", p, cls, ["Call exceeds remaining uncalled capital"])

    wire_instr = p.get('wireInstructions', {})
    if not wire_instr.get('accountNumber') and not wire_instr.get('swift'):
        return route("INVESTMENT_OPS_REVIEW", p, cls, ["Missing wire instructions"])

    proposal = {
        "type": "CAPITAL_CALL_PAYMENT",
        "amount": total_due,
        "currency": call_data.get('currency'),
        "beneficiary": wire_instr.get('beneficiary'),
        "dueDate": call_data.get('dueDate')
    }

    return route("INVESTMENT_OPS", p, cls, [], proposal)

async def handle_drawdown(p: Dict[str, Any], cls: DocumentClassification) -> ProcessResult:
    lender_data = p.get('lender', {})
    borrower_data = p.get('borrower', {})
    facility = await get_facility(
        lender_data.get('vehicleEntity', ''),
        lender_data.get('compartmentName'),
        borrower_data.get('legalName')
    )
    if not facility:
        return route("TREASURY_REVIEW", p, cls, ["No facility found"])

    drawdown_data = p.get('drawdown', {})
    amt = float(drawdown_data.get('amount') or 0)
    current_drawn = float(drawdown_data.get('principalDrawnToDate') or facility.get('drawnToDate', 0))

    limit = facility.get('facilityLimit')
    if limit is not None and (current_drawn + amt > float(limit) * 1.001):
        return route("TREASURY_REVIEW", p, cls, ["Drawdown exceeds facility limit"])

    payment_acct = p.get('paymentAccount', {})
    facility_data = p.get('facility', {})
    proposal = {
        "type": "LOAN_DRAWDOWN",
        "amount": amt,
        "currency": facility_data.get('currency'),
        "beneficiary": payment_acct.get('beneficiaryName'),
        "iban": payment_acct.get('iban')
    }

    return route("TREASURY", p, cls, [], proposal)

async def handle_spa(p: Dict[str, Any], cls: DocumentClassification) -> ProcessResult:
    if p.get('spaType') == "TRANCHE_FLEXIBLE":
        return route("LEGAL", p, cls, ["Tranche / Flexible Purchase: MONITOR_CAPITAL_REQUIRED"])
    else:
        target_data = p.get('target', {})
        payment_terms = p.get('paymentTerms', {})
        proposal = {
            "type": "SPA_FIXED_PURCHASE_PAYMENT",
            "amount": target_data.get('price'),
            "currency": target_data.get('currency'),
            "beneficiary": payment_terms.get('beneficiary'),
            "iban": payment_terms.get('iban')
        }
        return route("ACCOUNTING_AP", p, cls, ["Fixed Purchase: Create AP immediately"], proposal)

async def handle_subscription_agreement(p: Dict[str, Any], cls: DocumentClassification) -> ProcessResult:
    fund_or_veh = p.get('fundOrVehicle', {})
    if fund_or_veh.get('fundStructure') == "OPEN_END":
        return route("ACCOUNTING_AP", p, cls, ["Open-End Fund: Do not create full commitment payable. Create fixed asset entry per subscription"])
    elif fund_or_veh.get('fundStructure') == "CLOSED_END":
        sub_data = p.get('subscription', {})
        proposal = {
            "type": "SUBSCRIPTION_COMMITMENT_PAYABLE",
            "amount": sub_data.get('subscriptionAmount'),
            "currency": sub_data.get('currency')
        }
        return route("ACCOUNTING_AP", p, cls, ["Closed-End Fund: Create payable for full commitment"], proposal)
    else:
        return route("LEGAL", p, cls, ["Subscription Agreement: Fund structure unknown. Requires offering docs"])

async def handle_annex(p: Dict[str, Any], cls: DocumentClassification) -> ProcessResult:
    vendor = await resolve_vendor(p.get('providerOrCounterparty', ''))
    if not vendor:
        return route("LEGAL", p, cls, ["Annex: Vendor/Provider not found"])

    contract = await find_best_contract(vendor['id'], "ANY")
    if not contract:
        return route("LEGAL", p, cls, ["Annex: Match to existing contract failed"])

    actions = [f"Attached annex to contract {contract['id']}", "Incremented contract version"]

    if p.get('modifiesEconomicTerms'):
        actions.append("Economic terms modified: triggered re-evaluation of accounting entries")
        actions.append("QBO entries update flagged")

    return route("LEGAL", p, cls, actions)

async def handle_non_ap_payment_docs(p: Dict[str, Any], cls: DocumentClassification) -> ProcessResult:
    pc = cls.primaryClass
    if pc == "LOAN_AGREEMENT":
        return route("TREASURY", p, cls, ["New Loan Agreement - Setup Required"])
    if pc == "NOTE_ISSUANCE_FINAL_TERMS":
        return route("COMPLIANCE", p, cls, ["Registry updated; no payment"])
    if pc == "SIDE_LETTER":
        return route("LEGAL", p, cls, ["Overrides recorded"])

    return route("NO_ACTION", p, cls, ["Archived"])
