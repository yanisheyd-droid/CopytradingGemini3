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
private ws: WebSocket | null = null;
private reconnectAttempts = 0;
private maxReconnectAttempts = 10;
private subscriptionId: number | null = null;
private isRunning = false;
private watchedWallets: Set<string> = new Set();

constructor() {
this.watchedWallets.add(config.masterWallet);
}

async start() {
if (this.isRunning) {
console.log('Listener déjà actif');
return;
}

console.log('🎧 Démarrage du listener WebSocket...');
this.isRunning = true;
this.connect();
}

stop() {
this.isRunning = false;
if (this.ws) {
this.ws.close();
this.ws = null;
}
console.log('🛑 Listener arrêté');
}

private connect() {
try {
this.ws = new WebSocket(config.quicknodeWss);

  this.ws.on('open', () => {
    console.log('✅ WebSocket connecté');
    this.reconnectAttempts = 0;
    this.subscribeToWallets();
  });

  this.ws.on('message', (data: WebSocket.Data) => {
    this.handleMessage(data.toString());
  });

  this.ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  this.ws.on('close', () => {
    console.log('🔌 WebSocket déconnecté');
    this.attemptReconnect();
  });

} catch (error) {
  console.error('❌ Erreur de connexion:', error);
  this.attemptReconnect();
}
}

