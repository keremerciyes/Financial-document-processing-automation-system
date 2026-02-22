import { classifyDocument } from './classification';
import type { DocumentClassification, RouteTo } from './classification';
import { extractDocumentData } from './extraction';
import type { ExtractionResult, OperationalExpense, CapitalCall, LoanAgreementDrawdown, EquityAcquisitionSpa, SubscriptionAgreement, ContractAnnex } from './extraction';
import { parsePdf } from './ai';

// --- Types for Processor Result ---

export interface ProcessResult {
    classification: DocumentClassification;
    extraction: ExtractionResult;
    validationErrors: string[];
    routeTo: RouteTo | "HUMAN_REVIEW" | "ACCOUNTING_AP_REVIEW" | "INVESTMENT_OPS_REVIEW" | "TREASURY_REVIEW";
    proposal?: any; // The payment/action proposal
}

// --- Mock Database / Registry Helpers (Placeholders) ---

async function resolveVendor(name: string, vatId?: string) {
    // In real app: lookup vendor in DB by name/VAT
    return { id: "vendor_123", name: name, defaultCurrency: "EUR" };
}

async function findBestContract(vendorId: string, serviceType: string, compartment?: string, currency?: string) {
    // In real app: lookup active contract
    // Mocking finding a contract for simplicity
    return {
        id: "contract_abc",
        vendorId,
        serviceType,
        feeModel: "FIXED",
        amount: 1000,
        currency: "EUR",
        autoApprove: false,
        tolerancePct: 0.05
    };
}

async function getCommitment(investor: string, fund: string, compartment?: string) {
    return {
        id: "commit_xyz",
        investor,
        fund,
        totalCommitment: 1000000,
        calledToDate: 200000,
        remainingUncalled: 800000
    };
}

async function getFacility(lender: string, compartment?: string, borrower?: string) {
    return {
        id: "fac_789",
        lender,
        borrower,
        facilityLimit: 5000000,
        drawnToDate: 1000000,
        currency: "EUR"
    };
}

// --- Processing Logic ---

export async function processDocument(fileInput: Buffer | string | (Buffer | string)[]): Promise<ProcessResult> {

    // 0. Extract Text
    const docText = await parsePdf(fileInput);

    // 1. Classify
    const cls = await classifyDocument(docText);
    if (!cls.primaryClass) {
        return {
            classification: cls,
            extraction: {} as any,
            validationErrors: ["Could not classify document"],
            routeTo: "HUMAN_REVIEW"
        };
    }

    // 2. Extract Schema
    let payload: any = {};
    if (cls.primaryClass !== "OTHER") {
        console.log(`[Processor] Class: ${cls.primaryClass}, extracting schema...`);
        payload = await extractDocumentData(docText, cls.primaryClass);
    } else {
        console.log(`[Processor] Class is OTHER, skipping extraction.`);
    }

    // 2.5 Compartment Check
    if (!cls.compartmentName && cls.primaryClass !== "REPORTING_ONLY" && cls.primaryClass !== "OTHER" && !cls.isUmbrellaContract) {
        return route("WAITING_FOR_COMPARTMENT", payload, cls, ["Missing compartment info; please select compartment"]);
    }

    // 3. Route & Match based on Class
    switch (cls.primaryClass) {
        case "OPERATIONAL_EXPENSE":
            return handleOperationalExpense(payload as OperationalExpense, cls);
        case "CAPITAL_CALL":
            return handleCapitalCall(payload as CapitalCall, cls);
        case "LOAN_AGREEMENT_DRAWDOWN":
            return handleDrawdown(payload as LoanAgreementDrawdown, cls);
        case "EQUITY_ACQUISITION_SPA":
            return handleSPA(payload as EquityAcquisitionSpa, cls);
        case "SUBSCRIPTION_AGREEMENT":
            return handleSubscriptionAgreement(payload as SubscriptionAgreement, cls);
        case "CONTRACT_ANNEX":
            return handleAnnex(payload as ContractAnnex, cls);
        case "LOAN_AGREEMENT":
        case "SIDE_LETTER":
        case "NOTE_ISSUANCE_FINAL_TERMS":
        case "REPORTING_ONLY":
            return handleNonApPaymentDocs(payload, cls);
        case "OTHER":
        default:
            return route("HUMAN_REVIEW", payload, cls, ["Class is OTHER or Unknown"]);
    }
}

