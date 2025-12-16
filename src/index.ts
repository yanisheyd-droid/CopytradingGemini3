import { config, validateConfig, runtimeConfig } from './config/environment';
import { listener } from './core/listener'; // CORRECTION du chemin et des guillemets
import { copyEngine } from './core/copyEngine'; // CORRECTION du chemin et des guillemets
import { discoveryWallet } from './core/discoveryWallet';
import { telegramBot } from './telegram/bot';
import { ledger } from './core/ledger'; // CORRECTION du chemin et des guillemets

async function main() {
  try {
    console.log('🚀 DÉMARRAGE DU BOT COPY TRADING SOLANA');
    console.log('==========================================\n');

    // 1. Valider la configuration
    console.log('🔧 Validation de la configuration...');
    validateConfig();
    console.log('✅ Configuration valide\n');

    // 2. Afficher les paramètres
    console.log('⚙️ PARAMÈTRES:');
    console.log(`   Mode: ${config.mode}`);
    console.log(`   Master Wallet: ${config.masterWallet.slice(0, 8)}...`);
    console.log(`   Auto Copy: ${runtimeConfig.autoCopy ? '✅ OUI' : '❌ NON'}`);
    console.log('\n📊 Configuration Runtime (modifiable via Telegram):');
    console.log(`   Discovery: ${runtimeConfig.discoveryEnabled ? '🟢 ACTIF' : '🔴 INACTIF'}`);
    console.log(`   Discovery Range: ${runtimeConfig.minSolTransfer} - ${runtimeConfig.maxSolTransfer} SOL`);
    console.log(`   Taille Trade: ${runtimeConfig.tradeSize} SOL`);
    console.log(`   TP: +${runtimeConfig.tpPercent}% | SL: -${runtimeConfig.slPercent}%`);
    console.log('');
    
    // 3. Initialiser le Telegram Bot. 
    // La construction de l'objet (new TelegramBotManager()) déclenche le polling.
    // L'appel à telegramBot.start() n'est plus nécessaire.
    console.log('💬 Bot Telegram initialisé. En attente de commandes...');

    // 4. Lancer les modules si la configuration initiale le permet (ou attente via Telegram)
    console.log('4. Tentative de démarrage du Listener et du Discovery Wallet si actif...');
    
    // Note: Dans une architecture de bot, on attend souvent la commande /start du chat pour activer le listener.
    // Je garde la logique de démarrage immédiat mais la rend conditionnelle.
    if (telegramBot.isActive()) { 
      listener.start();
      discoveryWallet.start();
    } else {
      console.log('   Le Listener et Discovery Wallet sont en PAUSE (démarrer via Telegram)');
    }
    
    // 5. Lancer l'engine de monitoring (pour surveiller les TP/SL des trades actifs)
    copyEngine.startMonitoring();

    console.log('\n✅ Le bot est prêt.');
    console.log('Instructions: Ouvrez votre Telegram et envoyez /start au bot.');
    console.log('   - Vous pourrez démarrer/arrêter le listener, modifier taille de trade, TP, SL');
    console.log('   - Voir statistiques et positions\n');

    // 6. Monitoring périodique (Gardé du snippet)
    setInterval(() => {
      const stats = ledger.getStats();
      console.log(`📊 [${new Date().toLocaleTimeString()}] Positions: ${stats.activePositions} | PNL: ${stats.totalPnl.toFixed(4)} SOL`);
      
      // Nettoyer les anciennes découvertes toutes les heures
      discoveryWallet.clearOldDiscoveries(24);
    }, 60000); // Toutes les minutes

    // 7. Gestion des erreurs non capturées
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
      
      await telegramBot.getBot().sendMessage(
        config.chatId,
        '🛑 Bot arrêté'
      );
      
      process.exit(0);
    });

  } catch (error: any) {
    console.error('❌ ERREUR FATALE:', error);
    
    try {
      // Tenter d'envoyer la dernière erreur
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
