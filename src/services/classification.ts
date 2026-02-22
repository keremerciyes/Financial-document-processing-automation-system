import { chatCompletion } from './ai';

export type PrimaryClass =
    | 'OPERATIONAL_EXPENSE'
    | 'CAPITAL_CALL'
    | 'SUBSCRIPTION_AGREEMENT'
    | 'SIDE_LETTER'
    | 'LOAN_AGREEMENT'
    | 'LOAN_AGREEMENT_DRAWDOWN'
    | 'NOTE_ISSUANCE_FINAL_TERMS'
    | 'EQUITY_ACQUISITION_SPA'
    | 'CONTRACT_ANNEX'
    | 'REPORTING_ONLY'
    | 'OTHER';

export type RouteTo = 'ACCOUNTING_AP' | 'INVESTMENT_OPS' | 'TREASURY' | 'LEGAL' | 'COMPLIANCE' | 'NO_ACTION' | 'WAITING_FOR_COMPARTMENT';

export interface DocumentClassification {
    primaryClass: PrimaryClass;
    vehicleEntity: string | null;
    compartmentName: string | null;
    counterpartyName: string | null;
    documentDate: string | null;
    documentId: string | null;
    paymentRelevant: boolean;
    isUmbrellaContract: boolean;
    routeTo: RouteTo;
    confidence: number;
    reasons: string[];
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are a document classification engine for a securitisation + fund operations workflow.
Your job is to classify the document into ONE primary class and return STRICT JSON only.
Do not hallucinate. If a field is not present, use null. If you are unsure, set confidence low and add reasons.

PRIMARY_CLASS (choose exactly one):
- OPERATIONAL_EXPENSE          (service contracts + invoices: audit, domiciliation, SaaS, advisory, management fees)
- CAPITAL_CALL                 (capital call notice to fund/GP; contribution due; commitment tracking)
- SUBSCRIPTION_AGREEMENT       (LP subscription agreement / commitment agreement; admission into fund/vehicle)
- SIDE_LETTER                  (fee override / economic terms modifying LPA/subscription)
- LOAN_AGREEMENT               (credit facility / loan agreement schedules; structural only)
- LOAN_AGREEMENT_DRAWDOWN      (drawdown request / utilization request linking to existing loan agreement)
- NOTE_ISSUANCE_FINAL_TERMS    (final terms / series / tranche / notes issuance under programme; ISIN)
- EQUITY_ACQUISITION_SPA       (share purchase agreement / term extension for SPAs)
- CONTRACT_ANNEX               (annex, addendum or amendment to an existing contract modifying terms)
- REPORTING_ONLY               (capital account statements, statements, purely informational reports)
- OTHER

Also output:
- VEHICLE_ENTITY (e.g., “Boundless S.à r.l.”, “H-Securitisation S.C.S.p”, “H-Securitisation S.A.”) if mentioned
- COMPARTMENT_NAME (if explicitly stated, e.g., “SaluberMD”, “Retina”, “Keo World”, etc.)
- COUNTERPARTY_NAME (vendor / fund / borrower / issuer counterparty) if clearly stated
- DOCUMENT_DATE (ISO yyyy-mm-dd if possible)
- DOCUMENT_ID (invoice number / notice ref / docusign envelope / agreement ref if present)
- PAYMENT_RELEVANT (true if this document triggers a cash payment instruction; else false)
- IS_UMBRELLA_CONTRACT (true if contract applies to entire vehicle/all compartments; else false)
- ROUTE_TO (one of: ACCOUNTING_AP, INVESTMENT_OPS, TREASURY, LEGAL, COMPLIANCE, NO_ACTION)
- CONFIDENCE (0.0–1.0)
- REASONS (array of short strings citing the keywords/clauses you used)

Return STRICT valid JSON only with this schema:
{
  "primaryClass": "",
  "vehicleEntity": "",
  "compartmentName": "",
  "counterpartyName": "",
  "documentDate": "",
  "documentId": "",
  "paymentRelevant": false, // boolean
  "isUmbrellaContract": false, // boolean
  "routeTo": "",
  "confidence": 0.0, // number
  "reasons": [] // string[]
}`;

export async function classifyDocument(text: string): Promise<DocumentClassification> {
    console.log(`[Classification] Classifying text of length ${text.length}...`);
    return await chatCompletion(text, CLASSIFICATION_SYSTEM_PROMPT, true);
}
