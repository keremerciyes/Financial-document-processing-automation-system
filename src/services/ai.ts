// src/services/ai.ts
import OpenAI from 'openai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const apiKey = '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'
const { PDFParse } = require('pdf-parse');

const fs = require('fs');
const path = require('path');
const { writeFile, unlink } = fs.promises;
const { tmpdir } = require('os');
const { join } = require('path');

const openai = new OpenAI({
    apiKey: apiKey,
});

export interface ExtractedData {
    vendorName: string;
    serviceType: string;
    startDate: string;
    endDate: string;
    amount: number;
    currency: string;
    paymentTerms: string;
    compartmentHint: string;
    // Optional fields if needed for internal logic, but user requested the above specifically
    invoiceNumber?: string;
    date?: string;
    dueDate?: string;
    lineItems?: { description: string; amount: number }[];
}

export async function parsePdf(fileInput: Buffer | string | (Buffer | string)[]): Promise<string> {
    const files = Array.isArray(fileInput) ? fileInput : [fileInput];
    let extractedText = "";

    // 1. Try Local PDF Parsing
    for (const file of files) {
        try {
            if (Buffer.isBuffer(file)) {
                // @ts-ignore
                const parser = new PDFParse({ data: file });
                const result = await parser.getText();
                extractedText += "\n" + result.text.trim();
            } else if (typeof file === 'string' && fs.existsSync(file)) {
                const buffer = await fs.promises.readFile(file);
                // @ts-ignore
                const parser = new PDFParse({ data: buffer });
                const result = await parser.getText();
                extractedText += "\n" + result.text.trim();
            } else if (typeof file === 'string') {
                extractedText += "\n" + file;
            }
        } catch (e) {
            console.log(`[AI] Local PDF parse failed for a file, continuing...`);
        }
    }
    return extractedText;
}

export async function chatCompletion(text: string, systemPrompt: string, jsonMode: boolean = true): Promise<any> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            response_format: jsonMode ? { type: "json_object" } : undefined
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No content from AI");
        return jsonMode ? JSON.parse(content) : content;
    } catch (e) {
        console.error("[AI] Chat Completion Error:", e);
        throw e;
    }
}

// Keeping the original function for backward compatibility, but refactored to use helper
export async function extractMetadata(
    fileInput: Buffer | string | (Buffer | string)[],
    fileType: 'contract' | 'invoice'
): Promise<ExtractedData> {

    const prompt = `Extract the following fields from the ${fileType} (which may consist of multiple files, e.g. Contract + Annex) and return strictly valid JSON:
    {
        "vendorName": "",
        "serviceType": "",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "amount": 0,
        "currency": "EUR/USD",
        "paymentTerms": "",
        "compartmentHint": ""
    }
    For invoices, map 'totalAmount' to 'amount' and 'invoiceDate' to 'startDate'.
    For contracts, look for 'Fees', 'Remuneration', 'Price', 'Cost'. If 'estimated', use that value.
    If a field is not found, leave it empty or 0.
    Do NOT include comments (like // ...) in the JSON.
    Return ONLY the JSON.`;

    let extractedText = await parsePdf(fileInput);

    // 2. If Text Found -> Use Chat Completion
    if (extractedText.length > 50) {
        console.log(`[AI] Using Chat Completion (Combined Text extracted locally: ${extractedText.length} chars)`);
        return await chatCompletion(extractedText, prompt);
    }

    // 3. Fallback: Assistants API (Files/Vision/OCR)
    console.log(`[AI] Text insufficient. Using Assistants API (File Upload) for ${fileType}...`);
    // ... (Keep existing Assistants API logic or refactor similarly if needed)
    // For now, I'll keep the rest of the logic as is for the fallback, but wrap it in the function.
    // Ideally, we move the fallback logic to a separate helper too.

    // Fallback logic implementation (inline for now as it relies on file handling)
    const files = Array.isArray(fileInput) ? fileInput : [fileInput];
    const tempFilePaths: string[] = [];
    const fileIds: string[] = [];

    try {
        // Upload all files
        for (const fileItem of files) {
            const tempFilePath = join(tmpdir(), `${fileType}_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`);
            tempFilePaths.push(tempFilePath);

            if (Buffer.isBuffer(fileItem)) {
                await writeFile(tempFilePath, fileItem);
            } else if (typeof fileItem === 'string' && fs.existsSync(fileItem)) {
                await fs.promises.copyFile(fileItem, tempFilePath);
            } else {
                continue; // Skip invalid inputs
            }

            const uploadedFile = await openai.files.create({
                file: fs.createReadStream(tempFilePath),
                purpose: "assistants",
            });
            fileIds.push(uploadedFile.id);
        }

        if (fileIds.length === 0) throw new Error("No valid files to process.");

        const assistant = await openai.beta.assistants.create({
            name: "PDF Extractor Fallback",
            instructions: "You are a data extraction expert. The user has uploaded one or more files (likely scanned). Use your tools (File Search or Code Interpreter) to read the contents of ALL files thoroughly. Merge information if needed (e.g. Contract + Annex).",
            tools: [{ type: "file_search" }, { type: "code_interpreter" }],
            model: "gpt-5.2",
        });

        const attachments = fileIds.map(id => ({ file_id: id, tools: [{ type: "file_search" as const }, { type: "code_interpreter" as const }] }));

        const thread = await openai.beta.threads.create({
            messages: [
                {
                    role: "user",
                    content: `${prompt}\n\nPlease perform deep reading of all attached files.`,
                    attachments: attachments
                }
            ]
        });

        const run = await openai.beta.threads.runs.createAndPoll(
            thread.id,
            { assistant_id: assistant.id }
        );

        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(run.thread_id);
            const messageContent = messages.data[0]?.content[0];
            let text = "";
            if (messageContent && messageContent.type === 'text') {
                text = messageContent.text.value;
            }

            // Cleanup
            for (const fid of fileIds) {
                // @ts-ignore
                if (openai.files.del) await openai.files.del(fid);
                // @ts-ignore
                else if (openai.files.delete) await openai.files.delete(fid);
            }

            // @ts-ignore
            if (openai.beta.assistants.del) await openai.beta.assistants.del(assistant.id);
            // @ts-ignore
            else if (openai.beta.assistants.delete) await openai.beta.assistants.delete(assistant.id);

            for (const p of tempFilePaths) {
                if (fs.existsSync(p)) await unlink(p);
            }

            // Clean markdown code blocks and comments
            const cleanText = text
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .replace(/\s*\/\/.*$/gm, '');

            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as ExtractedData;
            } else {
                throw new Error("Invalid response from Assistant");
            }

        } else {
            throw new Error(`Assistant run failed: ${run.status}`);
        }
    } catch (error) {
        console.error("[AI] Fallback Extraction Error:", error);
        for (const p of tempFilePaths) {
            if (fs.existsSync(p)) await unlink(p).catch(() => { });
        }
        throw error;
    }
}

