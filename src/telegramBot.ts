import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { Ledger } from './ledger';
import { TradeEngine, simulateSignal, startListeners } from './solanaService';

dotenv.config();

export const bot = new TelegramBot(process.env.TG_TOKEN!, { polling: true });
const CHAT_ID = process.env.CHAT_ID!;

// MENU PRINCIPAL
const mainMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🚀 Démarrer Listeners", callback_data: "START_WSS" }, { text: "🛑 Stop", callback_data: "STOP_WSS" }],
            [{ text: "💰 Mon PNL", callback_data: "SHOW_PNL" }, { text: "📋 Wallets Suivis", callback_data: "SHOW_WALLETS" }],
            [{ text: "🛠 Config TP/SL", callback_data: "CONFIG_TPSL" }, { text: "⚡ Test Signal", callback_data: "TEST_SIG" }]
        ]
    }
};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 <b>GMINI COPY BOT SOLANA</b>\nPrêt à trader.", {
        parse_mode: 'HTML',
        ...mainMenu
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id.toString();
    const data = query.data!;

    // Gestion des actions
    if (data === "START_WSS") {
        startListeners(chatId);
        bot.answerCallbackQuery(query.id, { text: "Listeners actifs !" });
    }
    
    if (data === "SHOW_PNL") {
        const stats = Ledger.getStats();
        const text = `📊 <b>STATISTIQUES</b>\nTrades fermés: ${stats.totalTrades}\nWins: ${stats.wins}\nPNL Total: $${stats.totalPnl}`;
        bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    }

    if (data === "SHOW_WALLETS") {
        const wallets = Ledger.getWallets();
        const text = wallets.length > 0 
            ? wallets.map(w => `• <code>${w.address}</code>`).join('\n')
            : "Aucun wallet suivi.";
        bot.sendMessage(chatId, "📋 <b>Wallets surveillés :</b>\n" + text, { parse_mode: 'HTML' });
    }

    if (data === "TEST_SIG") {
        simulateSignal(chatId);
    }

    // ACHAT AUTOMATIQUE VIA BOUTON
    if (data.startsWith("BUY_")) {
        const tokenMint = data.split("_")[1];
        const amount = parseFloat(process.env.TRADE_AMOUNT_SOL || '0.1');
        bot.answerCallbackQuery(query.id, { text: "🚀 Exécution en cours..." });
        await TradeEngine.executeBuy(tokenMint, amount, chatId);
    }

    if (data === "IGNORE") {
        bot.deleteMessage(chatId, query.message!.message_id);
    }
});
