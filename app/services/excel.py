import pandas as pd
from typing import List, Dict, Any
from io import BytesIO

class LiabilityEntry:
    def __init__(self, vendorName: str, description: str, amount: float, currency: str, date: str = None):
        self.vendorName = vendorName
        self.description = description
        self.amount = amount
        self.currency = currency
        self.date = date

def parse_liabilities(file_bytes: bytes) -> List[LiabilityEntry]:
    try:
        df_dict = pd.read_excel(BytesIO(file_bytes), sheet_name=None, header=None)
        sheet_name = list(df_dict.keys())[0] if df_dict else None
        if not sheet_name: return []

        print(f"[Excel] Sheetnames: {list(df_dict.keys())}")
        df = df_dict[sheet_name]
        data = df.values.tolist()
        
        print(f"[Excel] Data Rows: {len(data)}")
        if len(data) > 0:
            print(f"[Excel] Sample Row: {data[0]}")

        liabilities = []
        for row in data:
            row_clean = [x for x in row if pd.notna(x)]
            row_str = " ".join([str(x) for x in row_clean]).lower()
            
            amount = 0
            found_number = False
            for cell in row_clean:
                if isinstance(cell, (int, float)) and cell > 0:
                    amount = cell
                    found_number = True
                    break

            if found_number:
                vendor_name = "Boundless Sarl" if 'boundless' in row_str else "Unknown"
                liabilities.append(LiabilityEntry(
                    vendorName=vendor_name,
                    description=row_str,
                    amount=amount,
                    currency="EUR"
                ))
        return liabilities
    except Exception as e:
        print(f"[Excel] Error parsing liabilities: {e}")
        return []

class JournalEntryLine:
    def __init__(self, account: str, debit: float, credit: float, description: str, name: str, class_name: str):
        self.account = account
        self.debit = debit
        self.credit = credit
        self.description = description
        self.name = name
        self.class_name = class_name

def parse_journal_entries(file_bytes: bytes) -> List[JournalEntryLine]:
    try:
        df_dict = pd.read_excel(BytesIO(file_bytes), sheet_name=None, header=None)
        sheet_name = list(df_dict.keys())[0] if df_dict else None
        if not sheet_name: return []

        df = df_dict[sheet_name]
        data = df.values.tolist()
        if len(data) < 2: return []

        # Row 0 is header
        header = [str(x).lower() if pd.notna(x) else '' for x in data[0]]
        
        account_idx = next((i for i, h in enumerate(header) if 'account' in h), -1)
        debit_idx = next((i for i, h in enumerate(header) if 'debit' in h), -1)
        credit_idx = next((i for i, h in enumerate(header) if 'credit' in h), -1)
        desc_idx = next((i for i, h in enumerate(header) if 'desc' in h), -1)
        name_idx = next((i for i, h in enumerate(header) if 'name' in h), -1)
        class_idx = next((i for i, h in enumerate(header) if 'class' in h), -1)

        entries = []
        for row in data[1:]:
            account = str(row[account_idx]) if account_idx != -1 and pd.notna(row[account_idx]) else ''
            debit = float(row[debit_idx]) if debit_idx != -1 and pd.notna(row[debit_idx]) else 0.0
            credit = float(row[credit_idx]) if credit_idx != -1 and pd.notna(row[credit_idx]) else 0.0
            description = str(row[desc_idx]) if desc_idx != -1 and pd.notna(row[desc_idx]) else ''
            name = str(row[name_idx]) if name_idx != -1 and pd.notna(row[name_idx]) else ''
            class_name = str(row[class_idx]) if class_idx != -1 and pd.notna(row[class_idx]) else ''

            if account or debit > 0 or credit > 0 or description:
                entries.append(JournalEntryLine(
                    account=account,
                    debit=debit,
                    credit=credit,
                    description=description,
                    name=name,
                    class_name=class_name
                ))
        return entries
    except Exception as e:
        print(f"[Excel] Error parsing journal entries: {e}")
        return []
