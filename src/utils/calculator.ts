export type DrinkCategory = 'beer' | 'wine' | 'spirit' | 'cocktail' | 'cider' | 'other';

export interface DrinkItem {
  id: string;
  name: string;
  category: DrinkCategory;
  volumeMl: number;
  abv: number; // percentage (e.g. 5.0 for 5%)
  price: number;
  barName?: string; // Venue / Bar Name (e.g. "Café Gollem", "De Zotte")
  notes?: string;
  isCustom?: boolean;
}

export interface CalculatedDrink extends DrinkItem {
  pureAlcoholMl: number; // in ml
  pureAlcoholPerCurrency: number; // ml of pure alcohol per 1 currency unit (the Krent Score)
  costPerStandardDrink: number; // currency cost per standard drink (12.5ml pure alcohol)
  standardDrinks: number; // number of standard drinks (12.5ml units) in this serving
  pricePerLiter: number; // price per 1000ml of liquid
  pricePer100mlPureAlcohol: number;
  efficiencyRank?: number;
  percentageRelativeToBest?: number; // 0% if best, or negative e.g. -24%
}

export interface BarSummary {
  barName: string;
  drinkCount: number;
  bestDrink: CalculatedDrink | null;
  worstDrink: CalculatedDrink | null;
  averageKrentScore: number;
  averageStandardDrinkCost: number;
  averagePricePerLiter: number;
  cheapestDrink: CalculatedDrink | null;
}

export type DuplicateMatchType = 'exact' | 'same_variant' | 'same_name_diff_volume';

export interface DuplicateCheckResult {
  matchType: DuplicateMatchType;
  existingDrink: DrinkItem;
  allSameNameInBar: DrinkItem[];
}

export interface CrossBarDrinkComparison {
  groupKey: string;
  displayName: string;
  category: DrinkCategory;
  volumeMl: number;
  abv: number;
  entries: CalculatedDrink[]; // sorted descending by Krent score (best deal first)
  bestEntry: CalculatedDrink;
  worstEntry: CalculatedDrink;
  maxPriceDifference: number;
  maxValueAdvantagePercent: number;
}

export const STANDARD_DRINK_ALCOHOL_ML = 12.5; // ~10 grams of pure alcohol (standard Dutch/EU unit)
export const DEFAULT_BAR_NAME = 'Current Bar';

const VALID_CATEGORIES: ReadonlySet<DrinkCategory> = new Set([
  'beer',
  'wine',
  'spirit',
  'cocktail',
  'cider',
  'other',
]);

/**
 * Known Dutch / Belgian pub beer reference dictionary.
 * Used to:
 * 1) Automatically recognize & canonicalize different menu naming variations of the same beer
 *    (e.g., "Westmalle Tripel Trappist" -> "Westmalle Tripel", "Karmeliet Tripel" -> "Tripel Karmeliet", "Barbãr" -> "Barbar Blond")
 * 2) Provide authoritative reference ABV when a menu omits ABV or when OCR misreads the price as ABV
 *    (e.g., Brand Pilsener scanned at 3.7% because price was €3.70 -> auto-corrected to 5.0%).
 */
export interface KnownDrinkSpec {
  canonicalKey: string;
  canonicalName: string;
  abv: number;
  category: DrinkCategory;
  defaultVolumeMl?: number;
  aliases: string[];
}

