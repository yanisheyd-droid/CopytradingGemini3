import fs from 'fs';
import { Trade, TrackedWallet } from './types';

const DB_FILE = 'db.json';

interface Database {
    trackedWallets: TrackedWallet[];
    trades: Trade[];
}

let db: Database = { trackedWallets: [], trades: [] };

// Charger la DB au démarrage
if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export const Ledger = {
    addWallet: (address: string) => {
        if (!db.trackedWallets.find(w => w.address === address)) {
            db.trackedWallets.push({ address, addedAt: Date.now() });
            save();
            return true;
        }
        return false;
    },
    removeWallet: (address: string) => {
        db.trackedWallets = db.trackedWallets.filter(w => w.address !== address);
        save();
    },
    getWallets: () => db.trackedWallets,
    
    addTrade: (trade: Trade) => {
        db.trades.push(trade);
        save();
    },
    updateTrade: (tradeId: string, updates: Partial<Trade>) => {
        const idx = db.trades.findIndex(t => t.id === tradeId);
        if (idx !== -1) {
            db.trades[idx] = { ...db.trades[idx], ...updates };
            save();
        }
    },
    getOpenTrades: () => db.trades.filter(t => t.status === 'OPEN'),
    getStats: () => {
        const closed = db.trades.filter(t => t.status === 'CLOSED');
        const wins = closed.filter(t => (t.pnl || 0) > 0).length;
        const totalPnl = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
        return { totalTrades: closed.length, wins, totalPnl: totalPnl.toFixed(4) };
    }
};
