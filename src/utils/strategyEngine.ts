import {
  BacktestConfig,
  BacktestResult,
  EquityPoint,
  RollMode,
  RollRecord,
  StopReason,
  Strategy,
  StrategyActionType,
  StrategyCondition,
} from '../types/dice';
import {
  clampWinChance,
  createRng,
  evaluateRollWin,
  generateDiceRoll,
  MIN_BET,
  multiplierFromChance,
  round8,
  targetFromChance,
} from './diceMath';

export interface StrategyRuntimeState {
  initialCapital: number;
  balance: number;
  baseBet: number;
  currentBet: number;
  baseWinChance: number;
  currentWinChance: number;
  currentMode: RollMode;
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  totalWagered: number;
  peakBalance: number;
  lowestBalance: number;
  maxDrawdown: number;
  maxBetReached: number;
  // Tracks if a 'first_streak' condition has already triggered in the current streak
  firstStreakFiredMap: Record<string, boolean>;
}

export function createInitialRuntimeState(params: {
  initialCapital: number;
  baseBet: number;
  baseWinChance: number;
  initialMode: RollMode;
}): StrategyRuntimeState {
  return {
    initialCapital: params.initialCapital,
    balance: params.initialCapital,
    baseBet: Math.max(MIN_BET, params.baseBet),
    currentBet: Math.max(MIN_BET, params.baseBet),
    baseWinChance: clampWinChance(params.baseWinChance),
    currentWinChance: clampWinChance(params.baseWinChance),
    currentMode: params.initialMode,
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    currentWinStreak: 0,
    currentLossStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0,
    totalWagered: 0,
    peakBalance: params.initialCapital,
    lowestBalance: params.initialCapital,
    maxDrawdown: 0,
    maxBetReached: Math.max(MIN_BET, params.baseBet),
    firstStreakFiredMap: {},
  };
}

export const ACTION_LABELS: Record<StrategyActionType, string> = {
  increase_bet_pct: 'Augmenter le montant du pari',
  decrease_bet_pct: 'Diminuer le montant du pari',
  increase_chance_pct: 'Augmenter la chance de gagner',
  decrease_chance_pct: 'Diminuer la chance de gagner',
  add_bet: 'Ajouter au montant du pari',
  sub_bet: 'Soustraire du montant du pari',
  add_chance: 'Ajouter à la chance de gagner',
  sub_chance: 'Soustraire de la chance de gagner',
  set_bet: 'Définir le montant du pari',
  set_chance: 'Définir la chance de gagner',
  reset_bet: 'Réinitialiser le montant du pari',
  reset_chance: 'Réinitialiser la chance de gagner',
  switch_over_under: 'Inverser Lancer au Dessus / en Dessous',
  stop_auto: 'Arrêter le pari automatique',
};

export function actionNeedsValue(action: StrategyActionType): boolean {
  return ![
    'reset_bet',
    'reset_chance',
    'switch_over_under',
    'stop_auto',
  ].includes(action);
}

export function actionValueSuffix(action: StrategyActionType): string {
  switch (action) {
    case 'increase_bet_pct':
    case 'decrease_bet_pct':
    case 'increase_chance_pct':
    case 'decrease_chance_pct':
    case 'add_chance':
    case 'sub_chance':
    case 'set_chance':
      return '%';
    case 'add_bet':
    case 'sub_bet':
    case 'set_bet':
      return 'jetons';
    default:
      return '';
  }
}

