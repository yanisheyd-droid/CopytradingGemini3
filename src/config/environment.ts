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