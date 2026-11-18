import React, { useState } from 'react';
import {
  CalculatedDrink,
  DrinkCategory,
  DrinkItem,
  formatCurrency,
} from '../utils/calculator';
import {
  Trash2,
  Trophy,
  Pencil,
  Check,
  X,
  MapPin,
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface DrinkCardProps {
  drink: CalculatedDrink;
  currency: string;
  onDelete: (id: string) => void;
  onUpdate?: (updated: DrinkItem) => void;
  onSelectBar?: (barName: string) => void;
  availableBars?: string[];
  bestScore: number;
  otherBarsCount?: number;
}

export const DrinkCard: React.FC<DrinkCardProps> = React.memo(({
  drink,
  currency,
  onDelete,
  onUpdate,
  onSelectBar,
  availableBars = [],
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

  const renderCategoryBadge = (category: string) => (
    <span className="p-1 rounded-lg bg-[#FFF2F3] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] inline-flex items-center justify-center shrink-0">
      <CategoryIcon category={category} className="w-4 h-4" />
    </span>
  );

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
    if (!editName.trim() || editVolume <= 0 || editAbv < 0 || editPrice <= 0) return;
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
      id={isBest ? 'tour-krent-champion' : undefined}
      className={`relative rounded-2xl p-4 transition-all duration-200 border ${
        isBest
          ? 'bg-gradient-to-b from-[#FFFFFF] to-[#FFF2F3] dark:from-[#18181B] dark:to-[#F21B2D]/10 border-[#F21B2D]/70 shadow-sm ring-1 ring-[#F21B2D]/20'
          : 'bg-[#FFFFFF] dark:bg-[#18181B] border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF8A8E] dark:hover:border-[#FF8A8E]/50 shadow-sm'
      }`}
    >
      {/* Top Banner for Best Value */}
      {isBest && (
        <div className="absolute -top-3 left-4 bg-[#F21B2D] text-white text-[11px] font-extrabold tracking-[-0.01em] uppercase px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 whitespace-nowrap">
          <Trophy className="w-3.5 h-3.5 shrink-0" />
          <span>Krent Champion &bull; Best Bang for Buck</span>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
            <div className="sm:col-span-4">
              <label
                htmlFor={`edit-name-${drink.id}`}
                className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold mb-1"
              >
                Drink Name
              </label>
              <input
                id={`edit-name-${drink.id}`}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:border-[#F21B2D] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor={`edit-bar-${drink.id}`}
                className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold mb-1"
              >
                Bar / Venue
              </label>
              <input
                id={`edit-bar-${drink.id}`}
                type="text"
                list={`bars-list-${drink.id}`}
                value={editBar}
                onChange={(e) => setEditBar(e.target.value)}
                required
                className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#F21B2D] rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:border-[#F21B2D] focus:outline-none"
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
              <label
                htmlFor={`edit-cat-${drink.id}`}
                className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold mb-1"
              >
                Category
              </label>
              <select
                id={`edit-cat-${drink.id}`}
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as DrinkCategory)}
                className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] rounded-xl px-2 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:border-[#F21B2D] focus:outline-none"
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
              <label
                htmlFor={`edit-notes-${drink.id}`}
                className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold mb-1"
              >
                Notes
              </label>
              <input
                id={`edit-notes-${drink.id}`}
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-zinc-300 rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:border-[#F21B2D] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 items-end text-xs">
            <div>
              <label
                htmlFor={`edit-vol-${drink.id}`}
                className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold mb-1"
              >
                Volume (ml)
              </label>
              <input
                id={`edit-vol-${drink.id}`}
                type="number"
                min="1"
                step="1"
                value={editVolume}
                onChange={(e) => setEditVolume(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-semibold rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:border-[#F21B2D] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={`edit-abv-${drink.id}`}
                className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold mb-1"
              >
                ABV (%)
              </label>
              <input
                id={`edit-abv-${drink.id}`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={editAbv}
                onChange={(e) => setEditAbv(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-semibold rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:border-[#F21B2D] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={`edit-price-${drink.id}`}
                className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold mb-1"
              >
                Price ({currency})
              </label>
              <input
                id={`edit-price-${drink.id}`}
                type="number"
                min="0.01"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-semibold rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:border-[#F21B2D] focus:outline-none"
              />
            </div>

            <div className="col-span-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#27272A] text-[#18181B] dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A] font-semibold flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold flex items-center gap-1"
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
                className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-extrabold tracking-[-0.02em] text-sm tabular-nums ${
                  isBest
                    ? 'bg-[#F21B2D] text-white shadow-sm'
                    : isSecond
                    ? 'bg-[#FF8A8E]/30 text-[#D91424] dark:text-[#FF8A8E] border border-[#FF8A8E]/50'
                    : isThird
                    ? 'bg-[#FFF2F3] dark:bg-[#27272A] text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A]'
                    : 'bg-[#FFF2F3]/60 dark:bg-[#121214] text-zinc-500 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A]'
                }`}
              >
                {isBest ? (
                  <Trophy className="w-5 h-5 text-white" />
                ) : (
                  `#${drink.efficiencyRank}`
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderCategoryBadge(drink.category)}
                  <h3 className="font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF] text-base leading-snug">{drink.name}</h3>
                  {drink.barName && (
                    <button
                      type="button"
                      onClick={() => onSelectBar && onSelectBar(drink.barName!)}
                      title={`Served at ${drink.barName} (click to filter)`}
                      className="text-[11px] font-bold text-[#D91424] dark:text-[#FF8A8E] bg-[#FF8A8E]/20 hover:bg-[#FF8A8E]/30 border border-[#FF8A8E]/40 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{drink.barName}</span>
                    </button>
                  )}
                  {otherBarsCount > 0 && (
                    <span
                      title={`This exact drink size is also recorded at ${otherBarsCount} other bar(s)`}
                      className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 bg-[#FFF2F3] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] px-2 py-0.5 rounded-lg whitespace-nowrap"
                    >
                      +{otherBarsCount} {otherBarsCount === 1 ? 'other bar' : 'other bars'}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span className="bg-[#FFF2F3] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] px-2 py-0.5 rounded-lg text-[#18181B] dark:text-zinc-300 tabular-nums font-semibold">
                    {drink.volumeMl}ml ({Number((drink.volumeMl / 10).toFixed(1))}cl)
                  </span>
                  <span>&bull;</span>
                  <span className="bg-[#FF8A8E]/20 border border-[#FF8A8E]/40 px-2 py-0.5 rounded-lg text-[#D91424] dark:text-[#FF8A8E] tabular-nums font-bold">
                    {drink.abv}% ABV
                  </span>
                  <span>&bull;</span>
                  <span className="bg-[#FFF2F3] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] px-2 py-0.5 rounded-lg text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-bold">
                    {formatCurrency(drink.price, currency)}
                  </span>
                  {drink.notes && (
                    <span className="text-zinc-500 dark:text-zinc-400 italic">
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
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                  KrentProcent
                </div>
                <div
                  className={`font-extrabold text-lg sm:text-xl tracking-[-0.03em] tabular-nums ${
                    isBest ? 'text-[#F21B2D]' : 'text-[#18181B] dark:text-[#FFFFFF]'
                  }`}
                >
                  {drink.pureAlcoholPerCurrency}{' '}
                  <span className="text-xs font-medium tracking-normal text-zinc-500 dark:text-zinc-400">ml / {currency}</span>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {drink.pureAlcoholMl} ml pure alc
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-[#E4E4E7] dark:border-[#27272A]">
                {onUpdate && (
                  <button
                    type="button"
                    onClick={startEditing}
                    title="Edit drink details or price"
                    className="p-2 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/20 text-zinc-600 dark:text-zinc-300 hover:text-[#F21B2D] border border-[#E4E4E7] dark:border-[#27272A] transition-colors"
                    aria-label={`Edit ${drink.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDelete(drink.id)}
                  title="Delete drink"
                  className="p-2 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#F21B2D] text-zinc-500 dark:text-zinc-400 hover:text-white border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D] transition-colors"
                  aria-label={`Remove ${drink.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Efficiency Bar & Comparison vs Winner */}
          <div className="mt-3 pt-2.5 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="w-full sm:w-3/5">
              <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                <span className="text-zinc-500 dark:text-zinc-400">Relative Value:</span>
                <span
                  className={
                    isBest
                      ? 'text-[#F21B2D] font-bold'
                      : drink.percentageRelativeToBest && drink.percentageRelativeToBest < -30
                      ? 'text-[#D91424] dark:text-[#FF8A8E] font-semibold'
                      : 'text-zinc-600 dark:text-zinc-300 font-semibold'
                  }
                >
                  {isBest
                    ? 'Benchmark (100%)'
                    : `${drink.percentageRelativeToBest}% vs Winner`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-[#FFF2F3] dark:bg-[#121214] rounded-full overflow-hidden border border-[#E4E4E7] dark:border-[#27272A]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isBest
                      ? 'bg-[#F21B2D]'
                      : isSecond
                      ? 'bg-[#FF8A8E]'
                      : 'bg-zinc-400 dark:bg-zinc-600'
                  }`}
                  style={{ width: `${efficiencyPercent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium sm:text-right shrink-0">
              <span>
                Per Liter:{' '}
                <span className="text-[#18181B] dark:text-zinc-200 font-semibold tabular-nums">
                  {formatCurrency(drink.pricePerLiter, currency)}/L
                </span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

DrinkCard.displayName = 'DrinkCard';