export function formatConditionSummary(cond: StrategyCondition): string {
  let ifPart = '';
  if (cond.category === 'bets') {
    const triggerLabel =
      cond.betTriggerType === 'every'
        ? 'Chaque'
        : cond.betTriggerType === 'every_streak'
        ? 'Chaque série de'
        : 'Première série de';
    const eventLabel =
      cond.betEventType === 'wins'
        ? cond.betCount > 1
          ? 'Gains'
          : 'Gain'
        : cond.betEventType === 'losses'
        ? cond.betCount > 1
          ? 'Pertes'
          : 'Perte'
        : cond.betCount > 1
        ? 'Paris'
        : 'Pari';
    ifPart = `Si ${triggerLabel} ${cond.betCount} ${eventLabel}`;
  } else {
    const metricLabel =
      cond.profitMetric === 'balance'
        ? 'Solde'
        : cond.profitMetric === 'net_profit'
        ? 'Profit net'
        : 'Perte nette';
    const opLabel = cond.profitOperator === 'gt' ? 'Supérieur à' : 'Inférieur à';
    ifPart = `Si ${metricLabel} ${opLabel} ${cond.profitValue}`;
  }

  let thenPart = ACTION_LABELS[cond.action];
  if (actionNeedsValue(cond.action)) {
    const suffix = actionValueSuffix(cond.action);
    if (
      cond.action === 'increase_bet_pct' ||
      cond.action === 'decrease_bet_pct' ||
      cond.action === 'increase_chance_pct' ||
      cond.action === 'decrease_chance_pct'
    ) {
      thenPart += ` de ${cond.actionValue} %`;
    } else if (cond.action === 'add_bet' || cond.action === 'add_chance') {
      thenPart += ` (+ ${cond.actionValue}${suffix === '%' ? ' %' : ''})`;
    } else if (cond.action === 'sub_bet' || cond.action === 'sub_chance') {
      thenPart += ` (- ${cond.actionValue}${suffix === '%' ? ' %' : ''})`;
    } else if (cond.action === 'set_bet' || cond.action === 'set_chance') {
      thenPart += ` (= ${cond.actionValue}${suffix === '%' ? ' %' : ''})`;
    }
  }

  return `${ifPart} → Alors ${thenPart}`;
}

function checkConditionTriggered(
  cond: StrategyCondition,
  state: StrategyRuntimeState,
  lastWon: boolean
): boolean {
  if (cond.category === 'bets') {
    const count = Math.max(1, Math.floor(cond.betCount || 1));

    if (cond.betTriggerType === 'every') {
      if (cond.betEventType === 'bets') {
        return state.totalBets > 0 && state.totalBets % count === 0;
      }
      if (cond.betEventType === 'wins') {
        return lastWon && state.totalWins > 0 && state.totalWins % count === 0;
      }
      if (cond.betEventType === 'losses') {
        return !lastWon && state.totalLosses > 0 && state.totalLosses % count === 0;
      }
      return false;
    }

    if (cond.betTriggerType === 'every_streak') {
      if (cond.betEventType === 'wins') {
        return (
          lastWon &&
          state.currentWinStreak > 0 &&
          state.currentWinStreak % count === 0
        );
      }
      if (cond.betEventType === 'losses') {
        return (
          !lastWon &&
          state.currentLossStreak > 0 &&
          state.currentLossStreak % count === 0
        );
      }
      // For 'bets', streak equals totalBets
      return state.totalBets > 0 && state.totalBets % count === 0;
    }

    if (cond.betTriggerType === 'first_streak') {
      // Reset the fired flag when the opposite outcome occurs
      if (cond.betEventType === 'wins') {
        if (!lastWon) {
          state.firstStreakFiredMap[cond.id] = false;
          return false;
        }
        if (
          state.currentWinStreak === count &&
          !state.firstStreakFiredMap[cond.id]
        ) {
          state.firstStreakFiredMap[cond.id] = true;
          return true;
        }
        return false;
      }
      if (cond.betEventType === 'losses') {
        if (lastWon) {
          state.firstStreakFiredMap[cond.id] = false;
          return false;
        }
        if (
          state.currentLossStreak === count &&
          !state.firstStreakFiredMap[cond.id]
        ) {
          state.firstStreakFiredMap[cond.id] = true;
          return true;
        }
        return false;
      }
      // 'bets'
      if (state.totalBets === count && !state.firstStreakFiredMap[cond.id]) {
        state.firstStreakFiredMap[cond.id] = true;
        return true;
      }
      return false;
    }
  } else {
    // category === 'profit'
    const netProfit = state.balance - state.initialCapital;
    const netLoss = state.initialCapital - state.balance;
    let currentMetricVal = state.balance;
    if (cond.profitMetric === 'net_profit') currentMetricVal = netProfit;
    else if (cond.profitMetric === 'net_loss') currentMetricVal = netLoss;

    if (cond.profitOperator === 'gt') {
      return currentMetricVal > cond.profitValue;
    }
    return currentMetricVal < cond.profitValue;
  }
  return false;
}

