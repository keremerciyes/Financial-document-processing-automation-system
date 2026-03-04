import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.routers.contracts import router as contracts_router
from app.routers.invoices import router as invoices_router
from app.routers.reversal import router as reversal_router
from app.routers.compare import router as compare_router
from app.routers.documents import router as documents_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contracts_router)
app.include_router(invoices_router)
app.include_router(reversal_router)
app.include_router(compare_router)
app.include_router(documents_router)

# Mount public directory for static assets
app.mount("/assets", StaticFiles(directory="public/assets"), name="assets")

@app.get("/")
async def root():
    return FileResponse("public/index.html")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
