// src/routes/invoices.ts
import { Elysia, t } from 'elysia';
import { extractMetadata } from '../services/ai';
import { assignCompartment } from '../services/fuzzyMatch';
import { qbo } from '../services/qbo';

export const invoicesRoutes = new Elysia({ prefix: '/invoices' })
    .post('/ingest', async ({ body }) => {
        const { file, text } = body as { file?: Blob, text?: string };

        let input: Buffer | string = "";
        if (file && file instanceof Blob) {
            input = Buffer.from(await file.arrayBuffer());
        } else if (text) {
            input = text;
        } else {
            throw new Error("No file or text provided");
        }

        // 1. AI Extraction
        const metadata = await extractMetadata(input, 'invoice');

        // 2. Compartment Assignment (Include line items check if needed, for now using same logic)
        // Note: In a real scenario, we'd iterate line items. Here we pass undefined for serviceType
        const matchResult = assignCompartment(
            metadata.compartmentHint,
            metadata.vendorName,
            undefined
        );

        return {
            success: true,
            invoice: {
                ...metadata,
                compartmentId: matchResult.compartment.id,
                compartmentName: matchResult.compartment.name
            }
        };
    }, {
        body: t.Object({
            file: t.Optional(t.File()),
            text: t.Optional(t.String())
        })
    })

    .post('/validate', ({ body }) => {
        const { vendorName, amount } = body;

        const accrual = qbo.findMatchingAccrual(vendorName, amount);

        if (accrual) {
            return {
                status: 'VALIDATED',
                accrualId: accrual.id,
                message: 'Matching accrual found.'
            };
        } else {
            return {
                status: 'MISMATCH',
                message: 'No matching accrual found within tolerance.'
            };
        }
    }, {
        body: t.Object({
            vendorName: t.String(),
            amount: t.Numeric()
        })
    })

    .post('/pay', ({ body }) => {
        const { invoice, accrualId } = body;

        // 1. Create Bill
        const bill = qbo.createBill(invoice.vendorName, invoice.amount);

        // 2. Pay Bill (Mock)
        qbo.payBill(bill.id);

        // 3. Reverse Accrual
        const reversed = qbo.reverseAccrual(accrualId);

        return {
            success: true,
            bill: { ...bill, status: 'PAID' },
            accrualReversed: reversed
        };
    }, {
        body: t.Object({
            invoice: t.Object({
                vendorName: t.String(),
                amount: t.Numeric()
            }),
            accrualId: t.String()
        })
    });
