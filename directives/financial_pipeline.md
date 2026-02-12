# Directive: Financial Pipeline Automation

## Goal
Automate the processing of contracts and invoices to streamline financial workflows.
- Match Invoices to Contracts.
- Assign Compartments (Business Units) using AI and Fuzzy Matching.
- Manage Accounting Entries in QuickBooks Online (QBO) - Mocked for now.
- Trigger Payments and Reverse Accruals.

## Inputs
- **Contracts**: PDF, Image, or Raw Text.
- **Invoices**: PDF, Image, or Raw Text.

## System Components
- **Backend**: Elysia.js (Bun)
- **AI**: GPT-4o (Vision & Text)
- **Matching**: Levenshtein Distance (Fuzzy Matching)
- **Accounting**: QBO Mock Service

---

## Workflow 1: Contract Processing
**Trigger**: `POST /contracts/upload`

1.  **Ingestion**
    -   Accept multipart/form-data or text.
    -   Convert files to Buffer.

2.  **AI Extraction**
    -   **Tool**: `execution/extract_metadata.ts` (Proposed)
    -   **Model**: GPT-4o
    -   **Extract**: `vendorName`, `serviceType`, `startDate`, `endDate`, `amount`, `currency`, `paymentTerms`, `compartmentHint`.

3.  **Compartment Assignment**
    -   **Tool**: `execution/assign_compartment.ts` (Proposed)
    -   **Strategy**:
        1.  LLM Hint Match (60%)
        2.  Vendor Name Match (50%)
        3.  Service Type Match (60%)
        4.  Default Fallback

4.  **Accrual Creation**
    -   **Tool**: `execution/qbo_service.ts` (Proposed)
    -   **Action**: Create "Accrual" entry in QBO (Status: OPEN).

---

## Workflow 2: Invoice Processing
**Trigger**: `POST /invoices/ingest`

1.  **Ingestion**
    -   Accept multipart/form-data or text.

2.  **AI Extraction**
    -   **Tool**: `execution/extract_metadata.ts`
    -   **Extract**: `vendorName`, `invoiceNumber`, `date`, `dueDate`, `totalAmount`, `lineItems`, `compartmentHint`.

3.  **Compartment Assignment**
    -   **Tool**: `execution/assign_compartment.ts`
    -   **Strategy**: Same as Contract + Line Item Search.

4.  **Validation**
    -   **Action**: Find matching Accrual (Vendor Match + Amount within 5% tolerance).
    -   **Result**: `VALIDATED` or `MISMATCH`.

5.  **Payment Processing** (If Validated)
    -   **Trigger**: `POST /invoices/pay`
    -   **Action 1**: Create Bill in QBO.
    -   **Action 2**: Execute Payment (Mock Bank API or Manual Flag).

6.  **Accrual Reversal**
    -   **Action**: Reverse the original Accrual in QBO (Status: REVERSED).

---

## Data Structures

### Compartment
```typescript
{
    id: string;
    name: string; // e.g., "KrediYA Bond Compartment"
    code: string; // e.g., "KY-01"
}
```

### Accrual
```typescript
{
    id: string;
    vendorName: string;
    amount: number;
    compartmentId: string;
    status: 'OPEN' | 'REVERSED';
}
```

### Bill
```typescript
{
    id: string;
    vendorName: string;
    amount: number;
    status: 'PENDING' | 'PAID';
}
```
