// Recipes from the server have no hot/cold field. A choice made in the dashboard (tags, shared via
// the server) wins; otherwise cold is inferred from the name (e.g. "Iced V60", "150🧊 SUPER FRUIT").
const COLD_PATTERN = /(\bice\b|\biced\b|\bcold\b|🧊|❄|بارد|مثلج|ثلج)/i;

export function isColdRecipe(recipe, tags) {
  if (!recipe) return false;
  const tag = tags?.[recipe.name];
  if (tag === 'cold' || tag === 'hot') return tag === 'cold';
  if (typeof recipe.cold === 'boolean') return recipe.cold;
  return COLD_PATTERN.test(recipe.name || '');
}
