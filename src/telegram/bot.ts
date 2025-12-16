import TelegramBot from 'node-telegram-bot-api';
import { config, runtimeConfig, updateRuntimeConfig, getRuntimeConfig } from '../config/environment';
import { keyboards } from './keyboards';
import { ledger } from '../core/ledger';
import { formatters } from '../utils/formatter';
import { copyEngine } from '../core/copyEngine';
import { discoveryWallet } from '../core/discoveryWallet';
import { listener } from '../core/listener'; // Ajout de l'import manquant

class TelegramBotManager {
  private bot: TelegramBot;
  private botActive: boolean = false;

  constructor() {
    this.bot = new TelegramBot(config.tgToken, { polling: true });
    this.setupHandlers();
  }

  private setupHandlers() {
    // Commande /start
    this.bot.onText(/\/start/, (msg) => {
      this.sendMainMenu(msg.chat.id);
    });

    // Gestion des callbacks
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;
      
      if (!chatId || !data) return;

      await this.handleCallback(chatId, data, query.message?.message_id);
      this.bot.answerCallbackQuery(query.id);
    });
  }

  private async handleCallback(chatId: number, data: string, messageId?: number) {
    // Menu principal
    if (data === 'main_menu') {
      return this.sendMainMenu(chatId);
    }

    if (data === 'start_bot') {
      // Démarrer le listener et le discovery wallet
      if (!listener.isActive()) {
        listener.start();
      }
      if (!discoveryWallet.isRunning()) {
        discoveryWallet.start();
      }
      this.botActive = true;
      return this.bot.sendMessage(chatId, '✅ Bot démarré ! Je surveille les wallets...', {
        reply_markup: { inline_keyboard: keyboards.mainMenu() }
      });
    }

    if (data === 'stop_bot') {
      // Arrêter le listener et le discovery wallet
      listener.stop();
      discoveryWallet.stop();
      this.botActive = false;
      return this.bot.sendMessage(chatId, '⏸ Bot mis en pause', {
        reply_markup: { inline_keyboard: keyboards.mainMenu() }
      });
    }

    if (data === 'show_pnl') {
      return this.showPnl(chatId);
    }

    if (data === 'show_wallets') {
      return this.showWallets(chatId);
    }

    if (data === 'last_trade') {
      return this.showLastTrade(chatId);
    }

    if (data === 'active_positions') {
      return this.showActivePositions(chatId);
    }

    // Gestion des paramètres (à implémenter)
    if (data === 'settings') {
      return this.showSettings(chatId);
    }
    
    // ... Autres commandes (TP/SL, add_wallet, etc.) à compléter si elles existent dans votre code

    // Confirmer wallet découvert
    if (data.startsWith('confirm_wallet_')) {
      const address = data.replace('confirm_wallet_', '');
      await discoveryWallet.addDiscoveredWallet(address);
      return this.bot.sendMessage(chatId, `✅ Wallet ajouté:\n\`${address}\``, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboards.backToMain() }
      });
    }

    // Ignorer wallet
    if (data === 'ignore_wallet') {
      return this.bot.sendMessage(chatId, 'Wallet ignoré.', {
        reply_markup: { inline_keyboard: keyboards.backToMain() }
      });
    }
  }

  // ============ AFFICHAGE ============

  sendMainMenu(chatId: number) {
    const status = this.botActive ? '🟢 ACTIF' : '🔴 PAUSE';
    const stats = ledger.getStats();
    const cfg = getRuntimeConfig();
    
    const message = `
🤖 **BOT COPY TRADING SOLANA**

Status: ${status}
Mode: ${config.mode}
Copy Auto: ${cfg.autoCopy ? '✅' : '❌'}
Discovery: ${cfg.discoveryEnabled ? '🟢' : '🔴'}

📊 **Stats Rapides**
Positions actives: ${stats.activePositions}
Win Rate: ${stats.winRate.toFixed(1)}%
PNL Total: ${stats.totalPnl.toFixed(4)} SOL

⚙️ **Config Actuelle**
Taille: ${cfg.tradeSize} SOL
TP: +${cfg.tpPercent}% | SL: -${cfg.slPercent}%

Que voulez-vous faire ?
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.mainMenu() }
    });
  }

  private showSettings(chatId: number) {
    const cfg = getRuntimeConfig();
    
    const message = `
⚙️ **PARAMÈTRES DE TRADING**

**Configuration Actuelle:**
💰 Taille de trade: ${cfg.tradeSize} SOL
🎯 Take Profit: +${cfg.tpPercent}%
🛑 Stop Loss: -${cfg.slPercent}%
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.settingsMenu() }
    });
  }
  
  private showPnl(chatId: number) {
    const stats = ledger.getStats();
    const message = formatters.formatStats(stats);
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.backToMain() }
    });
  }

  private showWallets(chatId: number) {
    const wallets = ledger.getWallets();
    
    if (wallets.length === 0) {
      return this.bot.sendMessage(chatId, 'Aucun wallet suivi', {
        reply_markup: { inline_keyboard: keyboards.backToMain() }
      });
    }

    const message = formatters.formatWallets(wallets);
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.backToMain() }
    });
  }

  private showLastTrade(chatId: number) {
    const trade = ledger.getLastTrade();
    
    if (!trade) {
      return this.bot.sendMessage(chatId, 'Aucun trade enregistré', {
        reply_markup: { inline_keyboard: keyboards.backToMain() }
      });
    }

    const message = formatters.formatTrade(trade);
    
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.backToMain() }
    });
  }

  private showActivePositions(chatId: number) {
    const positions = ledger.getActiveTrades();
    
    if (positions.length === 0) {
      return this.bot.sendMessage(chatId, 'Aucune position active', {
        reply_markup: { inline_keyboard: keyboards.backToMain() }
      });
    }

    // Correction TS7006: Ajout du type explicite 'any'
    positions.forEach((pos: any) => { 
      const message = formatters.formatTrade(pos);
      this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboards.positionActions(pos.id) }
      });
    });
  }
  
  // ============ NOTIFICATIONS ============

  async sendTradeDetected(trade: any) {
    const cfg = getRuntimeConfig();
    
    const message = `
🚨 **TRADE DÉTECTÉ - COPIE AUTOMATIQUE**

Wallet: ${trade.walletSource.slice(0, 8)}...
Token: ${trade.tokenSymbol || trade.tokenMint.slice(0, 8)}...
Type: ${trade.type}
Montant: ${cfg.tradeSize} SOL

⚙️ **Configuration:**
🎯 TP: +${cfg.tpPercent}%
🛑 SL: -${cfg.slPercent}%

⏳ Exécution en cours...
    `;

    await this.bot.sendMessage(config.chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.tradeDetected(trade.id) }
    });

    // Exécuter automatiquement le trade
    if (cfg.autoCopy) {
      const success = await copyEngine.executeTrade(trade.id);
      
      if (success) {
        await this.bot.sendMessage(
          config.chatId,
          `✅ **TRADE EXÉCUTÉ AUTOMATIQUEMENT**\n\nTrade ID: ${trade.id}\nVous serez notifié quand TP/SL sera atteint.`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }

  sendWalletDiscovered(wallet: string, amount: number) {
    const cfg = getRuntimeConfig();
    
    // Ne notifier que si Discovery Mode est activé
    if (!cfg.discoveryEnabled) {
      return;
    }
    
    const message = `
🔍 **NOUVEAU WALLET DÉCOUVERT**

Wallet: \`${wallet}\`
Transfer: ${amount} SOL

Voulez-vous suivre ce wallet ?
    `;

    this.bot.sendMessage(config.chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.confirmWallet(wallet) }
    });
  }

  sendTPSLTriggered(trade: any, type: 'TP' | 'SL') {
    const emoji = type === 'TP' ? '🎯' : '🛑';
    const message = `
${emoji} **${type} ATTEINT**

Token: ${trade.tokenSymbol || 'Unknown'}
Prix entrée: ${trade.buyPrice}
Prix sortie: ${trade.sellPrice}
PNL: ${trade.pnlPercent?.toFixed(2)}% (${trade.pnl?.toFixed(4)} SOL)

La position a été fermée automatiquement.
    `;

    this.bot.sendMessage(config.chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.backToMain() }
    });
  }

  isActive(): boolean {
    return this.botActive;
  }

  getBot(): TelegramBot {
    return this.bot;
  }
}

// CORRECTION CRITIQUE: Cette ligne DOIT être présente et intacte
export const telegramBot = new TelegramBotManager();
