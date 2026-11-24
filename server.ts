import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_TRIGGER_CATEGORIES = new Set(['bets', 'profit']);
const VALID_BET_TRIGGERS = new Set(['every', 'every_streak', 'first_streak']);
const VALID_BET_EVENTS = new Set(['wins', 'losses', 'bets']);
const VALID_PROFIT_METRICS = new Set(['balance', 'net_profit', 'net_loss']);
const VALID_PROFIT_OPS = new Set(['gt', 'lt']);
const VALID_ACTIONS = new Set([
  'increase_bet_pct',
  'decrease_bet_pct',
  'increase_chance_pct',
  'decrease_chance_pct',
  'add_bet',
  'sub_bet',
  'add_chance',
  'sub_chance',
  'set_bet',
  'set_chance',
  'reset_bet',
  'reset_chance',
  'switch_over_under',
  'stop_auto',
]);
const VALID_RISK_LEVELS = new Set(['Faible', 'Modéré', 'Élevé', 'Critique']);

const GOAL_DESCRIPTIONS: Record<string, string> = {
  balanced:
    'Équilibre risque/rendement : maîtriser les séries de pertes et protéger le capital avec un Stop-Loss et Take-Profit réalistes.',
  conservative:
    'Conservateur (Drawdown minimal) : préserver le capital au maximum, petites progressions ou réinitialisation rapide, probabilités élevées.',
  multiplier_hunt:
    'Chasse au multiplicateur : probabilité modérée ou basse (15 % à 35 %, multiplicateurs 2,8× à 6,6×) avec paliers de récupération contrôlés et arrêt strict.',
  high_winrate:
    'Haute fréquence de gains : chance de gagner élevée (65 % à 88 %), gestion fine des rares pertes pour limiter la baisse brutale de solde.',
};

