// Add-on content and settings (verse/duaa, weather). Settings are kept per device.

// Texts and references exactly as in Widget.dc.html
export const VERSES = [
  { k: 'آية اليوم', t: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', ref: 'سورة طه · ١١٤' },
  { k: 'آية اليوم', t: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', ref: 'سورة الشرح · ٥' },
  { k: 'دعاء', t: 'رَبِّ اشْرَحْ لِي صَدْرِي', ref: 'سورة طه · ٢٥' },
  { k: 'ذكر', t: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', ref: 'متفق عليه' },
];
export const MORNING_DHIKR = {
  title: 'أذكار الصباح',
  t: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
  ref: 'رواه الترمذي',
};

// Weather comes live from the server (Open-Meteo, Riyadh) as { city, temp, cond, hi, lo, hourly: [{ time, temp }] }
export function hourLabel(iso, lang) {
  const h = Number(String(iso).slice(11, 13));
  if (Number.isNaN(h)) return '';
  const h12 = h % 12 || 12;
  if (lang === 'ar') return `${h12.toLocaleString('ar-SA')} ${h < 12 ? 'ص' : 'م'}`;
  return `${h12} ${h < 12 ? 'AM' : 'PM'}`;
}
export const isHot = (temp) => temp >= 30;

const SETTINGS_KEY = 'nuqta_addons';
const DEFAULTS = { weather: true, verse: true };

export function loadAddonSettings() {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }; } catch { return { ...DEFAULTS }; }
}
export function saveAddonSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}