function applyAction(
  cond: StrategyCondition,
  state: StrategyRuntimeState
): { shouldStop: boolean } {
  const val = Number.isFinite(cond.actionValue) ? cond.actionValue : 0;

  switch (cond.action) {
    case 'increase_bet_pct':
      state.currentBet = round8(Math.max(MIN_BET, state.currentBet * (1 + val / 100)));
      break;
    case 'decrease_bet_pct':
      state.currentBet = round8(
        Math.max(MIN_BET, state.currentBet * Math.max(0, 1 - val / 100))
      );
      break;
    case 'increase_chance_pct':
      state.currentWinChance = clampWinChance(
        state.currentWinChance * (1 + val / 100)
      );
      break;
    case 'decrease_chance_pct':
      state.currentWinChance = clampWinChance(
        state.currentWinChance * Math.max(0.0001, 1 - val / 100)
      );
      break;
    case 'add_bet':
      state.currentBet = round8(Math.max(MIN_BET, state.currentBet + val));
      break;
    case 'sub_bet':
      state.currentBet = round8(Math.max(MIN_BET, state.currentBet - val));
      break;
    case 'add_chance':
      state.currentWinChance = clampWinChance(state.currentWinChance + val);
      break;
    case 'sub_chance':
      state.currentWinChance = clampWinChance(state.currentWinChance - val);
      break;
    case 'set_bet':
      state.currentBet = round8(Math.max(MIN_BET, val));
      break;
    case 'set_chance':
      state.currentWinChance = clampWinChance(val);
      break;
    case 'reset_bet':
      state.currentBet = state.baseBet;
      break;
    case 'reset_chance':
      state.currentWinChance = state.baseWinChance;
      break;
    case 'switch_over_under':
      state.currentMode = state.currentMode === 'over' ? 'under' : 'over';
      break;
    case 'stop_auto':
      return { shouldStop: true };
  }

  return { shouldStop: false };
}

export function stepDiceSimulation(
  state: StrategyRuntimeState,
  strategy: Strategy | null,
  rng: () => number
): {
  record: RollRecord;
  shouldStop: boolean;
  stopReason?: StopReason;
  stopConditionIndex?: number;
} {
  const bet = round8(Math.max(MIN_BET, state.currentBet));
  if (bet > state.balance + 1e-10) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  if (bet > state.maxBetReached) {
    state.maxBetReached = bet;
  }

  const winChance = clampWinChance(state.currentWinChance);
  const multiplier = multiplierFromChance(winChance);
  const mode = state.currentMode;
  const target = targetFromChance(winChance, mode);

  const rollValue = generateDiceRoll(rng);
  const won = evaluateRollWin(rollValue, winChance, mode);
  const profit = won ? round8(bet * (multiplier - 1)) : round8(-bet);

  state.balance = round8(Math.max(0, state.balance + profit));
  state.totalBets += 1;
  state.totalWagered = round8(state.totalWagered + bet);

  if (won) {
    state.totalWins += 1;
    state.currentWinStreak += 1;
    state.currentLossStreak = 0;
    if (state.currentWinStreak > state.longestWinStreak) {
      state.longestWinStreak = state.currentWinStreak;
    }
  } else {
    state.totalLosses += 1;
    state.currentLossStreak += 1;
    state.currentWinStreak = 0;
    if (state.currentLossStreak > state.longestLossStreak) {
      state.longestLossStreak = state.currentLossStreak;
    }
  }

  if (state.balance > state.peakBalance) {
    state.peakBalance = state.balance;
  }
  if (state.balance < state.lowestBalance) {
    state.lowestBalance = state.balance;
  }
  const currentDrawdown = round8(state.peakBalance - state.balance);
  if (currentDrawdown > state.maxDrawdown) {
    state.maxDrawdown = currentDrawdown;
  }

  // Evaluate Strategy Conditions in order
  const triggeredConditions: number[] = [];
  let shouldStop = false;
  let stopReason: StopReason | undefined;
  let stopConditionIndex: number | undefined;

  if (strategy && strategy.conditions.length > 0) {
    for (let i = 0; i < strategy.conditions.length; i++) {
      const cond = strategy.conditions[i];
      if (checkConditionTriggered(cond, state, won)) {
        triggeredConditions.push(i + 1);
        const res = applyAction(cond, state);
        if (res.shouldStop) {
          shouldStop = true;
          stopReason = 'stop_condition';
          stopConditionIndex = i + 1;
        }
      }
    }
  }

  const record: RollRecord = {
    id: state.totalBets,
    rollNumber: state.totalBets,
    rollValue,
    mode,
    target,
    winChance,
    multiplier,
    betAmount: bet,
    won,
    profit,
    balanceAfter: state.balance,
    wageredCumulative: state.totalWagered,
    expectedProfitCumulative: round8(-0.01 * state.totalWagered),
    triggeredConditions,
  };

  return { record, shouldStop, stopReason, stopConditionIndex };
}

/**
 * Downsamples equity curve to at most maxPoints while keeping start, end, and extrema.
 */
