import { extractMetadata, compareExtractions } from '../services/ai';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

async function main() {
    const contractPath = join(process.cwd(), 'contract2.pdf');
    const annexPath = join(process.cwd(), 'annex.pdf');
    const invoicePath = join(process.cwd(), 'invoice2.pdf');

    if (!existsSync(contractPath) || !existsSync(invoicePath)) {
        console.error("Error: contract2.pdf or invoice2.pdf not found in root directory.");
        process.exit(1);
    }

    try {
        console.log("Reading files...");
        const contractBuffer = readFileSync(contractPath);
        const annexBuffer = existsSync(annexPath) ? readFileSync(annexPath) : Buffer.from([]);
        const invoiceBuffer = readFileSync(invoicePath);

        console.log("Extracting from Contract (contract2 + annex)...");
        // Pass array of buffers for contract + annex
        const contractData = await extractMetadata([contractBuffer, annexBuffer], 'contract');
        console.log("Contract Data:", JSON.stringify(contractData, null, 2));

        console.log("Extracting from Invoice (invoice2)...");
        const invoiceData = await extractMetadata(invoiceBuffer, 'invoice');
        console.log("Invoice Data:", JSON.stringify(invoiceData, null, 2));

        console.log("Comparing...");
        const result = compareExtractions(contractData, invoiceData);

        console.log("\n--- Comparison Result ---");
        console.log(`Match: ${result.match ? "✅ YES" : "❌ NO"}`);
        if (!result.match) {
            console.log("Differences:");
            result.differences.forEach(diff => console.log(` - ${diff}`));
        } else {
            console.log("All critical fields match.");
        }

    } catch (error) {
        console.error("Error during comparison:", error);
    }
}

main();