// --- Handlers ---

function route(
    target: ProcessResult['routeTo'],
    payload: ExtractionResult,
    cls: DocumentClassification,
    errors: string[] = [],
    proposal?: any
): ProcessResult {
    return {
        classification: cls,
        extraction: payload,
        validationErrors: errors,
        routeTo: target,
        proposal
    };
}

async function handleOperationalExpense(p: OperationalExpense, cls: DocumentClassification): Promise<ProcessResult> {
    const vendor = await resolveVendor(p.vendor.legalName, p.vendor.vatId);
    if (!vendor) return route("ACCOUNTING_AP_REVIEW", p, cls, ["Vendor not found"]);

    const contract = await findBestContract(
        vendor.id,
        p.service.serviceType,
        p.service.compartmentName,
        p.billing.currency
    );

    if (!contract) {
        return route("ACCOUNTING_AP_REVIEW", p, cls, ["No contract match found"]);
    }

    // Amount Logic with tolerances (FX, wire fees, rounding)
    const matchingConfig = {
        tolerancePct: contract.tolerancePct || 0.05,
        wireFeeMaxAmount: 50,
        roundingDiffMax: 1.00,
        maxFxDifference: 0 // Mock placeholder for actual FX diff calculation
    };

    const invAmount = p.billing.grossAmount || p.billing.netAmount || 0;
    const diff = Math.abs(invAmount - contract.amount);

    // Configurable tolerance threshold calculation
    const baseAllowedDiff = contract.amount * matchingConfig.tolerancePct;
    const totalAllowedDiff = baseAllowedDiff + matchingConfig.wireFeeMaxAmount + matchingConfig.roundingDiffMax + matchingConfig.maxFxDifference;

    if (diff > totalAllowedDiff) {
        return route("ACCOUNTING_AP_REVIEW", p, cls, [`Amount mismatch: Invoice ${invAmount} vs Contract ${contract.amount}. Allowed diff including FX/wire/rounding: ${totalAllowedDiff.toFixed(2)}`]);
    }

    // Builder Payment Proposal
    const proposal: any = {
        type: "PAYMENT",
        payeeVendorId: vendor.id,
        iban: p.payment.iban,
        amount: invAmount,
        currency: p.billing.currency,
        dueDate: p.payment.dueDate,
        matchedContractId: contract.id,
        autoApprove: contract.autoApprove
    };

    if (p.service.includedInBoundlessAdminFee) {
        proposal.receivable = {
            fromEntity: "Boundless",
            amount: invAmount,
            currency: p.billing.currency,
            notes: "Year-end reconciliation adjustment for Admin Fee"
        };
    }

    return route("ACCOUNTING_AP", p, cls, [], proposal);
}

async function handleCapitalCall(p: CapitalCall, cls: DocumentClassification): Promise<ProcessResult> {
    const commitment = await getCommitment(
        p.investor.investorName,
        p.fund.fundName,
        p.investor.compartmentName
    );

    if (!commitment) return route("INVESTMENT_OPS_REVIEW", p, cls, ["No commitment found"]);

    const totalDue = p.call.totalAmountDue || p.call.contributionAmount || 0;

    if (totalDue > commitment.remainingUncalled * 1.001) { // 0.1% tolerance
        return route("INVESTMENT_OPS_REVIEW", p, cls, ["Call exceeds remaining uncalled capital"]);
    }

    // Mock wire check
    if (!p.wireInstructions.accountNumber && !p.wireInstructions.swift) {
        return route("INVESTMENT_OPS_REVIEW", p, cls, ["Missing wire instructions"]);
    }

    const proposal = {
        type: "CAPITAL_CALL_PAYMENT",
        amount: totalDue,
        currency: p.call.currency,
        beneficiary: p.wireInstructions.beneficiary,
        dueDate: p.call.dueDate
    };

    return route("INVESTMENT_OPS", p, cls, [], proposal);
}

