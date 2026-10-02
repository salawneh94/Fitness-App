import type { GenericFood } from '../foodSearch';

/**
 * Unbranded staples, so the most common things people eat can be logged by name.
 *
 * Open Food Facts is a database of *packaged* products: search it for "banana" or "chicken
 * breast" and you get banana bread and breaded nuggets. Yet whole foods are exactly what
 * people log most, and until now the only route for them was typing four macro numbers by hand.
 * This table covers that gap, and it works offline and costs nothing against OFF's 10-searches-a-
 * minute limit.
 *
 * Values are per 100 g, based on USDA FoodData Central (SR Legacy) reference figures, rounded.
 * Cooked foods are listed as cooked, since that is the state people weigh and eat them in. The
 * tests check every entry against the 4/4/9 Atwater factors, so a mistyped number fails CI rather
 * than quietly skewing someone's totals.
 */
export const GENERIC_FOODS: GenericFood[] = [
  // --- protein -------------------------------------------------------------------------------
  { id: 'chicken-breast', name: 'Chicken breast, cooked', aliases: ['chicken'], per100g: { calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
    servings: [{ label: '1 breast', grams: 172 }] },
  { id: 'chicken-thigh', name: 'Chicken thigh, cooked', aliases: ['chicken'], per100g: { calories: 209, proteinG: 25.9, carbsG: 0, fatG: 10.9 },
    servings: [{ label: '1 thigh', grams: 116 }] },
  { id: 'turkey-breast', name: 'Turkey breast, roasted', aliases: ['turkey'], per100g: { calories: 147, proteinG: 30.1, carbsG: 0, fatG: 2.1 },
    servings: [] },
  { id: 'ground-beef-85', name: 'Ground beef 85% lean, cooked', aliases: ['mince', 'minced beef', 'beef', 'hamburger'],
    per100g: { calories: 250, proteinG: 25.9, carbsG: 0, fatG: 15.4 }, servings: [] },
  { id: 'salmon', name: 'Salmon, cooked', aliases: ['fish'], per100g: { calories: 206, proteinG: 22.1, carbsG: 0, fatG: 12.4 },
    servings: [{ label: '1 fillet', grams: 154 }] },
  { id: 'tuna-canned', name: 'Tuna, canned in water', aliases: ['fish'], per100g: { calories: 116, proteinG: 25.5, carbsG: 0, fatG: 0.8 },
    servings: [{ label: '1 can, drained', grams: 142 }] },
  { id: 'cod', name: 'Cod, cooked', aliases: ['fish', 'white fish'], per100g: { calories: 105, proteinG: 22.8, carbsG: 0, fatG: 0.9 },
    servings: [{ label: '1 fillet', grams: 180 }] },
  { id: 'shrimp', name: 'Shrimp, cooked', aliases: ['prawns'], per100g: { calories: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3 },
    servings: [] },
  { id: 'egg', name: 'Egg, whole', aliases: ['eggs', 'boiled egg'], per100g: { calories: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6 },
    servings: [{ label: '1 large egg', grams: 50 }] },
  { id: 'egg-white', name: 'Egg white', aliases: ['eggs'], per100g: { calories: 52, proteinG: 10.9, carbsG: 0.7, fatG: 0.2 },
    servings: [{ label: '1 large white', grams: 33 }] },
  { id: 'tofu-firm', name: 'Tofu, firm', per100g: { calories: 144, proteinG: 17.3, carbsG: 2.8, fatG: 8.7, micros: { fiberG: 2.3 } },
    servings: [] },

  // --- dairy ---------------------------------------------------------------------------------
  { id: 'greek-yogurt-nonfat', name: 'Greek yogurt, plain, nonfat', aliases: ['yoghurt', 'yogurt'],
    per100g: { calories: 59, proteinG: 10.2, carbsG: 3.6, fatG: 0.4 }, servings: [{ label: '1 container', grams: 170 }] },
  { id: 'greek-yogurt-whole', name: 'Greek yogurt, plain, whole milk', aliases: ['yoghurt', 'yogurt'],
    per100g: { calories: 97, proteinG: 9, carbsG: 4, fatG: 5 }, servings: [{ label: '1 container', grams: 170 }] },
  { id: 'cottage-cheese', name: 'Cottage cheese, 2%', per100g: { calories: 81, proteinG: 10.5, carbsG: 4.8, fatG: 2.3 },
    servings: [{ label: '½ cup', grams: 113 }] },
  { id: 'milk-whole', name: 'Milk, whole', per100g: { calories: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3 },
    servings: [{ label: '1 cup', grams: 244 }] },
  { id: 'milk-2', name: 'Milk, 2%', aliases: ['semi skimmed milk'], per100g: { calories: 50, proteinG: 3.3, carbsG: 4.8, fatG: 2 },
    servings: [{ label: '1 cup', grams: 244 }] },
  { id: 'milk-skim', name: 'Milk, skim', aliases: ['nonfat milk', 'skimmed milk'], per100g: { calories: 34, proteinG: 3.4, carbsG: 5, fatG: 0.1 },
    servings: [{ label: '1 cup', grams: 245 }] },
  { id: 'cheddar', name: 'Cheddar cheese', aliases: ['cheese'], per100g: { calories: 403, proteinG: 24.9, carbsG: 1.3, fatG: 33.1 },
    servings: [{ label: '1 slice', grams: 28 }] },
  { id: 'mozzarella', name: 'Mozzarella, part-skim', aliases: ['cheese'], per100g: { calories: 254, proteinG: 24.3, carbsG: 2.8, fatG: 15.9 },
    servings: [{ label: '1 oz', grams: 28 }] },
  { id: 'butter', name: 'Butter', per100g: { calories: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81.1 },
    servings: [{ label: '1 tbsp', grams: 14 }] },

  // --- grains & starches -----------------------------------------------------------------------
  { id: 'white-rice', name: 'White rice, cooked', aliases: ['rice'], per100g: { calories: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3, micros: { fiberG: 0.4 } },
    servings: [{ label: '1 cup', grams: 158 }] },
  { id: 'brown-rice', name: 'Brown rice, cooked', aliases: ['rice'], per100g: { calories: 111, proteinG: 2.6, carbsG: 23, fatG: 0.9, micros: { fiberG: 1.8 } },
    servings: [{ label: '1 cup', grams: 195 }] },
  { id: 'pasta', name: 'Pasta, cooked', aliases: ['spaghetti', 'noodles', 'penne'], per100g: { calories: 158, proteinG: 5.8, carbsG: 30.9, fatG: 0.9, micros: { fiberG: 1.8 } },
    servings: [{ label: '1 cup', grams: 140 }] },
  { id: 'quinoa', name: 'Quinoa, cooked', per100g: { calories: 120, proteinG: 4.4, carbsG: 21.3, fatG: 1.9, micros: { fiberG: 2.8 } },
    servings: [{ label: '1 cup', grams: 185 }] },
  { id: 'oats', name: 'Oats, rolled, dry', aliases: ['oatmeal', 'porridge'], per100g: { calories: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5, micros: { fiberG: 10.1 } },
    servings: [{ label: '½ cup', grams: 40 }] },
  { id: 'bread-whole-wheat', name: 'Bread, whole wheat', aliases: ['toast', 'wholemeal bread'], per100g: { calories: 252, proteinG: 12.4, carbsG: 42.7, fatG: 3.5, micros: { fiberG: 6 } },
    servings: [{ label: '1 slice', grams: 32 }] },
  { id: 'bread-white', name: 'Bread, white', aliases: ['toast'], per100g: { calories: 266, proteinG: 7.6, carbsG: 50.6, fatG: 3.3, micros: { fiberG: 2.4 } },
    servings: [{ label: '1 slice', grams: 25 }] },
  { id: 'potato', name: 'Potato, baked', aliases: ['potatoes'], per100g: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1, micros: { fiberG: 2.2 } },
    servings: [{ label: '1 medium', grams: 173 }] },
  { id: 'sweet-potato', name: 'Sweet potato, baked', aliases: ['potatoes', 'yam'], per100g: { calories: 90, proteinG: 2, carbsG: 20.7, fatG: 0.2, micros: { fiberG: 3.3 } },
    servings: [{ label: '1 medium', grams: 114 }] },

  // --- legumes -------------------------------------------------------------------------------
  { id: 'black-beans', name: 'Black beans, cooked', aliases: ['beans'], per100g: { calories: 132, proteinG: 8.9, carbsG: 23.7, fatG: 0.5, micros: { fiberG: 8.7 } },
    servings: [{ label: '1 cup', grams: 172 }] },
  { id: 'chickpeas', name: 'Chickpeas, cooked', aliases: ['garbanzo'], per100g: { calories: 164, proteinG: 8.9, carbsG: 27.4, fatG: 2.6, micros: { fiberG: 7.6 } },
    servings: [{ label: '1 cup', grams: 164 }] },
  { id: 'lentils', name: 'Lentils, cooked', per100g: { calories: 116, proteinG: 9, carbsG: 20.1, fatG: 0.4, micros: { fiberG: 7.9 } },
    servings: [{ label: '1 cup', grams: 198 }] },
  { id: 'hummus', name: 'Hummus', per100g: { calories: 166, proteinG: 7.9, carbsG: 14.3, fatG: 9.6, micros: { fiberG: 6 } },
    servings: [{ label: '2 tbsp', grams: 30 }] },

  // --- fruit ---------------------------------------------------------------------------------
  { id: 'banana', name: 'Banana', per100g: { calories: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, micros: { fiberG: 2.6 } },
    servings: [{ label: '1 medium', grams: 118 }] },
  { id: 'apple', name: 'Apple', per100g: { calories: 52, proteinG: 0.3, carbsG: 13.8, fatG: 0.2, micros: { fiberG: 2.4 } },
    servings: [{ label: '1 medium', grams: 182 }] },
  { id: 'orange', name: 'Orange', per100g: { calories: 47, proteinG: 0.9, carbsG: 11.8, fatG: 0.1, micros: { fiberG: 2.4 } },
    servings: [{ label: '1 medium', grams: 131 }] },
  { id: 'strawberries', name: 'Strawberries', aliases: ['berries'], per100g: { calories: 32, proteinG: 0.7, carbsG: 7.7, fatG: 0.3, micros: { fiberG: 2 } },
    servings: [{ label: '1 cup', grams: 152 }] },
  { id: 'blueberries', name: 'Blueberries', aliases: ['berries'], per100g: { calories: 57, proteinG: 0.7, carbsG: 14.5, fatG: 0.3, micros: { fiberG: 2.4 } },
    servings: [{ label: '1 cup', grams: 148 }] },
  { id: 'grapes', name: 'Grapes', per100g: { calories: 69, proteinG: 0.7, carbsG: 18.1, fatG: 0.2, micros: { fiberG: 0.9 } },
    servings: [{ label: '1 cup', grams: 151 }] },
  { id: 'avocado', name: 'Avocado', per100g: { calories: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7, micros: { fiberG: 6.7 } },
    servings: [{ label: '½ avocado', grams: 68 }] },
  { id: 'mango', name: 'Mango', per100g: { calories: 60, proteinG: 0.8, carbsG: 15, fatG: 0.4, micros: { fiberG: 1.6 } },
    servings: [{ label: '1 cup', grams: 165 }] },
  { id: 'pineapple', name: 'Pineapple', per100g: { calories: 50, proteinG: 0.5, carbsG: 13.1, fatG: 0.1, micros: { fiberG: 1.4 } },
    servings: [{ label: '1 cup', grams: 165 }] },
  { id: 'watermelon', name: 'Watermelon', aliases: ['melon'], per100g: { calories: 30, proteinG: 0.6, carbsG: 7.6, fatG: 0.2, micros: { fiberG: 0.4 } },
    servings: [{ label: '1 cup', grams: 152 }] },

  // --- vegetables ----------------------------------------------------------------------------
  { id: 'broccoli', name: 'Broccoli, cooked', per100g: { calories: 35, proteinG: 2.4, carbsG: 7.2, fatG: 0.4, micros: { fiberG: 3.3 } },
    servings: [{ label: '1 cup', grams: 156 }] },
  { id: 'spinach', name: 'Spinach, raw', aliases: ['greens'], per100g: { calories: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, micros: { fiberG: 2.2 } },
    servings: [{ label: '1 cup', grams: 30 }] },
  { id: 'romaine', name: 'Romaine lettuce', aliases: ['lettuce', 'salad', 'greens'], per100g: { calories: 17, proteinG: 1.2, carbsG: 3.3, fatG: 0.3, micros: { fiberG: 2.1 } },
    servings: [{ label: '1 cup', grams: 47 }] },
  { id: 'carrot', name: 'Carrot', aliases: ['carrots'], per100g: { calories: 41, proteinG: 0.9, carbsG: 9.6, fatG: 0.2, micros: { fiberG: 2.8 } },
    servings: [{ label: '1 medium', grams: 61 }] },
  { id: 'tomato', name: 'Tomato', aliases: ['tomatoes'], per100g: { calories: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, micros: { fiberG: 1.2 } },
    servings: [{ label: '1 medium', grams: 123 }] },
  { id: 'cucumber', name: 'Cucumber', per100g: { calories: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1, micros: { fiberG: 0.5 } },
    servings: [] },
  { id: 'bell-pepper', name: 'Bell pepper, red', aliases: ['pepper', 'capsicum'], per100g: { calories: 31, proteinG: 1, carbsG: 6, fatG: 0.3, micros: { fiberG: 2.1 } },
    servings: [{ label: '1 medium', grams: 119 }] },
  { id: 'green-beans', name: 'Green beans, cooked', aliases: ['beans'], per100g: { calories: 35, proteinG: 1.9, carbsG: 7.9, fatG: 0.3, micros: { fiberG: 3.2 } },
    servings: [{ label: '1 cup', grams: 125 }] },
  { id: 'onion', name: 'Onion', per100g: { calories: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1, micros: { fiberG: 1.7 } },
    servings: [{ label: '1 medium', grams: 110 }] },
  { id: 'mushrooms', name: 'Mushrooms, white', per100g: { calories: 22, proteinG: 3.1, carbsG: 3.3, fatG: 0.3, micros: { fiberG: 1 } },
    servings: [{ label: '1 cup', grams: 70 }] },
  { id: 'corn', name: 'Sweet corn, cooked', aliases: ['corn'], per100g: { calories: 96, proteinG: 3.4, carbsG: 21, fatG: 1.5, micros: { fiberG: 2.4 } },
    servings: [{ label: '1 ear', grams: 103 }] },
  { id: 'peas', name: 'Green peas, cooked', aliases: ['peas'], per100g: { calories: 84, proteinG: 5.4, carbsG: 15.6, fatG: 0.2, micros: { fiberG: 5.5 } },
    servings: [{ label: '1 cup', grams: 160 }] },

  // --- nuts, seeds & fats --------------------------------------------------------------------
  { id: 'almonds', name: 'Almonds', aliases: ['nuts'], per100g: { calories: 579, proteinG: 21.2, carbsG: 21.6, fatG: 49.9, micros: { fiberG: 12.5 } },
    servings: [{ label: '1 oz (≈23 nuts)', grams: 28 }] },
  { id: 'peanuts', name: 'Peanuts', aliases: ['nuts'], per100g: { calories: 567, proteinG: 25.8, carbsG: 16.1, fatG: 49.2, micros: { fiberG: 8.5 } },
    servings: [{ label: '1 oz', grams: 28 }] },
  { id: 'walnuts', name: 'Walnuts', aliases: ['nuts'], per100g: { calories: 654, proteinG: 15.2, carbsG: 13.7, fatG: 65.2, micros: { fiberG: 6.7 } },
    servings: [{ label: '1 oz', grams: 28 }] },
  { id: 'peanut-butter', name: 'Peanut butter', per100g: { calories: 588, proteinG: 25.1, carbsG: 20, fatG: 50.4, micros: { fiberG: 6 } },
    servings: [{ label: '2 tbsp', grams: 32 }] },
  { id: 'chia', name: 'Chia seeds', per100g: { calories: 486, proteinG: 16.5, carbsG: 42.1, fatG: 30.7, micros: { fiberG: 34.4 } },
    servings: [{ label: '1 tbsp', grams: 12 }] },
  { id: 'olive-oil', name: 'Olive oil', aliases: ['oil'], per100g: { calories: 884, proteinG: 0, carbsG: 0, fatG: 100 },
    servings: [{ label: '1 tbsp', grams: 13.5 }] },

  // --- drinks & extras -----------------------------------------------------------------------
  { id: 'orange-juice', name: 'Orange juice', aliases: ['juice', 'oj'], per100g: { calories: 45, proteinG: 0.7, carbsG: 10.4, fatG: 0.2, micros: { fiberG: 0.2 } },
    servings: [{ label: '1 cup', grams: 248 }] },
  { id: 'coffee-black', name: 'Coffee, black', per100g: { calories: 1, proteinG: 0.1, carbsG: 0, fatG: 0 },
    servings: [{ label: '1 cup', grams: 237 }] },
  { id: 'honey', name: 'Honey', per100g: { calories: 304, proteinG: 0.3, carbsG: 82.4, fatG: 0 },
    servings: [{ label: '1 tbsp', grams: 21 }] },
  { id: 'dark-chocolate', name: 'Dark chocolate, 70–85%', aliases: ['chocolate'], per100g: { calories: 598, proteinG: 7.8, carbsG: 45.9, fatG: 42.6, micros: { fiberG: 10.9 } },
    servings: [{ label: '1 oz', grams: 28 }] },
];
