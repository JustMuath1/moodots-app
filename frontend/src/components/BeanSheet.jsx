import React, { useEffect, useState } from 'react';

// Bean bag: name, size, price and roast date. The newest bag becomes the active one; each brew
// remembers the bag it used (cost per cup, beans used).
const TX = {
  ar: { title: 'كيس البن', name: 'الاسم', size: 'الوزن (غ)', price: 'السعر (ر.س)', roast: 'تاريخ التحميص', save: 'حفظ', cancel: 'إلغاء', active: 'الكيس الحالي', placeholder: 'مثال: إثيوبيا يرغاتشيفي' },
  en: { title: 'Bean bag', name: 'Name', size: 'Size (g)', price: 'Price (SAR)', roast: 'Roast date', save: 'Save', cancel: 'Cancel', active: 'Current bag', placeholder: 'e.g. Ethiopia Yirgacheffe' },
};

export default function BeanSheet({ lang, onClose, onSaved }) {
  const T = TX[lang] || TX.en;
  const [active, setActive] = useState(null);
  const [f, setF] = useState({ name: '', bag_g: '250', price_sar: '', roast_date: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/bags').then((r) => r.json()).then((d) => {
      if (d.active) {
        setActive(d.active);
        setF({ name: d.active.name, bag_g: String(d.active.bag_g), price_sar: d.active.price_sar ?? '', roast_date: d.active.roast_date || '' });
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!f.name.trim() || !(Number(f.bag_g) > 0)) { setErr('—'); return; }
    setBusy(true);
    const body = { name: f.name.trim(), bag_g: Number(f.bag_g), price_sar: f.price_sar === '' ? null : Number(f.price_sar), roast_date: f.roast_date || null };
    const same = active && active.name === body.name && Number(active.bag_g) === body.bag_g;
    const res = await fetch(same ? `/api/bags/${active.id}` : '/api/bags', {
      method: same ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, active: true }),
    }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (res.ok) { onSaved?.(); onClose(); } else setErr(res.error || 'error');
  };

  const field = (k, label, type = 'text', extra = {}) => (
    <label className="sheet-field">
      <span>{label}</span>
      <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} dir={type === 'text' ? 'auto' : 'ltr'} {...extra} />
    </label>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-form" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{T.title}</div>
        {active && <span className="sheet-note">{T.active}: <b dir="auto">{active.name}</b></span>}
        {field('name', T.name, 'text', { placeholder: T.placeholder, maxLength: 80 })}
        <div className="sheet-two">
          {field('bag_g', T.size, 'number', { min: 1, inputMode: 'numeric' })}
          {field('price_sar', T.price, 'number', { min: 0, step: '0.5', inputMode: 'decimal' })}
        </div>
        {field('roast_date', T.roast, 'date')}
        {err && <span className="sheet-err">{err}</span>}
        <div className="btn-row">
          <button className="nb nb-secondary" onClick={onClose}>{T.cancel}</button>
          <button className="nb nb-primary" onClick={save} disabled={busy}>{T.save}</button>
        </div>
      </div>
    </div>
  );
}
