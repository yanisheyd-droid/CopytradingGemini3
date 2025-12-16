import { config } from '../config/environment';

export interface Wallet {
    address: string;
    type: 'master' | 'followed' | 'discovery';
    isActive: boolean;
    addedAt: number;
}

export interface Trade {
    id: string;
    walletSource: string;
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

class Ledger {
    private wallets: Map<string, Wallet> = new Map();
    private trades: Map<string, Trade> = new Map();

    constructor() {
        // Initialiser avec le master wallet
        this.addWallet(config.masterWallet, 'master');
    }

    addWallet(address: string, type: 'master' | 'followed' | 'discovery') {
        if (!this.wallets.has(address)) {
            this.wallets.set(address, {
                address,
                type,
                isActive: true,
                addedAt: Date.now()
            });
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
            // Données Mock pour la compilation
            tokenSymbol: tradeData.tokenSymbol || 'MOCK',
            pnl: 0
        };
        this.trades.set(newTrade.id, newTrade);
        return newTrade;
    }

    getTrade(id: string): Trade | undefined {
        return this.trades.get(id);
    }

    updateTrade(id: string, updates: Partial<Trade>) {
        const trade = this.getTrade(id);
        if (trade) {
            this.trades.set(id, { ...trade, ...updates });
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
