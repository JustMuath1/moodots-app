// Home layout for tablets: from nuqta-handoff-2/tokens/layout.json (v4).
// Each placed component is { id, kind, variant }; its size is SPANS[kind][variant] = [columns, rows].

export const GRID = {"columns": 12, "rowHeight": 104, "gap": 10, "flow": "row dense", "reference": "1280x800"};
export const SPANS = {"brew": {"S": [4, 2], "M": [8, 2], "L": [8, 4]}, "timeline": {"S": [4, 1], "M": [8, 1], "L": [8, 2]}, "grinder": {"S": [2, 1], "M": [4, 1]}, "brewer": {"S": [2, 1], "M": [4, 1]}, "weather": {"S": [2, 1], "M": [4, 1], "L": [4, 2]}, "verse": {"S": [2, 1], "M": [4, 1], "L": [4, 3]}, "recipes": {"S": [2, 2], "M": [4, 3], "L": [4, 5]}, "clock": {"S": [2, 1], "M": [4, 1]}, "scale": {"S": [2, 1], "M": [4, 2]}, "schedule": {"S": [2, 1], "M": [4, 1]}, "tank": {"S": [2, 1], "M": [4, 1]}, "heatmap": {"L": [8, 2]}, "hours": {"M": [4, 2]}, "consistency": {"M": [4, 2]}, "recipeShare": {"M": [4, 2]}, "waterWeekly": {"M": [4, 2]}, "gradeRating": {"M": [4, 2]}, "coldWeather": {"M": [4, 2]}, "costPerCup": {"S": [2, 1]}, "ratio": {"S": [2, 1]}, "beansUsed": {"S": [2, 1]}, "streak": {"S": [2, 1]}};
export const NAMES = { ar: {"brew": "التحضير", "timeline": "مسار التحضير", "grinder": "المطحنة", "brewer": "المُحضّر", "weather": "الطقس", "verse": "آية ودعاء", "recipes": "الوصفات", "clock": "الساعة", "scale": "الميزان", "schedule": "التحضير التالي", "tank": "الخزان", "heatmap": "خريطة الاستهلاك", "hours": "أوقات التحضير", "consistency": "ثبات الوصفة", "recipeShare": "حصة الوصفات", "waterWeekly": "الماء أسبوعياً", "gradeRating": "التقييم مقابل الطحن", "coldWeather": "البارد مقابل الطقس", "costPerCup": "تكلفة الكوب", "ratio": "النسبة", "beansUsed": "البن المستهلك", "streak": "السلسلة"}, en: {"brew": "Brew", "timeline": "Brewing path", "grinder": "Grinder", "brewer": "Brewer", "weather": "Weather", "verse": "Verse & duaa", "recipes": "Recipes", "clock": "Clock", "scale": "Scale", "schedule": "Next brew", "tank": "Water tank", "heatmap": "Brew map", "hours": "Brew times", "consistency": "Recipe consistency", "recipeShare": "Recipe share", "waterWeekly": "Water per week", "gradeRating": "Rating vs grind", "coldWeather": "Cold vs weather", "costPerCup": "Cost per cup", "ratio": "Ratio", "beansUsed": "Beans used", "streak": "Streak"} };
export const ADDONS = ["weather", "verse"];
export const SIZE_LABELS = { ar: {"S": "صغير", "M": "متوسط", "L": "كبير"}, en: { "S": "Small", "M": "Medium", "L": "Large" } };
export const DEFAULT_LAYOUT = [{"id": "brew", "kind": "brew", "variant": "L"}, {"id": "weather", "kind": "weather", "variant": "S"}, {"id": "verse", "kind": "verse", "variant": "S"}, {"id": "recipes", "kind": "recipes", "variant": "L"}, {"id": "timeline", "kind": "timeline", "variant": "M"}, {"id": "grinder", "kind": "grinder", "variant": "S"}, {"id": "brewer", "kind": "brewer", "variant": "M"}, {"id": "tank", "kind": "tank", "variant": "S"}];
export const ANALYTICS = ["heatmap", "hours", "consistency", "recipeShare", "waterWeekly", "gradeRating", "coldWeather", "costPerCup", "ratio", "beansUsed", "streak"];
export const KINDS = Object.keys(SPANS);

const KEY = 'nuqta_layout';

export function rowsOf(kind, variant) { return (SPANS[kind]?.[variant] || [4, 1])[1]; }

export function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) {
      const ok = saved.filter((w) => SPANS[w.kind] && SPANS[w.kind][w.variant]);
      // v5: the water tank joins saved layouts once (after the brewer); removing it later sticks
      if (ok.length && !localStorage.getItem('nuqta_tank_added3')) {
        localStorage.setItem('nuqta_tank_added3', '1');
        if (!ok.some((w) => w.kind === 'tank')) {
          const at = ok.findIndex((w) => w.kind === 'brewer');
          ok.splice(at < 0 ? ok.length : at + 1, 0, { id: 'tank', kind: 'tank', variant: 'S' });
        }
        // make room on the strip row like the v5 default: grinder S + brewer M + tank S
        const g = ok.find((w) => w.kind === 'grinder');
        if (g && g.variant === 'M') g.variant = 'S';
        saveLayout(ok);
      }
      if (ok.length) return ok;
    }
  } catch { /* fall back to the default */ }
  return DEFAULT_LAYOUT.map((w) => ({ ...w }));
}

export function saveLayout(layout) {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch {}
}
