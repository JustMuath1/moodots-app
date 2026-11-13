import React, { useEffect, useState } from 'react';

const LOCALES = {
  ar: { greg: 'ar-SA-u-ca-gregory-nu-latn', hijri: 'ar-SA-u-ca-islamic-umalqura-nu-latn' },
  en: { greg: 'en-GB', hijri: 'en-GB-u-ca-islamic-umalqura' },
};

function format(d, lang) {
  const loc = LOCALES[lang] || LOCALES.en;
  return {
    hh: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    date: d.toLocaleDateString(loc.greg, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    hijri: d.toLocaleDateString(loc.hijri, { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

export default function Clock({ lang, className = '' }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const c = format(now, lang);
  return (
    <div className={`xb-clock ${className}`}>
      <div className="xb-clock-dates">
        <span className="xb-clock-date">{c.date}</span>
        <span className="xb-clock-hijri">{c.hijri}</span>
      </div>
      <time className="xb-clock-time" dir="ltr" dateTime={now.toISOString()}>
        {c.hh}<span className="xb-blink">:</span>{c.mm}
      </time>
    </div>
  );
}
