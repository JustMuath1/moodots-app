import React from 'react';
import AnalyticsWidget from './AnalyticsWidgets';

// /analytics: all 11 widgets (analytics-spec §5.1). Row 1: heatmap. Row 2: the four small tiles.
// Then the six charts, three per row on tablets; one column on phones.
const ORDER = [
  ['heatmap', 'wide'],
  ['costPerCup', 'tile'], ['ratio', 'tile'], ['beansUsed', 'tile'], ['streak', 'tile'],
  ['hours', 'chart'], ['consistency', 'chart'], ['recipeShare', 'chart'],
  ['waterWeekly', 'chart'], ['gradeRating', 'chart'], ['coldWeather', 'chart'],
];

const TX = {
  ar: { title: 'التحليلات', sub: 'من سجل التحضير والخزان والطقس · مرّر أو المس أي نقطة لرؤية قيمتها', back: 'الرئيسية' },
  en: { title: 'Analytics', sub: 'From your brew log, tank and weather · hover or tap any dot to see its value', back: 'Home' },
};

export default function AnalyticsPage({ lang, analytics, onBack, onAddBag }) {
  const T = TX[lang] || TX.en;
  return (
    <div className="an-page">
      <div className="an-page-head">
        <div className="an-page-titles">
          <h1>{T.title}</h1>
          <p>{T.sub}</p>
        </div>
        <button className="nb nb-secondary" onClick={onBack}>{T.back}</button>
      </div>
      <div className="an-page-grid">
        {ORDER.map(([kind, cls]) => (
          <div key={kind} className={`an-slot ${cls}`}>
            <AnalyticsWidget kind={kind} a={analytics} lang={lang} onAddBag={onAddBag} />
          </div>
        ))}
      </div>
    </div>
  );
}
