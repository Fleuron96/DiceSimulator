import React, { useState, useEffect } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  BetEventType,
  BetTriggerCategory,
  BetTriggerType,
  ProfitMetric,
  ProfitOperator,
  Strategy,
  StrategyActionType,
  StrategyCondition,
} from '../types/dice';
import {
  ACTION_LABELS,
  actionNeedsValue,
  actionValueSuffix,
  formatConditionSummary,
} from '../utils/strategyEngine';

interface StrategyModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialStrategy: Strategy | null;
  onClose: () => void;
  onSave: (strategy: Strategy, isNew: boolean) => void;
  onDelete?: (strategyId: string) => void;
}

function createEmptyCondition(): StrategyCondition {
  return {
    id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: 'bets',
    betTriggerType: 'every',
    betEventType: 'losses',
    betCount: 1,
    profitMetric: 'net_profit',
    profitOperator: 'gt',
    profitValue: 100,
    action: 'increase_bet_pct',
    actionValue: 100,
  };
}

const ALL_ACTIONS: StrategyActionType[] = [
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
];

export const StrategyModal: React.FC<StrategyModalProps> = ({
  isOpen,
  mode,
  initialStrategy,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState<StrategyCondition[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (mode === 'create') {
      setName('Ma stratégie Dice');
      setDescription('');
      setConditions([createEmptyCondition()]);
    } else if (initialStrategy) {
      setName(initialStrategy.name);
      setDescription(initialStrategy.description || '');
      setConditions(
        initialStrategy.conditions.map((c) => ({ ...c }))
      );
    }
  }, [isOpen, mode, initialStrategy]);

  if (!isOpen) return null;

  const updateCondition = (
    idx: number,
    patch: Partial<StrategyCondition>
  ) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const moveCondition = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= conditions.length) return;
    setConditions((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const duplicateCondition = (idx: number) => {
    setConditions((prev) => {
      const copy: StrategyCondition = {
        ...prev[idx],
        id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removeCondition = (idx: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = (saveAsCopy = false) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Veuillez saisir un nom pour la stratégie.');
      return;
    }
    if (conditions.length === 0) {
      setErrorMsg('Ajoutez au moins une condition Si / Alors.');
      return;
    }

    const isNew = mode === 'create' || saveAsCopy;
    const strategyToSave: Strategy = {
      id: isNew
        ? `custom-${Date.now()}`
        : initialStrategy?.id || `custom-${Date.now()}`,
      name: saveAsCopy ? `${trimmedName} (copie)` : trimmedName,
      description:
        description.trim() ||
        `${conditions.length} condition${conditions.length > 1 ? 's' : ''} configurée${conditions.length > 1 ? 's' : ''}.`,
      isPreset: isNew ? false : initialStrategy?.isPreset,
      conditions,
    };

    onSave(strategyToSave, isNew);
    onClose();
  };

  const isEditingPreset = mode === 'edit' && Boolean(initialStrategy?.isPreset);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-[2px] p-0 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92dvh] flex flex-col bg-[#1a2c38] border border-[#2f4553] rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#2f4553] shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              {mode === 'create'
                ? 'Créer une stratégie'
                : `Modifier : ${initialStrategy?.name}`}
            </h2>
            <p className="text-[11px] sm:text-xs text-[#8b9bb4] mt-0.5">
              Définissez les règles conditionnelles Si / Alors exécutées après
              chaque lancer sous House Edge 1 %.
            </p>
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Strategy Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                Nom de la stratégie
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Martingale Sécurisée"
                className="w-full bg-[#0f212e] border border-[#2f4553] focus:border-[#1475e1] rounded-md px-3 py-2.5 text-base sm:text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#b1bad3] mb-1.5">
                Description (optionnelle)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Double sur perte avec Stop-Loss à -200"
                className="w-full bg-[#0f212e] border border-[#2f4553] focus:border-[#1475e1] rounded-md px-3 py-2.5 text-base sm:text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="bg-[#2c121a] border border-[#e9113c]/60 text-[#ff6b81] text-xs px-3.5 py-2.5 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Conditions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white">
                Conditions ({conditions.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setConditions((prev) => [...prev, createEmptyCondition()])
                }
                className="flex items-center gap-1.5 px-3 min-h-[38px] rounded-md bg-[#2f4553] hover:bg-[#3a5465] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une condition</span>
              </button>
            </div>

            {conditions.map((cond, idx) => {
              const needsVal = actionNeedsValue(cond.action);
              const valSuffix = actionValueSuffix(cond.action);

              return (
                <div
                  key={cond.id}
                  className="bg-[#0f212e] border border-[#2f4553] rounded-lg p-3.5 sm:p-4 space-y-3.5"
                >
                  {/* Condition Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#2f4553]/70">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded bg-[#213743] border border-[#2f4553] flex items-center justify-center text-xs font-bold text-white shrink-0 font-mono-tabular">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-medium text-[#b1bad3] line-clamp-2 sm:truncate">
                        {formatConditionSummary(cond)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveCondition(idx, -1)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-[#8b9bb4] hover:text-white hover:bg-[#213743] disabled:opacity-30 cursor-pointer"
                        title="Monter"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === conditions.length - 1}
                        onClick={() => moveCondition(idx, 1)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-[#8b9bb4] hover:text-white hover:bg-[#213743] disabled:opacity-30 cursor-pointer"
                        title="Descendre"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateCondition(idx)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-[#8b9bb4] hover:text-white hover:bg-[#213743] cursor-pointer"
                        title="Dupliquer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-[#8b9bb4] hover:text-[#ff4d6d] hover:bg-[#213743] cursor-pointer"
                        title="Supprimer la condition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Block 1: SI (Déclencheur) */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-[#1475e1] tracking-wide">
                      BLOC « SI » (Déclencheur)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      {/* Category */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] text-[#8b9bb4] mb-1">
                          Catégorie
                        </label>
                        <select
                          value={cond.category}
                          onChange={(e) =>
                            updateCondition(idx, {
                              category: e.target.value as BetTriggerCategory,
                            })
                          }
                          className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs text-white focus:border-[#1475e1] focus:outline-none"
                        >
                          <option value="bets">Paris</option>
                          <option value="profit">Profit</option>
                        </select>
                      </div>

                      {cond.category === 'bets' ? (
                        <>
                          <div className="sm:col-span-4">
                            <label className="block text-[11px] text-[#8b9bb4] mb-1">
                              Condition
                            </label>
                            <select
                              value={cond.betTriggerType}
                              onChange={(e) =>
                                updateCondition(idx, {
                                  betTriggerType: e.target
                                    .value as BetTriggerType,
                                })
                              }
                              className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs text-white focus:border-[#1475e1] focus:outline-none"
                            >
                              <option value="every">Chaque</option>
                              <option value="every_streak">
                                Chaque série de
                              </option>
                              <option value="first_streak">
                                Première série de
                              </option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-[#8b9bb4] mb-1">
                              Valeur (X)
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={cond.betCount}
                              onChange={(e) =>
                                updateCondition(idx, {
                                  betCount: Math.max(
                                    1,
                                    parseInt(e.target.value || '1', 10)
                                  ),
                                })
                              }
                              className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs font-mono-tabular text-white focus:border-[#1475e1] focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#8b9bb4] mb-1">
                              Événement
                            </label>
                            <select
                              value={cond.betEventType}
                              onChange={(e) =>
                                updateCondition(idx, {
                                  betEventType: e.target.value as BetEventType,
                                })
                              }
                              className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs text-white focus:border-[#1475e1] focus:outline-none"
                            >
                              <option value="losses">Pertes</option>
                              <option value="wins">Gains</option>
                              <option value="bets">Paris</option>
                            </select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#8b9bb4] mb-1">
                              Indicateur
                            </label>
                            <select
                              value={cond.profitMetric}
                              onChange={(e) =>
                                updateCondition(idx, {
                                  profitMetric: e.target.value as ProfitMetric,
                                })
                              }
                              className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs text-white focus:border-[#1475e1] focus:outline-none"
                            >
                              <option value="balance">Solde</option>
                              <option value="net_profit">Profit net</option>
                              <option value="net_loss">Perte nette</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#8b9bb4] mb-1">
                              Opérateur
                            </label>
                            <select
                              value={cond.profitOperator}
                              onChange={(e) =>
                                updateCondition(idx, {
                                  profitOperator: e.target
                                    .value as ProfitOperator,
                                })
                              }
                              className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs text-white focus:border-[#1475e1] focus:outline-none"
                            >
                              <option value="gt">Supérieur à</option>
                              <option value="lt">Inférieur à</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#8b9bb4] mb-1">
                              Valeur cible
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={cond.profitValue}
                              onChange={(e) =>
                                updateCondition(idx, {
                                  profitValue: parseFloat(
                                    e.target.value || '0'
                                  ),
                                })
                              }
                              className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs font-mono-tabular text-white focus:border-[#1475e1] focus:outline-none"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Block 2: ALORS (Action) */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-[#00e701] tracking-wide">
                      BLOC « ALORS » (Action à exécuter)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div
                        className={needsVal ? 'sm:col-span-8' : 'sm:col-span-12'}
                      >
                        <label className="block text-[11px] text-[#8b9bb4] mb-1">
                          Action
                        </label>
                        <select
                          value={cond.action}
                          onChange={(e) =>
                            updateCondition(idx, {
                              action: e.target.value as StrategyActionType,
                            })
                          }
                          className="w-full min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] rounded px-2.5 py-2 text-base sm:text-xs text-white focus:border-[#1475e1] focus:outline-none"
                        >
                          {ALL_ACTIONS.map((act) => (
                            <option key={act} value={act}>
                              {ACTION_LABELS[act]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {needsVal && (
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] text-[#8b9bb4] mb-1">
                            Valeur ({valSuffix})
                          </label>
                          <div className="flex items-center min-h-[42px] sm:min-h-0 bg-[#1a2c38] border border-[#2f4553] focus-within:border-[#1475e1] rounded px-2.5 py-2">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={cond.actionValue}
                              onChange={(e) =>
                                updateCondition(idx, {
                                  actionValue: parseFloat(
                                    e.target.value || '0'
                                  ),
                                })
                              }
                              className="w-full bg-transparent text-base sm:text-xs font-mono-tabular text-white focus:outline-none"
                            />
                            <span className="text-[11px] text-[#8b9bb4] ml-1.5 shrink-0">
                              {valSuffix}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-4 sm:px-5 py-3.5 sm:py-4 bg-[#152430] border-t border-[#2f4553] shrink-0">
          <div className="flex items-center gap-2">
            {mode === 'edit' &&
              initialStrategy &&
              !initialStrategy.isPreset &&
              onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initialStrategy.id);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-md bg-[#2c121a] hover:bg-[#3f1924] text-[#ff4d6d] text-xs font-semibold transition-colors cursor-pointer w-full sm:w-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 min-h-[42px] rounded-md bg-[#2f4553] hover:bg-[#3a5465] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Annuler
            </button>

            {mode === 'edit' && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="flex-1 sm:flex-initial px-4 min-h-[42px] rounded-md bg-[#213743] hover:bg-[#2b4655] border border-[#2f4553] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Copier
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave(false)}
              className="w-full sm:w-auto px-4 min-h-[42px] rounded-md bg-[#1475e1] hover:bg-[#1f83f0] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {isEditingPreset ? 'Mettre à jour' : 'Enregistrer la stratégie'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
