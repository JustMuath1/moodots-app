import { LockMark } from './ProSheet';
import React, { useState } from 'react';
import Widget from './Widgets';
import { SPANS, NAMES, ADDONS, ANALYTICS, SIZE_LABELS, KINDS } from '../utils/layout';

// Tablet home: 12-column grid of components (LayoutEditor.dc.html). In edit mode components wiggle,
// can be removed, resized (S → M → L), moved, and added from the tray.

const TXT = {
  ar: {
    editing: 'وضع التخصيص · اضغط عنصراً لتغيير حجمه أو موضعه',
    add: '+ إضافة عنصر', reset: 'الافتراضي', done: 'تم', addTitle: 'إضافة عنصر', close: 'إغلاق',
    addon: 'إضافة', core: 'أساسي', onScreen: 'على الشاشة', addBtn: '+ إضافة',
    remove: 'إزالة', resize: 'تغيير حجم', select: 'تحديد', earlier: 'نقل للأمام', later: 'نقل للخلف',
    groupCore: 'أساسي', groupAddons: 'إضافات', groupAnalytics: 'تحليلات', analyticsBadge: 'تحليل',
    settings: 'الإضافات', enabled: 'مفعّلة', disabled: 'متوقفة', standbyNote: 'تظهر أيضاً في شاشة الاستعداد',
  },
  en: {
    editing: 'Customising · tap a component to resize or move it',
    add: '+ Add component', reset: 'Default', done: 'Done', addTitle: 'Add a component', close: 'Close',
    addon: 'Add-on', core: 'Core', onScreen: 'On screen', addBtn: '+ Add',
    remove: 'Remove', resize: 'Resize', select: 'Select', earlier: 'Move earlier', later: 'Move later',
    groupCore: 'Core', groupAddons: 'Add-ons', groupAnalytics: 'Analytics', analyticsBadge: 'Analytics',
    settings: 'Add-ons', enabled: 'On', disabled: 'Off', standbyNote: 'Also shown on the standby screen',
  },
};

export function EditBar({ lang, onAdd, onReset, onDone }) {
  const T = TXT[lang] || TXT.en;
  return (
    <div className="edit-bar">
      <span className="edit-banner">{T.editing}</span>
      <button className="edit-btn outline" onClick={onAdd}>{T.add}</button>
      <button className="edit-btn" onClick={onReset}>{T.reset}</button>
      <button className="edit-btn primary" onClick={onDone}>{T.done}</button>
    </div>
  );
}

function ResizeCorner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {[[14, 4], [14, 9], [14, 14], [9, 9], [9, 14], [4, 14]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />)}
    </svg>
  );
}

