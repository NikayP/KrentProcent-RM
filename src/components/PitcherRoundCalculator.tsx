import React, { useState, useMemo } from 'react';
import { Users, Beer, Plus, Check } from 'lucide-react';
import {
  DrinkItem,
  calculatePitcherComparison,
  filterDrinksByBar,
  formatCurrency,
  DEFAULT_BAR_NAME,
} from '../utils/calculator';

interface PitcherRoundCalculatorProps {
  currency: string;
  drinks?: DrinkItem[];
  activeBar?: string;
  onAddDrink?: (drink: DrinkItem) => void;
}

export const PitcherRoundCalculator: React.FC<PitcherRoundCalculatorProps> = ({
  currency,
  drinks = [],
  activeBar = 'all',
  onAddDrink,
}) => {
  const [pitcherPrice, setPitcherPrice] = useState<number>(18.0);
  const [pitcherVolumeMl, setPitcherVolumeMl] = useState<number>(1500);
  const [pitcherAbv, setPitcherAbv] = useState<number>(5.0);

  const [glassPrice, setGlassPrice] = useState<number>(3.5);
  const [glassVolumeMl, setGlassVolumeMl] = useState<number>(250);
  const [glassAbv, setGlassAbv] = useState<number>(5.0);

  const [groupSize, setGroupSize] = useState<number>(4);
  const [glassesPerPerson, setGlassesPerPerson] = useState<number>(3);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const barDrinks = useMemo(() => {
    const list = filterDrinksByBar(drinks, activeBar);
    return list.filter((d) => d.category === 'beer' || d.category === 'cider');
  }, [drinks, activeBar]);

  const pitcherPresetsFromBar = useMemo(
    () => barDrinks.filter((d) => d.volumeMl >= 1000),
    [barDrinks]
  );

  const glassPresetsFromBar = useMemo(
    () => barDrinks.filter((d) => d.volumeMl < 1000),
    [barDrinks]
  );

  const result = useMemo(
    () =>
      calculatePitcherComparison({
        pitcherVolumeMl,
        pitcherAbv,
        pitcherPrice,
        glassVolumeMl,
        glassAbv,
        glassPrice,
        groupSize,
        glassesPerPerson,
      }),
    [
      pitcherVolumeMl,
      pitcherAbv,
      pitcherPrice,
      glassVolumeMl,
      glassAbv,
      glassPrice,
      groupSize,
      glassesPerPerson,
    ]
  );

  const targetBarName =
    activeBar && activeBar !== 'all' ? activeBar : drinks[0]?.barName || DEFAULT_BAR_NAME;

  const handleSavePitcherToBar = () => {
    if (!onAddDrink) return;
    onAddDrink({
      id: `pitcher-${Date.now()}`,
      name: `Beer Pitcher (${(pitcherVolumeMl / 1000).toFixed(1)}L)`,
      barName: targetBarName,
      category: 'beer',
      volumeMl: pitcherVolumeMl,
      abv: pitcherAbv,
      price: pitcherPrice,
      notes: 'Added from Pitcher Saver',
    });
    setSavedNote(`Pitcher saved to ${targetBarName}!`);
    setTimeout(() => setSavedNote(null), 2000);
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-white">
              Pitcher vs Individual Glasses &amp; Group Round Saver
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Going for drinks with a group? Compare ordering draft beer pitchers vs individual rounds
            to see exact per-pitcher and per-person savings.
          </p>
        </div>

        {onAddDrink && (
          <button
            type="button"
            onClick={handleSavePitcherToBar}
            className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 text-xs font-bold border border-stone-700 transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            {savedNote ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{savedNote}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Pitcher to {targetBarName}</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pitcher Option */}
        <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Beer className="w-4 h-4" /> Option A: Beer Pitcher
            </span>
            <span className="text-[11px] bg-stone-800 px-2 py-0.5 rounded text-stone-300">
              Shared Pitcher
            </span>
          </div>

          {pitcherPresetsFromBar.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] text-stone-500 uppercase shrink-0">From menu:</span>
              {pitcherPresetsFromBar.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPitcherVolumeMl(p.volumeMl);
                    setPitcherAbv(p.abv);
                    setPitcherPrice(p.price);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-stone-900 hover:bg-amber-500/20 text-stone-300 hover:text-amber-300 border border-stone-800 whitespace-nowrap"
                >
                  {p.name} ({formatCurrency(p.price, currency)})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="pitcher-vol" className="block text-[11px] text-stone-400 mb-1">
                Volume
              </label>
              <select
                id="pitcher-vol"
                value={pitcherVolumeMl}
                onChange={(e) => setPitcherVolumeMl(parseInt(e.target.value, 10))}
                className="w-full bg-stone-900 text-white font-bold text-xs rounded-lg p-2 border border-stone-700"
              >
                <option value={1250}>1.25 Liter (1250ml)</option>
                <option value={1500}>1.5 Liter (1500ml)</option>
                <option value={1800}>1.8 Liter (1800ml)</option>
                <option value={2000}>2.0 Liter (2000ml)</option>
                <option value={3000}>3.0 Liter Tower</option>
              </select>
            </div>

            <div>
              <label htmlFor="pitcher-abv" className="block text-[11px] text-stone-400 mb-1">
                ABV (%)
              </label>
              <input
                id="pitcher-abv"
                type="number"
                step="0.1"
                min="0.5"
                max="100"
                value={pitcherAbv}
                onChange={(e) => setPitcherAbv(parseFloat(e.target.value) || 0)}
                className="w-full bg-stone-900 text-white font-bold text-xs rounded-lg p-2 border border-stone-700 font-mono"
              />
            </div>

            <div>
              <label htmlFor="pitcher-price" className="block text-[11px] text-stone-400 mb-1">
                Pitcher Price ({currency})
              </label>
              <input
                id="pitcher-price"
                type="number"
                step="0.5"
                min="0.5"
                value={pitcherPrice}
                onChange={(e) => setPitcherPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-stone-900 text-white font-bold text-xs rounded-lg p-2 border border-stone-700 font-mono"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between text-xs">
            <span className="text-stone-400">Pitcher Krent Score:</span>
            <span className="text-amber-400 font-mono font-bold">
              {result.pitcherEfficiency.toFixed(2)} ml alc / {currency} (
              {result.pitcherPureAlcoholMl}ml alc)
            </span>
          </div>
        </div>

        {/* Individual Glass Option */}
        <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Beer className="w-4 h-4 text-stone-400" /> Option B: Single Glass
            </span>
            <span className="text-[11px] bg-stone-800 px-2 py-0.5 rounded text-stone-300">
              Per Drink
            </span>
          </div>

          {glassPresetsFromBar.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] text-stone-500 uppercase shrink-0">From menu:</span>
              {glassPresetsFromBar.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGlassVolumeMl(g.volumeMl);
                    setGlassAbv(g.abv);
                    setGlassPrice(g.price);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-stone-900 hover:bg-amber-500/20 text-stone-300 hover:text-amber-300 border border-stone-800 whitespace-nowrap"
                >
                  {g.name} ({formatCurrency(g.price, currency)})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="glass-vol" className="block text-[11px] text-stone-400 mb-1">
                Glass Size
              </label>
              <select
                id="glass-vol"
                value={glassVolumeMl}
                onChange={(e) => setGlassVolumeMl(parseInt(e.target.value, 10))}
                className="w-full bg-stone-900 text-white font-bold text-xs rounded-lg p-2 border border-stone-700"
              >
                <option value={200}>200ml (Fluitje)</option>
                <option value={250}>250ml (Vaasje)</option>
                <option value={330}>330ml (Bottle)</option>
                <option value={500}>500ml (Pint)</option>
                <option value={568}>568ml (UK Pint)</option>
              </select>
            </div>

            <div>
              <label htmlFor="glass-abv" className="block text-[11px] text-stone-400 mb-1">
                ABV (%)
              </label>
              <input
                id="glass-abv"
                type="number"
                step="0.1"
                min="0.5"
                max="100"
                value={glassAbv}
                onChange={(e) => setGlassAbv(parseFloat(e.target.value) || 0)}
                className="w-full bg-stone-900 text-white font-bold text-xs rounded-lg p-2 border border-stone-700 font-mono"
              />
            </div>

            <div>
              <label htmlFor="glass-price" className="block text-[11px] text-stone-400 mb-1">
                Glass Price ({currency})
              </label>
              <input
                id="glass-price"
                type="number"
                step="0.1"
                min="0.5"
                value={glassPrice}
                onChange={(e) => setGlassPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-stone-900 text-white font-bold text-xs rounded-lg p-2 border border-stone-700 font-mono"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between text-xs">
            <span className="text-stone-400">Glass Krent Score:</span>
            <span className="text-amber-400 font-mono font-bold">
              {result.glassEfficiency.toFixed(2)} ml alc / {currency} ({result.glassPureAlcoholMl}
              ml alc)
            </span>
          </div>
        </div>
      </div>

      {/* Group Size & Rounds Controls */}
      <div className="bg-stone-950/70 p-4 rounded-2xl border border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="group-size-input" className="font-bold text-stone-300">
              👥 Group Size (People at Table):
            </label>
            <span className="font-mono font-black text-amber-400">{groupSize} people</span>
          </div>
          <div className="flex items-center gap-2">
            {[2, 3, 4, 5, 6, 8, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setGroupSize(num)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  groupSize === num
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                }`}
              >
                {num}
              </button>
            ))}
            <input
              id="group-size-input"
              type="number"
              min="1"
              max="50"
              value={groupSize}
              onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-16 bg-stone-900 text-white font-mono text-xs font-bold rounded-lg px-2 py-1 border border-stone-700"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="rounds-input" className="font-bold text-stone-300">
              🍺 Rounds (Glasses per Person):
            </label>
            <span className="font-mono font-black text-amber-400">
              {glassesPerPerson} {glassesPerPerson === 1 ? 'glass' : 'glasses'} / person
            </span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setGlassesPerPerson(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  glassesPerPerson === r
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                }`}
              >
                {r}x
              </button>
            ))}
            <input
              id="rounds-input"
              type="number"
              min="1"
              max="30"
              value={glassesPerPerson}
              onChange={(e) => setGlassesPerPerson(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-16 bg-stone-900 text-white font-mono text-xs font-bold rounded-lg px-2 py-1 border border-stone-700"
            />
          </div>
        </div>
      </div>

      {/* Result Verdict Card */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 p-5 rounded-2xl border border-amber-500/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1">
              Group Economics Verdict
            </div>
            <h3 className="text-base sm:text-lg font-black text-white">
              {result.isPitcherBetter ? (
                <span className="text-emerald-400">
                  🎉 Pitcher is {result.percentageAdvantage}% better value!
                </span>
              ) : (
                <span className="text-amber-300">
                  ⚠️ Individual glasses are actually cheaper or equal!
                </span>
              )}
            </h3>
            <p className="text-xs text-stone-300 mt-1 max-w-xl">
              1 pitcher ({pitcherVolumeMl}ml) equals{' '}
              <strong className="text-white">
                {result.equivalentGlassesPerPitcher} glasses
              </strong>{' '}
              ({glassVolumeMl}ml). Ordering those individual glasses costs{' '}
              <strong className="text-white">
                {formatCurrency(result.costOfEquivalentGlasses, currency)}
              </strong>{' '}
              vs{' '}
              <strong className="text-emerald-400">
                {formatCurrency(pitcherPrice, currency)}
              </strong>{' '}
              for the pitcher.
            </p>
          </div>

          {/* Savings Badge */}
          <div className="bg-stone-900 p-3.5 rounded-xl border border-stone-800 text-center shrink-0">
            <div className="text-[10px] text-stone-400 uppercase font-semibold">
              Net Savings per Pitcher
            </div>
            <div
              className={`text-xl font-mono font-black ${
                result.savingsPerPitcher >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {result.savingsPerPitcher >= 0
                ? `+${formatCurrency(result.savingsPerPitcher, currency)}`
                : `-${formatCurrency(Math.abs(result.savingsPerPitcher), currency)}`}
            </div>
          </div>
        </div>

        {/* Group Table Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-stone-800 text-xs">
          <div className="bg-stone-900/80 p-3 rounded-xl border border-stone-800">
            <div className="text-stone-400 text-[11px]">Total Group Consumption</div>
            <div className="text-white font-mono font-bold text-sm mt-0.5">
              {result.groupTotalGlasses} glasses ({(result.groupTotalVolumeMl / 1000).toFixed(2)}L)
            </div>
            <div className="text-[10px] text-amber-300 mt-0.5">
              ~{result.pitchersNeededForGroup}{' '}
              {result.pitchersNeededForGroup === 1 ? 'pitcher' : 'pitchers'} needed
            </div>
          </div>

          <div className="bg-stone-900/80 p-3 rounded-xl border border-stone-800">
            <div className="text-stone-400 text-[11px]">Cost with Glasses</div>
            <div className="text-white font-mono font-bold text-sm mt-0.5">
              {formatCurrency(result.groupIndividualGlassesCost, currency)}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              {formatCurrency(result.costPerPersonGlasses, currency)} / person
            </div>
          </div>

          <div className="bg-stone-900/80 p-3 rounded-xl border border-stone-800">
            <div className="text-stone-400 text-[11px]">Cost with Pitchers</div>
            <div className="text-emerald-400 font-mono font-bold text-sm mt-0.5">
              {formatCurrency(result.groupPitcherCost, currency)}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              {formatCurrency(result.costPerPersonPitcher, currency)} / person
            </div>
          </div>

          <div className="bg-stone-900/80 p-3 rounded-xl border border-stone-800">
            <div className="text-stone-400 text-[11px]">Total Table Savings</div>
            <div
              className={`font-mono font-black text-sm mt-0.5 ${
                result.groupTotalSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {result.groupTotalSavings >= 0
                ? `+${formatCurrency(result.groupTotalSavings, currency)}`
                : `-${formatCurrency(Math.abs(result.groupTotalSavings), currency)}`}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              For {result.groupSize} people ({result.glassesPerPerson} rounds)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
