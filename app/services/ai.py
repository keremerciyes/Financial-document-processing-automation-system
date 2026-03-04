import os
import json
import asyncio
from typing import Union, List, Any, Dict
from pypdf import PdfReader
from io import BytesIO
import tempfile
import time

from openai import AsyncOpenAI
from .fuzzyMatch import similarity_score

api_key = 'ENTER_API_KEY_HERE'
openai = AsyncOpenAI(api_key=api_key)

async def parse_pdf(file_input: Union[bytes, str, List[Union[bytes, str]]]) -> str:
    files = file_input if isinstance(file_input, list) else [file_input]
    extracted_text = ""

    for f in files:
        try:
            if isinstance(f, bytes):
                reader = PdfReader(BytesIO(f))
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += "\n" + text.strip()
            elif isinstance(f, str) and os.path.exists(f):
                reader = PdfReader(f)
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += "\n" + text.strip()
            elif isinstance(f, str):
                extracted_text += "\n" + f
        except Exception as e:
            print(f"[AI] Local PDF parse failed for a file, continuing... {e}")
            
    return extracted_text

async def chat_completion(text: str, system_prompt: str, json_mode: bool = True) -> Any:
    try:
        kwargs = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
            
        response = await openai.chat.completions.create(
            model="gpt-4o",  # gpt-5.2 is unavailable normally, replace with an available fast model like gpt-4o or gpt-4o-mini
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            **kwargs
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("No content from AI")
            
        if json_mode:
            return json.loads(content)
        return content
    except Exception as e:
        print(f"[AI] Chat Completion Error: {e}")
        raise e

async def extract_metadata(file_input: Union[bytes, str, List[Union[bytes, str]]], file_type: str) -> Dict[str, Any]:
    prompt = f"""Extract the following fields from the {file_type} (which may consist of multiple files, e.g. Contract + Annex) and return strictly valid JSON:
    {{
        "vendorName": "",
        "serviceType": "",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "amount": 0,
        "currency": "EUR/USD",
        "paymentTerms": "",
        "compartmentHint": ""
    }}
    For invoices, map 'totalAmount' to 'amount' and 'invoiceDate' to 'startDate'.
    For contracts, look for 'Fees', 'Remuneration', 'Price', 'Cost'. If 'estimated', use that value.
    If a field is not found, leave it empty or 0.
    Do NOT include comments (like // ...) in the JSON.
    Return ONLY the JSON."""

    extracted_text = await parse_pdf(file_input)

    if len(extracted_text) > 50:
        print(f"[AI] Using Chat Completion (Combined Text extracted locally: {len(extracted_text)} chars)")
        return await chat_completion(extracted_text, prompt)

    print(f"[AI] Text insufficient. Using Assistants API (File Upload) for {file_type}...")
    files = file_input if isinstance(file_input, list) else [file_input]
    temp_file_paths = []
    file_ids = []

    try:
        for f in files:
            temp_path = tempfile.mktemp(suffix=".pdf")
            temp_file_paths.append(temp_path)
            if isinstance(f, bytes):
                with open(temp_path, "wb") as w:
                    w.write(f)
            elif isinstance(f, str) and os.path.exists(f):
                os.system(f"cp '{f}' '{temp_path}'")
            else:
                continue

            with open(temp_path, "rb") as file_obj:
                uploaded_file = await openai.files.create(
                    file=file_obj,
                    purpose="assistants",
                )
                file_ids.append(uploaded_file.id)

        if not file_ids:
            raise ValueError("No valid files to process.")

        assistant = await openai.beta.assistants.create(
            name="PDF Extractor Fallback",
            instructions="You are a data extraction expert. The user has uploaded one or more files (likely scanned). Use your tools (File Search or Code Interpreter) to read the contents of ALL files thoroughly. Merge information if needed (e.g. Contract + Annex).",
            tools=[{"type": "file_search"}, {"type": "code_interpreter"}],
            model="gpt-4o",
        )

        attachments = [{"file_id": id, "tools": [{"type": "file_search"}, {"type": "code_interpreter"}]} for id in file_ids]

        thread = await openai.beta.threads.create(
            messages=[
                {
                    "role": "user",
                    "content": f"{prompt}\n\nPlease perform deep reading of all attached files.",
                    "attachments": attachments
                }
            ]
        )

        run = await openai.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant.id
        )

        while run.status in ('queued', 'in_progress'):
            await asyncio.sleep(1)
            run = await openai.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

        if run.status == 'completed':
            messages = await openai.beta.threads.messages.list(thread_id=thread.id)
            message_content = messages.data[0].content[0]
            text = ""
            if message_content.type == 'text':
                text = message_content.text.value

            # Cleanup
            for fid in file_ids:
                try: 
                    await openai.files.delete(fid)
                except:
                    pass
            try:
                await openai.beta.assistants.delete(assistant.id)
            except:
                pass
            for p in temp_file_paths:
                if os.path.exists(p):
                    os.remove(p)

            clean_text = text.replace('```json', '').replace('```', '')
            # simple json extraction via regex mapping
            import re
            json_match = re.search(r'\{[\s\S]*\}', clean_text)
            if json_match:
                return json.loads(json_match.group(0))
            else:
                raise ValueError("Invalid response from Assistant")
        else:
            raise ValueError(f"Assistant run failed: {run.status}")

    except Exception as error:
        print(f"[AI] Fallback Extraction Error: {error}")
        for p in temp_file_paths:
            if os.path.exists(p):
                os.remove(p)
        raise error