private attemptReconnect() {
if (!this.isRunning) return;

if (this.reconnectAttempts < this.maxReconnectAttempts) {
  this.reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
  
  console.log(`🔄 Reconnexion dans ${delay/1000}s (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
  
  setTimeout(() => {
    this.connect();
  }, delay);
} else {
  console.error('❌ Max tentatives de reconnexion atteint');
  this.isRunning = false;
}
}

private subscribeToWallets() {
if (!this.ws) return;

// Récupérer les wallets actifs depuis le ledger
const activeWallets = ledger.getActiveWallets();

// Ajouter le master wallet
if (!activeWallets.includes(config.masterWallet)) {
  activeWallets.push(config.masterWallet);
}

// Mise à jour des wallets surveillés
this.watchedWallets = new Set(activeWallets);

console.log(`👀 Surveillance de ${this.watchedWallets.size} wallets...`);

// Souscrire à chaque wallet
this.watchedWallets.forEach(wallet => {
  this.subscribeToWallet(wallet);
});
}

private subscribeToWallet(walletAddress: string) {
if (!this.ws) return;

const subscribeMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'logsSubscribe',
  params: [
    {
      mentions: [walletAddress]
    },
    {
      commitment: 'processed' // Latence minimale
    }
  ]
};

this.ws.send(JSON.stringify(subscribeMessage));
console.log(`✅ Souscription au wallet: ${walletAddress.slice(0, 8)}...`);
}

private handleMessage(data: string) {
try {
const message = JSON.parse(data);

  // Confirmation de souscription
  if (message.result && !message.method) {
    this.subscriptionId = message.result;
    console.log(`📡 Subscription ID: ${this.subscriptionId}`);
    return;
  }

  // Notification de log
  if (message.method === 'logsNotification') {
    this.processLogNotification(message.params);
  }

} catch (error) {
  console.error('❌ Erreur parsing message:', error);
}
}

private async processLogNotification(params: any) {
const result = params?.result;
if (!result) return;

const signature = result.value?.signature;
const logs = result.value?.logs || [];
const err = result.value?.err;

if (err) {
  console.log('⚠️ Transaction échouée:', signature);
  return;
}

console.log(`📝 Transaction détectée: ${signature?.slice(0, 8)}...`);

// Parser la transaction
const parsed = this.parseTransactionLogs(logs, signature);

if (parsed) {
  await this.handleParsedTransaction(parsed);
}
}

private parseTransactionLogs(logs: string[], signature: string): ParsedTransaction | null {
// Détecter le type de transaction via les logs
let type: 'BUY' | 'SELL' | 'TRANSFER' | 'UNKNOWN' = 'UNKNOWN';
let tokenMint: string | undefined;
let amountSol = 0;
let destinationWallet: string | undefined;

const logString = logs.join(' ');

// Détecter un SWAP (BUY ou SELL)
if (logString.includes('Program log: Instruction: Swap')) {
  // Analyser si c'est un BUY ou SELL
  if (logString.includes('wsol') || logString.includes('So11111111111111111111111111111111111111112')) {
    // Si SOL est mentionné, déterminer la direction
    const solMatch = logString.match(/Transfer: (\d+\.?\d*) SOL/);
    if (solMatch) {
      amountSol = parseFloat(solMatch[1]);
    }

    // Rechercher le token mint
    const mintMatch = logString.match(/[A-HJ-NP-Za-km-z1-9]{32,44}/g);
    if (mintMatch) {
      // Filtrer pour trouver le token (pas SOL)
      tokenMint = mintMatch.find(addr => 
        addr !== 'So11111111111111111111111111111111111111112' &&
        addr.length >= 32
      );
    }

    // Déterminer BUY vs SELL
    if (logString.includes('from:') && logString.includes('to:')) {
      type = logString.indexOf('from:') < logString.indexOf('to:') ? 'BUY' : 'SELL';
    }
  }
}

// Détecter un TRANSFER de SOL
if (logString.includes('Transfer') && logString.includes('lamports')) {
  const lamportsMatch = logString.match(/(\d+) lamports/);
  if (lamportsMatch) {
    amountSol = parseInt(lamportsMatch[1]) / 1e9; // Convertir en SOL
    
    // Vérifier si c'est dans la fourchette de découverte
    if (amountSol >= runtimeConfig.minSolTransfer && amountSol <= runtimeConfig.maxSolTransfer) { // CORRECTION TS2339
      type = 'TRANSFER';
      
      // Extraire l'adresse de destination
      const addressMatch = logString.match(/to: ([A-HJ-NP-Za-km-z1-9]{32,44})/);
      if (addressMatch) {
        destinationWallet = addressMatch[1];
      }
    }
  }
}

if (type === 'UNKNOWN') return null;

return {
  walletSource: '', // Sera rempli par le contexte
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
  // Vérifier si dans la fourchette configurée
  if (parsed.amountSol >= runtimeConfig.minSolTransfer && 
      parsed.amountSol <= runtimeConfig.maxSolTransfer) {
    
    const isAlreadyFollowed = ledger.isWalletFollowed(parsed.destinationWallet);
    
    if (!isAlreadyFollowed) {
      console.log(`🆕 Nouveau wallet découvert: ${parsed.destinationWallet.slice(0, 8)}...`);
      
      // Notifier via Telegram
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
  console.log(`🎯 ${parsed.type} détecté: ${parsed.tokenMint.slice(0, 8)}...`);
  
  // Créer le trade dans le ledger avec la config actuelle
  const trade = ledger.createTrade({
    walletSource: parsed.walletSource || 'unknown',
    tokenMint: parsed.tokenMint,
    tokenSymbol: parsed.tokenSymbol,
    type: parsed.type,
    status: 'PENDING',
    amountSol: runtimeConfig.tradeSize, // Utiliser la taille configurée
    tpPercent: runtimeConfig.tpPercent, // Utiliser le TP configuré
    slPercent: runtimeConfig.slPercent, // Utiliser le SL configuré
    mode: config.mode
  });

  // Notifier via Telegram (qui va auto-exécuter)
  await telegramBot.sendTradeDetected(trade);
}
}

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
// Note: Solana WebSocket ne supporte pas la désinscription individuelle
// Il faudrait recréer toutes les souscriptions
}

getWatchedWallets(): string[] {
return Array.from(this.watchedWallets);
}

isActive(): boolean {
return this.isRunning && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
}
}

export const listener = new SolanaListener();
