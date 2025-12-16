// Assurez-vous que ce fichier est dans src/core/listener.ts

import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';
import { config, runtimeConfig } from '../config/environment';
import { ledger } from './ledger'; 
import { telegramBot } from '../telegram/bot';

interface TransactionLog {
signature: string;
err: any;
logs: string[];
}

interface ParsedTransaction {
// CORRECTION CRITIQUE: Initialiser à une string vide pour éviter 'undefined'
walletSource: string; 
type: 'BUY' | 'SELL' | 'TRANSFER' | 'UNKNOWN';
tokenMint?: string;
tokenSymbol?: string;
amountSol: number;
amountTokens?: number;
destinationWallet?: string;
timestamp: number;
}

class SolanaListener {
// ... (reste de la classe inchangé jusqu'à parseTransactionLogs)
private ws: WebSocket | null = null;
private reconnectAttempts = 0;
private maxReconnectAttempts = 10;
private subscriptionId: number | null = null;
private isRunning = false;
private watchedWallets: Set<string> = new Set();

constructor() {
this.watchedWallets.add(config.masterWallet);
}

// ... (fonctions start, stop, connect, attemptReconnect, subscribeToWallets, subscribeToWallet, handleMessage, processLogNotification inchangées)

private parseTransactionLogs(logs: string[], signature: string): ParsedTransaction | null {
// Détecter le type de transaction via les logs
let type: 'BUY' | 'SELL' | 'TRANSFER' | 'UNKNOWN' = 'UNKNOWN';
let tokenMint: string | undefined;
let amountSol = 0;
let destinationWallet: string | undefined;
let walletSource: string = ''; // Ajout d'une variable locale

const logString = logs.join(' ');

// Détecter un SWAP (BUY ou SELL)
if (logString.includes('Program log: Instruction: Swap')) {
  // ... (Logique SWAP inchangée)
  if (logString.includes('wsol') || logString.includes('So11111111111111111111111111111111111111112')) {
    const solMatch = logString.match(/Transfer: (\d+\.?\d*) SOL/);
    if (solMatch) {
      amountSol = parseFloat(solMatch[1]);
    }

    const mintMatch = logString.match(/[A-HJ-NP-Za-km-z1-9]{32,44}/g);
    if (mintMatch) {
      tokenMint = mintMatch.find(addr => 
        addr !== 'So11111111111111111111111111111111111111112' &&
        addr.length >= 32
      );
    }

    if (logString.includes('from:') && logString.includes('to:')) {
      type = logString.indexOf('from:') < logString.indexOf('to:') ? 'BUY' : 'SELL';
      // Tentative d'extraire la source (très difficile sans l'API, on utilise le master par défaut)
      // Pour les trades, la source est souvent un wallet suivi qui a initié l'instruction.
      // Par simplification, on l'initialise au master wallet si l'instruction de swap est détectée.
      walletSource = config.masterWallet;
    }
  }
}

// Détecter un TRANSFER de SOL
if (logString.includes('Transfer') && logString.includes('lamports')) {
  const lamportsMatch = logString.match(/(\d+) lamports/);
  if (lamportsMatch) {
    amountSol = parseInt(lamportsMatch[1]) / 1e9;
    
    if (amountSol >= runtimeConfig.minSolTransfer && amountSol <= runtimeConfig.maxSolTransfer) { 
      type = 'TRANSFER';
      
      const addressMatch = logString.match(/to: ([A-HJ-NP-Za-km-z1-9]{32,44})/);
      if (addressMatch) {
        destinationWallet = addressMatch[1];
      }
      // On peut aussi essayer d'extraire le 'from' pour la source dans le cas d'un TRANSFER
      const fromMatch = logString.match(/from: ([A-HJ-NP-Za-km-z1-9]{32,44})/);
      if (fromMatch) {
          walletSource = fromMatch[1];
      }
    }
  }
}

if (type === 'UNKNOWN') return null;

return {
  walletSource: walletSource || config.masterWallet, // ASSURER que c'est une string
  type,
  tokenMint,
  amountSol,
  destinationWallet,
  timestamp: Date.now()
};
}

private async handleParsedTransaction(parsed: ParsedTransaction) {
console.log(`🔍 Transaction parsée: ${parsed.type}`);

// DISCOVERY WALLET - Nouveau wallet trouvé
if (parsed.type === 'TRANSFER' && parsed.destinationWallet && runtimeConfig.discoveryEnabled) {
  if (parsed.amountSol >= runtimeConfig.minSolTransfer && 
      parsed.amountSol <= runtimeConfig.maxSolTransfer) {
    
    const isAlreadyFollowed = ledger.isWalletFollowed(parsed.destinationWallet);
    
    if (!isAlreadyFollowed) {
      console.log(`🆕 Nouveau wallet découvert: ${parsed.destinationWallet.slice(0, 8)}...`);
      
      telegramBot.sendWalletDiscovered(
        parsed.destinationWallet,
        parsed.amountSol
      );
    }
  }
  return;
}

// TRADE DÉTECTÉ - BUY ou SELL
if ((parsed.type === 'BUY' || parsed.type === 'SELL') && parsed.tokenMint) {
  
  // Utiliser la walletSource parsée (qui est garantie d'être une string)
  const source = parsed.walletSource; 

  console.log(`🎯 ${parsed.type} détecté de ${source.slice(0, 8)}...: ${parsed.tokenMint.slice(0, 8)}...`);

  // Créer le trade dans le ledger avec la config actuelle
  const trade = ledger.createTrade({
    walletSource: source, 
    tokenMint: parsed.tokenMint,
    tokenSymbol: parsed.tokenSymbol,
    type: parsed.type,
    amountSol: runtimeConfig.tradeSize, 
    tpPercent: runtimeConfig.tpPercent, 
    slPercent: runtimeConfig.slPercent,
    mode: config.mode
  });

  // Notifier via Telegram (qui va auto-exécuter)
  await telegramBot.sendTradeDetected(trade);
}
}

// ... (Reste de la classe inchangé)

addWallet(address: string) {
if (!this.watchedWallets.has(address)) {
this.watchedWallets.add(address);
if (this.ws && this.ws.readyState === WebSocket.OPEN) {
this.subscribeToWallet(address);
}
console.log(`➕ Wallet ajouté: ${address.slice(0, 8)}...`);
}
}

removeWallet(address: string) {
this.watchedWallets.delete(address);
console.log(`➖ Wallet retiré: ${address.slice(0, 8)}...`);
}

getWatchedWallets(): string[] {
return Array.from(this.watchedWallets);
}

isActive(): boolean {
return this.isRunning && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
}
}

export const listener = new SolanaListener();
