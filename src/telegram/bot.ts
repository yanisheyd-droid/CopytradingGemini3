import TelegramBot from 'node-telegram-bot-api';
import { config, runtimeConfig, updateRuntimeConfig, getRuntimeConfig } from '../config/environment';
import { keyboards } from './keyboards';
import { ledger } from '../core/ledger';
import { formatters } from '../utils/formatter';
import { copyEngine } from '../core/copyEngine';
import { discoveryWallet } from '../core/discoveryWallet';

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
      this.botActive = true;
      return this.bot.sendMessage(chatId, '✅ Bot démarré ! Je surveille les wallets...', {
        reply_markup: { inline_keyboard: keyboards.mainMenu() }
      });
    }

    if (data === 'stop_bot') {
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

    // Copier un trade
    if (data.startsWith('copy_')) {
      const tradeId = data.replace('copy_', '');
      return this.copyTrade(chatId, tradeId);
    }

    // Ignorer un trade
    if (data.startsWith('ignore_')) {
      return this.bot.sendMessage(chatId, '❌ Trade ignoré');
    }

    // Personnaliser TP/SL
    if (data.startsWith('customize_')) {
      const tradeId = data.replace('customize_', '');
      return this.showTpSlAdjust(chatId, tradeId);
    }

    // Ajuster TP
    if (data.startsWith('tp_')) {
      const [_, percent, tradeId] = data.split('_');
      ledger.updateTrade(tradeId, { tpPercent: parseFloat(percent) });
      return this.bot.sendMessage(chatId, `✅ TP défini à +${percent}%`, {
        reply_markup: { inline_keyboard: keyboards.tpSlAdjust(tradeId) }
      });
    }

    // Ajuster SL
    if (data.startsWith('sl_')) {
      const [_, percent, tradeId] = data.split('_');
      ledger.updateTrade(tradeId, { slPercent: parseFloat(percent) });
      return this.bot.sendMessage(chatId, `✅ SL défini à -${percent}%`, {
        reply_markup: { inline_keyboard: keyboards.tpSlAdjust(tradeId) }
      });
    }

    // Exécuter le trade
    if (data.startsWith('execute_')) {
      const tradeId = data.replace('execute_', '');
      return this.copyTrade(chatId, tradeId);
    }

    // Confirmer wallet découvert
    if (data.startsWith('confirm_wallet_')) {
      const address = data.replace('confirm_wallet_', '');
      ledger.addWallet(address, 'discovery');
      return this.bot.sendMessage(chatId, `✅ Wallet ajouté:\n${address}`, {
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

🔍 **Discovery Mode:** ${cfg.discoveryEnabled ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}
${cfg.discoveryEnabled ? `   Range: ${cfg.minSolTransfer}-${cfg.maxSolTransfer} SOL` : ''}

Cliquez pour modifier les paramètres:
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.settingsMenu() }
    });
  }

  private showCurrentConfig(chatId: number) {
    const cfg = getRuntimeConfig();
    
    const message = `
📊 **CONFIGURATION DÉTAILLÉE**

**Trading:**
💰 Taille par trade: ${cfg.tradeSize} SOL
🎯 Take Profit: +${cfg.tpPercent}%
🛑 Stop Loss: -${cfg.slPercent}%
⚡ Copy automatique: ${cfg.autoCopy ? '✅ OUI' : '❌ NON'}

**Discovery Wallet:**
🔍 Statut: ${cfg.discoveryEnabled ? '🟢 ACTIF' : '🔴 INACTIF'}
📊 Range: ${cfg.minSolTransfer}-${cfg.maxSolTransfer} SOL

**Système:**
🌐 Mode: ${config.mode}
💼 Master Wallet: \`${config.masterWallet.slice(0, 8)}...\`
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.backToMain() }
    });
  }

  private showTradeSizeMenu(chatId: number) {
    const cfg = getRuntimeConfig();
    
    const message = `
💰 **TAILLE DE TRADE**

Actuel: ${cfg.tradeSize} SOL

Choisissez la taille pour tous les futurs trades:
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.tradeSizeMenu() }
    });
  }

  private showTpMenu(chatId: number) {
    const cfg = getRuntimeConfig();
    
    const message = `
🎯 **TAKE PROFIT**

Actuel: +${cfg.tpPercent}%

Choisissez le TP pour tous les futurs trades:
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.tpMenu() }
    });
  }

  private showSlMenu(chatId: number) {
    const cfg = getRuntimeConfig();
    
    const message = `
🛑 **STOP LOSS**

Actuel: -${cfg.slPercent}%

Choisissez le SL pour tous les futurs trades:
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.slMenu() }
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

    positions.forEach(pos => {
      const message = formatters.formatTrade(pos);
      this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboards.positionActions(pos.id) }
      });
    });
  }

  private showTpSlAdjust(chatId: number, tradeId: string) {
    const trade = ledger.getTrade(tradeId);
    if (!trade) return;

    const message = `
⚙️ **Ajuster TP/SL**

Token: ${trade.tokenSymbol || trade.tokenMint.slice(0, 8)}...
TP actuel: +${trade.tpPercent}%
SL actuel: -${trade.slPercent}%

Choisissez vos niveaux:
    `;

    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.tpSlAdjust(tradeId) }
    });
  }

  // ============ ACTIONS ============

  private async copyTrade(chatId: number, tradeId: string) {
    // Cette méthode n'est plus utilisée car copy automatique
    // Gardée pour compatibilité avec les boutons de détails
    const trade = ledger.getTrade(tradeId);
    if (!trade) return;
    
    const message = formatters.formatTrade(trade);
    this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.positionActions(tradeId) }
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

export const telegramBot = new TelegramBotManager();