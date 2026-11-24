import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RollMode } from '../types/dice';
import {
  clampWinChance,
  formatRollDisplay,
  targetFromChance,
  chanceFromTarget,
} from '../utils/diceMath';

interface DiceSliderProps {
  mode: RollMode;
  winChance: number;
  lastRoll: {
    value: number;
    won: boolean;
    target: number;
    id: number;
  } | null;
  onChangeWinChance: (newChance: number) => void;
  disabled?: boolean;
}

export const DiceSlider: React.FC<DiceSliderProps> = ({
  mode,
  winChance,
  lastRoll,
  onChangeWinChance,
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const target = targetFromChance(winChance, mode);
  // Handle position in [1, 99] percent on the 0-100 track
  const handlePercent = Math.min(99, Math.max(1, target));

  const updateFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current || disabled) return;
      const rect = trackRef.current.getBoundingClientRect();
      const rawPct = ((clientX - rect.left) / rect.width) * 100;
      const clampedTarget = Math.min(98.99, Math.max(0.01, rawPct));
      // Snap to 0.5 or 0.01 increments smoothly (0.50 step when near 0.5, 0.1 otherwise for smooth control)
      const steppedTarget = Math.round(clampedTarget * 100) / 100;
      const newChance = clampWinChance(chanceFromTarget(steppedTarget, mode));
      onChangeWinChance(newChance);
    },
    [disabled, mode, onChangeWinChance]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: PointerEvent) => {
      updateFromClientX(e.clientX);
    };
    const handleUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [isDragging, updateFromClientX]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? 1 : 0.5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = mode === 'over' ? -step : step;
      onChangeWinChance(clampWinChance(winChance + delta));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = mode === 'over' ? step : -step;
      onChangeWinChance(clampWinChance(winChance + delta));
    }
  };

  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="w-full max-w-[740px] mx-auto px-3 sm:px-8 pt-11 sm:pt-14 pb-5 sm:pb-8 select-none">
      {/* Ticks row: 0, 25, 50, 75, 100 */}
      <div className="relative h-6 sm:h-7 mb-2 mx-2 sm:mx-0">
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${tick}%` }}
          >
            <span className="text-[11px] sm:text-sm font-bold text-white tabular-nums mb-1">
              {tick}
            </span>
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rotate-45 bg-[#2f4553] translate-y-1.5" />
          </div>
        ))}
      </div>

      {/* Outer Dark Bezel Track */}
      <div className="relative bg-[#213743] border-[8px] sm:border-[10px] border-[#213743] rounded-full shadow-inner touch-none">
        {/* Animated Last Roll Result Marker */}
        {lastRoll && (
          <div
            key={lastRoll.id}
            className="absolute -top-11 sm:-top-12 -translate-x-1/2 z-20 transition-all duration-200 ease-out pointer-events-none"
            style={{
              left: `${Math.min(95, Math.max(5, lastRoll.value))}%`,
            }}
          >
            <div
              className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold font-mono-tabular shadow-lg border transition-colors ${
                lastRoll.won
                  ? 'bg-[#0b2e19] text-[#00e701] border-[#00e701]/60'
                  : 'bg-[#2c121a] text-[#ff4d6d] border-[#e9113c]/60'
              }`}
            >
              {formatRollDisplay(lastRoll.value, lastRoll.target)}
            </div>
            <div
              className={`w-2 h-2 rotate-45 mx-auto -mt-1 border-r border-b ${
                lastRoll.won
                  ? 'bg-[#0b2e19] border-[#00e701]/60'
                  : 'bg-[#2c121a] border-[#e9113c]/60'
              }`}
            />
          </div>
        )}

        {/* Inner Track */}
        <div
          ref={trackRef}
          onPointerDown={(e) => {
            if (disabled) return;
            setIsDragging(true);
            updateFromClientX(e.clientX);
          }}
          className={`relative h-3.5 rounded-full bg-[#0f212e] p-0.5 flex items-center touch-none ${
            disabled ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'
          }`}
        >
          {/* Red / Green Bicolore Segments */}
          <div className="relative w-full h-full rounded-full overflow-hidden flex">
            {mode === 'over' ? (
              <>
                <div
                  className="h-full bg-[#e9113c] transition-[width] duration-75"
                  style={{ width: `${handlePercent}%` }}
                />
                <div
                  className="h-full bg-[#00e701] transition-[width] duration-75"
                  style={{ width: `${100 - handlePercent}%` }}
                />
              </>
            ) : (
              <>
                <div
                  className="h-full bg-[#00e701] transition-[width] duration-75"
                  style={{ width: `${handlePercent}%` }}
                />
                <div
                  className="h-full bg-[#e9113c] transition-[width] duration-75"
                  style={{ width: `${100 - handlePercent}%` }}
                />
              </>
            )}
          </div>

          {/* Draggable Blue Handle (44px touch area on mobile) */}
          <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Cible du dé"
            aria-valuemin={0.01}
            aria-valuemax={98.99}
            aria-valuenow={target}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!disabled) setIsDragging(true);
            }}
            style={{ left: `${handlePercent}%` }}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 sm:w-9 sm:h-9 rounded-md bg-[#3c82e6] hover:bg-[#4c90f0] active:scale-95 border border-[#6aa6f8]/40 shadow-lg flex items-center justify-center gap-1 transition-transform touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              isDragging ? 'scale-105 bg-[#4c90f0]' : ''
            } ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <span className="w-[2px] h-3.5 bg-[#1a498e] rounded-full" />
            <span className="w-[2px] h-3.5 bg-[#1a498e] rounded-full" />
            <span className="w-[2px] h-3.5 bg-[#1a498e] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
