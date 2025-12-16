import { Trade, ledger } from './ledger';
import { telegramBot } from '../telegram/bot'; // Import ajouté pour notification

class CopyEngine {
    private isMonitoring = false;

    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        console.log('🟢 Copy Engine Monitoring démarré');
        // Ici, la logique de surveillance des prix (TP/SL) devrait être mise en place.
    }

    stopAllMonitoring() {
        this.isMonitoring = false;
        console.log('🛑 Copy Engine Monitoring arrêté');
    }

    async executeTrade(tradeId: string): Promise<boolean> {
        const trade = ledger.getTrade(tradeId);
        if (!trade) return false;

        console.log(`Executing trade ${tradeId} in ${trade.mode} mode...`);

        // Logique réelle d'exécution du trade (appel Jupiter, Raydium, etc.)
        // Si réussi:
        trade.status = 'ACTIVE';
        trade.buyPrice = 1.0; // Prix fictif pour test
        ledger.updateTrade(tradeId, { status: 'ACTIVE', buyPrice: trade.buyPrice });
        
        console.log(`✅ Trade ${tradeId} exécuté. Statut: ACTIVE`);
        return true;
    }
}

export const copyEngine = new CopyEngine();
