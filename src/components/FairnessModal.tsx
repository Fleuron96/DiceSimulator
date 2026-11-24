import React from 'react';
import { RefreshCw, ShieldCheck, X } from 'lucide-react';
import { generateRandomSeed } from '../utils/diceMath';

interface FairnessModalProps {
  isOpen: boolean;
  seed: string;
  useSeed: boolean;
  winChance: number;
  multiplier: number;
  onChangeSeed: (seed: string) => void;
  onToggleUseSeed: (use: boolean) => void;
  onClose: () => void;
}

export const FairnessModal: React.FC<FairnessModalProps> = ({
  isOpen,
  seed,
  useSeed,
  winChance,
  multiplier,
  onChangeSeed,
  onToggleUseSeed,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-[#1a2c38] border border-[#2f4553] rounded-t-2xl sm:rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#2f4553]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-5 h-5 text-[#00e701] shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              Équité & Calibration Mathématique
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[#b1bad3] hover:text-white hover:bg-[#213743] transition-colors cursor-pointer shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-sm text-[#b1bad3]">
          <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5 sm:p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold text-white">
                House Edge : 1 % (RTP 99 %)
              </span>
              <span className="text-xs font-mono-tabular text-[#00e701]">
                99,0000 % théorique
              </span>
            </div>
            <p className="text-xs leading-relaxed">
              Toutes les probabilités et multiplicateurs sont strictement
              calibrés sur un avantage maison fixe de 1 %. Le tirage du dé suit
              une loi uniforme calibrée sur [0,00 ; 100,00) afin que la
              probabilité exacte de gain corresponde à P / 100.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3">
              <div className="text-[#8b9bb4] mb-1">Formule Multiplicateur</div>
              <div className="font-mono-tabular text-white font-semibold">
                M = 99 / P
              </div>
              <div className="font-mono-tabular text-[#b1bad3] mt-1">
                99 / {winChance.toFixed(4)} = {multiplier.toFixed(4)}×
              </div>
            </div>
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3">
              <div className="text-[#8b9bb4] mb-1">Espérance par pari</div>
              <div className="font-mono-tabular text-white font-semibold">
                E[Gain] = Mise × (-0,01)
              </div>
              <div className="font-mono-tabular text-[#b1bad3] mt-1">
                -1,00 % du volume misé
              </div>
            </div>
          </div>

          {/* Seed Controls */}
          <div className="pt-2 border-t border-[#2f4553] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-white">
                  Graine aléatoire déterministe (Seed)
                </div>
                <div className="text-[11px] text-[#8b9bb4]">
                  Activez pour rejouer exactement la même séquence de lancers et
                  comparer vos stratégies.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleUseSeed(!useSeed)}
                className={`px-3 min-h-[38px] rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                  useSeed
                    ? 'bg-[#1475e1] text-white'
                    : 'bg-[#2f4553] text-[#b1bad3] hover:text-white'
                }`}
              >
                {useSeed ? 'Activée' : 'Aléatoire pur'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={seed}
                onChange={(e) => onChangeSeed(e.target.value)}
                placeholder="Ex: STAKE-99RTP"
                className="flex-1 min-w-0 bg-[#0f212e] border border-[#2f4553] focus:border-[#1475e1] rounded-md px-3 py-2.5 text-base sm:text-xs font-mono-tabular text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onChangeSeed(generateRandomSeed())}
                className="flex items-center gap-1.5 px-3 min-h-[42px] rounded-md bg-[#2f4553] hover:bg-[#3a5465] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Générer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 sm:px-5 py-3.5 bg-[#152430] border-t border-[#2f4553]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 min-h-[42px] rounded-md bg-[#1475e1] hover:bg-[#1f83f0] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
