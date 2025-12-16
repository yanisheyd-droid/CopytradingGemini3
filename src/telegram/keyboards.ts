import { InlineKeyboardButton } from 'node-telegram-bot-api';

export const keyboards = {
  mainMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '▶️ Démarrer Bot', callback_data: 'start_bot' },
      { text: '⏸ Arrêter Bot', callback_data: 'stop_bot' }
    ],
    [
      { text: '📊 Voir PNL', callback_data: 'show_pnl' },
      { text: '💼 Wallets Suivis', callback_data: 'show_wallets' }
    ],
    [
      { text: '📈 Dernier Trade', callback_data: 'last_trade' },
      { text: '🎯 Positions Actives', callback_data: 'active_positions' }
    ],
    [
      { text: '➕ Ajouter Wallet', callback_data: 'add_wallet' },
      { text: '⚙️ Paramètres', callback_data: 'settings' }
    ]
  ],

  settingsMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '💰 Taille de Trade', callback_data: 'set_trade_size' },
      { text: '🎯 Take Profit', callback_data: 'set_tp' }
    ],
    [
      { text: '🛑 Stop Loss', callback_data: 'set_sl' },
      { text: '🔍 Discovery Mode', callback_data: 'toggle_discovery' }
    ],
    [
      { text: '📊 Voir Config', callback_data: 'show_config' },
      { text: '🔙 Menu Principal', callback_data: 'main_menu' }
    ]
  ],

  tradeSizeMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '0.1 SOL', callback_data: 'size_0.1' },
      { text: '0.5 SOL', callback_data: 'size_0.5' },
      { text: '1 SOL', callback_data: 'size_1' }
    ],
    [
      { text: '2 SOL', callback_data: 'size_2' },
      { text: '5 SOL', callback_data: 'size_5' },
      { text: '10 SOL', callback_data: 'size_10' }
    ],
    [
      { text: '🔙 Retour', callback_data: 'settings' }
    ]
  ],

  tpMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '+10%', callback_data: 'tp_global_10' },
      { text: '+25%', callback_data: 'tp_global_25' },
      { text: '+50%', callback_data: 'tp_global_50' }
    ],
    [
      { text: '+100%', callback_data: 'tp_global_100' },
      { text: '+200%', callback_data: 'tp_global_200' },
      { text: '+500%', callback_data: 'tp_global_500' }
    ],
    [
      { text: '🔙 Retour', callback_data: 'settings' }
    ]
  ],

  slMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '-5%', callback_data: 'sl_global_5' },
      { text: '-10%', callback_data: 'sl_global_10' },
      { text: '-20%', callback_data: 'sl_global_20' }
    ],
    [
      { text: '-30%', callback_data: 'sl_global_30' },
      { text: '-50%', callback_data: 'sl_global_50' }
    ],
    [
      { text: '🔙 Retour', callback_data: 'settings' }
    ]
  ],

  discoveryMenu: (minSol: number, maxSol: number): InlineKeyboardButton[][] => [
    [
      { text: 'Min: 0.1 SOL', callback_data: 'disc_min_0.1' },
      { text: 'Min: 0.5 SOL', callback_data: 'disc_min_0.5' },
      { text: 'Min: 1 SOL', callback_data: 'disc_min_1' }
    ],
    [
      { text: 'Max: 5 SOL', callback_data: 'disc_max_5' },
      { text: 'Max: 10 SOL', callback_data: 'disc_max_10' },
      { text: 'Max: 20 SOL', callback_data: 'disc_max_20' }
    ],
    [
      { text: `📊 Config: ${minSol}-${maxSol} SOL`, callback_data: 'noop' }
    ],
    [
      { text: '🔙 Retour', callback_data: 'settings' }
    ]
  ],

  // Notification seulement - pas de boutons car automatique
  tradeDetected: (tradeId: string): InlineKeyboardButton[][] => [
    [
      { text: '📊 Voir Détails', callback_data: `details_${tradeId}` }
    ]
  ],

  confirmWallet: (address: string): InlineKeyboardButton[][] => [
    [
      { text: '✅ Ajouter ce Wallet', callback_data: `confirm_wallet_${address}` },
      { text: '❌ Ignorer', callback_data: 'ignore_wallet' }
    ]
  ],

  walletActions: (address: string): InlineKeyboardButton[][] => [
    [
      { text: '🔄 Activer/Désactiver', callback_data: `toggle_${address}` },
      { text: '🗑 Supprimer', callback_data: `remove_${address}` }
    ],
    [
      { text: '📊 Voir Trades', callback_data: `trades_${address}` }
    ]
  ],

  tpSlAdjust: (tradeId: string): InlineKeyboardButton[][] => [
    [
      { text: 'TP: +10%', callback_data: `tp_10_${tradeId}` },
      { text: 'TP: +25%', callback_data: `tp_25_${tradeId}` },
      { text: 'TP: +50%', callback_data: `tp_50_${tradeId}` }
    ],
    [
      { text: 'TP: +100%', callback_data: `tp_100_${tradeId}` },
      { text: 'TP: +200%', callback_data: `tp_200_${tradeId}` }
    ],
    [
      { text: 'SL: -10%', callback_data: `sl_10_${tradeId}` },
      { text: 'SL: -20%', callback_data: `sl_20_${tradeId}` },
      { text: 'SL: -30%', callback_data: `sl_30_${tradeId}` }
    ],
    [
      { text: '✅ Valider et Copier', callback_data: `execute_${tradeId}` }
    ]
  ],

  positionActions: (tradeId: string): InlineKeyboardButton[][] => [
    [
      { text: '💰 Vendre Maintenant', callback_data: `sell_now_${tradeId}` },
      { text: '📊 Détails', callback_data: `details_${tradeId}` }
    ],
    [
      { text: '⚙️ Modifier TP/SL', callback_data: `modify_tpsl_${tradeId}` }
    ]
  ],

  backToMain: (): InlineKeyboardButton[][] => [
    [{ text: '🔙 Menu Principal', callback_data: 'main_menu' }]
  ]
};