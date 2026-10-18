import React, { useState } from 'react';
import {
  CalculatedDrink,
  DrinkCategory,
  DrinkItem,
  formatCurrency,
} from '../utils/calculator';
import {
  Beer,
  Wine,
  Flame,
  GlassWater,
  Apple,
  HelpCircle,
  Trash2,
  Swords,
  Trophy,
  Pencil,
  Check,
  X,
} from 'lucide-react';

interface DrinkCardProps {
  drink: CalculatedDrink;
  currency: string;
  onDelete: (id: string) => void;
  onUpdate?: (updated: DrinkItem) => void;
  onSelectForDuel?: (drink: CalculatedDrink) => void;
  onSelectBar?: (barName: string) => void;
  availableBars?: string[];
  isDuelSelected?: boolean;
  bestScore: number;
  otherBarsCount?: number;
}

export const DrinkCard: React.FC<DrinkCardProps> = ({
  drink,
  currency,
  onDelete,
  onUpdate,
  onSelectForDuel,
  onSelectBar,
  availableBars = [],
  isDuelSelected,
  bestScore,
  otherBarsCount = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(drink.name);
  const [editBar, setEditBar] = useState(drink.barName || '');
  const [editCategory, setEditCategory] = useState<DrinkCategory>(drink.category);
  const [editVolume, setEditVolume] = useState<number>(drink.volumeMl);
  const [editAbv, setEditAbv] = useState<number>(drink.abv);
  const [editPrice, setEditPrice] = useState<number>(drink.price);
  const [editNotes, setEditNotes] = useState<string>(drink.notes || '');

  const isBest = drink.efficiencyRank === 1;
  const isSecond = drink.efficiencyRank === 2;
  const isThird = drink.efficiencyRank === 3;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'beer':
        return <Beer className="w-4 h-4 text-amber-400" />;
      case 'wine':
        return <Wine className="w-4 h-4 text-rose-400" />;
      case 'spirit':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'cocktail':
        return <GlassWater className="w-4 h-4 text-cyan-400" />;
      case 'cider':
        return <Apple className="w-4 h-4 text-lime-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-stone-400" />;
    }
  };

  const startEditing = () => {
    setEditName(drink.name);
    setEditBar(drink.barName || '');
    setEditCategory(drink.category);
    setEditVolume(drink.volumeMl);
    setEditAbv(drink.abv);
    setEditPrice(drink.price);
    setEditNotes(drink.notes || '');
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || editVolume <= 0 || editAbv <= 0 || editPrice <= 0) return;
    if (onUpdate) {
      onUpdate({
        ...drink,
        name: editName.trim(),
        barName: editBar.trim() || drink.barName,
        category: editCategory,
        volumeMl: editVolume,
        abv: editAbv,
        price: editPrice,
        notes: editNotes.trim(),
      });
    }
    setIsEditing(false);
  };

  // Percentage bar relative to best
  const efficiencyPercent =
    bestScore > 0
      ? Math.min(100, Math.max(10, (drink.pureAlcoholPerCurrency / bestScore) * 100))
      : 100;

  return (
    <div
      className={`relative rounded-2xl p-4 transition-all duration-200 border ${
        isBest
          ? 'bg-gradient-to-b from-stone-900 to-amber-950/20 border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30'
          : isSecond
          ? 'bg-stone-900/90 border-stone-700/80 hover:border-stone-600'
          : 'bg-stone-900/70 border-stone-800 hover:border-stone-750'
      }`}
    >
      {/* Top Banner for Best Value */}
      {isBest && (
        <div className="absolute -top-3 left-4 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-stone-950 text-[11px] font-black uppercase px-3 py-0.5 rounded-full shadow-md flex items-center gap-1.5 tracking-wide">
          <Trophy className="w-3.5 h-3.5" />
          <span>Krent Champion &bull; Best Bang for Buck</span>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
            <div className="sm:col-span-4">
              <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                Drink Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full bg-stone-950 text-white rounded-lg px-2.5 py-1.5 border border-stone-700 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                Bar / Venue
              </label>
              <input
                type="text"
                list={`bars-list-${drink.id}`}
                value={editBar}
                onChange={(e) => setEditBar(e.target.value)}
                required
                className="w-full bg-stone-950 text-amber-300 rounded-lg px-2.5 py-1.5 border border-stone-700 focus:border-amber-400 focus:outline-none"
              />
              {availableBars.length > 0 && (
                <datalist id={`bars-list-${drink.id}`}>
                  {availableBars.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as DrinkCategory)}
                className="w-full bg-stone-950 text-white rounded-lg px-2 py-1.5 border border-stone-700 focus:border-amber-400 focus:outline-none"
              >
                <option value="beer">Beer</option>
                <option value="wine">Wine</option>
                <option value="spirit">Spirit</option>
                <option value="cocktail">Cocktail</option>
                <option value="cider">Cider</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                Notes
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full bg-stone-950 text-stone-300 rounded-lg px-2.5 py-1.5 border border-stone-700 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 items-end text-xs">
            <div>
              <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                Volume (ml)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={editVolume}
                onChange={(e) => setEditVolume(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-stone-950 text-white font-mono rounded-lg px-2.5 py-1.5 border border-stone-700 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                ABV (%)
              </label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={editAbv}
                onChange={(e) => setEditAbv(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-stone-950 text-white font-mono rounded-lg px-2.5 py-1.5 border border-stone-700 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                Price ({currency})
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-stone-950 text-white font-mono rounded-lg px-2.5 py-1.5 border border-stone-700 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="col-span-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Left: Rank, Name, Specs */}
            <div className="flex items-start gap-3">
              {/* Rank Badge */}
              <div
                className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm shadow-inner ${
                  isBest
                    ? 'bg-amber-400 text-stone-950 shadow-amber-300'
                    : isSecond
                    ? 'bg-stone-300 text-stone-900'
                    : isThird
                    ? 'bg-amber-700 text-amber-100'
                    : 'bg-stone-800 text-stone-400'
                }`}
              >
                {isBest ? (
                  <Trophy className="w-5 h-5 text-stone-950" />
                ) : (
                  `#${drink.efficiencyRank}`
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="p-1 rounded-md bg-stone-800/80">
                    {getCategoryIcon(drink.category)}
                  </span>
                  <h3 className="font-bold text-white text-base leading-snug">{drink.name}</h3>
                  {drink.barName && (
                    <button
                      type="button"
                      onClick={() => onSelectBar && onSelectBar(drink.barName!)}
                      title={`Served at ${drink.barName} (click to filter)`}
                      className="text-[11px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      <span className="text-amber-400">📍</span>
                      <span>{drink.barName}</span>
                    </button>
                  )}
                  {otherBarsCount > 0 && (
                    <span
                      title={`This exact drink size is also recorded at ${otherBarsCount} other bar(s)`}
                      className="text-[10px] font-semibold text-stone-300 bg-stone-800/90 border border-stone-700 px-2 py-0.5 rounded-md"
                    >
                      +{otherBarsCount} {otherBarsCount === 1 ? 'other bar' : 'other bars'}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-stone-400 font-medium">
                  <span className="bg-stone-800 px-2 py-0.5 rounded text-stone-300 font-mono">
                    {drink.volumeMl}ml ({Number((drink.volumeMl / 10).toFixed(1))}cl)
                  </span>
                  <span>&bull;</span>
                  <span className="bg-stone-800 px-2 py-0.5 rounded text-amber-400 font-mono font-bold">
                    {drink.abv}% ABV
                  </span>
                  <span>&bull;</span>
                  <span className="bg-stone-800 px-2 py-0.5 rounded text-white font-mono font-bold">
                    {formatCurrency(drink.price, currency)}
                  </span>
                  {drink.notes && (
                    <span className="text-stone-500 italic hidden sm:inline">
                      &bull; {drink.notes}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Key Value Metric and Edit / Duel / Delete buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              {/* Krent Metric Score */}
              <div className="text-right">
                <div className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider">
                  KrentProcent
                </div>
                <div
                  className={`font-mono font-black text-lg sm:text-xl tracking-tight ${
                    isBest ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {drink.pureAlcoholPerCurrency}{' '}
                  <span className="text-xs font-normal text-stone-400">ml / {currency}</span>
                </div>
                <div className="text-[11px] font-mono text-stone-400">
                  {drink.pureAlcoholMl} ml pure alc ({drink.standardDrinks} std)
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-stone-800">
                {onUpdate && (
                  <button
                    type="button"
                    onClick={startEditing}
                    title="Edit drink details or price"
                    className="p-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-amber-300 border border-stone-700/60 transition-colors"
                    aria-label={`Edit ${drink.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}

                {onSelectForDuel && (
                  <button
                    type="button"
                    onClick={() => onSelectForDuel(drink)}
                    title="Compare in 1v1 Duel"
                    className={`p-2 rounded-xl transition-all border ${
                      isDuelSelected
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-800 hover:bg-stone-750 text-stone-300 border-stone-700/60'
                    }`}
                    aria-label={`Compare ${drink.name} in duel`}
                  >
                    <Swords className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDelete(drink.id)}
                  title="Delete drink"
                  className="p-2 rounded-xl bg-stone-850 hover:bg-rose-950/60 text-stone-400 hover:text-rose-400 border border-stone-800 hover:border-rose-800 transition-colors"
                  aria-label={`Remove ${drink.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Efficiency Bar & Comparison vs Winner */}
          <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="w-full sm:w-3/5">
              <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                <span className="text-stone-400">Relative Value:</span>
                <span
                  className={
                    isBest
                      ? 'text-amber-400 font-bold'
                      : drink.percentageRelativeToBest && drink.percentageRelativeToBest < -30
                      ? 'text-rose-400 font-semibold'
                      : 'text-stone-300 font-semibold'
                  }
                >
                  {isBest
                    ? 'Benchmark (100%)'
                    : `${drink.percentageRelativeToBest}% vs Winner`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isBest
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : isSecond
                      ? 'bg-emerald-500'
                      : 'bg-stone-600'
                  }`}
                  style={{ width: `${efficiencyPercent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-stone-400 font-medium sm:text-right shrink-0">
              <span>
                Per Liter:{' '}
                <span className="text-stone-300 font-mono font-semibold">
                  {formatCurrency(drink.pricePerLiter, currency)}/L
                </span>
              </span>
              <span>&bull;</span>
              <span>
                Std Drink:{' '}
                <span className="text-white font-mono font-bold">
                  {formatCurrency(drink.costPerStandardDrink, currency)}
                </span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
