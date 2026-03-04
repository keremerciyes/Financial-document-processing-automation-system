from .ai import chat_completion
from typing import Any, Dict

SCHEMAS = {
    "OPERATIONAL_EXPENSE": """
    {
      "class": "OPERATIONAL_EXPENSE",
      "docSubtype": "INVOICE|CONTRACT|STATEMENT",
      "vendor": { "legalName": "", "vatId": "", "address": "" },
      "customer": { "legalName": "", "entityType": "Boundless|H-Securitisation_SA|H-Securitisation_SCSp|Other", "address": "" },
      "contractRef": { "contractTitle": "", "contractDate": "", "effectiveDate": "", "term": "", "renewal": "" },
      "service": { "serviceType": "AUDIT|DOMICILIATION|SaaS|ADVISORY|MANAGEMENT|REPORTING|OTHER", "description": "", "isCompartmentRelated": false, "compartmentName": "", "feeBasis": "FIXED_MONTHLY|FIXED_ANNUAL|PER_COMPARTMENT|USAGE_BASED|TIERED_VOLUME|OTHER", "includedInBoundlessAdminFee": false },
      "billing": { "invoiceNumber": "", "invoiceDate": "", "periodStart": "", "periodEnd": "", "currency": "", "netAmount": null, "vatAmount": null, "grossAmount": null, "lineItems": [ { "description": "", "quantity": null, "unitPrice": null, "amount": null, "compartmentName": "" } ] },
      "payment": { "dueDate": "", "beneficiaryName": "", "iban": "", "bicSwift": "", "bankName": "", "paymentReference": "", "paymentMethod": "WIRE|SEPA|CARD|UNKNOWN" },
      "matchingHints": { "keywords": [], "expectedRecurrence": "MONTHLY|ANNUAL|AD_HOC|UNKNOWN", "tolerancePct": 0.0 },
      "confidence": 0.0,
      "notes": ""
    }""",

    "CAPITAL_CALL": """
    {
      "class": "CAPITAL_CALL",
      "fund": { "fundName": "", "generalPartner": "", "platform": "Carta|Other|Unknown" },
      "investor": { "investorName": "", "vehicleEntity": "H-Securitisation_SA|H-Securitisation_SCSp|Boundless|Other", "compartmentName": "" },
      "call": { "noticeDate": "", "dueDate": "", "callNumber": "", "purpose": "", "currency": "", "contributionAmount": null, "interestOrFeesAmount": null, "totalAmountDue": null },
      "commitment": { "commitmentAmount": null, "calledCapitalPostCall": null, "remainingUncalledPostCall": null },
      "wireInstructions": { "beneficiary": "", "bankName": "", "bankAddress": "", "routingOrAba": "", "accountNumber": "", "swift": "", "reference": "", "specialInstructions": "" },
      "controls": { "requiresManualApproval": true, "approvalRoute": "INVESTMENT_OPS", "validationChecks": [ "commitment_exists", "remaining_uncalled_sufficient", "wire_instructions_verified", "due_date_in_future" ] },
      "confidence": 0.0,
      "notes": ""
    }""",

    "SUBSCRIPTION_AGREEMENT": """
    {
      "class": "SUBSCRIPTION_AGREEMENT",
      "fundOrVehicle": { "name": "", "type": "SCSp|Fund|Other", "fundStructure": "CLOSED_END|OPEN_END|UNKNOWN", "lpaDate": "", "gpName": "" },
      "applicantInvestor": { "name": "", "entity": "H-Securitisation_SCSp|H-Securitisation_SA|Boundless|Other", "representedBy": "", "address": "" },
      "subscription": { "agreementDate": "", "seriesOrClass": "", "subscriptionAmount": null, "currency": "", "fundingMechanism": "CAPITAL_CALLS|UPFRONT|UNKNOWN", "kycRequired": true },
      "economics": { "subscriptionFeePct": null, "managementFeePct": null, "carryPct": null, "sideLetterExists": false },
      "controls": { "noImmediatePayment": true, "requiresOfferingDocuments": true, "routeTo": "LEGAL", "linkedDocs": [] },
      "confidence": 0.0,
      "notes": ""
    }""",

    "SIDE_LETTER": """
    {
      "class": "SIDE_LETTER",
      "parties": { "fundOrPartnership": "", "gp": "", "investor": "" },
      "linkedAgreement": { "subscriptionAgreementRef": "", "lpaRef": "", "effectiveDate": "" },
      "economicsOverride": { "subscriptionFeePct": null, "managementFeePct": null, "carryPct": null, "otherFees": [ { "name": "", "basis": "", "value": null, "currency": "" } ], "priorityOfDocuments": "SIDE_LETTER_PREVAILS|UNKNOWN" },
      "controls": { "routeTo": "LEGAL", "affectsFuturePayments": true },
      "confidence": 0.0,
      "notes": ""
    }""",

    "LOAN_AGREEMENT": """
    {
      "class": "LOAN_AGREEMENT",
      "lender": { "entity": "", "vehicleEntity": "", "compartmentName": "" },
      "borrower": { "legalName": "", "country": "" },
      "facility": { "facilityType": "FIXED_RATE|PIK|OTHER", "facilityLimit": null, "currency": "", "agreementDate": "", "rateOrMargin": "", "maturity": "" },
      "controls": { "routeTo": "TREASURY", "structuralOnly": true, "requiresManualApproval": true, "validationChecks": [ "signatures_present" ] },
      "confidence": 0.0,
      "notes": ""
    }""",

    "LOAN_AGREEMENT_DRAWDOWN": """
    {
      "class": "LOAN_AGREEMENT_DRAWDOWN",
      "lender": { "entity": "", "vehicleEntity": "", "compartmentName": "" },
      "borrower": { "legalName": "", "country": "" },
      "facility": { "currency": "" },
      "drawdown": { "drawdownNumber": "", "drawdownDate": "", "amount": null, "principalDrawnToDate": null },
      "paymentAccount": { "beneficiaryName": "", "iban": "", "bicSwift": "", "bankName": "", "paymentReference": "" },
      "controls": { "routeTo": "TREASURY", "requiresLimitCheck": true, "requiresManualApproval": true, "validationChecks": [ "facility_exists", "amount_plus_drawn_to_date_leq_limit", "compartment_mapping_valid", "signatures_present" ] },
      "confidence": 0.0,
      "notes": ""
    }""",

    "NOTE_ISSUANCE_FINAL_TERMS": """
    {
        "class": "NOTE_ISSUANCE_FINAL_TERMS",
        "issuer": { "name": "", "lei": "" },
        "programme": { "name": "", "type": "Asset-Based Notes Programme|Other" },
        "issuance": { "finalTermsDate": "", "compartmentName": "", "series": "", "tranche": "", "isin": "", "maxNotes": null, "currency": "", "issueSize": null },
        "controls": { "routeTo": "COMPLIANCE", "noPayment": true, "registryUpdateOnly": true },
        "confidence": 0.0,
        "notes": ""
    }""",

    "EQUITY_ACQUISITION_SPA": """
    {
      "class": "EQUITY_ACQUISITION_SPA",
      "docSubtype": "SPA|TERM_EXTENSION|AMENDMENT",
      "spaType": "FIXED_PURCHASE|TRANCHE_FLEXIBLE|UNKNOWN",
      "buyer": { "name": "", "vehicleEntity": "", "compartmentName": "" },
      "seller": { "name": "" },
      "target": { "companyName": "", "sharesOrUnits": "", "price": null, "currency": "" },
      "dates": { "signingDate": "", "closingDate": "" },
      "paymentTerms": { "paymentDueDate": "", "beneficiary": "", "iban": "", "swift": "", "reference": "" },
      "controls": { "routeTo": "LEGAL", "requiresManualApproval": true },
      "confidence": 0.0,
      "notes": ""
    }""",

    "CONTRACT_ANNEX": """
    {
      "class": "CONTRACT_ANNEX",
      "providerOrCounterparty": "",
      "parentContractHint": "",
      "modifiesEconomicTerms": false,
      "newAmount": null,
      "currency": "",
      "effectiveDate": "",
      "versionIncrement": true,
      "confidence": 0.0,
      "notes": ""
    }""",

    "REPORTING_ONLY": """
    {
      "class": "REPORTING_ONLY",
      "docSubtype": "CAPITAL_ACCOUNT_STATEMENT|STATEMENT|REPORT|OTHER",
      "entity": { "vehicleEntity": "", "compartmentName": "" },
      "period": { "start": "", "end": "" },
      "metrics": [ { "name": "", "value": null, "currency": "" } ],
      "controls": { "routeTo": "NO_ACTION", "noPayment": true },
      "confidence": 0.0,
      "notes": ""
    }"""
}

async def extract_document_data(text: str, primary_class: str) -> Dict[str, Any]:
    schema = SCHEMAS.get(primary_class)
    if not schema:
        raise ValueError(f"No schema defined for class: {primary_class}")

    prompt = f"""You are a specialized data extractor.
    Extract data from the following document text according to the JSON schema below.
    Return STRICT valid JSON only.
    
    TARGET CLASS: {primary_class}
    
    SCHEMA:
    {schema}
    
    DOCUMENT TEXT:
    {text}"""

    return await chat_completion(text, prompt, True)