function downsampleCurve(points: EquityPoint[], maxPoints = 350): EquityPoint[] {
  if (points.length <= maxPoints) return points;
  const sampled: EquityPoint[] = [points[0]];
  const bucketSize = (points.length - 2) / (maxPoints - 2);
  for (let i = 0; i < maxPoints - 2; i++) {
    const start = Math.floor(1 + i * bucketSize);
    const end = Math.min(points.length - 1, Math.floor(1 + (i + 1) * bucketSize));
    if (start >= end) {
      sampled.push(points[start]);
      continue;
    }
    let minPt = points[start];
    let maxPt = points[start];
    for (let j = start; j < end; j++) {
      if (points[j].balance < minPt.balance) minPt = points[j];
      if (points[j].balance > maxPt.balance) maxPt = points[j];
    }
    if (minPt.roll <= maxPt.roll) {
      sampled.push(minPt);
      if (maxPt !== minPt) sampled.push(maxPt);
    } else {
      sampled.push(maxPt);
      if (minPt !== maxPt) sampled.push(minPt);
    }
  }
  sampled.push(points[points.length - 1]);
  return sampled;
}

export function runBacktestSimulation(
  config: BacktestConfig,
  strategy: Strategy | null
): BacktestResult {
  const t0 = performance.now();
  const rng = createRng(config.useSeed ? config.seed : undefined);

  const state = createInitialRuntimeState({
    initialCapital: config.initialCapital,
    baseBet: config.baseBet,
    baseWinChance: config.initialWinChance,
    initialMode: config.initialMode,
  });

  const maxRolls = Math.min(200000, Math.max(1, Math.floor(config.totalBets)));
  const rawCurve: EquityPoint[] = [
    {
      roll: 0,
      balance: config.initialCapital,
      netProfit: 0,
      expectedProfit: 0,
    },
  ];

  const maxHistoryKeep = 500;
  const recentRolls: RollRecord[] = [];
  let sumWinChances = 0;
  let stopReason: StopReason = 'limit_reached';
  let stopConditionIndex: number | undefined;

  for (let i = 0; i < maxRolls; i++) {
    if (state.currentBet > state.balance + 1e-10 || state.balance <= 0) {
      stopReason = 'insufficient_balance';
      break;
    }

    sumWinChances += state.currentWinChance;

    const step = stepDiceSimulation(state, strategy, rng);
    const rec = step.record;

    rawCurve.push({
      roll: rec.rollNumber,
      balance: rec.balanceAfter,
      netProfit: round8(rec.balanceAfter - config.initialCapital),
      expectedProfit: rec.expectedProfitCumulative,
    });

    if (recentRolls.length >= maxHistoryKeep) {
      recentRolls.shift();
    }
    recentRolls.push(rec);

    if (step.shouldStop) {
      stopReason = step.stopReason || 'stop_condition';
      stopConditionIndex = step.stopConditionIndex;
      break;
    }
  }

  const netProfit = round8(state.balance - config.initialCapital);
  const netProfitPct =
    config.initialCapital > 0
      ? (netProfit / config.initialCapital) * 100
      : 0;
  const theoreticalHouseEdgeCost = round8(0.01 * state.totalWagered);
  const expectedNetProfit = round8(-0.01 * state.totalWagered);
  const edgeDeviation = round8(netProfit - expectedNetProfit);
  const maxDrawdownPct =
    state.peakBalance > 0 ? (state.maxDrawdown / state.peakBalance) * 100 : 0;

  const durationMs = Math.max(0.1, performance.now() - t0);

  return {
    config,
    strategyName: strategy ? strategy.name : 'Jeu manuel (sans règle)',
    durationMs,
    stopReason,
    stopConditionIndex,
    finalBalance: state.balance,
    netProfit,
    netProfitPct,
    totalWagered: state.totalWagered,
    theoreticalHouseEdgeCost,
    expectedNetProfit,
    edgeDeviation,
    totalBetsExecuted: state.totalBets,
    wins: state.totalWins,
    losses: state.totalLosses,
    actualWinRate:
      state.totalBets > 0 ? (state.totalWins / state.totalBets) * 100 : 0,
    averageWinChance:
      state.totalBets > 0
        ? sumWinChances / state.totalBets
        : config.initialWinChance,
    longestWinStreak: state.longestWinStreak,
    longestLossStreak: state.longestLossStreak,
    maxBetReached: state.maxBetReached,
    maxDrawdown: state.maxDrawdown,
    maxDrawdownPct,
    peakBalance: state.peakBalance,
    lowestBalance: state.lowestBalance,
    equityCurve: downsampleCurve(rawCurve, 350),
    recentRolls: recentRolls.reverse(),
  };
}
