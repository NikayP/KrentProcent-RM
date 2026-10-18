import { DrinkItem } from '../utils/calculator';

export const POPULAR_BAR_PRESETS: DrinkItem[] = [
  {
    id: 'preset-pilsner-vaasje',
    name: 'Pilsner (Vaasje)',
    category: 'beer',
    volumeMl: 250,
    abv: 5.0,
    price: 3.5,
    barName: 'Café De Dokter',
    notes: 'Standard Dutch tap glass',
  },
  {
    id: 'preset-pilsner-pint',
    name: 'Pilsner (Pint / Halve Liter)',
    category: 'beer',
    volumeMl: 500,
    abv: 5.0,
    price: 6.5,
    barName: 'Café De Dokter',
    notes: 'Large draft beer',
  },
  {
    id: 'preset-fluitje',
    name: 'Pilsner (Fluitje)',
    category: 'beer',
    volumeMl: 200,
    abv: 5.0,
    price: 3.0,
    barName: 'Café De Dokter',
    notes: 'Small draft beer',
  },
  {
    id: 'preset-belgian-tripel',
    name: 'Belgian Tripel (Karmeliet/Westmalle)',
    category: 'beer',
    volumeMl: 330,
    abv: 8.5,
    price: 5.8,
    barName: 'Café De Zotte',
    notes: 'Strong abbey ale bottle',
  },
  {
    id: 'preset-craft-ipa',
    name: 'Craft IPA / IJwit',
    category: 'beer',
    volumeMl: 330,
    abv: 6.5,
    price: 5.5,
    barName: 'Gollem Craft Beer',
    notes: 'Specialty craft draft or bottle',
  },
  {
    id: 'preset-belgian-quad',
    name: 'Belgian Quadrupel / Imperial Stout',
    category: 'beer',
    volumeMl: 330,
    abv: 10.0,
    price: 6.5,
    barName: 'Café De Zotte',
    notes: 'Heavy dark ale',
  },
  {
    id: 'preset-pitcher',
    name: 'Beer Pitcher (1.5L)',
    category: 'beer',
    volumeMl: 1500,
    abv: 5.0,
    price: 18.0,
    barName: 'Café De Dokter',
    notes: 'Shared draft pitcher',
  },
  {
    id: 'preset-house-wine',
    name: 'House Wine (Glass)',
    category: 'wine',
    volumeMl: 150,
    abv: 12.5,
    price: 4.8,
    barName: 'Café De Dokter',
    notes: 'Standard wine pour',
  },
  {
    id: 'preset-wine-bottle',
    name: 'House Wine (Full Bottle)',
    category: 'wine',
    volumeMl: 750,
    abv: 12.5,
    price: 22.0,
    barName: 'Café De Dokter',
    notes: 'Full 750ml bottle',
  },
  {
    id: 'preset-shot',
    name: 'Spirit Shot (Jägermeister / Tequila)',
    category: 'spirit',
    volumeMl: 35,
    abv: 38.0,
    price: 4.0,
    barName: 'Gollem Craft Beer',
    notes: 'Standard bar shot',
  },
  {
    id: 'preset-cocktail',
    name: 'Cocktail (Gin & Tonic / Mojito)',
    category: 'cocktail',
    volumeMl: 220,
    abv: 10.0,
    price: 9.5,
    barName: 'Gollem Craft Beer',
    notes: 'Single shot mixer',
  },
  {
    id: 'preset-cider',
    name: 'Apple Cider (Pint)',
    category: 'cider',
    volumeMl: 500,
    abv: 4.5,
    price: 6.0,
    barName: 'Café De Dokter',
    notes: 'Draft cider',
  },
  {
    id: 'preset-zotte-vaasje',
    name: 'Pilsner (Vaasje)',
    category: 'beer',
    volumeMl: 250,
    abv: 5.0,
    price: 3.7,
    barName: 'Café De Zotte',
    notes: 'Standard Dutch tap glass',
  },
  {
    id: 'preset-gollem-vaasje',
    name: 'Pilsner (Vaasje)',
    category: 'beer',
    volumeMl: 250,
    abv: 5.0,
    price: 3.8,
    barName: 'Gollem Craft Beer',
    notes: 'House pilsner on tap',
  },
  {
    id: 'preset-dokter-tripel',
    name: 'Belgian Tripel (Karmeliet/Westmalle)',
    category: 'beer',
    volumeMl: 330,
    abv: 8.5,
    price: 6.2,
    barName: 'Café De Dokter',
    notes: 'Abbey tripel bottle',
  },
  {
    id: 'preset-gollem-tripel',
    name: 'Belgian Tripel (Karmeliet/Westmalle)',
    category: 'beer',
    volumeMl: 330,
    abv: 8.5,
    price: 5.6,
    barName: 'Gollem Craft Beer',
    notes: 'Draft tripel specialty',
  },
];

export const SAMPLE_MENU_TEXT = `--- DE BRUINE KROEG BEER & DRINKS MENU ---
Heineken Pilsener Vaasje 25cl (5.0%) - €3.60
Heineken Halve Liter Pint 50cl (5.0%) - €6.70
Brouwerij 't IJ Zatte Tripel 33cl (8.0%) - €5.75
Tripel Karmeliet 33cl (8.4%) - €6.00
Duvel Belgian Blond 33cl (8.5%) - €5.80
Guinness Draught Pint 50cl (4.2%) - €7.20
Brouwerij 't IJ Natte Dubbel 33cl (6.5%) - €5.60
Rochefort 10 Trappist 33cl (11.3%) - €7.20
Pitcher Pilsener 1500ml (5.0%) - €19.50
Huiswijn Wit / Rood Glas 150ml (12.5%) - €4.90
Huiswijn Fles 750ml (12.5%) - €24.00
Olmeca Tequila Shot 35ml (38.0%) - €4.20
Ketel One Vodka Shot 35ml (40.0%) - €4.50
Gin & Tonic 200ml (9.5%) - €10.50
Apple Bandit Cider 33cl (4.5%) - €4.80`;
