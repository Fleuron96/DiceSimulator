import React, { useState, useMemo, useRef } from 'react';
import { EquityPoint } from '../types/dice';

interface EquityChartProps {
  data: EquityPoint[];
  initialCapital: number;
  showExpectedCurve: boolean;
}

export const EquityChart: React.FC<EquityChartProps> = ({
  data,
  initialCapital,
  showExpectedCurve,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 880;
  const height = 270;
  const padLeft = 64;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const { minY, maxY, yTicks, zeroPct } = useMemo(() => {
    if (data.length === 0) {
      return { minY: -10, maxY: 10, yTicks: [-10, 0, 10], zeroPct: 50 };
    }
    let minVal = 0;
    let maxVal = 0;
    for (const pt of data) {
      if (pt.netProfit < minVal) minVal = pt.netProfit;
      if (pt.netProfit > maxVal) maxVal = pt.netProfit;
      if (showExpectedCurve && pt.expectedProfit < minVal) {
        minVal = pt.expectedProfit;
      }
    }
    const span = Math.max(1, maxVal - minVal);
    const padding = span * 0.1;
    const lo = minVal - padding;
    const hi = maxVal + padding;
    const total = hi - lo || 1;
    const zPct = Math.min(100, Math.max(0, ((hi - 0) / total) * 100));

    const ticks = [lo, lo + total * 0.25, lo + total * 0.5, lo + total * 0.75, hi];
    if (lo < 0 && hi > 0) {
      ticks.push(0);
    }

    return {
      minY: lo,
      maxY: hi,
      yTicks: Array.from(new Set(ticks.map((t) => Number(t.toFixed(2))))).sort(
        (a, b) => a - b
      ),
      zeroPct: zPct,
    };
  }, [data, showExpectedCurve]);

  const maxRoll = data.length > 0 ? data[data.length - 1].roll || 1 : 1;

  const xCoord = (roll: number) =>
    padLeft + (roll / Math.max(1, maxRoll)) * plotW;
  const yCoord = (netVal: number) =>
    padTop + ((maxY - netVal) / Math.max(1e-9, maxY - minY)) * plotH;

  const profitPath = useMemo(() => {
    if (data.length === 0) return '';
    return data
      .map(
        (pt, i) =>
          `${i === 0 ? 'M' : 'L'} ${xCoord(pt.roll).toFixed(2)} ${yCoord(pt.netProfit).toFixed(2)}`
      )
      .join(' ');
  }, [data, minY, maxY, maxRoll]);

  const areaPath = useMemo(() => {
    if (data.length === 0) return '';
    const baseY = yCoord(0);
    const firstX = xCoord(data[0].roll);
    const lastX = xCoord(data[data.length - 1].roll);
    return `${profitPath} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} L ${firstX.toFixed(2)} ${baseY.toFixed(2)} Z`;
  }, [profitPath, data, minY, maxY, maxRoll]);

  const expectedPath = useMemo(() => {
    if (!showExpectedCurve || data.length === 0) return '';
    return data
      .map(
        (pt, i) =>
          `${i === 0 ? 'M' : 'L'} ${xCoord(pt.roll).toFixed(2)} ${yCoord(pt.expectedProfit).toFixed(2)}`
      )
      .join(' ');
  }, [data, showExpectedCurve, minY, maxY, maxRoll]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const clampedX = Math.min(width - padRight, Math.max(padLeft, relX));
    const targetRoll = ((clampedX - padLeft) / plotW) * maxRoll;

    // Binary search nearest point
    let lo = 0;
    let hi = data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (data[mid].roll < targetRoll) lo = mid + 1;
      else hi = mid;
    }
    if (
      lo > 0 &&
      Math.abs(data[lo - 1].roll - targetRoll) <
        Math.abs(data[lo].roll - targetRoll)
    ) {
      lo = lo - 1;
    }
    setHoverIdx(lo);
  };

  if (data.length < 2) {
    return (
      <div className="h-[210px] sm:h-[260px] flex flex-col items-center justify-center bg-[#0f212e] border border-[#2f4553] rounded-lg text-center px-4 sm:px-6">
        <p className="text-sm font-semibold text-white">
          Aucune donnée de simulation disponible
        </p>
        <p className="text-xs text-[#8b9bb4] mt-1 max-w-md">
          Lancez un pari manuel ou le pari automatique pour tracer la courbe
          d’évolution du capital et la comparer à l’espérance théorique (-1 %).
        </p>
      </div>
    );
  }

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const zeroY = yCoord(0);

  return (
    <div className="relative bg-[#0f212e] border border-[#2f4553] rounded-lg p-2.5 sm:p-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto max-h-[280px] select-none touch-pan-y"
        onPointerDown={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="profitStrokeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset={`${zeroPct}%`} stopColor="#00e701" />
            <stop offset={`${zeroPct}%`} stopColor="#e9113c" />
          </linearGradient>
          <linearGradient id="profitFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e701" stopOpacity="0.22" />
            <stop offset={`${zeroPct}%`} stopColor="#00e701" stopOpacity="0.03" />
            <stop offset={`${zeroPct}%`} stopColor="#e9113c" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#e9113c" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {yTicks.map((tick, idx) => {
          const y = yCoord(tick);
          const isZero = Math.abs(tick) < 1e-6;
          return (
            <g key={`${tick}-${idx}`}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke={isZero ? '#557086' : '#1f3340'}
                strokeWidth={isZero ? 1.2 : 1}
                strokeDasharray={isZero ? '4 4' : undefined}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                fill={isZero ? '#ffffff' : '#8b9bb4'}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick > 0 ? `+${tick.toFixed(1)}` : tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X Axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const r = Math.round(maxRoll * frac);
          const x = xCoord(r);
          return (
            <text
              key={frac}
              x={x}
              y={height - 8}
              textAnchor={frac === 0 ? 'start' : frac === 1 ? 'end' : 'middle'}
              fill="#8b9bb4"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              #{r.toLocaleString('fr-FR')}
            </text>
          );
        })}

        {/* Zero baseline highlight */}
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={zeroY}
          y2={zeroY}
          stroke="#466073"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Area Fill */}
        <path d={areaPath} fill="url(#profitFillGrad)" />

        {/* Theoretical Expectation Curve (-1% wagered) */}
        {showExpectedCurve && expectedPath && (
          <path
            d={expectedPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.75"
            strokeDasharray="5 4"
            opacity="0.9"
          />
        )}

        {/* Main Equity Curve */}
        <path
          d={profitPath}
          fill="none"
          stroke="url(#profitStrokeGrad)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hover Crosshair */}
        {hovered && (
          <g>
            <line
              x1={xCoord(hovered.roll)}
              x2={xCoord(hovered.roll)}
              y1={padTop}
              y2={height - padBottom}
              stroke="#b1bad3"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <circle
              cx={xCoord(hovered.roll)}
              cy={yCoord(hovered.netProfit)}
              r="4.5"
              fill={hovered.netProfit >= 0 ? '#00e701' : '#e9113c'}
              stroke="#0f212e"
              strokeWidth="2"
            />
            {showExpectedCurve && (
              <circle
                cx={xCoord(hovered.roll)}
                cy={yCoord(hovered.expectedProfit)}
                r="3.5"
                fill="#f59e0b"
                stroke="#0f212e"
                strokeWidth="1.5"
              />
            )}
          </g>
        )}
      </svg>

      {/* Hover Tooltip Bar */}
      <div className="mt-2 pt-2 border-t border-[#1f3340] flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
        {hovered ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 sm:gap-4 font-mono-tabular">
              <span className="text-[#8b9bb4]">
                Tour <strong className="text-white">#{hovered.roll.toLocaleString('fr-FR')}</strong>
              </span>
              <span className="text-[#8b9bb4]">
                Solde :{' '}
                <strong className="text-white">
                  {hovered.balance.toFixed(2)}
                </strong>
              </span>
              <span className="text-[#8b9bb4]">
                Profit net :{' '}
                <strong
                  className={
                    hovered.netProfit >= 0 ? 'text-[#00e701]' : 'text-[#e9113c]'
                  }
                >
                  {hovered.netProfit >= 0 ? '+' : ''}
                  {hovered.netProfit.toFixed(2)}
                </strong>
              </span>
              {showExpectedCurve && (
                <span className="text-[#8b9bb4]">
                  Espérance (-1 %) :{' '}
                  <strong className="text-[#f59e0b]">
                    {hovered.expectedProfit.toFixed(2)}
                  </strong>
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#8b9bb4] font-mono-tabular">
              Capital initial : {initialCapital.toLocaleString('fr-FR')}
            </div>
          </>
        ) : (
          <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8b9bb4]">
            <span>
              Survolez ou touchez la courbe pour inspecter le profit et
              l’espérance à chaque tour.
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#00e701] inline-block" />
                <span>Gain net</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#e9113c] inline-block" />
                <span>Perte nette</span>
              </span>
              {showExpectedCurve && (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 border-t-2 border-dashed border-[#f59e0b] inline-block" />
                  <span>Espérance théorique (-1 %)</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
