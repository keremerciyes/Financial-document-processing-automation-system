// src/index.ts
import { Elysia } from "elysia";
import path from "path";
import { staticPlugin } from '@elysiajs/static';
import { contractsRoutes } from "./routes/contracts";
import { invoicesRoutes } from "./routes/invoices";
import { reversalRoutes } from "./routes/reversal";
import { compareRoutes } from "./routes/compare";
import { documentsRoutes } from "./routes/documents";

const app = new Elysia()
    .use(staticPlugin({ assets: path.join(import.meta.dir, "../public") }))
    .get("/", () => Bun.file(path.join(import.meta.dir, "../public/index.html")))
    .use(contractsRoutes)
    .use(invoicesRoutes)
    .use(reversalRoutes)
    .use(compareRoutes)
    .use(documentsRoutes)
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);