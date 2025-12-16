// Assurez-vous que ce fichier est dans src/index.ts

import { config, validateConfig, runtimeConfig } from './config/environment';
import { listener } from './core/listener';
import { copyEngine } from './core/copyEngine';
import { discoveryWallet } from './core/discoveryWallet';
import { telegramBot } from './telegram/bot';
import { ledger } from './core/ledger';

async function main() {
  try {
    console.log('🚀 DÉMARRAGE DU BOT COPY TRADING SOLANA');
    console.log('==========================================\n');

    // 1. Valider la configuration
    console.log('🔧 Validation de la configuration...');
    validateConfig();
    console.log('✅ Configuration valide\n');

    // 2. Charger l'état persistant
    console.log('💾 Chargement de l\'état précédent...');
    ledger.loadState(); // CORRECTION TS2339: La méthode loadState existe maintenant
    console.log('✅ État chargé.\n');

    // 3. Afficher les paramètres
    console.log('⚙️ PARAMÈTRES:');
    console.log(`   Mode: ${config.mode}`);
    console.log(`   Master Wallet: ${config.masterWallet.slice(0, 8)}...`);
    // Note: Utiliser config.autoCopy pour l'affichage initial
    console.log(`   Auto Copy: ${runtimeConfig.autoCopy ? '✅ OUI' : '❌ NON'}`); 
    console.log('\n📊 Configuration Runtime (modifiable via Telegram):');
    console.log(`   Discovery: ${runtimeConfig.discoveryEnabled ? '🟢 ACTIF' : '🔴 INACTIF'}`);
    console.log(`   Discovery Range: ${runtimeConfig.minSolTransfer} - ${runtimeConfig.maxSolTransfer} SOL`);
    console.log(`   Taille Trade: ${runtimeConfig.tradeSize} SOL`);
    console.log(`   TP: +${runtimeConfig.tpPercent}% | SL: -${runtimeConfig.slPercent}%`);
    console.log('');
    
    // 4. Initialiser le Telegram Bot. 
    // CORRECTION TS2339: Suppression de l'appel inexistant à telegramBot.start()
    console.log('💬 Bot Telegram initialisé. En attente de commandes...');

    // 5. Lancer les modules si la configuration initiale le permet (ou attente via Telegram)
    console.log('5. Tentative de démarrage du Listener et du Discovery Wallet si actif...');
    
    // Démarrer seulement si l'état du bot est marqué comme actif (si la propriété existe)
    if (telegramBot.isActive()) { 
      listener.start();
      discoveryWallet.start();
    } else {
      console.log('   Le Listener et Discovery Wallet sont en PAUSE (démarrer via Telegram)');
    }
    
    // 6. Lancer l'engine de monitoring (pour surveiller les TP/SL des trades actifs)
    console.log('6. Démarrage de l\'Engine de monitoring...');
    copyEngine.startMonitoring(); // CORRECTION TS2339: start() remplacé par startMonitoring()

    console.log('\n✅ Le bot est prêt.');
    console.log('Instructions: Ouvrez votre Telegram et envoyez /start au bot.');
    
    // 7. Monitoring périodique (Gardé du snippet)
    setInterval(() => {
      const stats = ledger.getStats();
      console.log(`📊 [${new Date().toLocaleTimeString()}] Positions: ${stats.activePositions} | PNL: ${stats.totalPnl.toFixed(4)} SOL`);
      
      discoveryWallet.clearOldDiscoveries(24);
      ledger.saveState(); // Ajout d'une sauvegarde périodique
    }, 60000); 

    // 8. Gestion des erreurs non capturées et arrêt propre
    process.on('unhandledRejection', (error: any) => {
      console.error('❌ Unhandled rejection:', error);
      telegramBot.getBot().sendMessage(
        config.chatId,
        `⚠️ Erreur non gérée: ${error.message}`
      );
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Arrêt du bot...');
      
      listener.stop();
      discoveryWallet.stop();
      copyEngine.stopAllMonitoring();
      ledger.saveState(); // Sauvegarde à l'arrêt
      
      await telegramBot.getBot().sendMessage(
        config.chatId,
        '🛑 Bot arrêté'
      );
      
      process.exit(0);
    });

  } catch (error: any) {
    console.error('❌ ERREUR FATALE:', error);
    
    try {
      await telegramBot.getBot().sendMessage(
        config.chatId,
        `❌ **ERREUR FATALE**\n\n${error.message}`,
        { parse_mode: 'Markdown' }
      );
    } catch (tgError) {
      console.error('❌ Échec de l\'envoi de la notification Telegram', tgError);
    }
    
    process.exit(1);
  }
}

main();
