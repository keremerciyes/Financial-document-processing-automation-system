import { Elysia } from 'elysia';
import { extractMetadata, compareExtractions } from '../services/ai';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

export const compareRoutes = new Elysia({ prefix: '/compare' })
    .get('/', async () => {
        const contractPath = join(process.cwd(), 'contract2.pdf');
        const annexPath = join(process.cwd(), 'annex.pdf');
        const invoicePath = join(process.cwd(), 'invoice2.pdf');

        if (!existsSync(contractPath) || !existsSync(invoicePath)) {
            return new Response("contract2.pdf or invoice2.pdf not found in root directory.", { status: 404 });
        }

        try {
            const contractBuffer = readFileSync(contractPath);
            const annexBuffer = existsSync(annexPath) ? readFileSync(annexPath) : Buffer.from([]);
            const invoiceBuffer = readFileSync(invoicePath);

            const [contractData, invoiceData] = await Promise.all([
                extractMetadata([contractBuffer, annexBuffer], 'contract'),
                extractMetadata(invoiceBuffer, 'invoice')
            ]);

            const result = compareExtractions(contractData, invoiceData);

            return result;

        } catch (error: any) {
            return new Response(`Error: ${error.message}`, { status: 500 });
        }
    });
