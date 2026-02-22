import { processDocument } from '../services/processor';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_DIR = '/Users/mustafasoydan/Desktop/Yooro/Yooro_dataset/DATA_DUMP_ORIGINAL';
const FOLDERS = ['Boundless Sarl', 'H-Securitisation SCSp'];

async function runRealDataTest() {
    console.log("Starting Real Data Extraction Test...");
    console.log("=====================================");

    const resultsByClass: Record<string, any[]> = {};
    let totalFiles = 0;

    for (const folder of FOLDERS) {
        const folderPath = join(BASE_DIR, folder);
        try {
            const files = await readdir(folderPath);
            const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

            for (const file of pdfFiles) {
                totalFiles++;
                const filePath = join(folderPath, file);
                console.log(`Processing [${totalFiles}]: ${file}`);

                try {
                    const result = await processDocument(filePath);
                    const cls = result.classification.primaryClass;

                    if (!resultsByClass[cls]) {
                        resultsByClass[cls] = [];
                    }

                    resultsByClass[cls].push({
                        file,
                        confidence: result.classification.confidence,
                        extraction: result.extraction
                    });

                } catch (err: any) {
                    console.error(`  ERROR: ${err.message}`);
                }
            }
        } catch (e: any) {
            console.error(`Error reading folder ${folder}: ${e.message}`);
        }
    }

    console.log("\n\n=========================================");
    console.log("       EXTRACTION REPORT BY CLASS        ");
    console.log("=========================================");

    for (const cls of Object.keys(resultsByClass).sort()) {
        const classResults = resultsByClass[cls] || [];
        console.log(`\n### CLASS: ${cls} (${classResults.length} docs)`);

        classResults.forEach((item: any) => {
            const ext = item.extraction;
            console.log(`\n  📄 File: ${item.file} (Conf: ${item.confidence})`);

            if (cls === 'OPERATIONAL_EXPENSE') {
                console.log(`     - Vendor: ${ext.vendor?.legalName}`);
                console.log(`     - Service: ${ext.service?.serviceType} (${ext.service?.description?.substring(0, 50)}...)`);
                console.log(`     - Amount: ${ext.billing?.grossAmount} ${ext.billing?.currency}`);
                console.log(`     - Type: ${ext.docSubtype}`);
            } else if (cls === 'CAPITAL_CALL') {
                console.log(`     - Fund: ${ext.fund?.fundName}`);
                console.log(`     - Investor: ${ext.investor?.investorName} (${ext.investor?.compartmentName})`);
                console.log(`     - Amount: ${ext.call?.totalAmountDue} ${ext.call?.currency}`);
                console.log(`     - Due Date: ${ext.call?.dueDate}`);
            } else if (cls === 'SUBSCRIPTION_AGREEMENT') {
                console.log(`     - Investor: ${ext.applicantInvestor?.name}`);
                console.log(`     - Fund/Vehicle: ${ext.fundOrVehicle?.name}`);
                console.log(`     - Sub Amount: ${ext.subscription?.subscriptionAmount} ${ext.subscription?.currency}`);
                console.log(`     - Date: ${ext.subscription?.agreementDate}`);
            } else if (cls === 'LOAN_AGREEMENT_OR_DRAWDOWN') {
                console.log(`     - Subtype: ${ext.docSubtype}`);
                console.log(`     - Lender: ${ext.lender?.vehicleEntity} (Comp: ${ext.lender?.compartmentName})`);
                console.log(`     - Borrower: ${ext.borrower?.legalName}`);
                console.log(`     - Amount: ${ext.drawdown?.amount || ext.facility?.facilityLimit} ${ext.facility?.currency}`);
            } else if (cls === 'EQUITY_ACQUISITION_SPA') {
                console.log(`     - Buyer: ${ext.buyer?.vehicleEntity}`);
                console.log(`     - Seller: ${ext.seller?.name}`);
                console.log(`     - Target: ${ext.target?.companyName}`);
                console.log(`     - Price: ${ext.target?.price} ${ext.target?.currency}`);
            } else if (cls === 'SIDE_LETTER') {
                console.log(`     - Investor: ${ext.parties?.investor}`);
                console.log(`     - Economics: SubFee=${ext.economicsOverride?.subscriptionFeePct}%, MgmtFee=${ext.economicsOverride?.managementFeePct}%`);
            } else if (cls === 'NOTE_ISSUANCE_FINAL_TERMS') {
                console.log(`     - Programme: ${ext.programme?.name}`);
                console.log(`     - Series/Tranche: ${ext.issuance?.series} / ${ext.issuance?.tranche}`);
                console.log(`     - ISIN: ${ext.issuance?.isin}`);
            } else {
                console.log(`     - Data: ${JSON.stringify(ext).substring(0, 100)}...`);
            }
        });
    }
}

runRealDataTest().catch(console.error);