async function handleDrawdown(p: LoanAgreementDrawdown, cls: DocumentClassification): Promise<ProcessResult> {

    const facility = await getFacility(p.lender.vehicleEntity, p.lender.compartmentName, p.borrower.legalName);
    if (!facility) return route("TREASURY_REVIEW", p, cls, ["No facility found"]);

    const amt = p.drawdown.amount || 0;
    const currentDrawn = p.drawdown.principalDrawnToDate || facility.drawnToDate;

    if (facility.facilityLimit && (currentDrawn + amt > facility.facilityLimit * 1.001)) {
        return route("TREASURY_REVIEW", p, cls, ["Drawdown exceeds facility limit"]);
    }

    const proposal = {
        type: "LOAN_DRAWDOWN",
        amount: amt,
        currency: p.facility.currency,
        beneficiary: p.paymentAccount.beneficiaryName,
        iban: p.paymentAccount.iban
    };

    return route("TREASURY", p, cls, [], proposal);
}

async function handleSPA(p: EquityAcquisitionSpa, cls: DocumentClassification): Promise<ProcessResult> {
    if (p.spaType === "TRANCHE_FLEXIBLE") {
        return route("LEGAL", p, cls, ["Tranche / Flexible Purchase: MONITOR_CAPITAL_REQUIRED"]);
    } else {
        const proposal = {
            type: "SPA_FIXED_PURCHASE_PAYMENT",
            amount: p.target.price,
            currency: p.target.currency,
            beneficiary: p.paymentTerms.beneficiary,
            iban: p.paymentTerms.iban
        };
        // Creating AP immediately -> Route to ACCOUNTING_AP for booking
        return route("ACCOUNTING_AP", p, cls, ["Fixed Purchase: Create AP immediately"], proposal);
    }
}

async function handleSubscriptionAgreement(p: SubscriptionAgreement, cls: DocumentClassification): Promise<ProcessResult> {
    if (p.fundOrVehicle.fundStructure === "OPEN_END") {
        return route("ACCOUNTING_AP", p, cls, ["Open-End Fund: Do not create full commitment payable. Create fixed asset entry per subscription"]);
    } else if (p.fundOrVehicle.fundStructure === "CLOSED_END") {
        const proposal = {
            type: "SUBSCRIPTION_COMMITMENT_PAYABLE",
            amount: p.subscription.subscriptionAmount,
            currency: p.subscription.currency
        };
        return route("ACCOUNTING_AP", p, cls, ["Closed-End Fund: Create payable for full commitment"], proposal);
    } else {
        return route("LEGAL", p, cls, ["Subscription Agreement: Fund structure unknown. Requires offering docs"]);
    }
}

async function handleAnnex(p: ContractAnnex, cls: DocumentClassification): Promise<ProcessResult> {
    const vendor = await resolveVendor(p.providerOrCounterparty);
    if (!vendor) return route("LEGAL", p, cls, ["Annex: Vendor/Provider not found"]);

    // Find best contract ("ANY" service type for mock)
    const contract = await findBestContract(vendor.id, "ANY");
    if (!contract) return route("LEGAL", p, cls, ["Annex: Match to existing contract failed"]);

    const actions = [`Attached annex to contract ${contract.id}`, "Incremented contract version"];

    if (p.modifiesEconomicTerms) {
        actions.push("Economic terms modified: triggered re-evaluation of accounting entries");
        actions.push("QBO entries update flagged");
    }

    return route("LEGAL", p, cls, actions);
}

async function handleNonApPaymentDocs(p: ExtractionResult, cls: DocumentClassification): Promise<ProcessResult> {
    if (cls.primaryClass === "LOAN_AGREEMENT") {
        return route("TREASURY", p, cls, ["New Loan Agreement - Setup Required"]);
    }
    if (cls.primaryClass === "NOTE_ISSUANCE_FINAL_TERMS") {
        return route("COMPLIANCE", p, cls, ["Registry updated; no payment"]);
    }
    if (cls.primaryClass === "SIDE_LETTER") {
        return route("LEGAL", p, cls, ["Overrides recorded"]);
    }

    return route("NO_ACTION", p, cls, ["Archived"]);
}
