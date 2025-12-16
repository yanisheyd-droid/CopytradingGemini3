import { Wallet, Trade } from '../core/ledger';

export const formatters = {
    formatStats(stats: any): string {
        return `
📊 **Statistiques Globales**

Positions Actives: ${stats.activePositions}
Trades Terminés: ${stats.totalTrades - stats.activePositions}
Win Rate: ${stats.winRate.toFixed(1)}%

PNL Total: ${stats.totalPnl.toFixed(4)} SOL
        `;
    },

    formatWallets(wallets: Wallet[]): string {
        let message = `💼 **WALLETS SUIVIS** (${wallets.length})\n\n`;
        
        wallets.forEach(w => {
            message += `${w.isActive ? '🟢' : '🔴'} \`${w.address.slice(0, 8)}...\` (${w.type})\n`;
        });
        
        return message;
    },

    formatTrade(trade: Trade): string {
        const statusEmoji = trade.status === 'ACTIVE' ? '🟢' : trade.status === 'CLOSED' ? '🔴' : '🟡';
        const pnlLine = trade.pnl !== undefined ? `\n\n💰 PNL: ${trade.pnl.toFixed(4)} SOL (${trade.pnlPercent?.toFixed(2)}%)` : '';
        
        return `
📈 **TRADE ${trade.id} - ${statusEmoji} ${trade.status}**

Token: **${trade.tokenSymbol || trade.tokenMint.slice(0, 8) + '...'}**
Type: ${trade.type}
Montant: ${trade.amountSol} SOL

Entrée: ${trade.buyPrice ? trade.buyPrice.toFixed(6) : 'N/A'}
Sortie: ${trade.sellPrice ? trade.sellPrice.toFixed(6) : 'N/A'}
TP: +${trade.tpPercent}% | SL: -${trade.slPercent}%
${pnlLine}
        `;
    }
};
