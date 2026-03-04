# Yooro Financial AI Processor

## Project Overview
Yooro is an AI-powered financial document processing system. The core of the system is designed to take raw financial documents (PDFs), parse the text, classify the document into specific accounting categories, and extract structured metadata using Large Language Models.

The project employs a structured workflow to handle various types of financial contracts and documents, including:
- Operational Expenses
- Invoices
- Capital Calls
- Loan Agreements
- SPA Agreements
- Loan Agreement Drawdowns
- Subscription Agreements
- Contract Annexes
- Final Terms
- Side Letters

## What We've Done So Far
We have built out the document processing logic and implemented several utility scripts to test, debug, and run the classification engine against a large dataset of real-world financial documents.

### Classification Engine & Workflow
The core logic resides in `src/services/` (`processor.ts`, `classification.ts`, `extraction.ts`). When a document is processed, it goes through the following pipeline:
1. **Text Extraction**: Reads the PDF buffer and extracts raw text.
2. **Classification**: Uses the LLM to identify the document type (e.g., `OPERATIONAL_EXPENSE`, `CAPITAL_CALL`).
3. **Structured Extraction**: Extracts domain-specific fields depending on the class (e.g., extracting vendor VAT, service type, and amounts for an invoice).
4. **Routing & Validation**: Runs deterministic business logic (e.g., matching invoices to contracts, checking capital calls against commitments) to propose a workflow route (e.g., `ACCOUNTING_AP`, `TREASURY`, `INVESTMENT_OPS`).

### Script Files (`src/scripts/`)
We have created a suite of scripts to interact with the processor:

- **`classify-dataset.ts`**
  The main bulk-processing script. It recursively scans the `Yooro_dataset/` directory for all PDF files, processes them through the classification engine, and copies the files into a new `yooro_contracts_by_class/` directory, organizing them into subfolders based on their assigned AI document class.

- **`test-real-data.ts`**
  A reporting tool to test extraction accuracy. It runs the processor against specific folders in the dataset, aggregates the extraction results, and prints a specialized report per document class (e.g., showing Buyer/Seller for SPAs, or Vendor/Amount for Invoices).

- **`manual-classify.ts`**
  An interactive testing script. It uses an AppleScript GUI file picker to let the user select a single PDF from their local machine. It then runs the processor on that file and prints the full Classification and Extraction JSON payloads to the terminal.

- **`compare.ts`**
  A validation script that demonstrates multi-document context. It reads a base contract and an annex together, extracts the combined metadata, and compares it against an isolated invoice's metadata to verify if the critical fields match.

- **`debug_pdf.ts`**
  A low-level debugging utility that tests the `pdf-parse` library against a local `Invoice.pdf` to ensure raw text extraction is working correctly before the LLM gets involved.

## Running the Scripts
This project currently uses TypeScript. You can run any of the scripts using `npx tsx` or `bun`:

```bash
# Example: Run the bulk classification
npx tsx src/scripts/classify-dataset.ts

# Example: Run the interactive manual classifier
npx tsx src/scripts/manual-classify.ts
```

*(Note: The project is transitioning into a broader ecosystem including a FastAPI backend for routing, as defined in `app/routers/`.) These matches below are not applied in this project. Fastapi is not applied. Class JSONs are not updated.

SERVICE_CONTRACT ↔ INVOICE
LOAN_AGREEMENT ↔ DRAWDOWN
INVESTMENT_AGREEMENT ↔ CAPITAL_CALL
*
