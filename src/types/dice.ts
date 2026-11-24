export type RollMode = 'over' | 'under';

export type CryptoCurrency = 'USDT' | 'BTC' | 'ETH' | 'SOL' | 'POL' | 'BNB';

export interface CryptoInfo {
  id: CryptoCurrency;
  symbol: CryptoCurrency;
  name: string;
  defaultCapital: number;
  defaultBet: number;
  usdRate: number;
  quickPresets: number[];
}

export type BetTriggerCategory = 'bets' | 'profit';
export type BetTriggerType = 'every' | 'every_streak' | 'first_streak';
export type BetEventType = 'wins' | 'losses' | 'bets';
export type ProfitMetric = 'balance' | 'net_profit' | 'net_loss';
export type ProfitOperator = 'gt' | 'lt';

export type StrategyActionType =
  | 'increase_bet_pct'
  | 'decrease_bet_pct'
  | 'increase_chance_pct'
  | 'decrease_chance_pct'
  | 'add_bet'
  | 'sub_bet'
  | 'add_chance'
  | 'sub_chance'
  | 'set_bet'
  | 'set_chance'
  | 'reset_bet'
  | 'reset_chance'
  | 'switch_over_under'
  | 'stop_auto';

export interface StrategyCondition {
  id: string;
  category: BetTriggerCategory;
  // When category === 'bets'
  betTriggerType: BetTriggerType;
  betEventType: BetEventType;
  betCount: number;
  // When category === 'profit'
  profitMetric: ProfitMetric;
  profitOperator: ProfitOperator;
  profitValue: number;
  // Then block
  action: StrategyActionType;
  actionValue: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  isPreset?: boolean;
  conditions: StrategyCondition[];
}

export interface RollRecord {
  id: number;
  rollNumber: number;
  rollValue: number;
  mode: RollMode;
  target: number;
  winChance: number;
  multiplier: number;
  betAmount: number;
  won: boolean;
  profit: number; // net profit/loss for this roll
  balanceAfter: number;
  wageredCumulative: number;
  expectedProfitCumulative: number;
  triggeredConditions: number[]; // 1-based condition indices triggered
}

export type ExecutionSpeed = 'normal' | 'fast' | 'instant';

export interface BacktestConfig {
  initialCapital: number;
  baseBet: number;
  totalBets: number;
  seed: string;
  useSeed: boolean;
  initialMode: RollMode;
  initialWinChance: number;
}

export interface EquityPoint {
  roll: number;
  balance: number;
  netProfit: number;
  expectedProfit: number;
}

export type StopReason =
  | 'limit_reached'
  | 'stop_condition'
  | 'insufficient_balance'
  | 'manual_stop';

export interface BacktestResult {
  config: BacktestConfig;
  strategyName: string;
  durationMs: number;
  stopReason: StopReason;
  stopConditionIndex?: number;
  finalBalance: number;
  netProfit: number;
  netProfitPct: number;
  totalWagered: number;
  theoreticalHouseEdgeCost: number; // 1% * totalWagered
  expectedNetProfit: number; // -1% * totalWagered
  edgeDeviation: number; // netProfit - expectedNetProfit
  totalBetsExecuted: number;
  wins: number;
  losses: number;
  actualWinRate: number;
  averageWinChance: number;
  longestWinStreak: number;
  longestLossStreak: number;
  maxBetReached: number;
  maxDrawdown: number; // positive number representing max drop from peak balance
  maxDrawdownPct: number;
  peakBalance: number;
  lowestBalance: number;
  equityCurve: EquityPoint[];
  recentRolls: RollRecord[]; // up to last 500 rolls for detailed inspection
}

export type AiOptimizationGoal =
  | 'balanced'
  | 'conservative'
  | 'multiplier_hunt'
  | 'high_winrate';

export interface AiRecommendedSettings {
  baseBetPctOfCapital: number;
  winChance: number;
  rollMode: RollMode;
  rationale: string;
}

export interface AiProposedStrategy {
  name: string;
  description: string;
  rationale: string;
  expectedProfile: string;
  conditions: StrategyCondition[];
}

export interface AiAnalysisResponse {
  diagnosticSummary: string;
  riskLevel: 'Faible' | 'Modéré' | 'Élevé' | 'Critique';
  keyFindings: string[];
  recommendedSettings: AiRecommendedSettings;
  proposedStrategies: AiProposedStrategy[];
}

