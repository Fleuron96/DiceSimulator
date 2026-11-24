import React, { useState, useMemo } from 'react';
import {
  Activity,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  BacktestResult,
  RollRecord,
  StopReason,
} from '../types/dice';
import {
  formatRollDisplay,
  formatTargetDisplay,
} from '../utils/diceMath';
import { EquityChart } from './EquityChart';

interface BacktestPanelProps {
  liveResult: BacktestResult;
}

function formatAdaptiveAmount(val: number): string {
  const abs = Math.abs(val);
  if (abs > 0 && abs < 0.01) return val.toFixed(6);
  if (abs > 0 && abs < 10) return val.toFixed(4);
  return val.toFixed(2);
}

const STOP_REASON_LABELS: Record<StopReason, string> = {
  limit_reached: 'Limite de paris atteinte',
  stop_condition: 'Condition d’arrêt déclenchée',
  insufficient_balance: 'Solde insuffisant (faillite)',
  manual_stop: 'Arrêt manuel / En cours',
};

export const BacktestPanel: React.FC<BacktestPanelProps> = ({
  liveResult,
}) => {
  const [showExpectedCurve, setShowExpectedCurve] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'wins' | 'losses' | 'triggered'
  >('all');

  const displayedResult = liveResult;

  const robustness = useMemo(() => {
    const n = displayedResult.totalBetsExecuted;
    if (n === 0) return null;

    let grossWin = 0;
    let grossLoss = 0;
    for (const r of displayedResult.recentRolls) {
      if (r.profit > 0) grossWin += r.profit;
      else if (r.profit < 0) grossLoss += Math.abs(r.profit);
    }

    const profitFactor =
      grossLoss > 1e-12 ? grossWin / grossLoss : grossWin > 0 ? 9.99 : 0;

    const recoveryRatio =
      displayedResult.maxDrawdown > 1e-12
        ? displayedResult.netProfit / displayedResult.maxDrawdown
        : displayedResult.netProfit > 0
        ? 5.0
        : 0;

    const initialCap = Math.max(1e-9, displayedResult.config.initialCapital);
    const baseBet = Math.max(1e-9, displayedResult.config.baseBet);
    const maxBetExposurePct = (displayedResult.maxBetReached / initialCap) * 100;
    const betEscalation = displayedResult.maxBetReached / baseBet;

    const isBankrupt = displayedResult.stopReason === 'insufficient_balance';
    const survivalBufferPct = isBankrupt
      ? 0
      : Math.max(0, 100 - displayedResult.maxDrawdownPct);

    // 4-pillar Robustness Score (0 - 100)
    const ddScore = Math.max(
      0,
      30 * (1 - Math.min(1, displayedResult.maxDrawdownPct / 50))
    );
    const expScore = Math.max(
      0,
      25 * (1 - Math.min(1, maxBetExposurePct / 20))
    );
    const pfClamped = Math.min(2, Math.max(0, profitFactor));
    const pfScore = (pfClamped / 2) * 25;

    const edgeRef = Math.max(1e-9, displayedResult.totalWagered * 0.1);
    const edgeScore =
      displayedResult.edgeDeviation >= 0
        ? 10
        : Math.max(0, 10 * (1 + displayedResult.edgeDeviation / edgeRef));
    const recScore = Math.min(10, Math.max(0, (recoveryRatio + 1) * 3.33));
    const resScore = Math.min(20, Math.max(0, edgeScore + recScore));

    let score = Math.round(ddScore + expScore + pfScore + resScore);
    if (isBankrupt) {
      score = Math.min(score, 15);
    }
    score = Math.max(0, Math.min(100, score));

    let label = 'Fragile';
    let badgeClass = 'bg-[#2c121a] text-[#ff4d6d] border-[#e9113c]/40';
    let barColor = '#e9113c';
    if (score >= 80) {
      label = 'Très robuste';
      badgeClass = 'bg-[#0b2e19] text-[#00e701] border-[#00e701]/35';
      barColor = '#00e701';
    } else if (score >= 60) {
      label = 'Solide';
      badgeClass = 'bg-[#0d283b] text-[#38bdf8] border-[#38bdf8]/35';
      barColor = '#38bdf8';
    } else if (score >= 40) {
      label = 'Modérée';
      badgeClass = 'bg-[#2c220a] text-[#f59e0b] border-[#f59e0b]/35';
      barColor = '#f59e0b';
    }

    const sampleReliability =
      n < 20
        ? 'Échantillon faible (< 20 paris)'
        : n < 100
        ? 'Échantillon intermédiaire'
        : 'Échantillon fiable (100+ paris)';

    let verdict = '';
    if (isBankrupt) {
      verdict =
        'Faillite atteinte : l’escalade de mise ou le drawdown a épuisé le capital.';
    } else if (maxBetExposurePct >= 15) {
      verdict = `Attention : la mise maximale a atteint ${maxBetExposurePct.toFixed(1)} % du capital (${betEscalation.toFixed(1)}× la mise de base), exposition élevée en série de pertes.`;
    } else if (displayedResult.maxDrawdownPct >= 25) {
      verdict = `Drawdown important (-${displayedResult.maxDrawdownPct.toFixed(1)} %) : envisagez un Stop-Loss plus strict ou une progression plus douce.`;
    } else if (score >= 75) {
      verdict = `Bonne résilience : drawdown contenu à -${displayedResult.maxDrawdownPct.toFixed(1)} % et mise plafonnée à ${maxBetExposurePct.toFixed(2)} % du capital.`;
    } else {
      verdict = `Comportement équilibré avec une exposition max de ${maxBetExposurePct.toFixed(2)} % du capital et un Profit Factor de ${profitFactor.toFixed(2)}.`;
    }

    return {
      score,
      label,
      badgeClass,
      barColor,
      profitFactor,
      recoveryRatio,
      maxBetExposurePct,
      betEscalation,
      survivalBufferPct,
      sampleReliability,
      verdict,
    };
  }, [displayedResult]);

  const filteredRolls = useMemo(() => {
    const list = displayedResult.recentRolls;
    if (historyFilter === 'wins') return list.filter((r) => r.won);
    if (historyFilter === 'losses') return list.filter((r) => !r.won);
    if (historyFilter === 'triggered') {
      return list.filter((r) => r.triggeredConditions.length > 0);
    }
    return list;
  }, [displayedResult.recentRolls, historyFilter]);

  return (
    <section
      id="backtest-analytics"
      className="w-full max-w-[1360px] mx-auto px-3 sm:px-6 pb-12 pt-2 space-y-4"
    >
      <div className="bg-[#1a2c38] border border-[#2f4553] rounded-xl overflow-hidden shadow-xl">
        {/* Top Bar of Analytics Panel */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[#2f4553]">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-[#1475e1]" />
            <div>
              <h2 className="text-base font-bold text-white">
                Statistiques en Direct ({liveResult.totalBetsExecuted} paris)
              </h2>
              <p className="text-xs text-[#8b9bb4]">
                House Edge : 1 % (RTP 99 %) · Espérance mathématique : -1,00 %
                du volume misé
              </p>
            </div>
          </div>

          {robustness && (
            <div
              className={`px-3 py-1 rounded-full border text-xs font-bold font-mono-tabular flex items-center gap-1.5 ${robustness.badgeClass}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>
                Robustesse : {robustness.score}/100 ({robustness.label})
              </span>
            </div>
          )}
        </div>

        {/* Main Content Body */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Net Profit */}
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-[#8b9bb4] flex items-center justify-between">
                <span>Profit / Perte Net</span>
                {displayedResult.netProfit >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[#00e701]" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-[#e9113c]" />
                )}
              </div>
              <div
                className={`text-base font-bold font-mono-tabular mt-1 ${
                  displayedResult.netProfit >= 0
                    ? 'text-[#00e701]'
                    : 'text-[#e9113c]'
                }`}
              >
                {displayedResult.netProfit >= 0 ? '+' : ''}
                {formatAdaptiveAmount(displayedResult.netProfit)}
              </div>
              <div className="text-[11px] font-mono-tabular text-[#8b9bb4] mt-0.5">
                {displayedResult.netProfitPct >= 0 ? '+' : ''}
                {displayedResult.netProfitPct.toFixed(2)} % du capital
              </div>
            </div>

            {/* Expected vs Actual */}
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-[#8b9bb4]">
                Écart vs Espérance (-1 %)
              </div>
              <div
                className={`text-base font-bold font-mono-tabular mt-1 ${
                  displayedResult.edgeDeviation >= 0
                    ? 'text-[#00e701]'
                    : 'text-[#e9113c]'
                }`}
              >
                {displayedResult.edgeDeviation >= 0 ? '+' : ''}
                {formatAdaptiveAmount(displayedResult.edgeDeviation)}
              </div>
              <div className="text-[11px] font-mono-tabular text-[#f59e0b] mt-0.5">
                Théorique : {formatAdaptiveAmount(displayedResult.expectedNetProfit)}
              </div>
            </div>

            {/* Volume Wagered */}
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-[#8b9bb4]">
                Volume Total Misé
              </div>
              <div className="text-base font-bold font-mono-tabular text-white mt-1">
                {formatAdaptiveAmount(displayedResult.totalWagered)}
              </div>
              <div className="text-[11px] font-mono-tabular text-[#8b9bb4] mt-0.5">
                House Edge 1 % : -{formatAdaptiveAmount(displayedResult.theoreticalHouseEdgeCost)}
              </div>
            </div>

            {/* Win / Loss Ratio */}
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-[#8b9bb4]">
                Gains / Pertes
              </div>
              <div className="text-base font-bold font-mono-tabular mt-1">
                <span className="text-[#00e701]">{displayedResult.wins}</span>
                <span className="text-[#8b9bb4] mx-1">/</span>
                <span className="text-[#e9113c]">{displayedResult.losses}</span>
              </div>
              <div className="text-[11px] font-mono-tabular text-[#8b9bb4] mt-0.5">
                Réel {displayedResult.actualWinRate.toFixed(2)} % · Moy{' '}
                {displayedResult.averageWinChance.toFixed(2)} %
              </div>
            </div>

            {/* Streaks */}
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-[#8b9bb4]">
                Séries Max (G / P)
              </div>
              <div className="text-base font-bold font-mono-tabular mt-1">
                <span className="text-[#00e701]">
                  {displayedResult.longestWinStreak}
                </span>
                <span className="text-[#8b9bb4] mx-1.5">/</span>
                <span className="text-[#e9113c]">
                  {displayedResult.longestLossStreak}
                </span>
              </div>
              <div className="text-[11px] font-mono-tabular text-[#8b9bb4] mt-0.5">
                Mise max : {formatAdaptiveAmount(displayedResult.maxBetReached)}
              </div>
            </div>

            {/* Drawdown & Execution */}
            <div className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-[#8b9bb4] flex items-center justify-between">
                <span>Drawdown Max</span>
                <ShieldAlert className="w-3.5 h-3.5 text-[#f59e0b]" />
              </div>
              <div className="text-base font-bold font-mono-tabular text-[#e9113c] mt-1">
                -{formatAdaptiveAmount(displayedResult.maxDrawdown)}
              </div>
              <div className="text-[11px] font-mono-tabular text-[#8b9bb4] mt-0.5">
                -{displayedResult.maxDrawdownPct.toFixed(2)} % du sommet
              </div>
            </div>
          </div>

          {/* Strategy Robustness Ratio Card */}
          <div className="bg-[#0f212e] border border-[#2f4553] rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1475e1]" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Ratio de Robustesse de la Stratégie
                </h3>
              </div>
              {robustness ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[#8b9bb4]">
                    {robustness.sampleReliability}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold font-mono-tabular ${robustness.badgeClass}`}
                  >
                    {robustness.score} / 100 · {robustness.label}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-[#8b9bb4]">
                  En attente de paris
                </span>
              )}
            </div>

            {robustness ? (
              <>
                {/* Score Progress Bar */}
                <div className="w-full h-2 bg-[#1a2c38] rounded-full overflow-hidden border border-[#2f4553]/60">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${robustness.score}%`,
                      backgroundColor: robustness.barColor,
                    }}
                  />
                </div>

                {/* 4 Robustness Ratios Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="bg-[#152430] border border-[#2f4553]/80 rounded-lg p-2.5">
                    <div className="text-[11px] text-[#8b9bb4]">
                      Profit Factor
                    </div>
                    <div
                      className={`text-sm font-bold font-mono-tabular mt-0.5 ${
                        robustness.profitFactor >= 1
                          ? 'text-[#00e701]'
                          : 'text-[#e9113c]'
                      }`}
                    >
                      {robustness.profitFactor.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[#8b9bb4] mt-0.5">
                      Gains bruts / Pertes brutes
                    </div>
                  </div>

                  <div className="bg-[#152430] border border-[#2f4553]/80 rounded-lg p-2.5">
                    <div className="text-[11px] text-[#8b9bb4]">
                      Ratio Calmar (Profit / DD)
                    </div>
                    <div
                      className={`text-sm font-bold font-mono-tabular mt-0.5 ${
                        robustness.recoveryRatio >= 0
                          ? 'text-[#00e701]'
                          : 'text-[#e9113c]'
                      }`}
                    >
                      {robustness.recoveryRatio >= 0 ? '+' : ''}
                      {robustness.recoveryRatio.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[#8b9bb4] mt-0.5">
                      Rendement net / Drawdown max
                    </div>
                  </div>

                  <div className="bg-[#152430] border border-[#2f4553]/80 rounded-lg p-2.5">
                    <div className="text-[11px] text-[#8b9bb4]">
                      Exposition Mise Max
                    </div>
                    <div
                      className={`text-sm font-bold font-mono-tabular mt-0.5 ${
                        robustness.maxBetExposurePct <= 5
                          ? 'text-[#00e701]'
                          : robustness.maxBetExposurePct <= 15
                          ? 'text-[#f59e0b]'
                          : 'text-[#e9113c]'
                      }`}
                    >
                      {robustness.maxBetExposurePct.toFixed(2)} %
                    </div>
                    <div className="text-[10px] text-[#8b9bb4] font-mono-tabular mt-0.5">
                      {robustness.betEscalation.toFixed(1)}× la mise de base
                    </div>
                  </div>

                  <div className="bg-[#152430] border border-[#2f4553]/80 rounded-lg p-2.5">
                    <div className="text-[11px] text-[#8b9bb4]">
                      Marge de survie
                    </div>
                    <div
                      className={`text-sm font-bold font-mono-tabular mt-0.5 ${
                        robustness.survivalBufferPct >= 80
                          ? 'text-[#00e701]'
                          : robustness.survivalBufferPct >= 50
                          ? 'text-[#f59e0b]'
                          : 'text-[#e9113c]'
                      }`}
                    >
                      {robustness.survivalBufferPct.toFixed(1)} %
                    </div>
                    <div className="text-[10px] text-[#8b9bb4] mt-0.5">
                      Capital préservé au creux
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#b1bad3] leading-relaxed">
                  {robustness.verdict}
                </p>
              </>
            ) : (
              <p className="text-xs text-[#8b9bb4]">
                Exécutez des paris manuels ou automatiques pour évaluer le
                Profit Factor, le ratio Profit / Drawdown, l’exposition maximale
                et la robustesse globale de votre stratégie.
              </p>
            )}
          </div>

          {/* Execution Status Summary Line */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#152430] border border-[#2f4553] rounded-lg px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3 text-[#b1bad3]">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#1475e1]" />
                <span>
                  <strong className="text-white font-mono-tabular">
                    {displayedResult.totalBetsExecuted.toLocaleString('fr-FR')}
                  </strong>{' '}
                  paris exécutés
                </span>
              </span>
              <span>·</span>
              <span>
                Statut :{' '}
                <strong
                  className={
                    displayedResult.stopReason === 'insufficient_balance'
                      ? 'text-[#e9113c]'
                      : 'text-white'
                  }
                >
                  {STOP_REASON_LABELS[displayedResult.stopReason]}
                  {displayedResult.stopConditionIndex
                    ? ` (Condition ${displayedResult.stopConditionIndex})`
                    : ''}
                </strong>
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#b1bad3] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showExpectedCurve}
                onChange={(e) => setShowExpectedCurve(e.target.checked)}
                className="accent-[#f59e0b] rounded cursor-pointer"
              />
              <span>Afficher l’espérance théorique (-1 %)</span>
            </label>
          </div>

          {/* Equity Curve Chart */}
          <EquityChart
            data={displayedResult.equityCurve}
            initialCapital={displayedResult.config.initialCapital}
            showExpectedCurve={showExpectedCurve}
          />

          {/* Detailed Roll History Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Historique détaillé des derniers lancers
                </h3>
                <p className="text-[11px] text-[#8b9bb4]">
                  Affichage jusqu’aux 500 derniers tours exécutés.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-[#0f212e] p-1 rounded-lg border border-[#2f4553] w-full sm:w-auto">
                {(
                  [
                    { id: 'all', label: 'Tous' },
                    { id: 'wins', label: 'Gains' },
                    { id: 'losses', label: 'Pertes' },
                    { id: 'triggered', label: 'Règles actives' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryFilter(tab.id)}
                    className={`flex-1 sm:flex-initial px-2.5 min-h-[36px] sm:min-h-[30px] rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      historyFilter === tab.id
                        ? 'bg-[#213743] text-white'
                        : 'text-[#8b9bb4] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Card List (< 640px) */}
            <div className="sm:hidden bg-[#0f212e] border border-[#2f4553] rounded-lg divide-y divide-[#1c2e3a] max-h-[360px] overflow-y-auto">
              {filteredRolls.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8b9bb4]">
                  Aucun lancer correspondant à ce filtre.
                </div>
              ) : (
                filteredRolls.slice(0, 100).map((r: RollRecord) => (
                  <div key={r.id} className="p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono-tabular">
                        <span className="text-[#8b9bb4]">#{r.rollNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            r.won
                              ? 'bg-[#0b2e19] text-[#00e701]'
                              : 'bg-[#2c121a] text-[#ff4d6d]'
                          }`}
                        >
                          {formatRollDisplay(r.rollValue, r.target)}
                        </span>
                        <span className="text-[11px] text-[#8b9bb4]">
                          {r.mode === 'over' ? '>' : '<'}{' '}
                          {formatTargetDisplay(r.target)}
                        </span>
                      </div>
                      <span
                        className={`font-mono-tabular font-bold ${
                          r.won ? 'text-[#00e701]' : 'text-[#e9113c]'
                        }`}
                      >
                        {r.profit >= 0 ? '+' : ''}
                        {r.profit.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#8b9bb4] font-mono-tabular">
                      <span>
                        Mise {r.betAmount.toFixed(2)} · {r.multiplier.toFixed(2)}×
                      </span>
                      <div className="flex items-center gap-2">
                        {r.triggeredConditions.length > 0 && (
                          <span className="font-sans text-[#1475e1] font-medium">
                            Cond. {r.triggeredConditions.join(', ')}
                          </span>
                        )}
                        <span className="text-white">
                          Solde {r.balanceAfter.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block bg-[#0f212e] border border-[#2f4553] rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[340px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#152430] text-[#8b9bb4] border-b border-[#2f4553] z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold"># Tour</th>
                      <th className="py-2.5 px-3 font-semibold">Résultat</th>
                      <th className="py-2.5 px-3 font-semibold">Cible</th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        Mise
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        Multiplicateur
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        Gain / Perte
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        Solde
                      </th>
                      <th className="py-2.5 px-3 font-semibold">
                        Condition déclenchée
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2e3a] font-mono-tabular">
                    {filteredRolls.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-8 text-center text-[#8b9bb4] font-sans"
                        >
                          Aucun lancer correspondant à ce filtre.
                        </td>
                      </tr>
                    ) : (
                      filteredRolls.slice(0, 150).map((r: RollRecord) => (
                        <tr
                          key={r.id}
                          className="hover:bg-[#162836] transition-colors"
                        >
                          <td className="py-2 px-3 text-[#8b9bb4]">
                            #{r.rollNumber}
                          </td>
                          <td className="py-2 px-3 font-bold">
                            <span
                              className={
                                r.won ? 'text-[#00e701]' : 'text-[#e9113c]'
                              }
                            >
                              {formatRollDisplay(r.rollValue, r.target)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#b1bad3]">
                            {r.mode === 'over' ? '>' : '<'}{' '}
                            {formatTargetDisplay(r.target)}{' '}
                            <span className="text-[10px] text-[#8b9bb4]">
                              ({r.winChance.toFixed(2)}%)
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-white">
                            {r.betAmount.toFixed(4)}
                          </td>
                          <td className="py-2 px-3 text-right text-[#b1bad3]">
                            {r.multiplier.toFixed(4)}×
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-semibold ${
                              r.won ? 'text-[#00e701]' : 'text-[#e9113c]'
                            }`}
                          >
                            {r.profit >= 0 ? '+' : ''}
                            {r.profit.toFixed(4)}
                          </td>
                          <td className="py-2 px-3 text-right text-white">
                            {r.balanceAfter.toFixed(4)}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            {r.triggeredConditions.length > 0 ? (
                              <span className="text-[11px] text-[#1475e1] font-medium">
                                Cond. {r.triggeredConditions.join(', ')}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#557086]">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
