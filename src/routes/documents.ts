import { Elysia, t } from 'elysia';
import { processDocument } from '../services/processor';

export const documentsRoutes = new Elysia({ prefix: '/documents' })
    .post('/process', async ({ body, set }) => {
        const { file, text } = body as { file?: Blob, text?: string };

        let input: Buffer | string = "";

        try {
            if (file && file instanceof Blob) {
                input = Buffer.from(await file.arrayBuffer());
            } else if (text) {
                input = text;
            } else {
                set.status = 400;
                return { success: false, error: "No file or text provided" };
            }

            console.log("Processing document...");
            const result = await processDocument(input);
            console.log("Processing complete:", result.classification.primaryClass);

            return {
                success: true,
                data: result
            };

        } catch (error: any) {
            console.error("Error processing document:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Internal Server Error"
            };
        }
    }, {
        body: t.Object({
            file: t.Optional(t.File()),
            text: t.Optional(t.String())
        })
    });
