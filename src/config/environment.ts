import dotenv from 'dotenv';
dotenv.config();

// Configuration persistante modifiable via Telegram
export interface RuntimeConfig {
  // Discovery Wallet (configurable via Telegram)
  discoveryEnabled: boolean;
  minSolTransfer: number;
  maxSolTransfer: number;
  
  // Trading (configurable via Telegram)
  tradeSize: number;
  tpPercent: number;
  slPercent: number;
  
  // Auto-copy
  autoCopy: boolean;
}

export const runtimeConfig: RuntimeConfig = {
  discoveryEnabled: false, // Désactivé par défaut, activable via Telegram
  minSolTransfer: 0.1,
  maxSolTransfer: 5.0,
  tradeSize: 0.5,
  tpPercent: 50,
  slPercent: 20,
  autoCopy: true // Achats et ventes automatiques sans confirmation
};

export const config = {
  masterWallet: process.env.MASTER_WALLET || '',
  quicknodeWss: process.env.QUICKNODE_WSS || '',
  rpcHttps: process.env.RPC_HTTPS || '',
  tgToken: process.env.TG_TOKEN || '',
  chatId: process.env.CHAT_ID || '',
  mode: (process.env.MODE || 'TEST') as 'TEST' | 'REAL',
  autoCopy: process.env.AUTO_COPY === 'true' || true,
};

export function validateConfig() {
  const required = ['masterWallet', 'quicknodeWss', 'tgToken', 'chatId'];
  const missing = required.filter(key => !config[key as keyof typeof config]);
  
  if (missing.length > 0) {
    throw new Error(`Variables manquantes: ${missing.join(', ')}`);
  }
  
  if (config.mode === 'REAL' && !config.rpcHttps) {
    throw new Error('RPC_HTTPS requis en mode REAL');
  }
}

// Helpers pour modifier la config runtime
export function updateRuntimeConfig(updates: Partial<RuntimeConfig>) {
  Object.assign(runtimeConfig, updates);
}

export function getRuntimeConfig(): RuntimeConfig {
  return { ...runtimeConfig };
}