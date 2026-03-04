from typing import List, Optional
import random

class Compartment:
    def __init__(self, id: str, name: str, code: str):
        self.id = id
        self.name = name
        self.code = code

class Accrual:
    def __init__(self, id: str, vendor_name: str, amount: float, compartment_id: str, status: str = 'OPEN'):
        self.id = id
        self.vendor_name = vendor_name
        self.amount = amount
        self.compartment_id = compartment_id
        self.status = status

class Bill:
    def __init__(self, id: str, vendor_name: str, amount: float, status: str = 'PENDING'):
        self.id = id
        self.vendor_name = vendor_name
        self.amount = amount
        self.status = status

class QBOService:
    def __init__(self):
        self.compartments = [
            Compartment('comp-1', 'KrediYA Bond Compartment', 'KY-01'),
            Compartment('comp-2', 'Rebel Fund II Compartment', 'RF-02'),
            Compartment('comp-3', 'General Operations', 'GEN-00')
        ]
        self.accruals: List[Accrual] = []
        self.bills: List[Bill] = []

    def get_compartments(self) -> List[Compartment]:
        return self.compartments

    def get_compartment_by_id(self, id: str) -> Optional[Compartment]:
        for c in self.compartments:
            if c.id == id:
                return c
        return None

    def create_accrual(self, vendor_name: str, amount: float, compartment_id: str) -> Accrual:
        accrual_id = f"acc-{random.randint(0, 9999)}"
        accrual = Accrual(accrual_id, vendor_name, amount, compartment_id, 'OPEN')
        self.accruals.append(accrual)
        print(f"[QBO] Created Accrual: {accrual.id} for {vendor_name} (${amount})")
        return accrual

    def find_matching_accrual(self, vendor_name: str, amount: float, tolerance_percent: float = 0.05) -> Optional[Accrual]:
        for a in self.accruals:
            if a.status != 'OPEN':
                continue
            
            # Name match (simple case-insensitive inclusion or exact match)
            name_match = (a.vendor_name.lower() in vendor_name.lower() or 
                          vendor_name.lower() in a.vendor_name.lower())
            
            # Amount match
            diff = abs(a.amount - amount)
            percent_diff = diff / a.amount if a.amount != 0 else 0
            
            if name_match and percent_diff <= tolerance_percent:
                return a
        return None

    def reverse_accrual(self, id: str) -> bool:
        for a in self.accruals:
            if a.id == id:
                a.status = 'REVERSED'
                print(f"[QBO] Reversed Accrual: {id}")
                return True
        return False

    def create_bill(self, vendor_name: str, amount: float) -> Bill:
        bill_id = f"bill-{random.randint(0, 9999)}"
        bill = Bill(bill_id, vendor_name, amount, 'PENDING')
        self.bills.append(bill)
        print(f"[QBO] Created Bill: {bill.id} for {vendor_name} (${amount})")
        return bill

    def pay_bill(self, id: str) -> bool:
        for b in self.bills:
            if b.id == id:
                b.status = 'PAID'
                print(f"[QBO] Paid Bill: {id}")
                return True
        return False

qbo = QBOService()
