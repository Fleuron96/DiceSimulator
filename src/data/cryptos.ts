import { CryptoCurrency, CryptoInfo } from '../types/dice';

export const CRYPTO_LIST: CryptoInfo[] = [
  {
    id: 'USDT',
    symbol: 'USDT',
    name: 'Tether',
    defaultCapital: 1000,
    defaultBet: 1,
    usdRate: 1,
    quickPresets: [100, 1000, 10000, 50000],
  },
  {
    id: 'BTC',
    symbol: 'BTC',
    name: 'Bitcoin',
    defaultCapital: 1,
    defaultBet: 0.001,
    usdRate: 95000,
    quickPresets: [0.1, 1, 5, 10],
  },
  {
    id: 'ETH',
    symbol: 'ETH',
    name: 'Ethereum',
    defaultCapital: 10,
    defaultBet: 0.01,
    usdRate: 3300,
    quickPresets: [1, 10, 50, 100],
  },
  {
    id: 'SOL',
    symbol: 'SOL',
    name: 'Solana',
    defaultCapital: 100,
    defaultBet: 0.1,
    usdRate: 210,
    quickPresets: [10, 100, 500, 1000],
  },
  {
    id: 'POL',
    symbol: 'POL',
    name: 'Polygon',
    defaultCapital: 1000,
    defaultBet: 1,
    usdRate: 0.55,
    quickPresets: [100, 1000, 10000, 50000],
  },
  {
    id: 'BNB',
    symbol: 'BNB',
    name: 'BNB',
    defaultCapital: 25,
    defaultBet: 0.05,
    usdRate: 640,
    quickPresets: [5, 25, 100, 500],
  },
];

export const CRYPTO_MAP: Record<CryptoCurrency, CryptoInfo> = CRYPTO_LIST.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<CryptoCurrency, CryptoInfo>
);
