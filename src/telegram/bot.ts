import TelegramBot from 'node-telegram-bot-api';
import { config, runtimeConfig, updateRuntimeConfig, getRuntimeConfig } from '../config/environment';
import { keyboards } from './keyboards';
import { ledger } from '../core/ledger'; // Correction des quotes
import { formatters } from '../utils/formatter'; // Correction des quotes
import { copyEngine } from '../core/copyEngine'; // Correction des quotes
import { discoveryWallet } from '../core/discoveryWallet';

class TelegramBotManager {
  private bot: TelegramBot;
  private botActive: boolean = false;

  constructor() {
    this.bot = new TelegramBot(config.tgToken, { polling: true });
    this.setupHandlers();
  }
// ... (reste du fichier non modifié, car le problème est à la ligne 310)

  private showActivePositions(chatId: number) {
    const positions = ledger.getActiveTrades();
    
    if (positions.length === 0) {
      return this.bot.sendMessage(chatId, 'Aucune position active', {
        reply_markup: { inline_keyboard: keyboards.backToMain() }
      });
    }

    // CORRECTION TS7006: Ajout de (pos: any)
    positions.forEach((pos: any) => { 
      const message = formatters.formatTrade(pos);
      this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboards.positionActions(pos.id) }
      });
    });
  }
// ... (reste du fichier non modifié)
