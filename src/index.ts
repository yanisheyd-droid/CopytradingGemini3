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

    // 2. Afficher les paramètres
    console.log('⚙️ PARAMÈTRES:');
    console.log(`   Mode: ${config.mode}`);
    console.log(`   Master Wallet: ${config.masterWallet.slice(0, 8)}...`);
    // Utilisez runtimeConfig.autoCopy, car la valeur de config.autoCopy par défaut est toujours true
    console.log(`   Auto Copy: ${runtimeConfig.autoCopy ? '✅ OUI' : '❌ NON'}`);
    console.log('\n📊 Configuration Runtime (modifiable via Telegram):');
    console.log(`   Discovery: ${runtimeConfig.discoveryEnabled ? '🟢 ACTIF' : '🔴 INACTIF'}`);
    console.log(`   Discovery Range: ${runtimeConfig.minSolTransfer} - ${runtimeConfig.maxSolTransfer} SOL`);
    console.log(`   Taille Trade: ${runtimeConfig.tradeSize} SOL`);
    console.log(`   TP: +${runtimeConfig.tpPercent}% | SL: -${runtimeConfig.slPercent}%`);
    console.log('');

    // 3. Démarrer le Telegram Bot
    console.log('💬 Démarrage du bot Telegram...');
    telegramBot.start();
    console.log('✅ Bot Telegram actif');
    console.log('   -> Envoyez /start sur Telegram pour interagir\n');

    // 4. Démarrer le Ledger (base de données in-memory)
    console.log('📚 Initialisation du Ledger...');
    ledger.loadState();
    console.log(`✅ ${ledger.getActiveWallets().length} wallets chargés`);
    console.log(`✅ ${ledger.getActiveTrades().length} trades actifs chargés\n`);

    // 5. Démarrer le Copy Engine
    console.log('🤖 Démarrage du Copy Engine...');
    copyEngine.start();
    console.log('✅ Copy Engine actif\n');
    
    // 6. Démarrer le Listener Solana (WebSocket)
    console.log('🎧 Démarrage du Listener Solana...');
    listener.start();
    // Le listener confirmera la connexion et la souscription plus tard

    // 7. Démarrer le Discovery Wallet (mode veille, activable via Telegram)
    console.log('🔍 Démarrage du Discovery Wallet...');
    discoveryWallet.start();
    console.log('✅ Discovery Wallet actif (mode: ' + (runtimeConfig.discoveryEnabled ? 'ACTIF' : 'INACTIF') + ')\n');

    console.log('✨ INITIALISATION COMPLÈTE.');
    console.log('   Le bot est en écoute pour des transactions sur Solana et des commandes Telegram.');
    console.log('   Vous pouvez modifier taille de trade, TP, SL, etc. via le menu /start.');
    console.log('   - Modifiez la taille de trade, TP, SL');
    console.log('   - Voir statistiques et positions\n');

    // 8. Monitoring périodique
    setInterval(() => {
      const stats = ledger.getStats();
      console.log(`📊 [${new Date().toLocaleTimeString()}] Positions: ${stats.activePositions} | PNL: ${stats.totalPnl.toFixed(4)} SOL`);
      
      // Nettoyer les anciennes découvertes toutes les heures
      discoveryWallet.clearOldDiscoveries(24);
    }, 60000); // Toutes les minutes

    // 9. Gestion des erreurs non capturées
    process.on('unhandledRejection', (error: any) => {
      console.error('❌ Unhandled rejection:', error);
      if (telegramBot.isActive()) {
        telegramBot.getBot().sendMessage(
          config.chatId,
          `⚠️ Erreur non gérée: ${error.message}`
        );
      }
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Arrêt du bot...');
      
      listener.stop();
      discoveryWallet.stop();
      copyEngine.stopAllMonitoring();
      
      if (telegramBot.isActive()) {
        await telegramBot.getBot().sendMessage(
          config.chatId,
          '🛑 Bot arrêté'
        );
      }
      
      process.exit(0);
    });

  } catch (error: any) {
    console.error('❌ ERREUR FATALE:', error);
    
    // Tenter d'envoyer un message fatal même si le bot n'est pas complètement initialisé
    if (config.chatId && config.tgToken) {
      try {
        await telegramBot.getBot().sendMessage(
          config.chatId,
          `❌ **ERREUR FATALE**\n\n${error.message}`,
          { parse_mode: 'Markdown' }
        );
      } catch (tgError) {
        console.error('❌ ERREUR ENVOI TELEGRAM FATAL:', tgError);
      }
    }
    
    process.exit(1);
  }
}

main();
