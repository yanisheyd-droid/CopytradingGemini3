import { Connection, PublicKey } from '@solana/web3.js';
import { config, runtimeConfig, getRuntimeConfig } from '../config/environment';
import { ledger } from './ledger'; // CORRECTION du chemin et des guillemets
import { telegramBot } from '../telegram/bot';
import { listener } from './listener'; // CORRECTION du chemin et des guillemets

interface DiscoveredWallet {
address: string;
discoveredAt: number;
transferAmount: number;
fromWallet: string;
notified: boolean;
}

class DiscoveryWallet {
private connection: Connection;
private discoveredWallets: Map<string, DiscoveredWallet> = new Map();
private _isRunning: boolean = false; // Correction TS2300

constructor() {
this.connection = new Connection(config.rpcHttps, 'confirmed');
}

start() {
if (this._isRunning) {
console.log('Discovery Wallet déjà actif');
return;
}

console.log('🔍 Démarrage Discovery Wallet...');
this._isRunning = true;

console.log(`📊 Critères de découverte:`);
console.log(`   Min: ${runtimeConfig.minSolTransfer} SOL`);
console.log(`   Max: ${runtimeConfig.maxSolTransfer} SOL`);
}

stop() {
this._isRunning = false;
console.log('🛑 Discovery Wallet arrêté');
}

async processTransfer(
fromWallet: string,
toWallet: string,
amount: number,
signature: string
) {
if (!this._isRunning) return;

// Vérifier si c'est dans la fourchette
if (amount < runtimeConfig.minSolTransfer || amount > runtimeConfig.maxSolTransfer) {
  return;
}

// Vérifier si le fromWallet est suivi
const isFromWalletFollowed = ledger.isWalletFollowed(fromWallet);
if (!isFromWalletFollowed && fromWallet !== config.masterWallet) {
  return;
}

// Vérifier si le toWallet n'est pas déjà suivi
const isToWalletFollowed = ledger.isWalletFollowed(toWallet);
if (isToWalletFollowed) {
  console.log(`ℹ️ Wallet ${toWallet.slice(0, 8)}... déjà suivi`);
  return;
}

// Vérifier si déjà découvert
if (this.discoveredWallets.has(toWallet)) {
  console.log(`ℹ️ Wallet ${toWallet.slice(0, 8)}... déjà découvert`);
  return;
}

console.log(`🆕 NOUVEAU WALLET DÉCOUVERT!`);
console.log(`   De: ${fromWallet.slice(0, 8)}...`);
console.log(`   À: ${toWallet.slice(0, 8)}...`);
console.log(`   Montant: ${amount} SOL`);

// Enregistrer la découverte
const discovery: DiscoveredWallet = {
  address: toWallet,
  discoveredAt: Date.now(),
  transferAmount: amount,
  fromWallet,
  notified: false
};

this.discoveredWallets.set(toWallet, discovery);

// Analyser le wallet avant de notifier
const analysis = await this.analyzeWallet(toWallet);

if (analysis.suspicious) {
  console.log(`⚠️ Wallet suspect, notification ignorée`);
  discovery.notified = true; // Marquer comme notifié pour ne pas re-tenter
  return;
}

// Notifier via Telegram
await this.notifyDiscovery(discovery, analysis);
discovery.notified = true;
}

private async analyzeWallet(address: string): Promise<any> {
try {
const pubkey = new PublicKey(address);

  // Récupérer le solde
  const balance = await this.connection.getBalance(pubkey);
  const balanceSOL = balance / 1e9;

  // Récupérer l'historique des transactions (dernières 10)
  const signatures = await this.connection.getSignaturesForAddress(
    pubkey,
    { limit: 10 }
  );

  const txCount = signatures.length;
  
  // Vérifier si c'est un wallet actif
  const isActive = txCount > 0;
  
  // Heuristique simple: wallet suspect si balance très élevée ou 0 transactions
  const suspicious = balanceSOL > 1000 || txCount === 0;

  return {
    balance: balanceSOL,
    txCount,
    isActive,
    suspicious,
    lastTx: signatures[0]?.blockTime || null
  };

} catch (error) {
  console.error(`❌ Erreur analyse wallet:`, error);
  return {
    balance: 0,
    txCount: 0,
    isActive: false,
    suspicious: false,
    lastTx: null
  };
}
}

private async notifyDiscovery(discovery: DiscoveredWallet, analysis: any) {
const message = `
🔍 **NOUVEAU WALLET DÉCOUVERT**

**Destination:**
\`${discovery.address}\`

**Transfer:**
${discovery.transferAmount} SOL depuis
\`${discovery.fromWallet.slice(0, 8)}…\`

**Analyse:**
💰 Balance: ${analysis.balance.toFixed(4)} SOL
📊 Transactions: ${analysis.txCount}
${analysis.isActive ? '✅' : '⚠️'} ${analysis.isActive ? 'Actif' : 'Inactif'}

Voulez-vous suivre ce wallet ?
`;

telegramBot.getBot().sendMessage(config.chatId, message, {
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [
        { 
          text: '✅ Ajouter et Surveiller', 
          callback_data: `confirm_wallet_${discovery.address}` 
        }
      ],
      [
        { 
          text: '❌ Ignorer', 
          callback_data: 'ignore_wallet' 
        }
      ],
      [
        { 
          text: '📊 Voir Détails', 
          callback_data: `wallet_details_${discovery.address}` 
        }
      ]
    ]
  }
});
}

async addDiscoveredWallet(address: string): Promise<boolean> {
const discovery = this.discoveredWallets.get(address);
if (!discovery) {
console.log(`❌ Wallet ${address} non trouvé dans les découvertes`);
return false;
}

// Ajouter au ledger
ledger.addWallet(address, 'discovery');

// Ajouter au listener
listener.addWallet(address);

console.log(`✅ Wallet ${address.slice(0, 8)}... ajouté avec succès`);

// Notification
telegramBot.getBot().sendMessage(
  config.chatId,
  `✅ Wallet ajouté avec succès!\n\n\`${address}\`\n\nLe bot surveille maintenant ce wallet.`,
  { parse_mode: 'Markdown' }
);

return true;
}

getDiscoveredWallets(): DiscoveredWallet[] {
return Array.from(this.discoveredWallets.values());
}

getUnnotifiedCount(): number {
return Array.from(this.discoveredWallets.values())
.filter(d => !d.notified).length;
}

clearOldDiscoveries(olderThanHours: number = 24) {
const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);

let cleared = 0;
for (const [address, discovery] of this.discoveredWallets.entries()) {
  if (discovery.discoveredAt < cutoff) {
    this.discoveredWallets.delete(address);
    cleared++;
  }
}

if (cleared > 0) {
  console.log(`🧹 ${cleared} découvertes anciennes nettoyées`);
}
}

isRunning(): boolean {
return this._isRunning; 
}

// Statistiques
getStats() {
const discoveries = this.getDiscoveredWallets();
const added = discoveries.filter(d => ledger.isWalletFollowed(d.address));

return {
  total: discoveries.length,
  added: added.length,
  pending: discoveries.length - added.length,
  avgTransferAmount: discoveries.reduce((sum, d) => sum + d.transferAmount, 0) / discoveries.length || 0
};
}
}

export const discoveryWallet = new DiscoveryWallet();
