import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  BarChart3,
  ChevronDown,
  Download,
  Infinity as InfinityIcon,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BacktestResult,
  CryptoCurrency,
  ExecutionSpeed,
  RollMode,
  RollRecord,
  StopReason,
  Strategy,
} from './types/dice';
import { CRYPTO_LIST, CRYPTO_MAP } from './data/cryptos';
import { DEFAULT_STRATEGIES } from './data/defaultStrategies';
import {
  chanceFromMultiplier,
  chanceFromTarget,
  clampWinChance,
  createRng,
  formatCompactCurrency,
  formatTargetDisplay,
  MIN_BET,
  multiplierFromChance,
  round8,
  targetFromChance,
} from './utils/diceMath';
import {
  createInitialRuntimeState,
  formatConditionSummary,
  stepDiceSimulation,
  StrategyRuntimeState,
} from './utils/strategyEngine';
import { exportStrategyToDocx } from './utils/strategyDocxExport';
import { HeaderBar } from './components/HeaderBar';
import { StakeLogo, TokenIcon } from './components/StakeLogo';
import { DiceSlider } from './components/DiceSlider';
import { WalletModal } from './components/WalletModal';
import { FairnessModal } from './components/FairnessModal';
import { StrategyModal } from './components/StrategyModal';
import { BacktestPanel } from './components/BacktestPanel';

const STRATEGIES_STORAGE_KEY = 'stake_dice_strategies_v1';

