// src/services/qbo.ts

export interface Compartment {
    id: string;
    name: string;
    code: string;
}

export interface Accrual {
    id: string;
    vendorName: string;
    amount: number;
    compartmentId: string;
    status: 'OPEN' | 'REVERSED';
}

export interface Bill {
    id: string;
    vendorName: string;
    amount: number;
    status: 'PENDING' | 'PAID';
}

class QBOService {
    private compartments: Compartment[] = [
        { id: 'comp-1', name: 'KrediYA Bond Compartment', code: 'KY-01' },
        { id: 'comp-2', name: 'Rebel Fund II Compartment', code: 'RF-02' },
        { id: 'comp-3', name: 'General Operations', code: 'GEN-00' }
    ];

    private accruals: Accrual[] = [];
    private bills: Bill[] = [];

    // Compartments
    getCompartments(): Compartment[] {
        return this.compartments;
    }

    getCompartmentById(id: string): Compartment | undefined {
        return this.compartments.find(c => c.id === id);
    }

    // Accruals
    createAccrual(vendorName: string, amount: number, compartmentId: string): Accrual {
        const accrual: Accrual = {
            id: `acc-${Math.floor(Math.random() * 10000)}`,
            vendorName,
            amount,
            compartmentId,
            status: 'OPEN'
        };
        this.accruals.push(accrual);
        console.log(`[QBO] Created Accrual: ${accrual.id} for ${vendorName} ($${amount})`);
        return accrual;
    }

    findMatchingAccrual(vendorName: string, amount: number, tolerancePercent: number = 0.05): Accrual | undefined {
        return this.accruals.find(a => {
            if (a.status !== 'OPEN') return false;
            // Name match (simple case-insensitive inclusion or exact match)
            const nameMatch = a.vendorName.toLowerCase().includes(vendorName.toLowerCase()) ||
                vendorName.toLowerCase().includes(a.vendorName.toLowerCase());

            // Amount match
            const diff = Math.abs(a.amount - amount);
            const percentDiff = diff / a.amount;

            return nameMatch && percentDiff <= tolerancePercent;
        });
    }

    reverseAccrual(id: string): boolean {
        const accrual = this.accruals.find(a => a.id === id);
        if (accrual) {
            accrual.status = 'REVERSED';
            console.log(`[QBO] Reversed Accrual: ${id}`);
            return true;
        }
        return false;
    }

    // Bills
    createBill(vendorName: string, amount: number): Bill {
        const bill: Bill = {
            id: `bill-${Math.floor(Math.random() * 10000)}`,
            vendorName,
            amount,
            status: 'PENDING'
        };
        this.bills.push(bill);
        console.log(`[QBO] Created Bill: ${bill.id} for ${vendorName} ($${amount})`);
        return bill;
    }

    payBill(id: string): boolean {
        const bill = this.bills.find(b => b.id === id);
        if (bill) {
            bill.status = 'PAID';
            console.log(`[QBO] Paid Bill: ${id}`);
            return true;
        }
        return false;
    }
}

export const qbo = new QBOService();
