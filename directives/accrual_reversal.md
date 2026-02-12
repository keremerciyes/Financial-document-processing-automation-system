# Directive: Accrual Reversal Loop

## Goal
Automate the verification of the Accrual Reversal Loop by matching Contracts (Rules), History (XLS), and Invoices (Trigger) key, and validating against a manual Reversal File.

## Inputs
1.  **Rules** (Contracts):
    -   `Files`: Multiple Final Terms PDFs (e.g., Rebel Fund II, KEO WORLD).
    -   `Purpose`: Source of truth for fee calculations and splits.
2.  **History** (Excel):
    -   `File`: Accrued liabilities XLS.
    -   `Purpose`: Memory of booked liabilities.
3.  **Trigger** (Invoice):
    -   `File`: Invoice PDF (Boundless Sarl).
    -   `Purpose`: Event forcing transaction.
4.  **Verification** (Answer Key):
    -   `File`: Reversal Accrued liabilities (Manual File).
    -   `Purpose`: Validation of generated logic.

## Workflow & Expected Outputs

### 1. LEARN (Contracts)
-   **Action**: Ingest multiple Final Terms PDFs.
-   **Output**: "Rule extracted: Mgt Fee = [Amount/Rule], split by [Class]." (JSON).
-   **Success**: Identifies fee is an accrual and split logic.

### 2. REMEMBER (History)
-   **Action**: Scan Excel for open accruals.
-   **Output**: "Open Debt Found: [Amount] dated [Date]."
-   **Success**: Extracts specific amount and date.

### 3. ACT (Invoice)
-   **Action**: Process Invoice and Match to History.
-   **Output**:
    -   Match Confirmation: "MATCH FOUND".
    -   Action Plan:
        1.  Create Bill (Debit Expense / Credit AP).
        2.  Create Reversal Entry (Debit Liability / Credit Expense).

### 4. CHECK (Verification)
-   **Action**: Compare generated Reversal against Manual File.
-   **Output**: "Validation Report" (Pass/Fail).
-   **Success**: Calculated reversal matches manual file exactly.
