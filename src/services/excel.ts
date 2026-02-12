// src/services/excel.ts
import * as XLSX from 'xlsx';

export interface LiabilityEntry {
    vendorName: string;
    description: string;
    amount: number;
    currency: string;
    date?: string;
}

export function parseLiabilities(fileBuffer: Buffer): LiabilityEntry[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    console.log('[Excel] Sheetnames:', workbook.SheetNames);
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    console.log('[Excel] Data Rows:', data.length);
    if (data.length > 0) console.log('[Excel] Sample Row:', data[0]);

    const liabilities: LiabilityEntry[] = [];

    // Simple parsing logic (assuming standard format or just searching for rows with numbers)
    // In a real app, successful parsing depends on strict template knowledge.
    // Here we'll look for rows that look like liabilities.

    // Generic parsing: Return everything that has a number in it for now
    for (const row of data) {
        const rowStr = JSON.stringify(row).toLowerCase();

        let amount = 0;
        let foundNumber = false;

        for (const cell of row) {
            if (typeof cell === 'number' && cell > 0) {
                amount = cell;
                foundNumber = true;
                break; // Take first number
            }
        }

        if (foundNumber) {
            liabilities.push({
                vendorName: rowStr.includes('boundless') ? "Boundless Sarl" : "Unknown",
                description: rowStr,
                amount: amount,
                currency: "EUR"
            });
        }
    }

    return liabilities;
}

export interface JournalEntryLine {
    account: string;
    debit: number;
    credit: number;
    description: string;
    name: string;
    class: string;
}

export function parseJournalEntries(fileBuffer: Buffer): JournalEntryLine[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    // Use header:1 to get raw arrays
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (data.length < 2) return [];

    // Identify columns based on header row (row 0)
    const header = data[0].map(h => String(h).toLowerCase());
    const accountIdx = header.findIndex(h => h.includes('account'));
    const debitIdx = header.findIndex(h => h.includes('debit'));
    const creditIdx = header.findIndex(h => h.includes('credit'));
    const descIdx = header.findIndex(h => h.includes('desc')); // description
    const nameIdx = header.findIndex(h => h.includes('name'));
    const classIdx = header.findIndex(h => h.includes('class'));

    const entries: JournalEntryLine[] = [];

    // Start from row 1
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const account = accountIdx !== -1 ? String(row[accountIdx] || '') : '';
        const debit = debitIdx !== -1 ? Number(row[debitIdx]) || 0 : 0;
        const credit = creditIdx !== -1 ? Number(row[creditIdx]) || 0 : 0;
        const description = descIdx !== -1 ? String(row[descIdx] || '') : '';
        const name = nameIdx !== -1 ? String(row[nameIdx] || '') : '';
        const className = classIdx !== -1 ? String(row[classIdx] || '') : '';

        // Only add if it has some meaningful content
        if (account || debit > 0 || credit > 0 || description) {
            entries.push({
                account,
                debit,
                credit,
                description,
                name,
                class: className
            });
        }
    }

    return entries;
}
