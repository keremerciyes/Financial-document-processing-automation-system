// src/routes/contracts.ts
import { Elysia, t } from 'elysia';
import { extractMetadata } from '../services/ai';
import { assignCompartment } from '../services/fuzzyMatch';
import { qbo } from '../services/qbo';

export const contractsRoutes = new Elysia({ prefix: '/contracts' })
    .post('/upload', async ({ body }) => {
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
        console.log("Extracting metadata...");
        const metadata = await extractMetadata(input, 'contract');
        console.log("Metadata:", metadata);

        // 2. Compartment Assignment
        const matchResult = assignCompartment(
            metadata.compartmentHint,
            metadata.vendorName,
            metadata.serviceType
        );
        console.log("Compartment Match:", matchResult);

        // 3. Create Accrual
        const accrual = qbo.createAccrual(
            metadata.vendorName,
            metadata.amount,
            matchResult.compartment.id
        );

        return {
            success: true,
            contract: {
                ...metadata,
                compartmentId: matchResult.compartment.id,
                compartmentName: matchResult.compartment.name,
                matchStrategy: matchResult.strategy
            },
            accrual
        };
    }, {
        body: t.Object({
            file: t.Optional(t.File()),
            text: t.Optional(t.String())
        })
    });
