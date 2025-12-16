export interface Trade {
    id: string;
    tokenAddress: string;
    entryPrice: number;
    amountSol: number;
    tokenAmount: number;
    tp: number; // Prix cible
    sl: number; // Prix stop
    status: 'OPEN' | 'CLOSED';
    pnl?: number;
    txHash?: string;
}

export interface TrackedWallet {
    address: string;
    addedAt: number;
}
