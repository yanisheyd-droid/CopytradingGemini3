// Assurez-vous que ce fichier est dans src/core/ledger.ts

import { config } from '../config/environment';
import * as fs from 'fs';
import * as path from 'path';

export interface Wallet {
// ...
}

export interface Trade {
    id: string;
    walletSource: string; // DOIT être une string
    tokenMint: string;
    tokenSymbol: string;
    type: 'BUY' | 'SELL';
    status: 'PENDING' | 'ACTIVE' | 'CLOSED';
    amountSol: number;
    tpPercent: number;
    slPercent: number;
    mode: 'TEST' | 'REAL';
    buyPrice?: number;
    sellPrice?: number;
    pnl?: number;
    pnlPercent?: number;
}
// ... (Reste de la classe Ledger inchangé)
