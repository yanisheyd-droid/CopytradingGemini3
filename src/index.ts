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
    console.log(`   Auto Copy: ${config.autoCopy ? '✅ OUI' : '❌ NON'}`);
    console.log('\n📊 Configuration Runtime (modifiable via Telegram):');
    console.log(`   Discovery: ${runtimeConfig.discoveryEnabled ? '🟢 ACTIF' : '🔴 INACTIF'}`);
    console.log(`   Discovery Range: ${runtimeConfig.minSolTransfer} - ${runtimeConfig.maxSolTransfer} SOL`);
    console.log(`   Taille Trade: ${runtimeConfig.tradeSize} SOL`);
    console.log(`   TP: +${runtimeConfig.tpPercent}% | SL: -${runtimeConfig.slPercent}%`);
    console.log('');

    // 3. Démarrer le bot Telegram
    console.log('📱 Initialisation du bot Telegram...');
    telegramBot.getBot().sendMessage(
      config.chatId,
      `🤖 **BOT DÉMARRÉ**\n\n` +
      `Mode: ${config.mode}\n` +
      `Copy Auto: ✅ Automatique\n` +
      `Discovery: ${runtimeConfig.discoveryEnabled ? '🟢' : '🔴'} (configurable)\n\n` +
      `Tapez /start pour accéder au menu`,
      { parse_mode: 'Markdown' }
    );
    console.log('✅ Bot Telegram initialisé\n');

    // 4. Charger les wallets du ledger
    const wallets = ledger.getActiveWallets();
    console.log(`💼 ${wallets.length} wallet(s) à surveiller`);

    // 5. Démarrer le WebSocket listener
    console.log('🎧 Démarrage du listener WebSocket...');
    await listener.start();
    
    // Attendre que la connexion soit établie
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (listener.isActive()) {
      console.log('✅ Listener actif\n');
    } else {
      throw new Error('Listener n\'a pas pu se connecter');
    }

    // 6. Discovery Wallet - Ne démarre PAS automatiquement
    console.log('🔍 Discovery Wallet: En attente (activation via Telegram)\n');

    // 7. Afficher le statut
    console.log('==========================================');
    console.log('🟢 BOT ENTIÈREMENT OPÉRATIONNEL');
    console.log('==========================================\n');

    console.log('📊 Status:');
    console.log(`   Listener: ${listener.isActive() ? '🟢 Actif' : '🔴 Inactif'}`);
    console.log(`   Discovery: ${runtimeConfig.discoveryEnabled ? '🟢 Actif' : '🔴 Inactif (activable via Telegram)'}`);
    console.log(`   Telegram: 🟢 Actif`);
    console.log(`   Auto-Copy: 🟢 Actif (sans confirmation)`);
    console.log('');

    console.log('💡 Le bot copie AUTOMATIQUEMENT tous les trades détectés');
    console.log('💡 Utilisez /start dans Telegram pour:');
    console.log('   - Activer/désactiver Discovery Mode');
    console.log('   - Modifier taille de trade, TP, SL');
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
      await telegramBot.getBot().sendMessage(
        config.chatId,
        `❌ **ERREUR FATALE**\n\n${error.message}`,
        { parse_mode: 'Markdown' }
      );
    } catch (tgError) {
      console.error('❌ Impossible d\'envoyer la notification Telegram');
    }
    
    process.exit(1);
  }
}

// Démarrer le bot
main();