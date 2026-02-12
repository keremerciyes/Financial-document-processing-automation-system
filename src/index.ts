// src/index.ts
import { Elysia } from "elysia";
import { staticPlugin } from '@elysiajs/static';
import { contractsRoutes } from "./routes/contracts";
import { invoicesRoutes } from "./routes/invoices";
import { reversalRoutes } from "./routes/reversal";
import { compareRoutes } from "./routes/compare";

const app = new Elysia()
    .use(staticPlugin())
    .get("/", () => Bun.file("public/index.html"))
    .use(contractsRoutes)
    .use(invoicesRoutes)
    .use(reversalRoutes)
    .use(compareRoutes)
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);