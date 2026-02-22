import { processDocument } from '../services/processor';
import * as fs from 'fs';
import * as path from 'path';

const DATASET_DIR = path.resolve(process.cwd(), 'Yooro_dataset');
const OUTPUT_DIR = path.resolve(process.cwd(), 'yooro_contracts_by_class');

// Function to recursively find all PDF files
function findPdfs(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (file === '.DS_Store') continue;

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findPdfs(filePath, fileList);
        } else if (file.toLowerCase().endsWith('.pdf')) {
            fileList.push(filePath);
        }
    }

    return fileList;
}

async function main() {
    console.log(`Starting classification process...`);
    console.log(`Searching for PDFs in: ${DATASET_DIR}`);

    if (!fs.existsSync(DATASET_DIR)) {
        console.error(`Dataset directory not found: ${DATASET_DIR}`);
        return;
    }

    const pdfFiles = findPdfs(DATASET_DIR);
    console.log(`Found ${pdfFiles.length} PDF files to process.\n`);

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created output directory: ${OUTPUT_DIR}`);
    }

    let successCount = 0;
    let failCount = 0;

    for (const file of pdfFiles) {
        console.log(`--------------------------------------------------`);
        console.log(`Processing file: ${path.basename(file)}`);

        try {
            const result = await processDocument(file);
            const primaryClass = result.classification.primaryClass || 'UNKNOWN';

            console.log(`Classification result: ${primaryClass}`);

            // Create class folder inside output directory
            const classDir = path.join(OUTPUT_DIR, primaryClass);
            if (!fs.existsSync(classDir)) {
                fs.mkdirSync(classDir, { recursive: true });
            }

            // Handle filename collisions if processing multiple files with same name
            let fileName = path.basename(file);
            let targetPath = path.join(classDir, fileName);
            let index = 1;
            while (fs.existsSync(targetPath)) {
                const ext = path.extname(fileName);
                const name = path.basename(fileName, ext);
                targetPath = path.join(classDir, `${name}_${index}${ext}`);
                index++;
            }

            // Copy file to target path
            fs.copyFileSync(file, targetPath);
            console.log(`Copied to: ${classDir}/${path.basename(targetPath)}`);

            successCount++;
        } catch (error: any) {
            console.error(`Failed to process ${file}:`, error.message);
            failCount++;

            // Copy failed files to an 'ERROR' folder to look up later
            const errDir = path.join(OUTPUT_DIR, 'ERROR');
            if (!fs.existsSync(errDir)) {
                fs.mkdirSync(errDir, { recursive: true });
            }
            fs.copyFileSync(file, path.join(errDir, path.basename(file)));
        }
    }

    console.log(`\n==================================================`);
    console.log(`Total files found:      ${pdfFiles.length}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Failed to process:      ${failCount}`);
    console.log(`==================================================`);
}

main().catch(console.error);