export const KNOWN_DRINK_SPECS: readonly KnownDrinkSpec[] = [
  // Non-alcoholic 0.0 beers (strictly 0.0% ABV)
  {
    canonicalKey: 'heineken 0 0',
    canonicalName: 'Heineken 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['heineken 0 0', 'heineken 00', 'heineken alcoholvrij'],
  },
  {
    canonicalKey: 'amstel radler 0 0',
    canonicalName: 'Amstel Radler 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['amstel radler 0 0', 'amstel radler 00', 'radler 0 0', 'amstel 0 0 radler'],
  },
  {
    canonicalKey: 'guinness 0 0',
    canonicalName: 'Guinness 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['guinness 0 0', 'guinness 00', 'guinness draught 0 0'],
  },
  {
    canonicalKey: 'affligem blond 0 0',
    canonicalName: 'Affligem Blond 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['affligem blond 0 0', 'affligem 0 0', 'affligem 00', 'affligem blond 00'],
  },
  {
    canonicalKey: 'paulaner 0 0',
    canonicalName: 'Paulaner Hefe-Weißbier 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: [
      'paulaner 0 0',
      'paulaner 00',
      'paulaner hefe weisbier 0 0',
      'paulaner hefe weissbier 0 0',
      'paulaner weizen 0 0',
    ],
  },
  {
    canonicalKey: 'kasteel rouge 0 0',
    canonicalName: 'Kasteel Rouge 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['kasteel rouge 0 0', 'kasteel rouge 00'],
  },
  {
    canonicalKey: 'leffe blond 0 0',
    canonicalName: 'Leffe Blond 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['leffe blond 0 0', 'leffe 0 0', 'leffe blond 00'],
  },
  {
    canonicalKey: 'brand weizen 0 0',
    canonicalName: 'Brand Weizen 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['brand weizen 0 0', 'brand weizen 00', 'brand ipa 0 0'],
  },
  {
    canonicalKey: 'hertog jan 0 0',
    canonicalName: 'Hertog Jan 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['hertog jan 0 0', 'hertog jan 00'],
  },
  {
    canonicalKey: 'grolsch 0 0',
    canonicalName: 'Grolsch 0.0',
    abv: 0.0,
    category: 'beer',
    aliases: ['grolsch 0 0', 'grolsch 00', 'grolsch radler 0 0'],
  },
  {
    canonicalKey: 'vandestreek playground ipa',
    canonicalName: 'vandeStreek Playground Non-Alcoholic IPA',
    abv: 0.5,
    category: 'beer',
    aliases: [
      'vandestreek play ipa',
      'vandestreek playground ipa',
      'vandestreek playground',
      'playground ipa',
      'play ipa',
    ],
  },
  {
    canonicalKey: 'oersoep big bob',
    canonicalName: 'Oersoep Big Bob',
    abv: 0.3,
    category: 'beer',
    aliases: ['oersoep big bob', 'big bob', 'big bob oersoep'],
  },

  // Standard Pilsners & Classics
  {
    canonicalKey: 'brand pilsener',
    canonicalName: 'Brand Pilsener',
    abv: 5.0,
    category: 'beer',
    aliases: ['brand', 'brand pils', 'brand pilsener', 'brand pilsner', 'brand tap'],
  },
  {
    canonicalKey: 'heineken pilsener',
    canonicalName: 'Heineken Pilsener',
    abv: 5.0,
    category: 'beer',
    aliases: ['heineken', 'heineken pils', 'heineken pilsener', 'heineken pilsner', 'heineken vaasje', 'heineken pint', 'heineken halve liter'],
  },
  {
    canonicalKey: 'hertog jan pilsener',
    canonicalName: 'Hertog Jan Pilsener',
    abv: 5.1,
    category: 'beer',
    aliases: ['hertog jan', 'hertog jan pils', 'hertog jan pilsener', 'hertog jan pilsner', 'hertog jan vaasje'],
  },
  {
    canonicalKey: 'grolsch pilsener',
    canonicalName: 'Grolsch Premium Pilsner',
    abv: 5.0,
    category: 'beer',
    aliases: ['grolsch', 'grolsch pils', 'grolsch pilsener', 'grolsch pilsner', 'grolsch premium pilsner'],
  },
  {
    canonicalKey: 'dommelsch pilsener',
    canonicalName: 'Dommelsch Pilsener',
    abv: 5.0,
    category: 'beer',
    aliases: ['dommelsch', 'dommelsch pils', 'dommelsch pilsener', 'dommelsch vaasje'],
  },
  {
    canonicalKey: 'amstel pilsener',
    canonicalName: 'Amstel Pilsener',
    abv: 5.0,
    category: 'beer',
    aliases: ['amstel', 'amstel pils', 'amstel pilsener', 'amstel bier'],
  },
  {
    canonicalKey: 'jupiler pilsener',
    canonicalName: 'Jupiler Pilsener',
    abv: 5.2,
    category: 'beer',
    aliases: ['jupiler', 'jupiler pils', 'jupiler pilsener'],
  },
  {
    canonicalKey: 'bavaria pilsener',
    canonicalName: 'Bavaria Pilsener',
    abv: 5.0,
    category: 'beer',
    aliases: ['bavaria', 'bavaria pils', 'bavaria pilsener'],
  },

  // Belgian & Specialty Classics (Unifying naming variations across bars!)
  {
    canonicalKey: 'westmalle tripel',
    canonicalName: 'Westmalle Tripel',
    abv: 9.5,
    category: 'beer',
    aliases: [
      'westmalle tripel',
      'westmalle tripel trappist',
      'westmalle trappist tripel',
      'tripel westmalle',
    ],
  },
  {
    canonicalKey: 'westmalle dubbel',
    canonicalName: 'Westmalle Dubbel',
    abv: 7.0,
    category: 'beer',
    aliases: [
      'westmalle dubbel',
      'westmalle dubbel trappist',
      'westmalle trappist dubbel',
      'dubbel westmalle',
    ],
  },
  {
    canonicalKey: 'tripel karmeliet',
    canonicalName: 'Tripel Karmeliet',
    abv: 8.4,
    category: 'beer',
    aliases: [
      'tripel karmeliet',
      'karmeliet tripel',
      'karmeliet',
      'bosteels tripel karmeliet',
    ],
  },
  {
    canonicalKey: 'barbar blond',
    canonicalName: 'Barbar Blond',
    abv: 8.0,
    category: 'beer',
    aliases: ['barbar', 'barbar blond', 'barbar honingbier', 'barbar blonde'],
  },
  {
    canonicalKey: 'la chouffe',
    canonicalName: 'La Chouffe',
    abv: 8.0,
    category: 'beer',
    aliases: ['la chouffe', 'chouffe', 'chouffe blond', 'chouffe blonde', 'la chouffe blond', 'la chouffe blonde'],
  },
  {
    canonicalKey: 'mc chouffe',
    canonicalName: 'Mc Chouffe',
    abv: 8.0,
    category: 'beer',
    aliases: ['mc chouffe', 'mcchouffe', 'chouffe bruin'],
  },
  {
    canonicalKey: 'duvel',
    canonicalName: 'Duvel',
    abv: 8.5,
    category: 'beer',
    aliases: ['duvel', 'duvel belgian blond', 'duvel blond', 'duvel sterk blond'],
  },
  {
    canonicalKey: 'duvel 6 66',
    canonicalName: 'Duvel 6.66%',
    abv: 6.66,
    category: 'beer',
    aliases: ['duvel 6 66', 'duvel 666'],
  },
  {
    canonicalKey: 'rochefort 10',
    canonicalName: 'Rochefort 10',
    abv: 11.3,
    category: 'beer',
    aliases: ['rochefort 10', 'rochefort 10 trappist', 'trappistes rochefort 10'],
  },
  {
    canonicalKey: 'rochefort 8',
    canonicalName: 'Rochefort 8',
    abv: 9.2,
    category: 'beer',
    aliases: ['rochefort 8', 'rochefort 8 trappist', 'trappistes rochefort 8'],
  },
  {
    canonicalKey: 'rochefort 6',
    canonicalName: 'Rochefort 6',
    abv: 7.5,
    category: 'beer',
    aliases: ['rochefort 6', 'rochefort 6 trappist', 'trappistes rochefort 6'],
  },
  {
    canonicalKey: 'rochefort triple extra',
    canonicalName: 'Rochefort Triple Extra',
    abv: 8.1,
    category: 'beer',
    aliases: ['rochefort triple extra', 'rochefort triple extra trappist', 'rochefort tripel extra'],
  },
  {
    canonicalKey: 'orval',
    canonicalName: 'Orval',
    abv: 6.2,
    category: 'beer',
    aliases: ['orval', 'orval trappist'],
  },
  {
    canonicalKey: 'chimay blauw',
    canonicalName: 'Chimay Blauw',
    abv: 9.0,
    category: 'beer',
    aliases: ['chimay blauw', 'chimay blue', 'chimay blauw trappist', 'chimay grande reserve'],
  },
  {
    canonicalKey: 'chimay rood',
    canonicalName: 'Chimay Rood',
    abv: 7.0,
    category: 'beer',
    aliases: ['chimay rood', 'chimay red', 'chimay rood trappist', 'chimay premiere'],
  },
  {
    canonicalKey: 'chimay wit',
    canonicalName: 'Chimay Wit (Cinq Cents)',
    abv: 8.0,
    category: 'beer',
    aliases: ['chimay wit', 'chimay tripel', 'chimay white', 'chimay cinq cents', 'chimay wit trappist'],
  },
  {
    canonicalKey: 'st bernardus abt 12',
    canonicalName: 'St. Bernardus Abt 12',
    abv: 10.0,
    category: 'beer',
    aliases: ['st bernardus abt 12', 'sint bernardus abt 12', 'abt 12'],
  },
  {
    canonicalKey: 'st bernardus prior 8',
    canonicalName: 'St. Bernardus Prior 8',
    abv: 8.0,
    category: 'beer',
    aliases: ['st bernardus prior 8', 'sint bernardus prior 8'],
  },
  {
    canonicalKey: 'kasteel rouge',
    canonicalName: 'Kasteel Rouge',
    abv: 8.0,
    category: 'beer',
    aliases: ['kasteel rouge', 'kasteelbier rouge'],
  },
  {
    canonicalKey: 'kasteel blond',
    canonicalName: 'Kasteel Blond',
    abv: 7.0,
    category: 'beer',
    aliases: ['kasteel blond', 'kasteelbier blond'],
  },
  {
    canonicalKey: 'kasteel donker',
    canonicalName: 'Kasteel Donker',
    abv: 11.0,
    category: 'beer',
    aliases: ['kasteel donker', 'kasteelbier donker'],
  },
  {
    canonicalKey: 'kasteel tripel',
    canonicalName: 'Kasteel Tripel',
    abv: 11.0,
    category: 'beer',
    aliases: ['kasteel tripel', 'kasteelbier tripel'],
  },
  {
    canonicalKey: 'la trappe tripel',
    canonicalName: 'La Trappe Tripel',
    abv: 8.0,
    category: 'beer',
    aliases: ['la trappe tripel', 'la trappe trappist tripel'],
  },
  {
    canonicalKey: 'la trappe dubbel',
    canonicalName: 'La Trappe Dubbel',
    abv: 7.0,
    category: 'beer',
    aliases: ['la trappe dubbel', 'la trappe trappist dubbel'],
  },
  {
    canonicalKey: 'la trappe quadrupel',
    canonicalName: 'La Trappe Quadrupel',
    abv: 10.0,
    category: 'beer',
    aliases: ['la trappe quadrupel', 'la trappe quad'],
  },
  {
    canonicalKey: 'la trappe blond',
    canonicalName: 'La Trappe Blond',
    abv: 6.5,
    category: 'beer',
    aliases: ['la trappe blond', 'la trappe trappist blond'],
  },
  {
    canonicalKey: 'la trappe isid or',
    canonicalName: "La Trappe Isid'or",
    abv: 7.5,
    category: 'beer',
    aliases: ['la trappe isid or', 'la trappe isidor', 'isidor'],
  },
  {
    canonicalKey: 'leffe blond',
    canonicalName: 'Leffe Blond',
    abv: 6.6,
    category: 'beer',
    aliases: ['leffe blond', 'leffe blonde'],
  },
  {
    canonicalKey: 'leffe bruin',
    canonicalName: 'Leffe Bruin',
    abv: 6.5,
    category: 'beer',
    aliases: ['leffe bruin', 'leffe brune', 'leffe donker'],
  },
  {
    canonicalKey: 'leffe tripel',
    canonicalName: 'Leffe Tripel',
    abv: 8.5,
    category: 'beer',
    aliases: ['leffe tripel', 'leffe triple'],
  },
  {
    canonicalKey: 'affligem blond',
    canonicalName: 'Affligem Blond',
    abv: 6.7,
    category: 'beer',
    aliases: ['affligem blond', 'affligem blonde'],
  },
  {
    canonicalKey: 'affligem dubbel',
    canonicalName: 'Affligem Dubbel',
    abv: 6.8,
    category: 'beer',
    aliases: ['affligem dubbel'],
  },
  {
    canonicalKey: 'affligem tripel',
    canonicalName: 'Affligem Tripel',
    abv: 9.0,
    category: 'beer',
    aliases: ['affligem tripel', 'affligem triple'],
  },
  {
    canonicalKey: 'guinness draught',
    canonicalName: 'Guinness Draught',
    abv: 4.2,
    category: 'beer',
    aliases: ['guinness', 'guinness draught', 'guinness pint', 'guinness draught pint', 'guinness stout'],
  },
  {
    canonicalKey: 'weihenstephaner hefeweissbier',
    canonicalName: 'Weihenstephaner Hefeweissbier',
    abv: 5.4,
    category: 'beer',
    aliases: [
      'weihenstephaner',
      'weihenstephaner hefeweissbier',
      'weihenstephaner hefe weizen',
      'weihenstephaner weizen',
      'weihenstephan',
    ],
  },
  {
    canonicalKey: 'paulaner hefe weissbier',
    canonicalName: 'Paulaner Hefe-Weißbier',
    abv: 5.5,
    category: 'beer',
    aliases: [
      'paulaner',
      'paulaner hefe weissbier',
      'paulaner hefe weisbier',
      'paulaner weizen',
      'paulaner weissbier',
    ],
  },
  {
    canonicalKey: 'franziskaner weissbier',
    canonicalName: 'Franziskaner Weissbier',
    abv: 5.0,
    category: 'beer',
    aliases: ['franziskaner', 'franziskaner weizen', 'franziskaner weissbier', 'franziskaner hefe weissbier'],
  },
  {
    canonicalKey: 'erdinger weissbier',
    canonicalName: 'Erdinger Weissbier',
    abv: 5.3,
    category: 'beer',
    aliases: ['erdinger', 'erdinger weizen', 'erdinger weissbier'],
  },
  {
    canonicalKey: 'de koninck bolleke',
    canonicalName: 'De Koninck (Bolleke)',
    abv: 5.2,
    category: 'beer',
    aliases: ['de koninck', 'de koninck bolleke', 'bolleke', 'bolleke de koninck', 'koninck'],
  },
  {
    canonicalKey: 'brouwerij t ij ijwit',
    canonicalName: "Brouwerij 't IJ IJwit",
    abv: 6.5,
    category: 'beer',
    aliases: ['ijwit', 't ij ijwit', 'brouwerij t ij ijwit', 'ij wit'],
  },
  {
    canonicalKey: 'brouwerij t ij zatte',
    canonicalName: "Brouwerij 't IJ Zatte Tripel",
    abv: 8.0,
    category: 'beer',
    aliases: ['zatte', 'zatte tripel', 't ij zatte', 'brouwerij t ij zatte', 'brouwerij t ij zatte tripel'],
  },
  {
    canonicalKey: 'brouwerij t ij natte',
    canonicalName: "Brouwerij 't IJ Natte Dubbel",
    abv: 6.5,
    category: 'beer',
    aliases: ['natte', 'natte dubbel', 't ij natte', 'brouwerij t ij natte', 'brouwerij t ij natte dubbel'],
  },
  {
    canonicalKey: 'oedipus mannenliefde',
    canonicalName: 'Oedipus Mannenliefde',
    abv: 6.0,
    category: 'beer',
    aliases: ['oedipus mannenliefde', 'mannenliefde', 'oedipus mannenliefde saison'],
  },
  {
    canonicalKey: 'texels skuumkoppe',
    canonicalName: 'Texels Skuumkoppe',
    abv: 6.0,
    category: 'beer',
    aliases: ['texels skuumkoppe', 'skuumkoppe', 'texels'],
  },
  {
    canonicalKey: 'cornet oaked',
    canonicalName: 'Cornet Oaked',
    abv: 8.5,
    category: 'beer',
    aliases: ['cornet', 'cornet oaked', 'cornet blond'],
  },
  {
    canonicalKey: 'delirium tremens',
    canonicalName: 'Delirium Tremens',
    abv: 8.5,
    category: 'beer',
    aliases: ['delirium tremens', 'delirium blond'],
  },
  {
    canonicalKey: 'delirium red',
    canonicalName: 'Delirium Red',
    abv: 8.0,
    category: 'beer',
    aliases: ['delirium red'],
  },
  {
    canonicalKey: 'gouden carolus classic',
    canonicalName: 'Gouden Carolus Classic',
    abv: 8.5,
    category: 'beer',
    aliases: ['gouden carolus classic'],
  },
  {
    canonicalKey: 'gouden carolus tripel',
    canonicalName: 'Gouden Carolus Tripel',
    abv: 9.0,
    category: 'beer',
    aliases: ['gouden carolus tripel'],
  },
  {
    canonicalKey: 'gouden carolus whisky infused',
    canonicalName: 'Gouden Carolus Whisky Infused',
    abv: 11.7,
    category: 'beer',
    aliases: ['gouden carolus whisky infused', 'gouden carolus whiskey infused'],
  },
  {
    canonicalKey: 'uiltje dr raptor',
    canonicalName: 'Uiltje Dr. Raptor Imperial IPA',
    abv: 8.2,
    category: 'beer',
    aliases: ['uiltje dr raptor', 'dr raptor', 'uiltje dr raptor imperial ipa'],
  },
  {
    canonicalKey: 'uiltje bird of prey',
    canonicalName: 'Uiltje Bird of Prey IPA',
    abv: 5.8,
    category: 'beer',
    aliases: ['uiltje bird of prey', 'bird of prey', 'bird of prey ipa'],
  },
  {
    canonicalKey: 'lagunitas ipa',
    canonicalName: 'Lagunitas IPA',
    abv: 6.2,
    category: 'beer',
    aliases: ['lagunitas ipa', 'lagunitas'],
  },
  {
    canonicalKey: 'saison dupont',
    canonicalName: 'Saison Dupont',
    abv: 6.5,
    category: 'beer',
    aliases: ['saison dupont'],
  },
  {
    canonicalKey: 'vedett extra white',
    canonicalName: 'Vedett Extra White',
    abv: 4.7,
    category: 'beer',
    aliases: ['vedett', 'vedett extra white', 'vedett white', 'vedett wit'],
  },
  {
    canonicalKey: 'hoegaarden wit',
    canonicalName: 'Hoegaarden Witbier',
    abv: 4.9,
    category: 'beer',
    aliases: ['hoegaarden', 'hoegaarden wit', 'hoegaarden witbier'],
  },
  {
    canonicalKey: 'apple bandit cider',
    canonicalName: 'Apple Bandit Cider',
    abv: 4.5,
    category: 'cider',
    aliases: ['apple bandit', 'apple bandit cider', 'apple bandit juicy apple'],
  },
];