function clamp(num: number, min: number, max: number): number {
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function sanitizeCondition(raw: unknown, idx: number, strategyIdx: number) {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const category = VALID_TRIGGER_CATEGORIES.has(String(c.category))
    ? String(c.category)
    : 'bets';
  const betTriggerType = VALID_BET_TRIGGERS.has(String(c.betTriggerType))
    ? String(c.betTriggerType)
    : 'every';
  const betEventType = VALID_BET_EVENTS.has(String(c.betEventType))
    ? String(c.betEventType)
    : 'losses';
  const betCount = Math.max(1, Math.round(Number(c.betCount) || 1));

  const profitMetric = VALID_PROFIT_METRICS.has(String(c.profitMetric))
    ? String(c.profitMetric)
    : 'net_profit';
  const profitOperator = VALID_PROFIT_OPS.has(String(c.profitOperator))
    ? String(c.profitOperator)
    : 'gt';
  const profitValue = Number.isFinite(Number(c.profitValue))
    ? Number(c.profitValue)
    : 10;

  const action = VALID_ACTIONS.has(String(c.action))
    ? String(c.action)
    : 'reset_bet';

  let actionValue = Number.isFinite(Number(c.actionValue))
    ? Math.max(0, Number(c.actionValue))
    : 0;

  if (action === 'set_chance') {
    actionValue = clamp(actionValue || 49.5, 0.01, 98.99);
  }

  return {
    id: `ai-cond-${Date.now()}-${strategyIdx}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    betTriggerType,
    betEventType,
    betCount,
    profitMetric,
    profitOperator,
    profitValue,
    action,
    actionValue,
  };
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ai/analyze-strategy', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(500).json({
        error:
          'Clé API Gemini manquante sur le serveur. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
      });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Corps de requête JSON invalide.' });
      return;
    }

    const goal =
      typeof body.goal === 'string' && GOAL_DESCRIPTIONS[body.goal]
        ? body.goal
        : 'balanced';
    const stats = (body.stats && typeof body.stats === 'object'
      ? body.stats
      : {}) as Record<string, unknown>;
    const config = (body.config && typeof body.config === 'object'
      ? body.config
      : {}) as Record<string, unknown>;
    const activeStrategy = (body.activeStrategy &&
    typeof body.activeStrategy === 'object'
      ? body.activeStrategy
      : null) as Record<string, unknown> | null;
    const recentRollsSample = Array.isArray(body.recentRollsSample)
      ? body.recentRollsSample.slice(0, 60)
      : [];

    const initialCapital = Math.max(
      0.000001,
      Number(config.initialCapital) || 1000
    );
    const cryptoSymbol =
      typeof config.cryptoSymbol === 'string'
        ? config.cryptoSymbol.slice(0, 10)
        : 'USDT';

    const promptPayload = {
      objectifOptimisation: GOAL_DESCRIPTIONS[goal],
      configurationActuelle: {
        crypto: cryptoSymbol,
        capitalInitial: initialCapital,
        soldeActuel: Number(config.balance) || initialCapital,
        miseDeBase: Number(config.baseBet) || 1,
        chanceDeGagnerPct: Number(config.winChance) || 49.5,
        multiplicateur: Number(config.multiplier) || 2,
        modeLancer: config.rollMode === 'under' ? 'under' : 'over',
        houseEdgePct: 1,
        rtpPct: 99,
      },
      statistiquesSession: {
        parisExecutes: Number(stats.totalBetsExecuted) || 0,
        gains: Number(stats.wins) || 0,
        pertes: Number(stats.losses) || 0,
        tauxVictoireReelPct: Number(stats.actualWinRate) || 0,
        chanceMoyennePct: Number(stats.averageWinChance) || 0,
        profitNet: Number(stats.netProfit) || 0,
        profitNetPct: Number(stats.netProfitPct) || 0,
        volumeMise: Number(stats.totalWagered) || 0,
        esperanceTheoriqueMoins1Pct: Number(stats.expectedNetProfit) || 0,
        ecartVsEsperance: Number(stats.edgeDeviation) || 0,
        serieMaxGains: Number(stats.longestWinStreak) || 0,
        serieMaxPertes: Number(stats.longestLossStreak) || 0,
        miseMaxAtteinte: Number(stats.maxBetReached) || 0,
        drawdownMax: Number(stats.maxDrawdown) || 0,
        drawdownMaxPct: Number(stats.maxDrawdownPct) || 0,
        statutArret: stats.stopReason || 'manual_stop',
      },
      strategieActive: activeStrategy
        ? {
            nom: activeStrategy.name,
            description: activeStrategy.description,
            conditions: activeStrategy.conditions,
          }
        : null,
      echantillonDerniersLancers: recentRollsSample,
    };

    const systemInstruction = `Tu es un analyste quantitatif expert en probabilités, gestion de bankroll (risk management) et simulation Dice à House Edge fixe de 1 % (RTP 99 %, Multiplicateur = 99 / P).
Règles mathématiques strictes :
- Sois toujours honnête mathématiquement : l'espérance par pari est de -1 % de la mise. Aucune stratégie ne bat le House Edge à long terme, mais une bonne stratégie contrôle la variance, limite le drawdown, plafonne l'exposition martingale et protège le capital via des conditions d'arrêt (Take-Profit / Stop-Loss).
- Réponds uniquement en français clair, précis et actionnable.
- Adapte toutes les valeurs numériques (profitValue, actionValue, baseBetPctOfCapital) au capital (${initialCapital} ${cryptoSymbol}) et à l'objectif demandé.
- Pour chaque stratégie proposée (exactement 2 stratégies complémentaires et optimisées), fournis entre 3 et 5 conditions exécutables en respectant STRICTEMENT les valeurs d'énumération autorisées :
  * category: "bets" ou "profit"
  * Si category === "bets":
    - betTriggerType: "every" | "every_streak" | "first_streak"
    - betEventType: "wins" | "losses" | "bets"
    - betCount: entier >= 1
  * Si category === "profit":
    - profitMetric: "balance" | "net_profit" | "net_loss"
    - profitOperator: "gt" | "lt"
    - profitValue: nombre positif en ${cryptoSymbol} (attention: pour net_loss, netLoss est positif quand on perd, donc net_loss gt X signifie perte nette > X)
  * action (Bloc ALORS): une seule parmi:
    "increase_bet_pct", "decrease_bet_pct", "increase_chance_pct", "decrease_chance_pct", "add_bet", "sub_bet", "add_chance", "sub_chance", "set_bet", "set_chance", "reset_bet", "reset_chance", "switch_over_under", "stop_auto"
  * actionValue: nombre >= 0 (pour reset_bet, reset_chance, switch_over_under, stop_auto mettre 0; pour increase_bet_pct/decrease_bet_pct mettre un pourcentage ex. 25, 50, 100; pour set_chance une probabilité entre 0.01 et 98.99).`;

    try {
      const requestParams = {
        model: 'gemini-4-hydrogen',
        contents: `Analyse ces statistiques de simulation Dice et propose des paramètres et stratégies conditionnelles optimisés :\n${JSON.stringify(promptPayload)}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagnosticSummary: {
                type: Type.STRING,
                description:
                  'Diagnostic statistique concis en français (2 à 3 phrases) analysant écart vs espérance, drawdown, séries de pertes et gestion de mise.',
              },
              riskLevel: {
                type: Type.STRING,
                description:
                  'Exactement une des valeurs: Faible, Modéré, Élevé, Critique',
              },
              keyFindings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '3 à 4 observations chiffrées clés sur la session ou la stratégie.',
              },
              recommendedSettings: {
                type: Type.OBJECT,
                properties: {
                  baseBetPctOfCapital: {
                    type: Type.NUMBER,
                    description:
                      'Pourcentage recommandé du capital initial pour la mise de base (ex: 0.1 à 2.0).',
                  },
                  winChance: {
                    type: Type.NUMBER,
                    description: 'Chance de gagner optimale entre 1.0 et 95.0.',
                  },
                  rollMode: {
                    type: Type.STRING,
                    description: 'over ou under',
                  },
                  rationale: {
                    type: Type.STRING,
                    description:
                      'Explication courte du paramétrage recommandé.',
                  },
                },
                required: [
                  'baseBetPctOfCapital',
                  'winChance',
                  'rollMode',
                  'rationale',
                ],
              },
              proposedStrategies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    expectedProfile: { type: Type.STRING },
                    conditions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          category: { type: Type.STRING },
                          betTriggerType: { type: Type.STRING },
                          betEventType: { type: Type.STRING },
                          betCount: { type: Type.INTEGER },
                          profitMetric: { type: Type.STRING },
                          profitOperator: { type: Type.STRING },
                          profitValue: { type: Type.NUMBER },
                          action: { type: Type.STRING },
                          actionValue: { type: Type.NUMBER },
                        },
                        required: [
                          'category',
                          'betTriggerType',
                          'betEventType',
                          'betCount',
                          'profitMetric',
                          'profitOperator',
                          'profitValue',
                          'action',
                          'actionValue',
                        ],
                      },
                    },
                  },
                  required: [
                    'name',
                    'description',
                    'rationale',
                    'expectedProfile',
                    'conditions',
                  ],
                },
              },
            },
            required: [
              'diagnosticSummary',
              'riskLevel',
              'keyFindings',
              'recommendedSettings',
              'proposedStrategies',
            ],
          },
        },
      };

      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null =
        null;
      let lastErr: unknown = null;
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          response = await ai.models.generateContent(requestParams);
          break;
        } catch (err: unknown) {
          lastErr = err;
          const errStatus =
            typeof (err as { status?: number })?.status === 'number'
              ? (err as { status: number }).status
              : 0;
          const errMsg = err instanceof Error ? err.message : String(err);
          const isTransient =
            errStatus === 503 ||
            errStatus === 429 ||
            errMsg.includes('503') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('RESOURCE_EXHAUSTED');
          if (!isTransient || attempt === maxAttempts - 1) {
            throw err;
          }
          const delayMs = 600 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!response) {
        throw lastErr ?? new Error('Réponse IA indisponible.');
      }

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'Réponse vide reçue du modèle Gemini.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      const rawSettings = (parsed.recommendedSettings &&
      typeof parsed.recommendedSettings === 'object'
        ? parsed.recommendedSettings
        : {}) as Record<string, unknown>;

      const rawStrategies = Array.isArray(parsed.proposedStrategies)
        ? parsed.proposedStrategies
        : [];

      const sanitized = {
        diagnosticSummary:
          typeof parsed.diagnosticSummary === 'string'
            ? parsed.diagnosticSummary
            : 'Analyse générée.',
        riskLevel: VALID_RISK_LEVELS.has(String(parsed.riskLevel))
          ? String(parsed.riskLevel)
          : 'Modéré',
        keyFindings: Array.isArray(parsed.keyFindings)
          ? parsed.keyFindings.map((f) => String(f)).slice(0, 5)
          : [],
        recommendedSettings: {
          baseBetPctOfCapital: clamp(
            Number(rawSettings.baseBetPctOfCapital) || 0.25,
            0.01,
            10
          ),
          winChance: clamp(Number(rawSettings.winChance) || 49.5, 0.01, 98.99),
          rollMode: rawSettings.rollMode === 'under' ? 'under' : 'over',
          rationale:
            typeof rawSettings.rationale === 'string'
              ? rawSettings.rationale
              : '',
        },
        proposedStrategies: rawStrategies.slice(0, 3).map((s, sIdx) => {
          const obj = (s && typeof s === 'object' ? s : {}) as Record<
            string,
            unknown
          >;
          const conds = Array.isArray(obj.conditions)
            ? obj.conditions
                .slice(0, 8)
                .map((c, cIdx) => sanitizeCondition(c, cIdx, sIdx))
            : [];
          return {
            name:
              typeof obj.name === 'string' && obj.name.trim()
                ? obj.name.trim()
                : `Stratégie IA #${sIdx + 1}`,
            description:
              typeof obj.description === 'string' ? obj.description : '',
            rationale: typeof obj.rationale === 'string' ? obj.rationale : '',
            expectedProfile:
              typeof obj.expectedProfile === 'string'
                ? obj.expectedProfile
                : 'Profil équilibré',
            conditions: conds,
          };
        }),
      };

      res.json(sanitized);
    } catch (err: unknown) {
      const rawMsg =
        err instanceof Error
          ? err.message
          : 'Erreur inconnue lors de l’appel à Gemini.';
      let status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;

      let cleanMsg = rawMsg;
      try {
        const parsedErr = JSON.parse(rawMsg) as {
          error?: { code?: number; message?: string; status?: string };
        };
        if (parsedErr?.error?.message) {
          cleanMsg = parsedErr.error.message;
        }
        if (typeof parsedErr?.error?.code === 'number') {
          status = parsedErr.error.code;
        }
      } catch {
        // rawMsg is already plain text
      }

      if (status === 403 || cleanMsg.includes('API_KEY_INVALID')) {
        cleanMsg =
          'Clé API Gemini invalide ou non autorisée. Vérifiez votre clé dans Settings > Secrets.';
      } else if (status === 429) {
        cleanMsg =
          'Quota Gemini temporairement saturé (429). Réessayez dans quelques instants.';
      } else if (status === 503) {
        cleanMsg =
          'Le service Gemini connaît un pic de demande temporaire (503). Veuillez réessayer dans quelques secondes.';
      }

      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: cleanMsg,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
