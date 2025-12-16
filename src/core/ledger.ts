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

const STATE_FILE = path.join(process.cwd(), 'state.json');

class Ledger {
    private wallets: Map<string, Wallet> = new Map();
    private trades: Map<string, Trade> = new Map();

    constructor() {
        // Initialiser avec le master wallet
        this.addWallet(config.masterWallet, 'master');
    }

    loadState() {
        if (!fs.existsSync(STATE_FILE)) {
            console.log('💾 Aucun fichier d\'état trouvé. Démarrage à neuf.');
            return;
        }

        try {
            const data = fs.readFileSync(STATE_FILE, 'utf-8');
            const state = JSON.parse(data);
            
            this.wallets = new Map(
                state.wallets.map((w: Wallet) => [w.address, w])
            );
            this.addWallet(config.masterWallet, 'master'); // S'assurer que le master est là
            
            this.trades = new Map(
                state.trades.map((t: Trade) => [t.id, t])
            );
            
            console.log(`✅ État chargé: ${this.wallets.size} wallets, ${this.trades.size} trades`);
        } catch (error) {
            console.error('❌ Erreur de chargement de l\'état:', error);
        }
    }

    saveState() {
        const state = {
            wallets: Array.from(this.wallets.values()),
            trades: Array.from(this.trades.values())
        };
        
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
        } catch (error) {
            console.error('❌ Erreur de sauvegarde de l\'état:', error);
        }
    }

    addWallet(address: string, type: 'master' | 'followed' | 'discovery') {
        if (!this.wallets.has(address)) {
            this.wallets.set(address, {
                address,
                type,
                isActive: true,
                addedAt: Date.now()
            });
            this.saveState(); 
        }
    }

    isWalletFollowed(address: string): boolean {
        const wallet = this.wallets.get(address);
        return !!wallet && wallet.isActive;
    }

    getActiveWallets(): string[] {
        return Array.from(this.wallets.values())
            .filter(w => w.isActive)
            .map(w => w.address);
    }
    
    createTrade(tradeData: Omit<Trade, 'id' | 'status' | 'mode'> & { mode: 'TEST' | 'REAL', status?: 'PENDING' | 'ACTIVE' | 'CLOSED' }): Trade {
        const newTrade: Trade = {
            id: 'T' + Date.now(),
            status: 'PENDING',
            ...tradeData,
            tokenSymbol: tradeData.tokenSymbol || 'MOCK',
            pnl: 0
        };
        this.trades.set(newTrade.id, newTrade);
        this.saveState(); 
        return newTrade;
    }

    getTrade(id: string): Trade | undefined {
        return this.trades.get(id);
    }

    updateTrade(id: string, updates: Partial<Trade>) {
        const trade = this.getTrade(id);
        if (trade) {
            this.trades.set(id, { ...trade, ...updates });
            this.saveState(); 
        }
    }
    
    getStats() {
        const closedTrades = Array.from(this.trades.values()).filter(t => t.status === 'CLOSED');
        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const winners = closedTrades.filter(t => (t.pnl || 0) > 0).length;
        
        return {
            activePositions: Array.from(this.trades.values()).filter(t => t.status === 'ACTIVE').length,
            totalTrades: this.trades.size,
            totalPnl,
            winRate: closedTrades.length > 0 ? (winners / closedTrades.length) * 100 : 0
        };
    }
    
    getWallets(): Wallet[] { return Array.from(this.wallets.values()); }
    getLastTrade(): Trade | undefined { return Array.from(this.trades.values()).pop(); }
    getActiveTrades(): Trade[] { return Array.from(this.trades.values()).filter(t => t.status === 'ACTIVE'); }
}

export const ledger = new Ledger();