/**
 * Checks if a drink name or raw line explicitly denotes a non-alcoholic (0.0%) drink.
 * Handles "Heineken 0.0", "Amstel Radler 0,0%", "Guinness 0.0", "Paulaner 0.0", "Alcoholvrij", etc.
 */
export function isExplicitZeroAlcohol(text: string): boolean {
  if (!text) return false;
  return (
    /\b0[.,]0(?:\s*%|\b)/i.test(text) ||
    /\b0\s*%/i.test(text) ||
    /\b(?:alcoholvrij|alcohol\s*free|non[-\s]*alcoholic|alkoholfrei|sans\s*alcool)\b/i.test(text)
  );
}

/**
 * Strips generic menu filler words and normalizes punctuation/accents to produce a clean token string
 * for looking up against KNOWN_DRINK_SPECS or matching drinks across bars.
 */
function cleanDrinkTokensForLookup(name: string): string {
  if (!name) return '';
  const hasZero = isExplicitZeroAlcohol(name);
  let cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Preserve 0.0 as "0 0" before stripping punctuation
  cleaned = cleaned.replace(/\b0[.,]0\b/g, ' 0 0 ');

  cleaned = cleaned
    .replace(/['’"`()\[\]{},._\/\\+-]+/g, ' ')
    // Strip serving/packaging descriptors that vary between menus
    .replace(
      /\b(fles|flesje|bottle|van de tap|tap|draft|draught|wisseltap|blik|can|glas|glass|speciaalbier|trappist|abdijbier|belgian)\b/g,
      ' '
    )
    .replace(/\b\d+\s*(ml|cl|l|liter)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (hasZero && !/\b0 0\b/.test(cleaned)) {
    cleaned = `${cleaned} 0 0`.trim();
  }
  return cleaned;
}

// Fast lookup index from alias -> KnownDrinkSpec
const ALIAS_TO_SPEC_MAP: Map<string, KnownDrinkSpec> = (() => {
  const map = new Map<string, KnownDrinkSpec>();
  for (const spec of KNOWN_DRINK_SPECS) {
    map.set(spec.canonicalKey, spec);
    for (const alias of spec.aliases) {
      map.set(alias.toLowerCase().trim(), spec);
    }
  }
  return map;
})();

/**
 * Matches a drink name against our known Dutch/Belgian pub drink database.
 */
export function matchKnownDrinkSpec(name: string): KnownDrinkSpec | null {
  if (!name) return null;
  const cleaned = cleanDrinkTokensForLookup(name);
  if (!cleaned) return null;

  // 1. Direct alias match
  const direct = ALIAS_TO_SPEC_MAP.get(cleaned);
  if (direct) return direct;

  // 2. Strip size words (vaasje, fluitje, pint, halve liter) and try again
  const withoutSize = cleaned
    .replace(/\b(vaasje|fluitje|pint|pintje|halve liter|klein|groot)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const byWithoutSize = ALIAS_TO_SPEC_MAP.get(withoutSize);
  if (byWithoutSize) return byWithoutSize;

  // 3. Reversed word order check for 2-word names (e.g. "Karmeliet Tripel" -> "tripel karmeliet")
  const tokens = withoutSize.split(' ').filter(Boolean);
  if (tokens.length === 2) {
    const reversed = `${tokens[1]} ${tokens[0]}`;
    const byReversed = ALIAS_TO_SPEC_MAP.get(reversed);
    if (byReversed) return byReversed;
  }

  return null;
}

/**
 * Normalizes a café price to detect and fix weird OCR decimal artifacts like €7.03 -> €7.00.
 * In Dutch/European bars, drink prices are almost always multiples of €0.10 or €0.25/€0.05.
 * Specifically, single-digit cent glitches like .01, .02, .03, .04 are OCR misreads of .00.
 */
export function normalizeCafePrice(rawPrice: number): number {
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) return 0;
  const cents = Math.round(rawPrice * 100);
  const remainder = cents % 5;
  if (remainder === 0) {
    return Number((cents / 100).toFixed(2));
  }
  const lastTwo = cents % 100;
  if (lastTwo === 99 || lastTwo === 49) {
    return Number((cents / 100).toFixed(2));
  }
  // OCR often misreads ".00" as ".03", ".02", ".01" or ".50" as ".53", ".52"
  const rem10 = cents % 10;
  if (rem10 <= 3) {
    return Number(((cents - rem10) / 100).toFixed(2));
  }
  const snappedCents = Math.round(cents / 5) * 5;
  return Number((snappedCents / 100).toFixed(2));
}

/**
 * Sanitizes a numeric value, returning fallback if NaN, infinite, or below min.
 */
export function sanitizePositiveNumber(value: unknown, fallback = 0, max?: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (max !== undefined && num > max) return max;
  return num;
}

/**
 * Sanitizes a DrinkItem to guarantee valid properties, canonical beer names, and accurate ABV/prices:
 * - Forces 0.0% ABV on any drink containing "0.0", "0,0", or "Alcoholvrij" (never falls back to 5%).
 * - Matches known Dutch/Belgian pub beers (e.g. "Westmalle Tripel Trappist" -> "Westmalle Tripel",
 *   "Karmeliet Tripel" -> "Tripel Karmeliet", "Barbãr" -> "Barbar Blond") and auto-corrects
 *   misread ABVs (e.g. Brand Pilsener scanned at 3.7% because price was €3.70 -> 5.0%, Oersoep Big Bob -> 0.3%).
 */
export function sanitizeDrinkItem(raw: Partial<DrinkItem> & { id?: string }): DrinkItem {
  let category: DrinkCategory =
    raw.category && VALID_CATEGORIES.has(raw.category) ? raw.category : 'beer';
  let name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Unnamed Drink';
  const barName =
    typeof raw.barName === 'string' && raw.barName.trim() ? raw.barName.trim() : DEFAULT_BAR_NAME;
  const volumeMl = sanitizePositiveNumber(raw.volumeMl, 330, 50000);
  const rawPrice = sanitizePositiveNumber(raw.price, 0, 100000);
  const price = normalizeCafePrice(rawPrice) || rawPrice;
  let abv = sanitizePositiveNumber(raw.abv, 0, 100);

  const knownSpec = matchKnownDrinkSpec(name);
  const explicitZero = isExplicitZeroAlcohol(name);

  if (explicitZero) {
    abv = 0;
  }

  if (knownSpec) {
    category = knownSpec.category;
    // Preserve serving size suffix if user explicitly wrote e.g. "Heineken Vaasje" or "Heineken Pint",
    // otherwise use the clean canonical name so cross-bar comparisons match automatically!
    const lowerName = name.toLowerCase();
    const hasServingSuffix = /\b(vaasje|fluitje|pint|halve liter|pitcher)\b/i.test(lowerName);
    if (!hasServingSuffix) {
      name = knownSpec.canonicalName;
    }

    if (knownSpec.abv === 0) {
      abv = 0;
    } else if (!explicitZero) {
      // Correct ABV if:
      // 1) It was left at the generic 5.0% fallback while the known beer has a different ABV (e.g., Westmalle 9.5%, Oersoep Big Bob 0.3%)
      // 2) The scanned ABV is suspiciously equal to the price (e.g. Brand Pilsener @ €3.70 scanned as 3.7% ABV)
      // 3) The scanned ABV deviates significantly (> 0.6%) from the authoritative brewery ABV
      const abvMatchesPrice = price > 0 && Math.abs(abv - price) < 0.15;
      const isGenericFallback = Math.abs(abv - 5.0) < 0.05 && Math.abs(knownSpec.abv - 5.0) > 0.2;
      const isLargeDeviation = Math.abs(abv - knownSpec.abv) > 0.6;

      if (abv <= 0 || abvMatchesPrice || isGenericFallback || isLargeDeviation) {
        abv = knownSpec.abv;
      }
    }
  }

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `drink-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    barName,
    category,
    volumeMl: Number(volumeMl.toFixed(1)),
    abv: Number(abv.toFixed(2)),
    price: Number(price.toFixed(2)),
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : undefined,
    isCustom: Boolean(raw.isCustom),
  };
}

/**
 * Calculates pure alcohol in ml from volume (ml) and ABV (%).
 */
export function calculatePureAlcoholMl(volumeMl: number, abv: number): number {
  if (!Number.isFinite(volumeMl) || !Number.isFinite(abv) || volumeMl <= 0 || abv <= 0) {
    return 0;
  }
  const clampedAbv = Math.min(100, abv);
  return (volumeMl * clampedAbv) / 100;
}

/**
 * Calculates pure alcohol (ml) per unit of currency spent.
 * This is the primary KrentProcent efficiency score.
 * Higher number means more alcohol per euro/dollar.
 */
export function calculateAlcoholPerCurrency(pureAlcoholMl: number, price: number): number {
  if (!Number.isFinite(pureAlcoholMl) || !Number.isFinite(price) || price <= 0 || pureAlcoholMl <= 0) {
    return 0;
  }
  return pureAlcoholMl / price;
}

/**
 * Calculates cost for one standard drink (~12.5ml pure alcohol).
 */
export function calculateCostPerStandardDrink(
  pureAlcoholMl: number,
  price: number,
  standardUnitMl = STANDARD_DRINK_ALCOHOL_ML
): number {
  if (
    !Number.isFinite(pureAlcoholMl) ||
    !Number.isFinite(price) ||
    !Number.isFinite(standardUnitMl) ||
    pureAlcoholMl <= 0 ||
    price <= 0 ||
    standardUnitMl <= 0
  ) {
    return 0;
  }
  return (standardUnitMl / pureAlcoholMl) * price;
}

/**
 * Full calculation for a single drink item.
 */
export function calculateDrinkMetrics(drink: DrinkItem): CalculatedDrink {
  const safeVolume = Number.isFinite(drink.volumeMl) && drink.volumeMl > 0 ? drink.volumeMl : 0;
  const safeAbv = Number.isFinite(drink.abv) && drink.abv > 0 ? Math.min(100, drink.abv) : 0;
  const safePrice = Number.isFinite(drink.price) && drink.price > 0 ? drink.price : 0;

  const pureAlcoholMl = calculatePureAlcoholMl(safeVolume, safeAbv);
  const pureAlcoholPerCurrency = calculateAlcoholPerCurrency(pureAlcoholMl, safePrice);
  const costPerStandardDrink = calculateCostPerStandardDrink(pureAlcoholMl, safePrice);
  const standardDrinks = pureAlcoholMl > 0 ? pureAlcoholMl / STANDARD_DRINK_ALCOHOL_ML : 0;
  const pricePerLiter = safeVolume > 0 && safePrice > 0 ? (safePrice / safeVolume) * 1000 : 0;
  const pricePer100mlPureAlcohol =
    pureAlcoholMl > 0 && safePrice > 0 ? (safePrice / pureAlcoholMl) * 100 : 0;

  return {
    ...drink,
    barName: drink.barName?.trim() || DEFAULT_BAR_NAME,
    pureAlcoholMl: Number(pureAlcoholMl.toFixed(2)),
    pureAlcoholPerCurrency: Number(pureAlcoholPerCurrency.toFixed(3)),
    costPerStandardDrink: Number(costPerStandardDrink.toFixed(2)),
    standardDrinks: Number(standardDrinks.toFixed(2)),
    pricePerLiter: Number(pricePerLiter.toFixed(2)),
    pricePer100mlPureAlcohol: Number(pricePer100mlPureAlcohol.toFixed(2)),
  };
}

/**
 * Normalizes a bar name by stripping diacritics/accents, trimming, and collapsing whitespace.
 * e.g. "Café in de Blaauwe Hand" -> "cafe in de blaauwe hand"
 *      "Cafe   in de Blaauwe Hand" -> "cafe in de blaauwe hand"
 */
export function normalizeBarKey(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes a drink name for duplicate & cross-bar matching.
 * First checks if the drink matches a canonical beer in KNOWN_DRINK_SPECS
 * (so "Westmalle Tripel" and "Westmalle Tripel Trappist", or "Tripel Karmeliet" and "Karmeliet Tripel",
 * or "Barbãr" and "Barbar Blond" produce the exact same key!).
 * Otherwise strips accents, lowercases, removes generic menu filler words, normalizes punctuation, and collapses whitespace.
 */
export function normalizeDrinkKey(name: string): string {
  if (!name) return '';
  const known = matchKnownDrinkSpec(name);
  if (known) {
    return known.canonicalKey;
  }

  return cleanDrinkTokensForLookup(name);
}

/**
 * Checks if two bar names match, ignoring accents, casing, and spacing differences.
 */
export function areBarNamesEquivalent(nameA: string, nameB: string): boolean {
  return normalizeBarKey(nameA) === normalizeBarKey(nameB);
}

/**
 * Checks if two drink names match, ignoring accents, casing, punctuation, and spacing differences.
 */
export function areDrinkNamesEquivalent(nameA: string, nameB: string): boolean {
  const keyA = normalizeDrinkKey(nameA);
  const keyB = normalizeDrinkKey(nameB);
  return keyA.length > 0 && keyA === keyB;
}

/**
 * Creates a unique composite signature for a drink variant within a specific bar:
 * normalizedBarKey + normalizedDrinkKey + rounded volumeMl.
 */
export function getBarDrinkVariantKey(
  drink: Pick<DrinkItem, 'name' | 'barName' | 'volumeMl'>
): string {
  const barKey = normalizeBarKey(drink.barName || DEFAULT_BAR_NAME);
  const drinkKey = normalizeDrinkKey(drink.name);
  const volKey = Math.round(Number(drink.volumeMl) || 0);
  return `${barKey}::${drinkKey}::${volKey}`;
}

/**
 * Checks if a candidate drink is a duplicate of an existing drink IN THE SAME BAR.
 * A beer at Bar A and the same beer at Bar B are NEVER duplicates.
 * Within the same bar:
 * - 'exact': Same normalized drink name, same volumeMl, same ABV, and same price.
 * - 'same_variant': Same normalized drink name and same volumeMl, but different price or ABV.
 * - 'same_name_diff_volume': Same normalized drink name in the same bar, but a different volumeMl (e.g., 250ml vs 500ml).
 */
export function findDuplicateDrinkInBar(
  drinks: DrinkItem[],
  candidate: {
    id?: string;
    name: string;
    barName?: string;
    volumeMl: number;
    abv: number;
    price: number;
  }
): DuplicateCheckResult | null {
  if (!drinks || drinks.length === 0 || !candidate.name?.trim()) return null;

  const targetBarKey = normalizeBarKey(candidate.barName || DEFAULT_BAR_NAME);
  const targetDrinkKey = normalizeDrinkKey(candidate.name);
  if (!targetDrinkKey) return null;

  const sameNameInBar = drinks.filter((d) => {
    if (candidate.id && d.id === candidate.id) return false;
    const dBarKey = normalizeBarKey(d.barName || DEFAULT_BAR_NAME);
    if (dBarKey !== targetBarKey) return false;
    return normalizeDrinkKey(d.name) === targetDrinkKey;
  });

  if (sameNameInBar.length === 0) return null;

  const candidateVol = Math.round(Number(candidate.volumeMl) || 0);
  const sameVolumeMatch = sameNameInBar.find(
    (d) => Math.round(Number(d.volumeMl) || 0) === candidateVol
  );

  if (sameVolumeMatch) {
    const isSameAbv = Math.abs((Number(sameVolumeMatch.abv) || 0) - (Number(candidate.abv) || 0)) < 0.01;
    const isSamePrice =
      Math.abs((Number(sameVolumeMatch.price) || 0) - (Number(candidate.price) || 0)) < 0.005;

    if (isSameAbv && isSamePrice) {
      return {
        matchType: 'exact',
        existingDrink: sameVolumeMatch,
        allSameNameInBar: sameNameInBar,
      };
    }

    return {
      matchType: 'same_variant',
      existingDrink: sameVolumeMatch,
      allSameNameInBar: sameNameInBar,
    };
  }

  return {
    matchType: 'same_name_diff_volume',
    existingDrink: sameNameInBar[0],
    allSameNameInBar: sameNameInBar,
  };
}

/**
 * Deduplicates drinks PER BAR (same bar + same normalized drink name + same volumeMl).
 * Drinks with the same name at DIFFERENT bars are always preserved.
 * @param prefer 'first' keeps the earliest item in the array; 'latest' updates with the later item's values.
 */
export function deduplicateDrinksPerBar(
  drinks: DrinkItem[],
  prefer: 'first' | 'latest' = 'first'
): { drinks: DrinkItem[]; duplicatesRemoved: number } {
  if (!drinks || drinks.length === 0) {
    return { drinks: [], duplicatesRemoved: 0 };
  }

  const consolidated = consolidateDrinksBars(drinks);
  const variantMap = new Map<string, number>(); // key -> index in result
  const result: DrinkItem[] = [];
  let duplicatesRemoved = 0;

  for (const rawDrink of consolidated) {
    const drink = sanitizeDrinkItem(rawDrink);
    const key = getBarDrinkVariantKey(drink);
    const existingIndex = variantMap.get(key);

    if (existingIndex === undefined) {
      variantMap.set(key, result.length);
      result.push(drink);
    } else {
      duplicatesRemoved++;
      if (prefer === 'latest') {
        const prev = result[existingIndex];
        result[existingIndex] = {
          ...prev,
          ...drink,
          id: prev.id, // preserve stable id
          barName: prev.barName, // preserve canonical barName
        };
      }
    }
  }

  return { drinks: result, duplicatesRemoved };
}

/**
 * Smartly adds or updates a drink in a bar:
 * - 'update_existing' (default): If a drink with the same name & volumeMl already exists in the same bar,
 *   updates that existing drink (or skips if 100% identical) instead of creating a duplicate.
 * - 'force_add': Always adds as a new drink entry.
 */
export function upsertDrinkInBar(
  drinks: DrinkItem[],
  newDrink: DrinkItem,
  mode: 'update_existing' | 'force_add' = 'update_existing',
  knownBars: string[] = []
): {
  drinks: DrinkItem[];
  action: 'added' | 'updated' | 'unchanged_duplicate';
  drink: DrinkItem;
} {
  const allBars = Array.from(new Set([...getUniqueBars(drinks), ...knownBars]));
  const canonicalBar = canonicalizeBarName(newDrink.barName || DEFAULT_BAR_NAME, allBars);
  const cleanedDrink = sanitizeDrinkItem({
    ...newDrink,
    barName: canonicalBar,
  });

  if (mode === 'force_add') {
    return {
      drinks: consolidateDrinksBars([cleanedDrink, ...drinks]),
      action: 'added',
      drink: cleanedDrink,
    };
  }

  const dup = findDuplicateDrinkInBar(drinks, cleanedDrink);
  if (dup && (dup.matchType === 'exact' || dup.matchType === 'same_variant')) {
    const existing = dup.existingDrink;
    const updatedItem: DrinkItem = {
      ...existing,
      name: cleanedDrink.name || existing.name,
      category: cleanedDrink.category,
      volumeMl: cleanedDrink.volumeMl,
      abv: cleanedDrink.abv,
      price: cleanedDrink.price,
      barName: existing.barName || canonicalBar,
      notes: cleanedDrink.notes || existing.notes,
    };

    const updatedList = drinks.map((d) => (d.id === existing.id ? updatedItem : d));
    return {
      drinks: consolidateDrinksBars(updatedList),
      action: dup.matchType === 'exact' ? 'unchanged_duplicate' : 'updated',
      drink: updatedItem,
    };
  }

  return {
    drinks: consolidateDrinksBars([cleanedDrink, ...drinks]),
    action: 'added',
    drink: cleanedDrink,
  };
}

/**
 * Merges a batch of imported/scanned/preset drinks into the existing drink list with per-bar duplicate handling.
 * - First deduplicates the incoming batch itself per bar.
 * - Then merges into existingDrinks according to conflictStrategy:
 *   - 'update': updates price/ABV of matching (bar + name + volumeMl) drinks, skips exact matches, adds new ones.
 *   - 'skip': skips any drink that already exists (same bar + name + volumeMl), adds only new ones.
 *   - 'add_all': adds all items without checking existing drinks.
 */
export function mergeDrinksBatch(
  existingDrinks: DrinkItem[],
  incomingDrinks: DrinkItem[],
  conflictStrategy: 'update' | 'skip' | 'add_all' = 'update',
  knownBars: string[] = []
): {
  drinks: DrinkItem[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
} {
  if (!incomingDrinks || incomingDrinks.length === 0) {
    return {
      drinks: existingDrinks,
      addedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };
  }

  const allKnownBars = Array.from(new Set([...getUniqueBars(existingDrinks), ...knownBars]));
  const normalizedIncoming = incomingDrinks.map((d) =>
    sanitizeDrinkItem({
      ...d,
      barName: canonicalizeBarName(d.barName || DEFAULT_BAR_NAME, allKnownBars),
    })
  );

  // Deduplicate incoming batch against itself first
  const { drinks: uniqueIncoming, duplicatesRemoved: batchInternalDups } = deduplicateDrinksPerBar(
    normalizedIncoming,
    'latest'
  );

  if (conflictStrategy === 'add_all') {
    return {
      drinks: consolidateDrinksBars([...uniqueIncoming, ...existingDrinks]),
      addedCount: uniqueIncoming.length,
      updatedCount: 0,
      skippedCount: batchInternalDups,
    };
  }

  let currentList = [...existingDrinks];
  const newlyAdded: DrinkItem[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = batchInternalDups;

  for (const candidate of uniqueIncoming) {
    const dup = findDuplicateDrinkInBar(currentList, candidate);

    if (!dup || dup.matchType === 'same_name_diff_volume') {
      newlyAdded.push(candidate);
      currentList = [candidate, ...currentList];
      addedCount++;
    } else if (dup.matchType === 'exact') {
      skippedCount++;
    } else if (dup.matchType === 'same_variant') {
      if (conflictStrategy === 'skip') {
        skippedCount++;
      } else {
        // 'update'
        const existingId = dup.existingDrink.id;
        currentList = currentList.map((d) =>
          d.id === existingId
            ? {
                ...d,
                name: candidate.name || d.name,
                category: candidate.category,
                volumeMl: candidate.volumeMl,
                abv: candidate.abv,
                price: candidate.price,
                notes: candidate.notes || d.notes,
              }
            : d
        );
        updatedCount++;
      }
    }
  }

  // Put newly added items at the top of the list
  const existingUpdated = currentList.filter((d) => !newlyAdded.some((n) => n.id === d.id));
  return {
    drinks: consolidateDrinksBars([...newlyAdded, ...existingUpdated]),
    addedCount,
    updatedCount,
    skippedCount,
  };
}

/**
 * Finds if a bar name matches any existing bar in a list (ignoring accents and case).
 * If matched, returns the existing canonical string.
 * If not matched, returns the trimmed input name.
 */
export function canonicalizeBarName(inputName: string, existingBars: string[]): string {
  const trimmed = inputName?.trim();
  if (!trimmed) return DEFAULT_BAR_NAME;
  const key = normalizeBarKey(trimmed);

  for (const bar of existingBars) {
    if (normalizeBarKey(bar) === key) {
      return bar;
    }
  }
  return trimmed;
}

/**
 * Consolidates all drinks' barNames so that variations like
 * "Café in de Blaauwe Hand" and "Cafe in de Blaauwe Hand"
 * are unified into a single canonical barName across all drinks.
 */
export function consolidateDrinksBars(
  drinks: DrinkItem[],
  preferredCanonicalBars: string[] = []
): DrinkItem[] {
  if (!drinks || drinks.length === 0) return [];
  const keyToCanonical = new Map<string, string>();

  // Register preferred canonical bar names first (if provided)
  for (const bar of preferredCanonicalBars) {
    const raw = bar?.trim();
    if (!raw) continue;
    const key = normalizeBarKey(raw);
    if (key && !keyToCanonical.has(key)) {
      keyToCanonical.set(key, raw);
    }
  }

  // First pass: register the primary display name for each key
  for (const d of drinks) {
    const raw = d.barName?.trim() || DEFAULT_BAR_NAME;
    const key = normalizeBarKey(raw);
    if (!keyToCanonical.has(key)) {
      keyToCanonical.set(key, raw);
    }
  }

  // Second pass: map every drink's barName to the canonical name
  return drinks.map((d) => {
    const raw = d.barName?.trim() || DEFAULT_BAR_NAME;
    const key = normalizeBarKey(raw);
    const canonical = keyToCanonical.get(key) || raw;
    if (d.barName === canonical) return d;
    return { ...d, barName: canonical };
  });
}

/**
 * Extracts list of unique bar names from drinks and optional managed bars list, ignoring accent/case differences.
 */
export function getUniqueBars(drinks: DrinkItem[], extraBars: string[] = []): string[] {
  const keyToBar = new Map<string, string>();

  for (const d of drinks) {
    const name = d.barName?.trim() || DEFAULT_BAR_NAME;
    const key = normalizeBarKey(name);
    if (key && !keyToBar.has(key)) {
      keyToBar.set(key, name);
    }
  }

  for (const b of extraBars) {
    const name = b?.trim();
    if (!name) continue;
    const key = normalizeBarKey(name);
    if (key && !keyToBar.has(key)) {
      keyToBar.set(key, name);
    }
  }

  return Array.from(keyToBar.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Filters drinks by selected bar ('all' returns all drinks), ignoring accent/case differences.
 */
export function filterDrinksByBar(drinks: DrinkItem[], selectedBar: string): DrinkItem[] {
  if (!selectedBar || selectedBar === 'all') return drinks;
  const targetKey = normalizeBarKey(selectedBar);
  return drinks.filter((d) => normalizeBarKey(d.barName || DEFAULT_BAR_NAME) === targetKey);
}

/**
 * Deletes all drinks associated with a specific bar (accent-insensitive, case-insensitive & trimmed).
 */
export function deleteDrinksForBar(drinks: DrinkItem[], barNameToDelete: string): DrinkItem[] {
  if (!barNameToDelete) return drinks;
  const targetKey = normalizeBarKey(barNameToDelete);
  return drinks.filter(
    (d) => normalizeBarKey(d.barName || DEFAULT_BAR_NAME) !== targetKey
  );
}

/**
 * Renames a bar across all drinks. If renamed to an existing bar name,
 * merges the two bars and deduplicates identical (name + volume) drinks within the merged bar.
 */
export function renameBarInDrinks(
  drinks: DrinkItem[],
  oldBarName: string,
  newBarName: string,
  existingBars: string[] = []
): { drinks: DrinkItem[]; canonicalNewName: string; mergedDuplicatesRemoved: number } {
  const trimmedNew = newBarName?.trim();
  if (!oldBarName || !trimmedNew) {
    return { drinks, canonicalNewName: oldBarName, mergedDuplicatesRemoved: 0 };
  }

  const oldKey = normalizeBarKey(oldBarName);
  const otherBars = existingBars.filter((b) => normalizeBarKey(b) !== oldKey);
  const canonicalNewName = canonicalizeBarName(trimmedNew, otherBars);

  const renamed = drinks.map((d) => {
    const dKey = normalizeBarKey(d.barName || DEFAULT_BAR_NAME);
    if (dKey === oldKey) {
      return { ...d, barName: canonicalNewName };
    }
    return d;
  });

  const { drinks: deduplicated, duplicatesRemoved } = deduplicateDrinksPerBar(renamed, 'first');
  return {
    drinks: deduplicated,
    canonicalNewName,
    mergedDuplicatesRemoved: duplicatesRemoved,
  };
}

/**
 * Calculates bar summary stats across multiple bars (including any empty managed bars).
 */
export function calculateBarSummaries(
  drinks: DrinkItem[],
  extraBars: string[] = []
): BarSummary[] {
  const bars = getUniqueBars(drinks, extraBars);

  return bars
    .map((barName) => {
      const barDrinks = filterDrinksByBar(drinks, barName);
      const ranked = rankDrinks(barDrinks);

      if (ranked.length === 0) {
        return {
          barName,
          drinkCount: 0,
          bestDrink: null,
          worstDrink: null,
          averageKrentScore: 0,
          averageStandardDrinkCost: 0,
          averagePricePerLiter: 0,
          cheapestDrink: null,
        };
      }

      const totalKrent = ranked.reduce((acc, d) => acc + d.pureAlcoholPerCurrency, 0);
      const alcoholicRanked = ranked.filter((d) => d.pureAlcoholMl > 0);
      const totalCost = alcoholicRanked.reduce((acc, d) => acc + d.costPerStandardDrink, 0);
      const totalPricePerLiter = ranked.reduce((acc, d) => acc + d.pricePerLiter, 0);
      const sortedByPrice = [...ranked].sort((a, b) => a.price - b.price);

      return {
        barName,
        drinkCount: ranked.length,
        bestDrink: ranked[0],
        worstDrink: ranked[ranked.length - 1],
        averageKrentScore: Number((totalKrent / ranked.length).toFixed(3)),
        averageStandardDrinkCost:
          alcoholicRanked.length > 0 ? Number((totalCost / alcoholicRanked.length).toFixed(2)) : 0,
        averagePricePerLiter: Number((totalPricePerLiter / ranked.length).toFixed(2)),
        cheapestDrink: sortedByPrice[0],
      };
    })
    .sort((a, b) => {
      if (a.drinkCount === 0 && b.drinkCount > 0) return 1;
      if (b.drinkCount === 0 && a.drinkCount > 0) return -1;
      if (b.averageKrentScore !== a.averageKrentScore) {
        return b.averageKrentScore - a.averageKrentScore;
      }
      return a.barName.localeCompare(b.barName);
    });
}

/**
 * Finds drinks that appear across multiple bars (same normalized drink name + volumeMl)
 * so users can compare where the exact same drink (e.g. "Heineken Vaasje 250ml" or "Duvel 330ml")
 * is cheapest and offers the best KrentProcent score.
 */
export function findCrossBarCommonDrinks(drinks: DrinkItem[]): CrossBarDrinkComparison[] {
  if (!drinks || drinks.length === 0) return [];

  const groups = new Map<string, CalculatedDrink[]>();

  for (const d of drinks) {
    const calc = calculateDrinkMetrics(d);
    const groupKey = `${normalizeDrinkKey(d.name)}::${Math.round(d.volumeMl)}`;
    const list = groups.get(groupKey) || [];
    list.push(calc);
    groups.set(groupKey, list);
  }

  const comparisons: CrossBarDrinkComparison[] = [];

  for (const [groupKey, list] of groups.entries()) {
    // Keep only unique bars within this group
    const uniqueBarsInGroup = new Set(list.map((d) => normalizeBarKey(d.barName || DEFAULT_BAR_NAME)));
    if (uniqueBarsInGroup.size < 2) continue;

    // Sort descending by Krent score, then lowest price
    const sorted = [...list].sort((a, b) => {
      if (b.pureAlcoholPerCurrency !== a.pureAlcoholPerCurrency) {
        return b.pureAlcoholPerCurrency - a.pureAlcoholPerCurrency;
      }
      return a.price - b.price;
    });

    const bestEntry = sorted[0];
    const worstEntry = sorted[sorted.length - 1];
    const prices = sorted.map((d) => d.price);
    const maxPriceDifference = Number((Math.max(...prices) - Math.min(...prices)).toFixed(2));
    const maxValueAdvantagePercent =
      worstEntry.pureAlcoholPerCurrency > 0
        ? Number(
            (
              ((bestEntry.pureAlcoholPerCurrency - worstEntry.pureAlcoholPerCurrency) /
                worstEntry.pureAlcoholPerCurrency) *
              100
            ).toFixed(1)
          )
        : 0;

    comparisons.push({
      groupKey,
      displayName: bestEntry.name,
      category: bestEntry.category,
      volumeMl: bestEntry.volumeMl,
      abv: bestEntry.abv,
      entries: sorted,
      bestEntry,
      worstEntry,
      maxPriceDifference,
      maxValueAdvantagePercent,
    });
  }

  return comparisons.sort((a, b) => {
    if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
    return b.maxValueAdvantagePercent - a.maxValueAdvantagePercent;
  });
}

/**
 * Ranks drinks by pure alcohol per currency (highest value first).
 * Annotates each with its rank and percentage difference compared to the #1 top deal.
 */
export function rankDrinks(drinks: DrinkItem[]): CalculatedDrink[] {
  if (!drinks || drinks.length === 0) return [];

  const calculated = drinks.map(calculateDrinkMetrics);

  // Sort descending by value score (pure alcohol per currency), with deterministic tie-breakers
  calculated.sort((a, b) => {
    if (b.pureAlcoholPerCurrency !== a.pureAlcoholPerCurrency) {
      return b.pureAlcoholPerCurrency - a.pureAlcoholPerCurrency;
    }
    if (a.price !== b.price) {
      return a.price - b.price;
    }
    if (b.pureAlcoholMl !== a.pureAlcoholMl) {
      return b.pureAlcoholMl - a.pureAlcoholMl;
    }
    return a.name.localeCompare(b.name);
  });

  const bestScore = calculated[0]?.pureAlcoholPerCurrency || 0;

  return calculated.map((item, index) => {
    let percentageRelativeToBest = 0;
    if (bestScore > 0 && item.pureAlcoholPerCurrency > 0) {
      percentageRelativeToBest = Number(
        (((item.pureAlcoholPerCurrency - bestScore) / bestScore) * 100).toFixed(1)
      );
    } else if (bestScore > 0 && item.pureAlcoholPerCurrency === 0) {
      percentageRelativeToBest = -100;
    }

    return {
      ...item,
      efficiencyRank: index + 1,
      percentageRelativeToBest,
    };
  });
}

/**
 * Formats currency neatly with chosen symbol
 */
export function formatCurrency(amount: number, symbol = '€'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${safeAmount.toFixed(2)}`;
}