export interface ComparisonResult {
    match: boolean;
    differences: string[];
    contractAmount: number;
    invoiceAmount: number;
    contractCompartment: string;
    invoiceCompartment: string;
}

import { similarityScore } from './fuzzyMatch';

export interface MatchingConfig {
    tolerancePct?: number;
    maxFxDifference?: number;
    allowWireFee?: boolean;
    wireFeeMaxAmount?: number;
    roundingDiffMax?: number;
}

export function compareExtractions(
    contract: ExtractedData,
    invoice: ExtractedData,
    config: MatchingConfig = { tolerancePct: 0.05, allowWireFee: true, wireFeeMaxAmount: 50, roundingDiffMax: 1.00 }
): ComparisonResult {
    const differences: string[] = [];
    const VAT_RATE = 0.17; // 17%

    const tolerancePct = config.tolerancePct ?? 0.05;
    const wireMax = config.allowWireFee ? (config.wireFeeMaxAmount ?? 50) : 0;
    const roundMax = config.roundingDiffMax ?? 1.00;
    const fxMax = config.maxFxDifference ?? 0;

    // 1. Compare Amount
    // Check match with raw amount OR amount + VAT
    const amountDiff = Math.abs(contract.amount - invoice.amount);
    const amountWithVat = contract.amount * (1 + VAT_RATE);
    const amountVatDiff = Math.abs(amountWithVat - invoice.amount);

    const baseAllowedDiff = contract.amount * tolerancePct;
    const totalAllowedDiff = baseAllowedDiff + wireMax + roundMax + fxMax;
    const totalVatAllowedDiff = (amountWithVat * tolerancePct) + wireMax + roundMax + fxMax;

    const matchRaw = amountDiff <= totalAllowedDiff;
    const matchVat = amountVatDiff <= totalVatAllowedDiff;

    if (!matchRaw && !matchVat) {
        differences.push(
            `Amount mismatch: Contract(${contract.amount}) vs Invoice(${invoice.amount}). ` +
            `(Checked incl. 17% VAT: ${amountWithVat.toFixed(2)}, allowed diff: ${totalVatAllowedDiff.toFixed(2)})`
        );
    }

    // 2. Compare Compartment
    const cComp = (contract.compartmentHint || "").trim();
    const iComp = (invoice.compartmentHint || "").trim();

    // Exact or inclusion match
    let compartmentMatch =
        cComp.toLowerCase() === iComp.toLowerCase() ||
        cComp.toLowerCase().includes(iComp.toLowerCase()) ||
        iComp.toLowerCase().includes(cComp.toLowerCase());

    // Fuzzy match if not exact
    if (!compartmentMatch && cComp && iComp) {
        const score = similarityScore(cComp, iComp);
        if (score > 0.8) {
            compartmentMatch = true;
            console.log(`[AI] Fuzzy Match Success: '${cComp}' ~ '${iComp}' (Score: ${score.toFixed(2)})`);
        }
    }

    if (!compartmentMatch) {
        differences.push(`Compartment mismatch: Contract('${contract.compartmentHint}') vs Invoice('${invoice.compartmentHint}')`);
    }

    return {
        match: (matchRaw || matchVat) && compartmentMatch,
        differences,
        contractAmount: contract.amount,
        invoiceAmount: invoice.amount,
        contractCompartment: contract.compartmentHint,
        invoiceCompartment: invoice.compartmentHint
    };
}
