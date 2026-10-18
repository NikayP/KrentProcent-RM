import React, { useState, useEffect, useMemo } from 'react';
import {
  DrinkItem,
  compareTwoDrinks,
  calculateDrinkMetrics,
  formatCurrency,
  getUniqueBars,
  filterDrinksByBar,
} from '../utils/calculator';
import { Swords, Trophy, Zap } from 'lucide-react';

interface HeadToHeadDuelProps {
  drinks: DrinkItem[];
  currency: string;
  initialSelection?: DrinkItem[];
}

export const HeadToHeadDuel: React.FC<HeadToHeadDuelProps> = ({
  drinks,
  currency,
  initialSelection = [],
}) => {
  const [drinkAId, setDrinkAId] = useState<string>(
    initialSelection[0]?.id || drinks[0]?.id || ''
  );
  const [drinkBId, setDrinkBId] = useState<string>(
    initialSelection[1]?.id || drinks[1]?.id || drinks[0]?.id || ''
  );

  // Sync when initialSelection updates from Leaderboard or CrossBarComparison
  useEffect(() => {
    if (initialSelection[0]?.id) {
      setDrinkAId(initialSelection[0].id);
    }
    if (initialSelection[1]?.id) {
      setDrinkBId(initialSelection[1].id);
    }
  }, [initialSelection]);

  const bars = useMemo(() => getUniqueBars(drinks), [drinks]);

  const drinkA = drinks.find((d) => d.id === drinkAId) || drinks[0];
  const drinkB =
    drinks.find((d) => d.id === drinkBId) ||
    drinks.find((d) => d.id !== drinkA?.id) ||
    drinks[0];

  if (!drinkA || !drinkB || drinks.length < 2) {
    return (
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center">
        <Swords className="w-12 h-12 text-amber-400 mx-auto mb-3 opacity-60" />
        <h3 className="text-lg font-bold text-white mb-2">
          Need at least 2 drinks for a 1v1 Duel
        </h3>
        <p className="text-sm text-stone-400 max-w-sm mx-auto">
          Add at least 2 drinks to your board to pit them head-to-head and see the exact savings.
        </p>
      </div>
    );
  }

  const duel = compareTwoDrinks(drinkA, drinkB);
  const metricA = calculateDrinkMetrics(drinkA);
  const metricB = calculateDrinkMetrics(drinkB);

  const isAWinner = duel.winnerId === drinkA.id;
  const isBWinner = duel.winnerId === drinkB.id;
  const isTie = duel.winnerId === 'tie';

  const maxScore = Math.max(metricA.pureAlcoholPerCurrency, metricB.pureAlcoholPerCurrency, 0.1);

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-400" />
            1v1 Drink Battle
          </h2>
          <p className="text-xs text-stone-400">
            Compare any two drinks (within the same bar or across different bars) to see which gives
            more alcohol per {currency}.
          </p>
        </div>

        {/* Quick swap button */}
        <button
          type="button"
          onClick={() => {
            setDrinkAId(drinkB.id);
            setDrinkBId(drinkA.id);
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700/80 transition-colors w-fit"
        >
          ⇄ Swap Drinks
        </button>
      </div>

      {/* Selectors and Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* VS Badge in Middle on Desktop */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-stone-950 border-2 border-amber-500 text-amber-400 font-black text-xs items-center justify-center shadow-lg">
          VS
        </div>

        {/* Drink A Side */}
        <div
          className={`rounded-2xl p-4 sm:p-5 border transition-all ${
            isAWinner
              ? 'bg-gradient-to-b from-stone-900 via-stone-900 to-amber-950/20 border-amber-400 ring-1 ring-amber-400/40 shadow-lg shadow-amber-500/10'
              : 'bg-stone-950/60 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Contender 1
            </span>
            {isAWinner && (
              <span className="bg-amber-400 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Trophy className="w-3 h-3" /> Winner
              </span>
            )}
          </div>

          <label htmlFor="select-drink-a" className="sr-only">
            Select Drink A
          </label>
          <select
            id="select-drink-a"
            value={drinkA.id}
            onChange={(e) => setDrinkAId(e.target.value)}
            className="w-full bg-stone-900 text-white font-bold text-sm rounded-xl px-3 py-2.5 border border-stone-700 focus:outline-none focus:border-amber-400 mb-2"
          >
            {bars.map((bar) => (
              <optgroup key={`group-a-${bar}`} label={`📍 ${bar}`}>
                {filterDrinksByBar(drinks, bar).map((d) => (
                  <option key={`a-${d.id}`} value={d.id}>
                    {d.name} ({d.volumeMl}ml, {d.abv}%, {formatCurrency(d.price, currency)})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {drinkA.barName && (
            <div className="mb-3 text-[11px] font-semibold text-amber-300 flex items-center gap-1">
              <span>📍 Served at:</span>
              <span className="font-bold">{drinkA.barName}</span>
            </div>
          )}

          {/* Metric Highlights */}
          <div className="space-y-3">
            <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
              <div className="text-[11px] text-stone-400 uppercase font-semibold">
                KrentProcent Value
              </div>
              <div className="text-xl font-mono font-black text-amber-400">
                {metricA.pureAlcoholPerCurrency}{' '}
                <span className="text-xs font-normal text-stone-400">ml / {currency}</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-stone-950 rounded-full mt-2 overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${(metricA.pureAlcoholPerCurrency / maxScore) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-stone-900/70 p-2.5 rounded-lg border border-stone-800">
                <div className="text-stone-400">Pure Alcohol</div>
                <div className="text-white font-mono font-bold text-sm">
                  {metricA.pureAlcoholMl} ml
                </div>
              </div>
              <div className="bg-stone-900/70 p-2.5 rounded-lg border border-stone-800">
                <div className="text-stone-400">Std Drinks</div>
                <div className="text-white font-mono font-bold text-sm">
                  {metricA.standardDrinks}x
                </div>
              </div>
              <div className="bg-stone-900/70 p-2.5 rounded-lg border border-stone-800">
                <div className="text-stone-400">Cost / Std</div>
                <div className="text-white font-mono font-bold text-sm">
                  {formatCurrency(metricA.costPerStandardDrink, currency)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drink B Side */}
        <div
          className={`rounded-2xl p-4 sm:p-5 border transition-all ${
            isBWinner
              ? 'bg-gradient-to-b from-stone-900 via-stone-900 to-amber-950/20 border-amber-400 ring-1 ring-amber-400/40 shadow-lg shadow-amber-500/10'
              : 'bg-stone-950/60 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Contender 2
            </span>
            {isBWinner && (
              <span className="bg-amber-400 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Trophy className="w-3 h-3" /> Winner
              </span>
            )}
          </div>

          <label htmlFor="select-drink-b" className="sr-only">
            Select Drink B
          </label>
          <select
            id="select-drink-b"
            value={drinkB.id}
            onChange={(e) => setDrinkBId(e.target.value)}
            className="w-full bg-stone-900 text-white font-bold text-sm rounded-xl px-3 py-2.5 border border-stone-700 focus:outline-none focus:border-amber-400 mb-2"
          >
            {bars.map((bar) => (
              <optgroup key={`group-b-${bar}`} label={`📍 ${bar}`}>
                {filterDrinksByBar(drinks, bar).map((d) => (
                  <option key={`b-${d.id}`} value={d.id}>
                    {d.name} ({d.volumeMl}ml, {d.abv}%, {formatCurrency(d.price, currency)})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {drinkB.barName && (
            <div className="mb-3 text-[11px] font-semibold text-stone-300 flex items-center gap-1">
              <span>📍 Served at:</span>
              <span className="font-bold text-amber-300">{drinkB.barName}</span>
            </div>
          )}

          {/* Metric Highlights */}
          <div className="space-y-3">
            <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
              <div className="text-[11px] text-stone-400 uppercase font-semibold">
                KrentProcent Value
              </div>
              <div className="text-xl font-mono font-black text-amber-400">
                {metricB.pureAlcoholPerCurrency}{' '}
                <span className="text-xs font-normal text-stone-400">ml / {currency}</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-stone-950 rounded-full mt-2 overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${(metricB.pureAlcoholPerCurrency / maxScore) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-stone-900/70 p-2.5 rounded-lg border border-stone-800">
                <div className="text-stone-400">Pure Alcohol</div>
                <div className="text-white font-mono font-bold text-sm">
                  {metricB.pureAlcoholMl} ml
                </div>
              </div>
              <div className="bg-stone-900/70 p-2.5 rounded-lg border border-stone-800">
                <div className="text-stone-400">Std Drinks</div>
                <div className="text-white font-mono font-bold text-sm">
                  {metricB.standardDrinks}x
                </div>
              </div>
              <div className="bg-stone-900/70 p-2.5 rounded-lg border border-stone-800">
                <div className="text-stone-400">Cost / Std</div>
                <div className="text-white font-mono font-bold text-sm">
                  {formatCurrency(metricB.costPerStandardDrink, currency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Duel Verdict Callout */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 p-4 sm:p-5 rounded-2xl border border-amber-900/50 shadow-inner">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-1">Duel Verdict</h4>
            {isTie ? (
              <p className="text-sm text-stone-300">
                It&apos;s an exact draw! Both drinks deliver the exact same alcohol per {currency}.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-amber-300">{duel.summaryText}</p>
                <p className="text-xs text-stone-400">
                  {isAWinner ? (
                    <>
                      To get the same pure alcohol ({metricA.pureAlcoholMl}ml) from{' '}
                      <strong>
                        {drinkB.name} ({drinkB.barName})
                      </strong>
                      , you would have to spend{' '}
                      <strong className="text-white">
                        {formatCurrency(duel.equivalentCostOnLoser, currency)}
                      </strong>{' '}
                      instead of{' '}
                      <strong className="text-emerald-400">
                        {formatCurrency(drinkA.price, currency)}
                      </strong>
                      !
                    </>
                  ) : (
                    <>
                      To get the same pure alcohol ({metricB.pureAlcoholMl}ml) from{' '}
                      <strong>
                        {drinkA.name} ({drinkA.barName})
                      </strong>
                      , you would have to spend{' '}
                      <strong className="text-white">
                        {formatCurrency(duel.equivalentCostOnLoser, currency)}
                      </strong>{' '}
                      instead of{' '}
                      <strong className="text-emerald-400">
                        {formatCurrency(drinkB.price, currency)}
                      </strong>
                      !
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
