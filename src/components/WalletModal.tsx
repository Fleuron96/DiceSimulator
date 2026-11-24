import React, { useState, useEffect } from 'react';
import { Wallet, X, RotateCcw } from 'lucide-react';
import { CryptoCurrency } from '../types/dice';
import { CRYPTO_LIST, CRYPTO_MAP } from '../data/cryptos';
import { formatCompactCurrency, formatCrypto } from '../utils/diceMath';
import { TokenIcon } from './StakeLogo';

interface WalletModalProps {
  isOpen: boolean;
  selectedCrypto: CryptoCurrency;
  onSelectCrypto: (currency: CryptoCurrency) => void;
  disableCryptoSwitch?: boolean;
  currentBalance: number;
  initialCapital: number;
  onClose: () => void;
  onApplyCapital: (newCapital: number) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  selectedCrypto,
  onSelectCrypto,
  disableCryptoSwitch = false,
  currentBalance,
  initialCapital,
  onClose,
  onApplyCapital,
}) => {
  const [amountInput, setAmountInput] = useState<string>(String(initialCapital));

  useEffect(() => {
    if (isOpen) {
      setAmountInput(String(initialCapital));
    }
  }, [isOpen, initialCapital, selectedCrypto]);

  if (!isOpen) return null;

  const activeCrypto = CRYPTO_MAP[selectedCrypto];
  const parsed = parseFloat(amountInput);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#1a2c38] border border-[#2f4553] rounded-t-2xl sm:rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#2f4553]">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-[#1475e1]" />
            <h2 className="text-base font-bold text-white">
              Portefeuille virtuel
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[#b1bad3] hover:text-white hover:bg-[#213743] transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-xs text-[#b1bad3] leading-relaxed">
            Ce portefeuille utilise uniquement des jetons virtuels de
            démonstration (sans argent réel). Sélectionnez une cryptomonnaie et
            définissez votre capital de départ.
          </p>

          {/* Crypto Selector Grid */}
          <div>
            <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
              Cryptomonnaie active
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CRYPTO_LIST.map((crypto) => {
                const isSelected = crypto.id === selectedCrypto;
                return (
                  <button
                    key={crypto.id}
                    type="button"
                    disabled={disableCryptoSwitch && !isSelected}
                    onClick={() => onSelectCrypto(crypto.id)}
                    className={`flex items-center gap-2 px-2.5 min-h-[40px] rounded-md border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                      isSelected
                        ? 'bg-[#213743] border-[#1475e1] text-white'
                        : 'bg-[#0f212e] border-[#2f4553] text-[#b1bad3] hover:text-white hover:bg-[#213743]/70'
                    }`}
                  >
                    <TokenIcon currency={crypto.id} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{crypto.symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#b1bad3]">
                Solde actuel ({activeCrypto.name})
              </div>
              <div className="text-[11px] font-mono-tabular text-[#8b9bb4] mt-0.5">
                ≈ {formatCompactCurrency(currentBalance * activeCrypto.usdRate)}
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono-tabular text-sm font-bold text-white truncate">
              <span className="truncate">{formatCrypto(currentBalance)}</span>
              <TokenIcon currency={selectedCrypto} className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
              Nouveau capital de départ ({activeCrypto.symbol})
            </label>
            <div className="flex items-center bg-[#0f212e] border border-[#2f4553] focus-within:border-[#1475e1] rounded-md px-3 py-2.5 transition-colors">
              <input
                type="number"
                min="0.0001"
                step="any"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full bg-transparent text-white font-mono-tabular text-base sm:text-sm focus:outline-none"
                placeholder={String(activeCrypto.defaultCapital)}
              />
              <TokenIcon currency={selectedCrypto} className="w-4 h-4 shrink-0 ml-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {activeCrypto.quickPresets.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountInput(String(val))}
                className={`min-h-[42px] rounded text-xs font-semibold font-mono-tabular border transition-colors cursor-pointer ${
                  parsed === val
                    ? 'bg-[#213743] border-[#1475e1] text-white'
                    : 'bg-[#0f212e] border-[#2f4553] text-[#b1bad3] hover:text-white hover:bg-[#213743]'
                }`}
              >
                {val.toLocaleString('fr-FR')} {activeCrypto.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 px-4 sm:px-5 py-4 bg-[#152430] border-t border-[#2f4553]">
          <button
            type="button"
            onClick={() => {
              onApplyCapital(initialCapital);
              onClose();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 min-h-[42px] rounded-md bg-[#2f4553] hover:bg-[#3a5465] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              Réinitialiser ({initialCapital.toLocaleString('fr-FR')}{' '}
              {activeCrypto.symbol})
            </span>
          </button>

          <button
            type="button"
            disabled={!isValid}
            onClick={() => {
              if (isValid) {
                onApplyCapital(parsed);
                onClose();
              }
            }}
            className="w-full sm:w-auto px-4 min-h-[42px] rounded-md bg-[#1475e1] hover:bg-[#1f83f0] disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Appliquer le capital
          </button>
        </div>
      </div>
    </div>
  );
};

