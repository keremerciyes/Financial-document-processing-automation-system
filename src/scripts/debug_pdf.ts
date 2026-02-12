
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function main() {
    const invoicePath = join(process.cwd(), 'Invoice.pdf');
    if (!existsSync(invoicePath)) {
        console.error("Invoice.pdf not found");
        return;
    }
    const buffer = readFileSync(invoicePath);
    console.log("Buffer length:", buffer.length);

    try {
        // @ts-ignore
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        console.log("--- Extracted Text Start ---");
        console.log(result.text);
        console.log("--- Extracted Text End ---");
    } catch (e) {
        console.error("Error parsing PDF:", e);
    }
}
main();
