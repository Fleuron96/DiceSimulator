import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { CryptoCurrency } from '../types/dice';
import { CRYPTO_LIST, CRYPTO_MAP } from '../data/cryptos';
import { StakeLogo, TokenIcon } from './StakeLogo';
import { formatCompactCurrency, formatCrypto } from '../utils/diceMath';

interface HeaderBarProps {
  selectedCrypto: CryptoCurrency;
  wallets: Record<CryptoCurrency, { balance: number; initialCapital: number }>;
  onSelectCrypto: (currency: CryptoCurrency) => void;
  disableCryptoSwitch?: boolean;
  balance: number;
  initialCapital: number;
  onOpenWallet: () => void;
  onQuickSetBalance: (amount: number) => void;
  onOpenFairness: () => void;
  onScrollToBacktest: () => void;
  onResetSession: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  selectedCrypto,
  wallets,
  onSelectCrypto,
  disableCryptoSwitch = false,
  balance,
  initialCapital,
  onOpenWallet,
  onQuickSetBalance,
  onOpenFairness,
  onScrollToBacktest,
  onResetSession,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCrypto = CRYPTO_MAP[selectedCrypto];
  const netProfit = balance - initialCapital;
  const mobileDecimals = balance < 10 ? 4 : 2;

  return (
    <header className="sticky top-0 z-30 h-[56px] sm:h-[60px] bg-[#1a2c38] border-b border-[#0f212e] shadow-md px-2.5 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4">
      {/* Left: Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <StakeLogo className="h-5 sm:h-7 w-auto" />
      </div>

      {/* Center: Virtual Balance + Crypto Selector + Portefeuille CTA */}
      <div className="relative flex items-center min-w-0" ref={dropdownRef}>
        <div className="flex items-center rounded-md overflow-hidden shadow-sm border border-[#2f4553]/60">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 sm:gap-2 bg-[#0f212e] hover:bg-[#0b1924] px-2.5 sm:px-3.5 min-h-[40px] text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
            title="Changer de cryptomonnaie ou ajuster le capital virtuel"
          >
            <span className="font-mono-tabular tracking-tight sm:hidden">
              {balance.toLocaleString('fr-FR', {
                minimumFractionDigits: mobileDecimals,
                maximumFractionDigits: mobileDecimals,
              })}
            </span>
            <span className="font-mono-tabular tracking-tight hidden sm:inline">
              {formatCrypto(balance)}
            </span>
            <TokenIcon
              currency={selectedCrypto}
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
            />
            <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#b1bad3]" />
          </button>
          <button
            type="button"
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 bg-[#1475e1] hover:bg-[#1f83f0] active:bg-[#1164c2] text-white text-xs sm:text-sm font-semibold px-2.5 sm:px-4 min-h-[40px] transition-colors whitespace-nowrap cursor-pointer"
            aria-label="Portefeuille"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">Portefeuille</span>
          </button>
        </div>

        {dropdownOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[calc(100vw-24px)] max-w-[300px] bg-[#1a2c38] border border-[#2f4553] rounded-lg shadow-2xl p-2 z-50">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[#8b9bb4] flex items-center justify-between border-b border-[#2f4553]/60 mb-1.5">
              <span>Portefeuille crypto</span>
              <span
                className={`font-mono-tabular font-semibold ${
                  netProfit >= 0 ? 'text-[#00e701]' : 'text-[#e9113c]'
                }`}
              >
                {netProfit >= 0 ? '+' : ''}
                {Math.abs(netProfit) > 0 && Math.abs(netProfit) < 1
                  ? netProfit.toFixed(6)
                  : netProfit.toFixed(2)}{' '}
                {selectedCrypto}
              </span>
            </div>

            {/* Crypto List */}
            <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
              {CRYPTO_LIST.map((crypto) => {
                const wallet = wallets[crypto.id];
                const isSelected = crypto.id === selectedCrypto;
                return (
                  <button
                    key={crypto.id}
                    type="button"
                    disabled={disableCryptoSwitch && !isSelected}
                    onClick={() => {
                      if (!isSelected) {
                        onSelectCrypto(crypto.id);
                      }
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 min-h-[44px] rounded-md text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-[#213743] text-white'
                        : 'text-[#d5e0ea] hover:bg-[#213743]/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono-tabular text-xs sm:text-sm font-semibold text-white truncate">
                        {formatCrypto(wallet.balance)}
                      </div>
                      <div className="text-[10px] text-[#8b9bb4] font-mono-tabular">
                        {formatCompactCurrency(wallet.balance * crypto.usdRate)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-white leading-tight">
                          {crypto.symbol}
                        </div>
                        <div className="text-[10px] text-[#8b9bb4] leading-tight">
                          {crypto.name}
                        </div>
                      </div>
                      <TokenIcon currency={crypto.id} className="w-5 h-5 shrink-0" />
                      <span className="w-3.5 flex items-center justify-center">
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#00e701]" />
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Capital Presets for Active Crypto */}
            <div className="mt-2 pt-2 border-t border-[#2f4553]/60">
              <div className="text-[11px] font-medium text-[#8b9bb4] px-2.5 pb-1.5">
                Capital rapide ({activeCrypto.symbol})
              </div>
              <div className="grid grid-cols-2 gap-1 px-1">
                {activeCrypto.quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={disableCryptoSwitch}
                    onClick={() => {
                      onQuickSetBalance(preset);
                      setDropdownOpen(false);
                    }}
                    className="flex items-center justify-between px-2.5 min-h-[36px] rounded bg-[#0f212e] hover:bg-[#213743] border border-[#2f4553]/60 text-xs text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="font-mono-tabular font-semibold">
                      {preset.toLocaleString('fr-FR')}
                    </span>
                    <TokenIcon currency={selectedCrypto} className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Functional Utility Actions */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onScrollToBacktest}
          className="flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] sm:px-2.5 rounded-md text-xs font-semibold text-[#b1bad3] hover:text-white hover:bg-[#213743] transition-colors whitespace-nowrap cursor-pointer"
          title="Ouvrir le panneau Statistiques"
          aria-label="Ouvrir le panneau Statistiques"
        >
          <BarChart3 className="w-4 h-4" />
          <span className="hidden md:inline">Statistiques</span>
        </button>
        <button
          type="button"
          onClick={onOpenFairness}
          className="flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] sm:px-2.5 rounded-md text-xs font-semibold text-[#b1bad3] hover:text-white hover:bg-[#213743] transition-colors whitespace-nowrap cursor-pointer"
          title="Équité & House Edge 1 % (RTP 99 %)"
          aria-label="Équité et RTP 99 %"
        >
          <ShieldCheck className="w-4 h-4 text-[#00e701]" />
          <span className="hidden md:inline">RTP 99 %</span>
        </button>
        <button
          type="button"
          onClick={onResetSession}
          className="hidden sm:flex items-center justify-center min-w-[40px] min-h-[40px] rounded-md text-[#b1bad3] hover:text-white hover:bg-[#213743] transition-colors cursor-pointer"
          title="Réinitialiser l'historique de la session"
          aria-label="Réinitialiser l'historique de la session"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
