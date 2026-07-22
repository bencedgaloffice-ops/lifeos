/**
 * Rule-based meal suggestions — matches what's actually in the kitchen
 * against a small built-in library of common, balanced meal templates.
 * Deliberately not an LLM call: no API key is configured for that, and a
 * simple honest matcher is more trustworthy than a fabricated "AI chef."
 */

export type MealTemplate = {
  id: string;
  name: string;
  /** Ingredient keywords matched case-insensitively against kitchen item names. */
  requires: string[];
  steps: string[];
  calories: number;
  proteinG: number;
  estimatedCost: number;
};

export const mealTemplates: MealTemplate[] = [
  {
    id: "chicken-rice",
    name: "High-protein chicken & rice bowl",
    requires: ["chicken", "rice"],
    steps: [
      "Season and pan-sear the chicken breast until cooked through.",
      "Cook the rice according to package instructions.",
      "Slice the chicken and serve over rice with a vegetable of choice.",
    ],
    calories: 520,
    proteinG: 45,
    estimatedCost: 4,
  },
  {
    id: "egg-toast",
    name: "Eggs on toast",
    requires: ["egg", "bread"],
    steps: [
      "Toast the bread.",
      "Fry or scramble the eggs.",
      "Serve eggs over toast, season to taste.",
    ],
    calories: 350,
    proteinG: 20,
    estimatedCost: 2,
  },
  {
    id: "beef-pasta",
    name: "Beef & pasta",
    requires: ["beef", "pasta"],
    steps: [
      "Brown the beef in a pan.",
      "Cook the pasta according to package instructions.",
      "Combine with a sauce of choice and serve.",
    ],
    calories: 650,
    proteinG: 38,
    estimatedCost: 5,
  },
  {
    id: "tuna-salad",
    name: "Tuna salad",
    requires: ["tuna", "lettuce"],
    steps: [
      "Drain the tuna and flake it into a bowl.",
      "Chop the lettuce and any other vegetables on hand.",
      "Combine and dress to taste.",
    ],
    calories: 320,
    proteinG: 30,
    estimatedCost: 3,
  },
  {
    id: "yogurt-fruit",
    name: "Greek yogurt & fruit bowl",
    requires: ["yogurt", "fruit"],
    steps: ["Spoon yogurt into a bowl.", "Top with sliced fruit.", "Add honey or nuts if available."],
    calories: 250,
    proteinG: 18,
    estimatedCost: 2,
  },
  {
    id: "salmon-veg",
    name: "Baked salmon & vegetables",
    requires: ["salmon", "vegetable"],
    steps: [
      "Preheat the oven to 200°C (400°F).",
      "Season the salmon and roast with chopped vegetables for 15–18 minutes.",
      "Serve immediately.",
    ],
    calories: 480,
    proteinG: 42,
    estimatedCost: 7,
  },
  {
    id: "chickpea-rice",
    name: "Chickpea rice bowl",
    requires: ["chickpea", "rice"],
    steps: [
      "Warm the chickpeas in a pan with spices of choice.",
      "Cook the rice.",
      "Combine and top with a fresh vegetable.",
    ],
    calories: 420,
    proteinG: 16,
    estimatedCost: 2,
  },
  {
    id: "turkey-wrap",
    name: "Turkey wrap",
    requires: ["turkey", "tortilla"],
    steps: [
      "Lay out the tortilla.",
      "Layer turkey slices with lettuce and condiments of choice.",
      "Roll tightly and slice in half.",
    ],
    calories: 380,
    proteinG: 28,
    estimatedCost: 4,
  },
  {
    id: "oats-milk",
    name: "Protein oats",
    requires: ["oats", "milk"],
    steps: [
      "Combine oats with milk in a pot or microwave-safe bowl.",
      "Cook until creamy.",
      "Stir in protein powder or nut butter if available.",
    ],
    calories: 340,
    proteinG: 22,
    estimatedCost: 1.5,
  },
  {
    id: "shrimp-noodles",
    name: "Garlic shrimp noodles",
    requires: ["shrimp", "noodle"],
    steps: [
      "Cook the noodles according to package instructions.",
      "Sauté the shrimp with garlic until pink and cooked through.",
      "Toss together with a splash of soy sauce or olive oil.",
    ],
    calories: 460,
    proteinG: 34,
    estimatedCost: 6,
  },
];

export type SuggestedMeal = MealTemplate & { matchedIngredients: string[] };

/** Matches meal templates against the user's fridge/pantry/freezer contents. */
export function suggestMeals(itemNames: string[], limit = 4): SuggestedMeal[] {
  const lowerNames = itemNames.map((n) => n.toLowerCase());

  const scored = mealTemplates
    .map((meal) => {
      const matched = meal.requires.filter((req) =>
        lowerNames.some((name) => name.includes(req)),
      );
      return { meal, matched };
    })
    .filter((s) => s.matched.length > 0)
    .sort((a, b) => {
      const aFull = a.matched.length === a.meal.requires.length ? 1 : 0;
      const bFull = b.matched.length === b.meal.requires.length ? 1 : 0;
      if (aFull !== bFull) return bFull - aFull;
      return b.matched.length - a.matched.length;
    });

  return scored.slice(0, limit).map((s) => ({ ...s.meal, matchedIngredients: s.matched }));
}
