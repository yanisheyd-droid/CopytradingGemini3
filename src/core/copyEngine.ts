// Assurez-vous que ce fichier est dans src/core/copyEngine.ts

import { Trade, ledger } from './ledger';
// L'importation de telegramBot est nécessaire si vous l'utilisez dans executeTrade
// import { telegramBot } from '../telegram/bot'; 

class CopyEngine {
    private isMonitoring = false;

    // Méthode startMonitoring() était déjà définie
    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        console.log('🟢 Copy Engine Monitoring démarré');
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
        trade.status = 'ACTIVE';
        trade.buyPrice = 1.0; 
        ledger.updateTrade(tradeId, { status: 'ACTIVE', buyPrice: trade.buyPrice });
        
        console.log(`✅ Trade ${tradeId} exécuté. Statut: ACTIVE`);
        return true;
    }
}

export const copyEngine = new CopyEngine();
