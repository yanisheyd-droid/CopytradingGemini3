import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fetch from 'node-fetch'; // Pour Jupiter Price API
import { Ledger } from './ledger';
import { bot } from './telegramBot';
import dotenv from 'dotenv';
dotenv.config();

const connection = new Connection(process.env.RPC_HTTPS!);
const wssConnection = new Connection(process.env.QUICKNODE_WSS!, { wsEndpoint: process.env.QUICKNODE_WSS });

// --- JUPITER PRICE API ---
async function getTokenPrice(tokenMint: string): Promise<number> {
    try {
        const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenMint}`);
        const data: any = await response.json();
        return data.data[tokenMint]?.price || 0;
    } catch (e) {
        return 0;
    }
}

// --- TRADING ENGINE ---
export const TradeEngine = {
    
    // 1. EXECUTER L'ACHAT
    executeBuy: async (tokenMint: string, amountSol: number, chatId: string) => {
        const price = await getTokenPrice(tokenMint);
        if (price === 0) {
            bot.sendMessage(chatId, "⚠️ Erreur: Impossible de récupérer le prix.");
            return;
        }

        const tokenAmount = (amountSol * 200) / price; // Simulation conversion (SOL -> USD -> Token)

        // En mode REAL, ici on construit la tx Jupiter swap
        // const { swapTransaction } = await jupiterApi.quote(...);
        
        const tradeId = Date.now().toString();
        const tpPercent = parseFloat(process.env.DEFAULT_TP_PERCENT || '25');
        const slPercent = parseFloat(process.env.DEFAULT_SL_PERCENT || '10');

        const tradeData = {
            id: tradeId,
            tokenAddress: tokenMint,
            entryPrice: price,
            amountSol: amountSol,
            tokenAmount: tokenAmount,
            tp: price * (1 + tpPercent / 100),
            sl: price * (1 - slPercent / 100),
            status: 'OPEN' as const
        };

        Ledger.addTrade(tradeData);

        const msg = `✅ <b>ACHAT CONFIRMÉ</b>\n` +
                    `Token: <code>${tokenMint}</code>\n` +
                    `Prix Entrée: $${price.toFixed(6)}\n` +
                    `TP: $${tradeData.tp.toFixed(6)} (+${tpPercent}%)\n` +
                    `SL: $${tradeData.sl.toFixed(6)} (-${slPercent}%)\n` +
                    `Mode: ${process.env.MODE}`;
        
        bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });

        // Démarrer monitoring spécifique pour ce trade
        monitorTrade(tradeData, chatId);
    }
};

// --- MONITORING BOUCLE (TP/SL) ---
async function monitorTrade(trade: any, chatId: string) {
    const interval = setInterval(async () => {
        const currentPrice = await getTokenPrice(trade.tokenAddress);
        
        if (currentPrice === 0) return;

        // VÉRIFICATION TP
        if (currentPrice >= trade.tp) {
            clearInterval(interval);
            closeTrade(trade, currentPrice, 'TAKE PROFIT 🟢', chatId);
        }
        // VÉRIFICATION SL
        else if (currentPrice <= trade.sl) {
            clearInterval(interval);
            closeTrade(trade, currentPrice, 'STOP LOSS 🔴', chatId);
        }
    }, 5000); // Vérifie toutes les 5 secondes
}

function closeTrade(trade: any, exitPrice: number, reason: string, chatId: string) {
    const pnl = (exitPrice - trade.entryPrice) * trade.tokenAmount;
    Ledger.updateTrade(trade.id, { status: 'CLOSED', pnl });

    const msg = `🚨 <b>VENTE AUTOMATIQUE (${reason})</b>\n` +
                `Token: <code>${trade.tokenAddress}</code>\n` +
                `Prix Sortie: $${exitPrice.toFixed(6)}\n` +
                `PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    
    bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
}

// --- LISTENERS WSS ---
export const startListeners = (chatId: string) => {
    console.log("🟢 Listeners WSS Démarrés...");

    // 1. DISCOVERY LISTENER (Sur le Master Wallet)
    const masterPubkey = new PublicKey(process.env.MASTER_WALLET!);
    connection.onLogs(masterPubkey, (logs, ctx) => {
        // Logique simplifiée : détecter un transfert SOL
        // Dans une vraie app, on parse l'instruction précise
        if (logs.err) return;
        
        // Simuler la détection d'un nouveau wallet destinataire
        // Ici, il faudrait analyser la transaction on-chain pour trouver le destinataire
        // Pour l'exemple, on génère un event
        const signature = logs.signature;
        bot.sendMessage(chatId, `🔭 <b>Discovery Wallet</b>\nMouvement détecté sur le Master !\nTx: <code>${signature}</code>`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: "🔍 Analyser le destinataire", callback_data: `SCAN_${signature}` }
                ]]
            }
        });
    }, 'processed');

    // 2. TRACKED WALLETS LISTENER
    // On boucle pour créer un listener par wallet suivi
    setInterval(() => {
        const wallets = Ledger.getWallets();
        // Ici on pourrait rafraîchir les listeners dynamiquement
        // Pour l'exemple, supposons qu'un wallet suivi achète un token
    }, 10000);
};

// Simulation d'un signal pour tester le bot
export const simulateSignal = (chatId: string) => {
    const fakeToken = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // Bonk
    bot.sendMessage(chatId, `💎 <b>SIGNAL DÉTECTÉ</b>\nWallet suivi a acheté un token !\nToken: <code>${fakeToken}</code>`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ COPIER (BUY)", callback_data: `BUY_${fakeToken}` },
                    { text: "❌ IGNORER", callback_data: `IGNORE` }
                ]
            ]
        }
    });
};