function loadInitialStrategies(): Strategy[] {
  try {
    const raw = localStorage.getItem(STRATEGIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_STRATEGIES;
}

export default function App() {
  // Strategies state (persisted in localStorage)
  const [strategies, setStrategies] = useState<Strategy[]>(loadInitialStrategies);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(() => {
    const loaded = loadInitialStrategies();
    return loaded[0]?.id || DEFAULT_STRATEGIES[0].id;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STRATEGIES_STORAGE_KEY, JSON.stringify(strategies));
    } catch {
      // ignore storage errors
    }
  }, [strategies]);

  const activeStrategy = useMemo(
    () => strategies.find((s) => s.id === selectedStrategyId) || strategies[0] || null,
    [strategies, selectedStrategyId]
  );

  // Control mode: Manual, Simple Auto, or Strategy (3rd icon tab)
  const [controlTab, setControlTab] = useState<'manual' | 'auto' | 'strategy'>(
    'strategy'
  );

  // Simple Auto ("Automatique" tab) controls
  const [onWinMode, setOnWinMode] = useState<'reset' | 'increase'>('reset');
  const [onWinPctInput, setOnWinPctInput] = useState<string>('0');
  const [onLossMode, setOnLossMode] = useState<'reset' | 'increase'>('reset');
  const [onLossPctInput, setOnLossPctInput] = useState<string>('0');
  const [stopOnGainInput, setStopOnGainInput] = useState<string>('0.00000000');
  const [stopOnLossInput, setStopOnLossInput] = useState<string>('0.00000000');

  // Wallet & Betting State (Multi-Crypto)
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoCurrency>('USDT');
  const [wallets, setWallets] = useState<
    Record<CryptoCurrency, { balance: number; initialCapital: number }>
  >(() =>
    CRYPTO_LIST.reduce(
      (acc, c) => {
        acc[c.id] = {
          balance: c.defaultCapital,
          initialCapital: c.defaultCapital,
        };
        return acc;
      },
      {} as Record<CryptoCurrency, { balance: number; initialCapital: number }>
    )
  );
  const activeCrypto = CRYPTO_MAP[selectedCrypto];
  const initialCapital = wallets[selectedCrypto].initialCapital;
  const balance = wallets[selectedCrypto].balance;

  const setBalance = useCallback(
    (nextBalance: number) => {
      setWallets((prev) => ({
        ...prev,
        [selectedCrypto]: {
          ...prev[selectedCrypto],
          balance: nextBalance,
        },
      }));
    },
    [selectedCrypto]
  );

  const [baseBetInput, setBaseBetInput] = useState<string>('1.00000000');
  const [numBetsInput, setNumBetsInput] = useState<string>('100');
  const [isInfiniteBets, setIsInfiniteBets] = useState<boolean>(false);
  const [executionSpeed, setExecutionSpeed] = useState<ExecutionSpeed>('fast');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Dice Mathematical Parameters (1% House Edge -> M = 99 / P)
  const [rollMode, setRollMode] = useState<RollMode>('over');
  const [winChance, setWinChance] = useState<number>(49.5);
  const multiplier = useMemo(() => multiplierFromChance(winChance), [winChance]);
  const targetValue = useMemo(
    () => targetFromChance(winChance, rollMode),
    [winChance, rollMode]
  );

  // Editable text drafts for synchronized inputs
  const [multDraft, setMultDraft] = useState<string>('2.0000');
  const [targetDraft, setTargetDraft] = useState<string>('50.50');
  const [chanceDraft, setChanceDraft] = useState<string>('49.5000');
  const [focusedField, setFocusedField] = useState<
    'mult' | 'target' | 'chance' | null
  >(null);

  useEffect(() => {
    if (focusedField !== 'mult') setMultDraft(multiplier.toFixed(4));
    if (focusedField !== 'target') setTargetDraft(formatTargetDisplay(targetValue));
    if (focusedField !== 'chance') setChanceDraft(winChance.toFixed(4));
  }, [multiplier, targetValue, winChance, focusedField]);

  // Seed / Fairness state
  const [seed, setSeed] = useState<string>('STAKE-99RTP');
  const [useSeed, setUseSeed] = useState<boolean>(false);

  // UI Modals & Popovers
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
  const [strategyModalState, setStrategyModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
  }>({ open: false, mode: 'create' });
  const [inspectedConditionIdx, setInspectedConditionIdx] = useState<number | null>(
    null
  );
  const [confirmDeleteStrategyId, setConfirmDeleteStrategyId] = useState<
    string | null
  >(null);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Live Session Tracking
  const [liveRolls, setLiveRolls] = useState<RollRecord[]>([]);
  const [liveStopReason, setLiveStopReason] = useState<StopReason>('manual_stop');
  const [liveStopCondIdx, setLiveStopCondIdx] = useState<number | undefined>(
    undefined
  );
  const [lastTriggeredConditions, setLastTriggeredConditions] = useState<
    number[]
  >([]);
  const [lastRollDisplay, setLastRollDisplay] = useState<{
    value: number;
    won: boolean;
    target: number;
    id: number;
  } | null>(null);

  // Auto-betting Runner State
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false);
  const [autoBetsDone, setAutoBetsDone] = useState<number>(0);

  // Refs for stable async auto-betting loop
  const isAutoRunningRef = useRef(false);
  const runtimeStateRef = useRef<StrategyRuntimeState | null>(null);
  const liveRngRef = useRef<() => number>(createRng(undefined));
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play subtle WebAudio click/win tone if soundEnabled
  const playRollSound = useCallback(
    (won: boolean) => {
      if (!soundEnabled) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = won ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(won ? 680 : 220, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      } catch {
        // ignore audio errors
      }
    },
    [soundEnabled]
  );

  const parsedBaseBet = useMemo(() => {
    const val = parseFloat(baseBetInput);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }, [baseBetInput]);

  // Handlers for Multiplier / Target / WinChance synchronization
  const handleMultiplierChange = (valStr: string) => {
    setMultDraft(valStr);
    const num = parseFloat(valStr.replace(',', '.'));
    if (Number.isFinite(num) && num > 1.0001) {
      setWinChance(chanceFromMultiplier(num));
    }
  };

  const handleChanceChange = (valStr: string) => {
    setChanceDraft(valStr);
    const num = parseFloat(valStr.replace(',', '.'));
    if (Number.isFinite(num) && num >= 0.01 && num <= 98.99) {
      setWinChance(clampWinChance(num));
    }
  };

  const handleTargetChange = (valStr: string) => {
    setTargetDraft(valStr);
    const num = parseFloat(valStr.replace(',', '.'));
    if (Number.isFinite(num) && num >= 0.01 && num <= 99.99) {
      setWinChance(chanceFromTarget(num, rollMode));
    }
  };

  const handleFlipMode = () => {
    if (isAutoRunning) return;
    setRollMode((prev) => (prev === 'over' ? 'under' : 'over'));
  };

  const handleHalfBet = () => {
    if (isAutoRunning) return;
    const next = Math.max(MIN_BET, round8((parsedBaseBet || 1) / 2));
    setBaseBetInput(next.toFixed(8));
  };

  const handleDoubleBet = () => {
    if (isAutoRunning) return;
    const base = parsedBaseBet > 0 ? parsedBaseBet : 1;
    const next = Math.min(balance, round8(base * 2));
    setBaseBetInput(next.toFixed(8));
  };

  // Stop auto-betting cleanly
  const stopAutoBetting = useCallback(
    (reason: StopReason = 'manual_stop', condIdx?: number, notice?: string) => {
      isAutoRunningRef.current = false;
      setIsAutoRunning(false);
      setLiveStopReason(reason);
      setLiveStopCondIdx(condIdx);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        window.cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      if (notice) {
        setStatusNotice(notice);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        window.cancelAnimationFrame(timerRef.current);
      }
    };
  }, []);

  // Reset Live Session
  const handleResetSession = useCallback(() => {
    stopAutoBetting('manual_stop');
    setBalance(initialCapital);
    setLiveRolls([]);
    setLastRollDisplay(null);
    setLastTriggeredConditions([]);
    setAutoBetsDone(0);
    setStatusNotice(null);
    runtimeStateRef.current = null;
  }, [initialCapital, setBalance, stopAutoBetting]);

  const handleApplyCapital = useCallback(
    (newCapital: number) => {
      stopAutoBetting('manual_stop');
      setWallets((prev) => ({
        ...prev,
        [selectedCrypto]: {
          balance: newCapital,
          initialCapital: newCapital,
        },
      }));
      setLiveRolls([]);
      setLastRollDisplay(null);
      setLastTriggeredConditions([]);
      setAutoBetsDone(0);
      setStatusNotice(null);
      runtimeStateRef.current = null;
    },
    [selectedCrypto, stopAutoBetting]
  );

  const handleSelectCrypto = useCallback(
    (nextCrypto: CryptoCurrency) => {
      if (isAutoRunningRef.current || nextCrypto === selectedCrypto) return;
      setSelectedCrypto(nextCrypto);
      setBaseBetInput(CRYPTO_MAP[nextCrypto].defaultBet.toFixed(8));
      setStopOnGainInput('0.00000000');
      setStopOnLossInput('0.00000000');
      setLiveRolls([]);
      setLastRollDisplay(null);
      setLastTriggeredConditions([]);
      setAutoBetsDone(0);
      setStatusNotice(null);
      runtimeStateRef.current = null;
    },
    [selectedCrypto]
  );

  // Manual Single Roll
  const handleManualRoll = () => {
    if (isAutoRunning) return;
    setStatusNotice(null);
    const bet = parsedBaseBet;
    if (bet <= 0) {
      setStatusNotice('Veuillez saisir un montant de pari supérieur à 0.');
      return;
    }
    if (bet > balance) {
      setStatusNotice(
        'Solde insuffisant. Réinitialisez votre capital via le Portefeuille.'
      );
      return;
    }

    const rng = useSeed ? liveRngRef.current : Math.random;
    const tempState = createInitialRuntimeState({
      initialCapital,
      baseBet: bet,
      baseWinChance: winChance,
      initialMode: rollMode,
    });
    tempState.balance = balance;
    tempState.totalBets = liveRolls.length;
    tempState.totalWagered =
      liveRolls.length > 0 ? liveRolls[0].wageredCumulative : 0;

    const { record } = stepDiceSimulation(tempState, null, rng);
    record.rollNumber = liveRolls.length + 1;
    record.id = Date.now() + Math.random();

    setBalance(record.balanceAfter);
    setLiveRolls((prev) => [record, ...prev].slice(0, 500));
    setLastRollDisplay({
      value: record.rollValue,
      won: record.won,
      target: record.target,
      id: record.id,
    });
    setLastTriggeredConditions([]);
    playRollSound(record.won);
  };

  // Start Visual Automated Strategy Execution
  const handleToggleAutoBet = () => {
    if (isAutoRunning) {
      stopAutoBetting('manual_stop');
      return;
    }

    setStatusNotice(null);
    const bet = parsedBaseBet;
    if (bet <= 0) {
      setStatusNotice('Veuillez saisir un montant de pari supérieur à 0.');
      return;
    }
    if (bet > balance) {
      setStatusNotice(
        'Solde insuffisant pour la mise de départ. Ouvrez le Portefeuille pour recharger.'
      );
      return;
    }

    const targetBets = isInfiniteBets
      ? Infinity
      : Math.max(1, parseInt(numBetsInput || '0', 10));

    if (!isInfiniteBets && (!Number.isFinite(targetBets) || targetBets <= 0)) {
      setStatusNotice(
        'Indiquez un nombre de paris > 0 ou activez le mode infini (∞).'
      );
      return;
    }

    // Initialize runtime state for this auto run
    const state = createInitialRuntimeState({
      initialCapital,
      baseBet: bet,
      baseWinChance: winChance,
      initialMode: rollMode,
    });
    state.balance = balance;
    if (liveRolls.length > 0) {
      state.totalBets = liveRolls[0].rollNumber;
      state.totalWagered = liveRolls[0].wageredCumulative;
    }
    runtimeStateRef.current = state;
    liveRngRef.current = createRng(useSeed ? seed : undefined);

    isAutoRunningRef.current = true;
    setIsAutoRunning(true);
    setAutoBetsDone(0);
    setLiveStopReason('manual_stop');
    setLiveStopCondIdx(undefined);

    const isSimpleAuto = controlTab === 'auto';
    const winPct = Math.max(0, parseFloat(onWinPctInput || '0') || 0);
    const lossPct = Math.max(0, parseFloat(onLossPctInput || '0') || 0);
    const stopGainVal = Math.max(0, parseFloat(stopOnGainInput || '0') || 0);
    const stopLossVal = Math.max(0, parseFloat(stopOnLossInput || '0') || 0);
    const runStartBalance = balance;

    const strategyForRun: Strategy | null = isSimpleAuto
      ? {
          id: 'simple-auto-runtime',
          name: 'Automatique simple',
          description: '',
          conditions: [
            onWinMode === 'reset'
              ? {
                  id: 'sa-win-reset',
                  category: 'bets',
                  betTriggerType: 'every',
                  betEventType: 'wins',
                  betCount: 1,
                  profitMetric: 'net_profit',
                  profitOperator: 'gt',
                  profitValue: 0,
                  action: 'reset_bet',
                  actionValue: 0,
                }
              : {
                  id: 'sa-win-inc',
                  category: 'bets',
                  betTriggerType: 'every',
                  betEventType: 'wins',
                  betCount: 1,
                  profitMetric: 'net_profit',
                  profitOperator: 'gt',
                  profitValue: 0,
                  action: 'increase_bet_pct',
                  actionValue: winPct,
                },
            onLossMode === 'reset'
              ? {
                  id: 'sa-loss-reset',
                  category: 'bets',
                  betTriggerType: 'every',
                  betEventType: 'losses',
                  betCount: 1,
                  profitMetric: 'net_profit',
                  profitOperator: 'gt',
                  profitValue: 0,
                  action: 'reset_bet',
                  actionValue: 0,
                }
              : {
                  id: 'sa-loss-inc',
                  category: 'bets',
                  betTriggerType: 'every',
                  betEventType: 'losses',
                  betCount: 1,
                  profitMetric: 'net_profit',
                  profitOperator: 'gt',
                  profitValue: 0,
                  action: 'increase_bet_pct',
                  actionValue: lossPct,
                },
          ],
        }
      : activeStrategy;

    let executedInRun = 0;

    const runStep = () => {
      if (!isAutoRunningRef.current || !runtimeStateRef.current) return;

      const st = runtimeStateRef.current;
      const batchSize = executionSpeed === 'instant' ? 15 : 1;
      const newRecords: RollRecord[] = [];
      let stopNow = false;
      let finalReason: StopReason = 'limit_reached';
      let finalCondIdx: number | undefined;
      let noticeMsg: string | undefined;

      for (let b = 0; b < batchSize; b++) {
        if (executedInRun >= targetBets) {
          stopNow = true;
          finalReason = 'limit_reached';
          break;
        }
        if (st.currentBet > st.balance + 1e-10 || st.balance <= 0) {
          stopNow = true;
          finalReason = 'insufficient_balance';
          noticeMsg = `Arrêt automatique : solde insuffisant pour couvrir la mise suivante (${st.currentBet.toFixed(4)}).`;
          break;
        }

        const step = stepDiceSimulation(
          st,
          strategyForRun,
          liveRngRef.current
        );
        executedInRun += 1;
        step.record.id = Date.now() + Math.random() + executedInRun;
        newRecords.push(step.record);

        if (isSimpleAuto) {
          const runProfit = st.balance - runStartBalance;
          if (stopGainVal > 0 && runProfit >= stopGainVal) {
            stopNow = true;
            finalReason = 'stop_condition';
            noticeMsg = `Arrêt sur Gain Net atteint (+${runProfit.toFixed(4)}).`;
            break;
          }
          if (stopLossVal > 0 && -runProfit >= stopLossVal) {
            stopNow = true;
            finalReason = 'stop_condition';
            noticeMsg = `Arrêt sur Perte Nette atteint (-${(-runProfit).toFixed(4)}).`;
            break;
          }
        } else if (step.shouldStop) {
          stopNow = true;
          finalReason = step.stopReason || 'stop_condition';
          finalCondIdx = step.stopConditionIndex;
          noticeMsg = `Condition d’arrêt #${finalCondIdx} déclenchée.`;
          break;
        }
      }

      if (newRecords.length > 0) {
        const latest = newRecords[newRecords.length - 1];
        setBalance(st.balance);
        setWinChance(st.currentWinChance);
        setRollMode(st.currentMode);
        setAutoBetsDone(executedInRun);
        setLastTriggeredConditions(latest.triggeredConditions);
        setLastRollDisplay({
          value: latest.rollValue,
          won: latest.won,
          target: latest.target,
          id: latest.id,
        });
        setLiveRolls((prev) =>
          [...newRecords.reverse(), ...prev].slice(0, 500)
        );
        if (executionSpeed !== 'instant') {
          playRollSound(latest.won);
        }
      }

      if (stopNow) {
        stopAutoBetting(finalReason, finalCondIdx, noticeMsg);
        return;
      }

      const delay =
        executionSpeed === 'normal' ? 280 : executionSpeed === 'fast' ? 60 : 0;

      if (delay === 0) {
        timerRef.current = window.requestAnimationFrame(runStep);
      } else {
        timerRef.current = window.setTimeout(runStep, delay);
      }
    };

    runStep();
  };

  // Build Live BacktestResult view from liveRolls for the statistics panel
  const liveSessionResult: BacktestResult = useMemo(() => {
    const chrono = [...liveRolls].reverse();
    let wins = 0;
    let losses = 0;
    let curW = 0;
    let curL = 0;
    let maxW = 0;
    let maxL = 0;
    let maxBet = 0;
    let peak = initialCapital;
    let lowest = initialCapital;
    let maxDD = 0;
    let sumChance = 0;

    const curve = [
      {
        roll: 0,
        balance: initialCapital,
        netProfit: 0,
        expectedProfit: 0,
      },
    ];

    for (const r of chrono) {
      if (r.won) {
        wins++;
        curW++;
        curL = 0;
        if (curW > maxW) maxW = curW;
      } else {
        losses++;
        curL++;
        curW = 0;
        if (curL > maxL) maxL = curL;
      }
      if (r.betAmount > maxBet) maxBet = r.betAmount;
      if (r.balanceAfter > peak) peak = r.balanceAfter;
      if (r.balanceAfter < lowest) lowest = r.balanceAfter;
      const dd = peak - r.balanceAfter;
      if (dd > maxDD) maxDD = dd;
      sumChance += r.winChance;
      curve.push({
        roll: r.rollNumber,
        balance: r.balanceAfter,
        netProfit: r.balanceAfter - initialCapital,
        expectedProfit: r.expectedProfitCumulative,
      });
    }

    const totalWagered =
      chrono.length > 0 ? chrono[chrono.length - 1].wageredCumulative : 0;
    const netProfit = balance - initialCapital;
    const expectedNetProfit = -0.01 * totalWagered;

    return {
      config: {
        initialCapital,
        baseBet: parsedBaseBet,
        totalBets: chrono.length,
        seed,
        useSeed,
        initialMode: rollMode,
        initialWinChance: winChance,
      },
      strategyName: activeStrategy ? activeStrategy.name : 'Manuel',
      durationMs: 0,
      stopReason: liveStopReason,
      stopConditionIndex: liveStopCondIdx,
      finalBalance: balance,
      netProfit,
      netProfitPct: initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0,
      totalWagered,
      theoreticalHouseEdgeCost: 0.01 * totalWagered,
      expectedNetProfit,
      edgeDeviation: netProfit - expectedNetProfit,
      totalBetsExecuted: chrono.length,
      wins,
      losses,
      actualWinRate: chrono.length > 0 ? (wins / chrono.length) * 100 : 0,
      averageWinChance:
        chrono.length > 0 ? sumChance / chrono.length : winChance,
      longestWinStreak: maxW,
      longestLossStreak: maxL,
      maxBetReached: maxBet,
      maxDrawdown: maxDD,
      maxDrawdownPct: peak > 0 ? (maxDD / peak) * 100 : 0,
      peakBalance: peak,
      lowestBalance: lowest,
      equityCurve: curve,
      recentRolls: liveRolls,
    };
  }, [
    liveRolls,
    initialCapital,
    balance,
    parsedBaseBet,
    seed,
    useSeed,
    rollMode,
    winChance,
    activeStrategy,
    liveStopReason,
    liveStopCondIdx,
  ]);

  // Strategy CRUD handlers
  const handleSaveStrategy = (strategy: Strategy, isNew: boolean) => {
    if (isNew) {
      setStrategies((prev) => [...prev, strategy]);
      setSelectedStrategyId(strategy.id);
    } else {
      setStrategies((prev) =>
        prev.map((s) => (s.id === strategy.id ? strategy : s))
      );
    }
    setInspectedConditionIdx(null);
  };

  const handleDeleteStrategy = (strategyId: string) => {
    const deleted = strategies.find((s) => s.id === strategyId);
    setStrategies((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.id !== strategyId);
      if (selectedStrategyId === strategyId && next.length > 0) {
        setSelectedStrategyId(next[0].id);
      }
      return next;
    });
    setConfirmDeleteStrategyId(null);
    setInspectedConditionIdx(null);
    if (deleted) {
      setStatusNotice(`Stratégie « ${deleted.name} » supprimée.`);
    }
  };

  const handleExportStrategyDocx = async () => {
    if (!activeStrategy || isExportingDocx) return;
    setIsExportingDocx(true);
    setStatusNotice(null);
    try {
      const fileName = await exportStrategyToDocx(activeStrategy, {
        cryptoSymbol: selectedCrypto,
        initialCapital,
        baseBet: parsedBaseBet,
        winChance,
        multiplier,
        rollMode,
      });
      setStatusNotice(`Stratégie exportée au format Word (${fileName}).`);
    } catch (err: unknown) {
      setStatusNotice(
        err instanceof Error
          ? `Erreur lors de l’export .docx : ${err.message}`
          : 'Impossible d’exporter la stratégie en .docx.'
      );
    } finally {
      setIsExportingDocx(false);
    }
  };

  const potentialWinProfit = Math.max(
    0,
    round8(parsedBaseBet * (multiplier - 1))
  );

  return (
    <div className="min-h-screen bg-[#0f212e] text-[#f2f6fa] flex flex-col">
      {/* Top Bar */}
      <HeaderBar
        selectedCrypto={selectedCrypto}
        wallets={wallets}
        onSelectCrypto={handleSelectCrypto}
        disableCryptoSwitch={isAutoRunning}
        balance={balance}
        initialCapital={initialCapital}
        onOpenWallet={() => setWalletModalOpen(true)}
        onQuickSetBalance={handleApplyCapital}
        onOpenFairness={() => setFairnessModalOpen(true)}
        onScrollToBacktest={() => {
          document
            .getElementById('backtest-analytics')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onResetSession={handleResetSession}
      />

      {/* Main Game Frame */}
      <main className="w-full max-w-[1360px] mx-auto px-2.5 sm:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4">
        <div className="bg-[#0f212e] border border-[#1c2f3d] rounded-xl overflow-hidden shadow-2xl">
          <div className="flex flex-col lg:flex-row">
            {/* LEFT CONTROL PANEL (Sidebar — placed below Dice Stage on mobile for immediate visibility) */}
            <aside className="order-2 lg:order-1 w-full lg:w-[340px] shrink-0 bg-[#213743] p-3.5 sm:p-4 flex flex-col justify-between gap-3.5 border-t lg:border-t-0 lg:border-r border-[#172833]">
              <div className="space-y-3.5">
                {/* Mode Toggle: Manuel / Automatique / Stratégies (3ème onglet icône) */}
                <div className="flex items-center gap-1 bg-[#0f212e] p-1 rounded-full border border-[#2f4553]/60">
                  <button
                    type="button"
                    disabled={isAutoRunning}
                    onClick={() => setControlTab('manual')}
                    className={`flex-1 min-h-[40px] px-2 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      controlTab === 'manual'
                        ? 'bg-[#2f4553] text-white shadow-sm'
                        : 'text-[#b1bad3] hover:text-white'
                    }`}
                  >
                    Manuel
                  </button>
                  <button
                    type="button"
                    disabled={isAutoRunning}
                    onClick={() => setControlTab('auto')}
                    className={`flex-1 min-h-[40px] px-2 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      controlTab === 'auto'
                        ? 'bg-[#2f4553] text-white shadow-sm'
                        : 'text-[#b1bad3] hover:text-white'
                    }`}
                  >
                    Automatique
                  </button>
                  <button
                    type="button"
                    disabled={isAutoRunning}
                    onClick={() => setControlTab('strategy')}
                    title="Création et gestion de stratégies conditionnelles"
                    aria-label="Création et gestion de stratégies"
                    className={`px-3.5 min-h-[40px] rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                      controlTab === 'strategy'
                        ? 'bg-[#2f4553] text-white shadow-sm'
                        : 'text-[#b1bad3] hover:text-white'
                    }`}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 14.5L7.5 10L10.5 13L17 5.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13 5.5H17V9.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* Montant du Pari */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#b1bad3] mb-1.5">
                    <span>Montant du Pari</span>
                    <span className="font-mono-tabular text-[11px] text-[#8b9bb4]">
                      {formatCompactCurrency(parsedBaseBet * activeCrypto.usdRate)}
                    </span>
                  </div>
                  <div className="flex items-stretch rounded-md overflow-hidden bg-[#0f212e] border border-[#2f4553] focus-within:border-[#557086] shadow-inner">
                    <div className="flex-1 flex items-center px-2.5 min-h-[44px]">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        disabled={isAutoRunning}
                        value={baseBetInput}
                        onChange={(e) => setBaseBetInput(e.target.value)}
                        className="w-full bg-transparent text-white text-base sm:text-sm font-semibold font-mono-tabular focus:outline-none disabled:opacity-60"
                      />
                      <TokenIcon
                        currency={selectedCrypto}
                        className="w-4 h-4 shrink-0 ml-1.5"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isAutoRunning}
                      onClick={handleHalfBet}
                      className="min-w-[44px] px-3 bg-[#2f4553] hover:bg-[#3c5667] active:bg-[#243642] text-white text-xs font-bold border-l border-[#1a2c38] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ½
                    </button>
                    <button
                      type="button"
                      disabled={isAutoRunning}
                      onClick={handleDoubleBet}
                      className="min-w-[44px] px-3 bg-[#2f4553] hover:bg-[#3c5667] active:bg-[#243642] text-white text-xs font-bold border-l border-[#1a2c38] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      2×
                    </button>
                  </div>
                </div>

                {controlTab === 'manual' ? (
                  <div className="space-y-3.5">
                    {/* Profit en cas de gain */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-[#b1bad3] mb-1.5">
                        <span>Profit en cas de gain</span>
                        <span className="font-mono-tabular text-[11px] text-[#8b9bb4]">
                          {formatCompactCurrency(
                            potentialWinProfit * activeCrypto.usdRate
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-[#2f4553]/60 border border-[#2f4553] rounded-md px-3 py-2">
                        <span className="text-sm font-semibold font-mono-tabular text-white">
                          {potentialWinProfit.toFixed(8)}
                        </span>
                        <TokenIcon
                          currency={selectedCrypto}
                          className="w-4 h-4 shrink-0"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualRoll}
                      className="w-full min-h-[44px] py-3 rounded-md bg-[#00e701] hover:bg-[#1fff20] active:bg-[#00c701] text-[#05080a] text-sm font-bold shadow-md transition-colors cursor-pointer"
                    >
                      Parier
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Nombre de Paris */}
                    <div>
                      <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                        Nombre de Paris
                      </label>
                      <div className="flex items-center min-h-[44px] bg-[#0f212e] border border-[#2f4553] focus-within:border-[#557086] rounded-md px-2.5 py-1.5 shadow-inner">
                        <input
                          type={isInfiniteBets ? 'text' : 'number'}
                          min="0"
                          step="1"
                          disabled={isAutoRunning || isInfiniteBets}
                          value={isInfiniteBets ? '∞ (Illimité)' : numBetsInput}
                          onChange={(e) => setNumBetsInput(e.target.value)}
                          className="w-full bg-transparent text-white text-base sm:text-sm font-semibold font-mono-tabular focus:outline-none disabled:opacity-75"
                        />
                        <button
                          type="button"
                          disabled={isAutoRunning}
                          onClick={() => setIsInfiniteBets((v) => !v)}
                          title="Basculer le mode infini"
                          className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded transition-colors cursor-pointer ${
                            isInfiniteBets
                              ? 'bg-[#1475e1] text-white'
                              : 'text-[#b1bad3] hover:text-white'
                          }`}
                        >
                          <InfinityIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {controlTab === 'auto' ? (
                      <>
                        {/* En cas de Gain */}
                        <div>
                          <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                            En cas de Gain
                          </label>
                          <div className="flex flex-wrap sm:flex-nowrap items-stretch rounded-md overflow-hidden bg-[#0f212e] border border-[#2f4553] shadow-inner">
                            <button
                              type="button"
                              disabled={isAutoRunning}
                              onClick={() => setOnWinMode('reset')}
                              className={`min-h-[40px] px-2.5 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                onWinMode === 'reset'
                                  ? 'bg-[#2f4553] text-white'
                                  : 'bg-[#1a2c38] text-[#b1bad3] hover:text-white'
                              }`}
                            >
                              Réinitialiser
                            </button>
                            <button
                              type="button"
                              disabled={isAutoRunning}
                              onClick={() => setOnWinMode('increase')}
                              className={`min-h-[40px] px-2.5 text-[11px] font-bold border-l border-[#0f212e] transition-colors cursor-pointer whitespace-nowrap ${
                                onWinMode === 'increase'
                                  ? 'bg-[#2f4553] text-white'
                                  : 'bg-[#1a2c38] text-[#b1bad3] hover:text-white'
                              }`}
                            >
                              Augmenter de
                            </button>
                            <div className="flex-1 flex items-center px-2.5 min-h-[40px] min-w-[70px]">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={isAutoRunning || onWinMode === 'reset'}
                                value={onWinPctInput}
                                onChange={(e) => setOnWinPctInput(e.target.value)}
                                className="w-full bg-transparent text-white text-base sm:text-xs font-semibold font-mono-tabular focus:outline-none disabled:opacity-50"
                              />
                              <span className="text-xs font-bold text-[#8b9bb4] ml-1">
                                %
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* En cas de Perte */}
                        <div>
                          <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                            En cas de Perte
                          </label>
                          <div className="flex flex-wrap sm:flex-nowrap items-stretch rounded-md overflow-hidden bg-[#0f212e] border border-[#2f4553] shadow-inner">
                            <button
                              type="button"
                              disabled={isAutoRunning}
                              onClick={() => setOnLossMode('reset')}
                              className={`min-h-[40px] px-2.5 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                onLossMode === 'reset'
                                  ? 'bg-[#2f4553] text-white'
                                  : 'bg-[#1a2c38] text-[#b1bad3] hover:text-white'
                              }`}
                            >
                              Réinitialiser
                            </button>
                            <button
                              type="button"
                              disabled={isAutoRunning}
                              onClick={() => setOnLossMode('increase')}
                              className={`min-h-[40px] px-2.5 text-[11px] font-bold border-l border-[#0f212e] transition-colors cursor-pointer whitespace-nowrap ${
                                onLossMode === 'increase'
                                  ? 'bg-[#2f4553] text-white'
                                  : 'bg-[#1a2c38] text-[#b1bad3] hover:text-white'
                              }`}
                            >
                              Augmenter de
                            </button>
                            <div className="flex-1 flex items-center px-2.5 min-h-[40px] min-w-[70px]">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={isAutoRunning || onLossMode === 'reset'}
                                value={onLossPctInput}
                                onChange={(e) => setOnLossPctInput(e.target.value)}
                                className="w-full bg-transparent text-white text-base sm:text-xs font-semibold font-mono-tabular focus:outline-none disabled:opacity-50"
                              />
                              <span className="text-xs font-bold text-[#8b9bb4] ml-1">
                                %
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Arrêter sur Gain Net */}
                        <div>
                          <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                            Arrêter sur Gain Net
                          </label>
                          <div className="flex items-center min-h-[44px] bg-[#0f212e] border border-[#2f4553] focus-within:border-[#557086] rounded-md px-2.5 py-2 shadow-inner">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={isAutoRunning}
                              value={stopOnGainInput}
                              onChange={(e) => setStopOnGainInput(e.target.value)}
                              className="w-full bg-transparent text-white text-base sm:text-sm font-semibold font-mono-tabular focus:outline-none disabled:opacity-60"
                            />
                            <TokenIcon
                              currency={selectedCrypto}
                              className="w-4 h-4 shrink-0 ml-1.5"
                            />
                          </div>
                        </div>

                        {/* Arrêter sur Perte Nette */}
                        <div>
                          <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                            Arrêter sur Perte Nette
                          </label>
                          <div className="flex items-center min-h-[44px] bg-[#0f212e] border border-[#2f4553] focus-within:border-[#557086] rounded-md px-2.5 py-2 shadow-inner">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={isAutoRunning}
                              value={stopOnLossInput}
                              onChange={(e) => setStopOnLossInput(e.target.value)}
                              className="w-full bg-transparent text-white text-base sm:text-sm font-semibold font-mono-tabular focus:outline-none disabled:opacity-60"
                            />
                            <TokenIcon
                              currency={selectedCrypto}
                              className="w-4 h-4 shrink-0 ml-1.5"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>

                    {/* Sélectionner une stratégie */}
                    <div>
                      <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                        Sélectionner une stratégie
                      </label>
                      <div className="relative">
                        <select
                          disabled={isAutoRunning}
                          value={activeStrategy?.id || ''}
                          onChange={(e) => {
                            setSelectedStrategyId(e.target.value);
                            setInspectedConditionIdx(null);
                            setConfirmDeleteStrategyId(null);
                          }}
                          className="w-full min-h-[44px] appearance-none bg-[#0f212e] border border-[#2f4553] focus:border-[#557086] rounded-md px-3 py-2.5 pr-8 text-base sm:text-sm font-semibold text-white focus:outline-none cursor-pointer disabled:opacity-60"
                        >
                          {strategies.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-[#b1bad3] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Conditions Badges (1, 2, 3...) */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-[#b1bad3] mb-2">
                        <span>Conditions</span>
                        <span className="text-[11px] font-normal text-[#8b9bb4]">
                          {activeStrategy?.conditions.length || 0} active
                          {(activeStrategy?.conditions.length || 0) > 1
                            ? 's'
                            : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeStrategy?.conditions.map((cond, idx) => {
                          const num = idx + 1;
                          const isTriggered =
                            lastTriggeredConditions.includes(num);
                          const isSelected = inspectedConditionIdx === idx;
                          return (
                            <button
                              key={cond.id}
                              type="button"
                              onClick={() =>
                                setInspectedConditionIdx(
                                  isSelected ? null : idx
                                )
                              }
                              title={formatConditionSummary(cond)}
                              className={`relative min-w-[44px] min-h-[44px] rounded-md font-bold text-sm font-mono-tabular flex items-center justify-center transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#1475e1] border-[#4c96eb] text-white'
                                  : isTriggered
                                  ? 'bg-[#2f4553] border-[#00e701] text-white'
                                  : 'bg-[#2f4553] hover:bg-[#3a5465] border-[#3d5667]/60 text-white'
                              }`}
                            >
                              {num}
                              <span
                                className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                                  isTriggered ? 'bg-[#00e701]' : 'bg-[#7c92a6]'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {/* Inline Rule Inspector when a condition badge is clicked */}
                      {inspectedConditionIdx !== null &&
                        activeStrategy?.conditions[inspectedConditionIdx] && (
                          <div className="mt-2.5 bg-[#0f212e] border border-[#2f4553] rounded-md p-2.5 text-xs text-[#d5e0ea] space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-[#8b9bb4]">
                              <span>
                                Règle #{inspectedConditionIdx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setStrategyModalState({
                                    open: true,
                                    mode: 'edit',
                                  })
                                }
                                className="text-[#1475e1] hover:underline font-semibold cursor-pointer"
                              >
                                Éditer
                              </button>
                            </div>
                            <p className="leading-snug font-medium">
                              {formatConditionSummary(
                                activeStrategy.conditions[inspectedConditionIdx]
                              )}
                            </p>
                          </div>
                        )}
                    </div>

                    {/* Strategy Action Buttons */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={isAutoRunning}
                        onClick={() =>
                          setStrategyModalState({ open: true, mode: 'create' })
                        }
                        className="w-full min-h-[42px] py-2.5 px-3 rounded-md bg-[#2f4553] hover:bg-[#3a5465] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Créer une stratégie
                      </button>
                      <button
                        type="button"
                        disabled={isAutoRunning || !activeStrategy}
                        onClick={() =>
                          setStrategyModalState({ open: true, mode: 'edit' })
                        }
                        className="w-full min-h-[42px] py-2.5 px-3 rounded-md bg-[#2f4553] hover:bg-[#3a5465] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Modifier la stratégie
                      </button>

                      {/* Export (.docx) & Delete Strategy */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!activeStrategy || isExportingDocx}
                          onClick={handleExportStrategyDocx}
                          title="Exporter la stratégie au format Word (.docx)"
                          className="min-h-[40px] px-2.5 py-2 rounded-md bg-[#0f212e] hover:bg-[#1a2c38] border border-[#2f4553] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-[#1475e1] shrink-0" />
                          <span className="truncate">
                            {isExportingDocx ? 'Export...' : 'Exporter .docx'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            isAutoRunning ||
                            !activeStrategy ||
                            strategies.length <= 1
                          }
                          onClick={() => {
                            if (activeStrategy) {
                              setConfirmDeleteStrategyId(
                                confirmDeleteStrategyId === activeStrategy.id
                                  ? null
                                  : activeStrategy.id
                              );
                            }
                          }}
                          title={
                            strategies.length <= 1
                              ? 'Au moins une stratégie doit être conservée'
                              : 'Supprimer la stratégie sélectionnée'
                          }
                          className="min-h-[40px] px-2.5 py-2 rounded-md bg-[#2c121a] hover:bg-[#3f1924] border border-[#e9113c]/40 text-[#ff6b81] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Supprimer</span>
                        </button>
                      </div>

                      {confirmDeleteStrategyId &&
                        activeStrategy &&
                        confirmDeleteStrategyId === activeStrategy.id && (
                          <div className="bg-[#0f212e] border border-[#e9113c]/50 rounded-md p-2.5 space-y-2">
                            <p className="text-[11px] text-[#f2f6fa] leading-snug">
                              Supprimer définitivement{' '}
                              <strong className="text-white">
                                « {activeStrategy.name} »
                              </strong>{' '}
                              ?
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteStrategyId(null)}
                                className="min-h-[36px] rounded bg-[#2f4553] hover:bg-[#3a5465] text-white text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteStrategy(activeStrategy.id)
                                }
                                className="min-h-[36px] rounded bg-[#e9113c] hover:bg-[#ff2652] text-white text-xs font-bold transition-colors cursor-pointer"
                              >
                                Confirmer
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                      </>
                    )}

                    {/* Execution Speed Selector */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#8b9bb4] mb-1">
                        <span>Vitesse d’exécution</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-[#0f212e] p-1 rounded-md border border-[#2f4553]">
                        {(
                          [
                            { id: 'normal', label: 'Normale' },
                            { id: 'fast', label: 'Rapide' },
                            { id: 'instant', label: 'Instantanée' },
                          ] as const
                        ).map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => setExecutionSpeed(sp.id)}
                            className={`min-h-[38px] py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              executionSpeed === sp.id
                                ? 'bg-[#2f4553] text-white'
                                : 'text-[#8b9bb4] hover:text-white'
                            }`}
                          >
                            {sp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary CTA: Lancer le Pari Automatique */}
                    <button
                      type="button"
                      onClick={handleToggleAutoBet}
                      className={`w-full min-h-[46px] py-3 px-4 rounded-md text-sm font-bold shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                        isAutoRunning
                          ? 'bg-[#e9113c] hover:bg-[#ff2652] text-white'
                          : 'bg-[#1475e1] hover:bg-[#1f83f0] active:bg-[#1164c2] text-white'
                      }`}
                    >
                      {isAutoRunning ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>
                            Arrêter ({autoBetsDone}
                            {!isInfiniteBets ? `/${numBetsInput}` : ''})
                          </span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Lancer le Pari Automatique</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {statusNotice && (
                  <div className="bg-[#0f212e] border border-[#2f4553] rounded-md px-3 py-2 text-xs text-[#f59e0b]">
                    {statusNotice}
                  </div>
                )}
              </div>
            </aside>

            {/* RIGHT MAIN DICE STAGE (placed first on mobile) */}
            <div className="order-1 lg:order-2 flex-1 bg-[#0f212e] flex flex-col justify-between min-h-[260px] sm:min-h-[380px] lg:min-h-[540px] p-3.5 sm:p-6">
              {/* Top Recent Rolls Strip */}
              <div className="flex items-center justify-between gap-2 min-h-[32px]">
                <div className="text-[11px] font-medium text-[#8b9bb4] hidden sm:block">
                  {controlTab === 'strategy' && activeStrategy ? (
                    <span>
                      Stratégie :{' '}
                      <strong className="text-white">
                        {activeStrategy.name}
                      </strong>
                    </span>
                  ) : controlTab === 'auto' ? (
                    'Mode automatique simple'
                  ) : (
                    'Mode manuel'
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full ml-auto pb-1">
                  {liveRolls.length === 0 ? (
                    <span className="text-[11px] text-[#557086]">
                      Aucun lancer effectué
                    </span>
                  ) : (
                    liveRolls.slice(0, 10).map((r) => (
                      <span
                        key={r.id}
                        title={`Tour #${r.rollNumber} · Mise ${r.betAmount.toFixed(2)} · Gain ${r.profit >= 0 ? '+' : ''}${r.profit.toFixed(2)}`}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono-tabular shrink-0 ${
                          r.won
                            ? 'bg-[#00e701] text-[#05080a]'
                            : 'bg-[#2f4553] text-[#b1bad3]'
                        }`}
                      >
                        {r.rollValue.toFixed(2)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Center Slider Zone */}
              <div className="my-auto py-3 sm:py-8">
                <DiceSlider
                  mode={rollMode}
                  winChance={winChance}
                  lastRoll={lastRollDisplay}
                  onChangeWinChance={(c) => {
                    if (!isAutoRunning) setWinChance(c);
                  }}
                  disabled={isAutoRunning}
                />
              </div>

              {/* Bottom Synchronized Parameters Card */}
              <div className="bg-[#213743] rounded-lg p-3 sm:p-4 border border-[#2f4553]/40">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {/* Multiplicateur */}
                  <div className="order-1">
                    <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                      Multiplicateur
                    </label>
                    <div className="flex items-center bg-[#0f212e] border border-[#2f4553] focus-within:border-[#1475e1] rounded-md px-3 min-h-[42px] shadow-inner">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={isAutoRunning}
                        value={multDraft}
                        onFocus={() => setFocusedField('mult')}
                        onBlur={() => setFocusedField(null)}
                        onChange={(e) => handleMultiplierChange(e.target.value)}
                        className="w-full bg-transparent text-white text-base sm:text-sm font-bold font-mono-tabular focus:outline-none disabled:opacity-70"
                      />
                      <span className="text-sm font-bold text-[#b1bad3] ml-2 select-none">
                        ×
                      </span>
                    </div>
                  </div>

                  {/* Lancer au Dessus / en Dessous */}
                  <div className="col-span-2 sm:col-span-1 order-3 sm:order-2">
                    <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                      {rollMode === 'over'
                        ? 'Lancer au Dessus'
                        : 'Lancer en Dessous'}
                    </label>
                    <div className="flex items-center bg-[#0f212e] border border-[#2f4553] focus-within:border-[#1475e1] rounded-md px-3 min-h-[42px] shadow-inner">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={isAutoRunning}
                        value={targetDraft}
                        onFocus={() => setFocusedField('target')}
                        onBlur={() => setFocusedField(null)}
                        onChange={(e) => handleTargetChange(e.target.value)}
                        className="w-full bg-transparent text-white text-base sm:text-sm font-bold font-mono-tabular focus:outline-none disabled:opacity-70"
                      />
                      <button
                        type="button"
                        disabled={isAutoRunning}
                        onClick={handleFlipMode}
                        title="Inverser Lancer au Dessus / Lancer en Dessous"
                        aria-label="Inverser Lancer au Dessus ou en Dessous"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 text-[#b1bad3] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chance de Gagner */}
                  <div className="order-2 sm:order-3">
                    <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                      Chance de Gagner
                    </label>
                    <div className="flex items-center bg-[#0f212e] border border-[#2f4553] focus-within:border-[#1475e1] rounded-md px-3 min-h-[42px] shadow-inner">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={isAutoRunning}
                        value={chanceDraft}
                        onFocus={() => setFocusedField('chance')}
                        onBlur={() => setFocusedField(null)}
                        onChange={(e) => handleChanceChange(e.target.value)}
                        className="w-full bg-transparent text-white text-base sm:text-sm font-bold font-mono-tabular focus:outline-none disabled:opacity-70"
                      />
                      <span className="text-sm font-bold text-[#b1bad3] ml-2 select-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Game Footer Bar */}
          <div className="bg-[#0f212e] border-t border-[#1c2f3d] px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            {/* Left Functional Icons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[#b1bad3] hover:text-white hover:bg-[#1a2c38] transition-colors cursor-pointer"
                title={soundEnabled ? 'Couper le son' : 'Activer le son'}
                aria-label="Basculer le son"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#00e701]" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('backtest-analytics')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[#b1bad3] hover:text-white hover:bg-[#1a2c38] transition-colors cursor-pointer"
                title="Voir les statistiques en direct"
                aria-label="Statistiques en direct"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-[#b1bad3] hover:text-white hover:bg-[#1a2c38] transition-colors cursor-pointer"
                title="Réinitialiser la session"
                aria-label="Réinitialiser la session"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Center Brand & House Edge Notice */}
            <div className="flex items-center gap-2 sm:gap-3">
              <StakeLogo className="h-4 sm:h-5 w-auto opacity-85 hidden sm:block" />
              <span className="text-[11px] sm:text-xs text-[#8b9bb4] sm:border-l sm:border-[#2f4553] sm:pl-3">
                House Edge : 1 % (RTP 99 %)
              </span>
            </div>

            {/* Right Équité Button */}
            <button
              type="button"
              onClick={() => setFairnessModalOpen(true)}
              className="flex items-center gap-1.5 px-3 min-h-[38px] rounded-md bg-[#1a2c38] hover:bg-[#213743] border border-[#2f4553] text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#b1bad3]" />
              <span>Équité</span>
            </button>
          </div>
        </div>
      </main>

      {/* Live Statistics Panel */}
      <BacktestPanel liveResult={liveSessionResult} />

      {/* Modals */}
      <WalletModal
        isOpen={walletModalOpen}
        selectedCrypto={selectedCrypto}
        onSelectCrypto={handleSelectCrypto}
        disableCryptoSwitch={isAutoRunning}
        currentBalance={balance}
        initialCapital={initialCapital}
        onClose={() => setWalletModalOpen(false)}
        onApplyCapital={handleApplyCapital}
      />

      <FairnessModal
        isOpen={fairnessModalOpen}
        seed={seed}
        useSeed={useSeed}
        winChance={winChance}
        multiplier={multiplier}
        onChangeSeed={setSeed}
        onToggleUseSeed={setUseSeed}
        onClose={() => setFairnessModalOpen(false)}
      />

      <StrategyModal
        isOpen={strategyModalState.open}
        mode={strategyModalState.mode}
        initialStrategy={
          strategyModalState.mode === 'edit' ? activeStrategy : null
        }
        onClose={() =>
          setStrategyModalState((prev) => ({ ...prev, open: false }))
        }
        onSave={handleSaveStrategy}
        onDelete={handleDeleteStrategy}
      />
    </div>
  );
}