def compare_extractions(contract: Dict[str, Any], invoice: Dict[str, Any], config: dict = None) -> Dict[str, Any]:
    if config is None:
        config = {'tolerancePct': 0.05, 'allowWireFee': True, 'wireFeeMaxAmount': 50, 'roundingDiffMax': 1.00}
    
    differences = []
    VAT_RATE = 0.17 # 17%

    tolerance_pct = config.get('tolerancePct', 0.05)
    wire_max = config.get('wireFeeMaxAmount', 50) if config.get('allowWireFee', True) else 0
    round_max = config.get('roundingDiffMax', 1.00)
    fx_max = config.get('maxFxDifference', 0)

    # 1. Compare Amount
    c_amount = float(contract.get('amount', 0) or 0)
    i_amount = float(invoice.get('amount', 0) or 0)

    amount_diff = abs(c_amount - i_amount)
    amount_with_vat = c_amount * (1 + VAT_RATE)
    amount_vat_diff = abs(amount_with_vat - i_amount)

    base_allowed_diff = c_amount * tolerance_pct
    total_allowed_diff = base_allowed_diff + wire_max + round_max + fx_max
    total_vat_allowed_diff = (amount_with_vat * tolerance_pct) + wire_max + round_max + fx_max

    match_raw = amount_diff <= total_allowed_diff
    match_vat = amount_vat_diff <= total_vat_allowed_diff

    if not match_raw and not match_vat:
        differences.append(
            f"Amount mismatch: Contract({c_amount}) vs Invoice({i_amount}). "
            f"(Checked incl. 17% VAT: {amount_with_vat:.2f}, allowed diff: {total_vat_allowed_diff:.2f})"
        )

    # 2. Compare Compartment
    c_comp = (contract.get('compartmentHint') or "").strip()
    i_comp = (invoice.get('compartmentHint') or "").strip()

    compartment_match = (
        c_comp.lower() == i_comp.lower() or
        c_comp.lower() in i_comp.lower() or
        i_comp.lower() in c_comp.lower()
    )

    if not compartment_match and c_comp and i_comp:
        score = similarity_score(c_comp, i_comp)
        if score > 0.8:
            compartment_match = True
            print(f"[AI] Fuzzy Match Success: '{c_comp}' ~ '{i_comp}' (Score: {score:.2f})")

    if not compartment_match:
        differences.append(f"Compartment mismatch: Contract('{c_comp}') vs Invoice('{i_comp}')")

    return {
        "match": (match_raw or match_vat) and compartment_match,
        "differences": differences,
        "contractAmount": c_amount,
        "invoiceAmount": i_amount,
        "contractCompartment": c_comp,
        "invoiceCompartment": i_comp
    }