export function AddTray({ lang, layout, onAdd, onClose, addons, onAddons, caps = {}, onLocked }) {
  const T = TXT[lang] || TXT.en;
  const L = lang === 'ar' ? 'ar' : 'en';
  const label = (k) => Object.keys(SPANS[k]).map((z) => `${SIZE_LABELS[L][z]} ${SPANS[k][z][0]}×${SPANS[k][z][1]}`).join(' · ');
  return (
    <div className="tray-overlay" onClick={onClose}>
      <div className="tray-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tray-head"><span className="tray-title">{T.addTitle}</span><button className="edit-btn" onClick={onClose}>{T.close}</button></div>
        {[
          [T.groupCore, KINDS.filter((k) => !ADDONS.includes(k) && !ANALYTICS.includes(k))],
          [T.groupAddons, KINDS.filter((k) => ADDONS.includes(k))],
          [T.groupAnalytics, ANALYTICS],
        ].map(([title, kinds]) => (
          <div key={title} className="tray-group">
            <span className="tray-title sm">{title}</span>
            <div className="tray-grid">
              {kinds.map((k) => {
                const on = layout.some((w) => w.kind === k);
                const ext = ADDONS.includes(k);
                const an = ANALYTICS.includes(k);
                const locked = an && !caps.analytics;
                const disabled = !locked && (on || (ext && !addons[k]));
                return (
                  <div key={k} className={`tray-card${ext ? ' ext' : ''}${an ? ' an' : ''}`}>
                    <div className="tray-card-head"><span className="tray-name">{NAMES[L][k]}</span><span className={`tray-badge${ext ? ' ext' : ''}${an ? ' an' : ''}`}>{an ? T.analyticsBadge : ext ? T.addon : T.core}</span></div>
                    <span className="tray-sizes">{label(k)}</span>
                    <button className={`tray-add${on ? ' on' : ''}${locked ? ' locked' : ''}`} disabled={disabled} onClick={() => (locked ? onLocked?.() : onAdd(k))}>{locked ? <><LockMark /> PRO</> : on ? T.onScreen : T.addBtn}</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="tray-settings">
          <span className="tray-title sm">{T.settings}</span>
          {ADDONS.map((k) => (
            <button key={k} className="tray-toggle" onClick={() => onAddons({ ...addons, [k]: !addons[k] })} aria-pressed={addons[k]}>
              <span>{NAMES[L][k]} <span className="tray-note">· {T.standbyNote}</span></span>
              <span className={`switch${addons[k] ? ' on' : ''}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeGrid({ lang, layout, setLayout, edit, ctx, addons, caps = {} }) {
  const T = TXT[lang] || TXT.en;
  const L = lang === 'ar' ? 'ar' : 'en';
  const [sel, setSel] = useState(null);
  const shown = layout.filter((w) => (!ADDONS.includes(w.kind) || addons[w.kind]) && (caps.analytics !== false || !ANALYTICS.includes(w.kind)));

  const setVariant = (id, v) => setLayout(layout.map((w) => (w.id === id ? { ...w, variant: v } : w)));
  const move = (id, dir) => {
    const i = layout.findIndex((w) => w.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layout.length) return;
    const next = layout.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setLayout(next);
  };

  return (
    <div className={`home-grid${edit ? ' editing' : ''}`} onClick={() => edit && setSel(null)}>
      {shown.map((w, i) => {
        const opts = SPANS[w.kind];
        const [cols, rows] = opts[w.variant];
        const keys = Object.keys(opts);
        const isSel = edit && sel === w.id;
        return (
          <section
            key={w.id}
            className={`grid-item${edit && !isSel ? ` wiggle${i % 2 ? ' alt' : ''}` : ''}${isSel ? ' selected' : ''}`}
            style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}` }}
            aria-label={NAMES[L][w.kind]}
          >
            <Widget kind={w.kind} variant={w.variant} ctx={ctx} />
            {edit && (
              <>
                <button className="gi-cover" aria-label={`${T.select} ${NAMES[L][w.kind]}`} onClick={(e) => { e.stopPropagation(); setSel(w.id); }} />
                <button className="gi-remove" aria-label={`${T.remove} ${NAMES[L][w.kind]}`} onClick={(e) => { e.stopPropagation(); setLayout(layout.filter((x) => x.id !== w.id)); setSel(null); }}>×</button>
                {keys.length > 1 && (
                  <button className="gi-resize" aria-label={`${T.resize} ${NAMES[L][w.kind]}`} onClick={(e) => { e.stopPropagation(); setVariant(w.id, keys[(keys.indexOf(w.variant) + 1) % keys.length]); setSel(w.id); }}>
                    <ResizeCorner />
                  </button>
                )}
              </>
            )}
            {isSel && (
              <div className={`gi-toolbar${cols < 4 ? ' floating' : ''}`} onClick={(e) => e.stopPropagation()}>
                {cols < 4 && <span className="gi-name">{NAMES[L][w.kind]}</span>}
                <div className="gi-sizes">
                  {keys.map((z) => (
                    <button key={z} className={z === w.variant ? 'on' : ''} onClick={() => setVariant(w.id, z)}>{SIZE_LABELS[L][z]} <span dir="ltr">{opts[z][0]}×{opts[z][1]}</span></button>
                  ))}
                </div>
                <div className="gi-move">
                  <button onClick={() => move(w.id, -1)} aria-label={T.earlier}>{L === 'ar' ? '→' : '←'}</button>
                  <button onClick={() => move(w.id, 1)} aria-label={T.later}>{L === 'ar' ? '←' : '→'}</button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
