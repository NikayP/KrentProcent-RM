import React from 'react';
import {
  Beer,
  Wine,
  Flame,
  Martini,
  Apple,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import type { DrinkCategory } from '../utils/calculator';

export interface CategoryMeta {
  id: DrinkCategory;
  label: string;
  filterLabel: string;
  icon: LucideIcon;
  colorClass: string;
}

export const DRINK_CATEGORY_META: Record<DrinkCategory, CategoryMeta> = {
  beer: {
    id: 'beer',
    label: 'Beer',
    filterLabel: 'Beer',
    icon: Beer,
    colorClass: 'text-[#F21B2D]',
  },
  wine: {
    id: 'wine',
    label: 'Wine',
    filterLabel: 'Wine',
    icon: Wine,
    colorClass: 'text-[#D91424] dark:text-[#FF8A8E]',
  },
  spirit: {
    id: 'spirit',
    label: 'Spirit',
    filterLabel: 'Spirits',
    icon: Flame,
    colorClass: 'text-orange-500',
  },
  cocktail: {
    id: 'cocktail',
    label: 'Cocktail',
    filterLabel: 'Cocktails',
    icon: Martini,
    colorClass: 'text-pink-500',
  },
  cider: {
    id: 'cider',
    label: 'Cider',
    filterLabel: 'Cider',
    icon: Apple,
    colorClass: 'text-emerald-500',
  },
  other: {
    id: 'other',
    label: 'Other',
    filterLabel: 'Other',
    icon: HelpCircle,
    colorClass: 'text-zinc-400',
  },
};

export const DRINK_CATEGORY_LIST: CategoryMeta[] = [
  DRINK_CATEGORY_META.beer,
  DRINK_CATEGORY_META.wine,
  DRINK_CATEGORY_META.spirit,
  DRINK_CATEGORY_META.cocktail,
  DRINK_CATEGORY_META.cider,
  DRINK_CATEGORY_META.other,
];

interface CategoryIconProps {
  category: DrinkCategory | string;
  className?: string;
  colored?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-4 h-4',
  colored = true,
}) => {
  const meta =
    DRINK_CATEGORY_META[category as DrinkCategory] ?? DRINK_CATEGORY_META.other;
  const Icon = meta.icon;
  return (
    <Icon
      className={`${className} shrink-0 ${colored ? meta.colorClass : ''}`.trim()}
    />
  );
};
