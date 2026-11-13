import React, { useState } from 'react';

// "Rate this brew" sheet (analytics-spec §5.3): shown after a brew finishes. 5 stars + an optional note.
// The rating feeds "rating vs grind". Rating on one screen closes the sheet on the others.
const TX = {
  ar: { title: 'قيّم هذا التحضير', note: 'ملاحظة (اختياري)', ph: 'مثلاً: مُرّ قليلاً، جرّب طحناً أخشن', save: 'حفظ', later: 'لاحقاً', stars: ['سيئ', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'] },
  en: { title: 'Rate this brew', note: 'Note (optional)', ph: 'e.g. a little bitter, try a coarser grind', save: 'Save', later: 'Later', stars: ['Poor', 'Okay', 'Good', 'Very good', 'Excellent'] },
};

export default function RatingSheet({ lang, brew, onClose }) {
  const T = TX[lang] || TX.en;
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = hover || stars;

  const save = async () => {
    if (!stars) return;
    setBusy(true);
    await fetch(`/api/brews/${encodeURIComponent(brew.id)}/rating`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: stars, note }),
    }).catch(() => {});
    setBusy(false);
    onClose(true);
  };

  return (
    <div className="modal-overlay rate-overlay" onClick={() => onClose(false)}>
      <div className="modal sheet-form rate-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T.title}>
        <div className="modal-title">{T.title}</div>
        {brew.recipe && <span className="sheet-note" dir="auto">{brew.recipe}</span>}
        <div className="rate-stars" role="radiogroup" aria-label={T.title} onPointerLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} · ${T.stars[n - 1]}`}
              className={`rate-star${n <= shown ? ' on' : ''}`} onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(n)}
              onClick={() => setStars(n)}>★</button>
          ))}
        </div>
        <span className="rate-word">{shown ? T.stars[shown - 1] : ' '}</span>
        <label className="sheet-field">
          <span>{T.note}</span>
          <textarea rows={2} maxLength={500} value={note} placeholder={T.ph} dir="auto" onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="btn-row">
          <button className="nb nb-secondary" onClick={() => onClose(false)}>{T.later}</button>
          <button className="nb nb-primary" onClick={save} disabled={!stars || busy}>{T.save}</button>
        </div>
      </div>
    </div>
  );
}
