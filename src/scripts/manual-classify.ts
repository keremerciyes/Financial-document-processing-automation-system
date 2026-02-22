import { processDocument } from '../services/processor';
import { spawn } from 'child_process';

async function selectFile(): Promise<string | null> {
    return new Promise((resolve, reject) => {
        // Applescript to open a file picker
        const applescript = `
        set selectedFile to choose file with prompt "Select a contract PDF:" of type {"pdf"}
        POSIX path of selectedFile
        `;

        const process = spawn('osascript', ['-e', applescript]);
        let result = '';
        let error = '';

        process.stdout.on('data', (data) => {
            result += data.toString();
        });

        process.stderr.on('data', (data) => {
            error += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0 && result.trim()) {
                resolve(result.trim());
            } else {
                if (error.includes("User canceled")) {
                    resolve(null);
                } else {
                    // Start debugging
                    // console.error("AppleScript error:", error); 
                    // reject(new Error(error || 'File selection failed'));
                    resolve(null);
                }
            }
        });
    });
}

async function main() {
    console.log("Opening file picker...");
    const filePath = await selectFile();

    if (!filePath) {
        console.log("No file selected or operation canceled.");
        return;
    }

    console.log(`\nSelected File: ${filePath}`);
    console.log("Processing and local logical classification...\n");

    try {
        const result = await processDocument(filePath);

        console.log("--------------------------------------------------");
        console.log("           CLASSIFICATION RESULT                  ");
        console.log("--------------------------------------------------");
        console.log(`Primary Class:   \x1b[36m${result.classification.primaryClass}\x1b[0m`); // Cyan
        console.log(`Confidence:      ${result.classification.confidence}`);
        console.log(`Vehicle:         ${result.classification.vehicleEntity || 'N/A'}`);
        console.log(`Compartment:     ${result.classification.compartmentName || 'N/A'}`);
        console.log(`Counterparty:    ${result.classification.counterpartyName || 'N/A'}`);
        console.log(`Reasons:         ${result.classification.reasons.join('; ')}`);
        console.log("--------------------------------------------------");

        console.log("\nFull Classification JSON:");
        console.log(JSON.stringify(result.classification, null, 2));

        if (result.extraction && Object.keys(result.extraction).length > 0) {
            console.log("\n--------------------------------------------------");
            console.log("           EXTRACTION RESULT                      ");
            console.log("--------------------------------------------------");
            console.log(JSON.stringify(result.extraction, null, 2));
            console.log("--------------------------------------------------");
        } else {
            console.log("\nNo extraction data available (Class might be OTHER or extraction failed).");
        }

    } catch (error: any) {
        console.error("Error processing document:", error.message);
    }
}

main();
