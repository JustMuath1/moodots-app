import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogoMark } from './Logo';
import { isColdRecipe } from '../utils/recipes';

// Recipes: list, view, create / edit, send to the machine. Design: nuqta-recipes-handoff (RecipeFlow).
// Recipes made or edited here are stored by the moodots server (my_recipes.json); editing an xBloom or
// starter recipe saves a moodots version that replaces it, and "Use the original" brings it back.
const TX = {
  en: {
    sub: 'moodots · recipes', list: 'Recipes', create: 'Create recipe', newTitle: 'New recipe', editTitle: 'Edit recipe', back: 'Back',
    edit: 'Edit', del: 'Delete', restore: 'Use the original', all: 'All', hot: 'Hot', iced: 'Iced', onM: 'On machine', notM: 'Not on machine',
    pours: 'Pours', sec: 's', total: 'Total', addPour: 'Add pour', name: 'Recipe name', namePh: 'e.g. Morning V60', nameTaken: 'A recipe with this name already exists',
    kind: 'Type', dose: 'Coffee dose', grind: 'Grind size', temp: 'Water temperature', save: 'Save', saveSend: 'Save and send to machine', cancel: 'Cancel',
    send: 'Send to machine', resend: 'Send again', sendTitle: 'Send to machine', sending: 'Sending the recipe over Bluetooth…',
    sent: 'Recipe is on your machine', sentHint: 'moodots loaded it onto the machine. Start it from the dashboard or from the machine.',
    done: 'Done', err: 'The machine is not connected. Turn it on, bring it near the computer and connect.', connect: 'Connect and retry', connecting: 'Connecting…',
    errBusy: 'A brew is running. Send the recipe when it has finished.', errNoGrind: 'Recipes without grinding can’t be loaded onto the machine (it would grind anyway). Brew them from the dashboard: moodots pours them step by step.',
    errOther: 'The machine didn’t take the recipe. Try again.',
    machOn: 'Machine connected', machOff: 'Machine disconnected', dosel: 'Dose', water: 'Water', ratio: 'Ratio', tempL: 'Temperature', grindL: 'Grind', poursL: 'Pours',
    noGrind: 'Off', saved: 'Recipe saved', deleted: 'Recipe deleted', restored: 'Original recipe is back', empty: 'No recipes here yet',
    fromX: 'From your xBloom account', fromS: 'Built in', fromN: 'Made in moodots', changed: 'Changed in moodots',
    pats: { 1: 'Center', 3: 'Circle', 2: 'Spiral' }, patsLong: { 1: 'Center pour', 3: 'Circle pour', 2: 'Spiral pour' },
    g: 'g', ml: 'ml',
  },
  ar: {
    sub: 'مودوتس · الوصفات', list: 'الوصفات', create: 'إنشاء وصفة', newTitle: 'وصفة جديدة', editTitle: 'تعديل الوصفة', back: 'رجوع',
    edit: 'تعديل', del: 'حذف', restore: 'استخدام الأصل', all: 'الكل', hot: 'ساخن', iced: 'مثلّج', onM: 'على الآلة', notM: 'ليست على الآلة',
    pours: 'الصبّات', sec: 'ث', total: 'المجموع', addPour: 'إضافة صبّة', name: 'اسم الوصفة', namePh: 'مثال: V60 الصباح', nameTaken: 'توجد وصفة بهذا الاسم',
    kind: 'النوع', dose: 'كمية القهوة', grind: 'درجة الطحن', temp: 'حرارة الماء', save: 'حفظ', saveSend: 'حفظ وإرسال إلى الآلة', cancel: 'إلغاء',
    send: 'إرسال إلى الآلة', resend: 'إرسال مرة أخرى', sendTitle: 'إرسال إلى الآلة', sending: 'جارٍ إرسال الوصفة عبر البلوتوث…',
    sent: 'الوصفة على آلتك', sentHint: 'حمّلها مودوتس على الآلة. ابدأها من اللوحة أو من الآلة.',
    done: 'تم', err: 'الآلة غير متصلة. شغّلها وقرّبها من الكمبيوتر ثم اتصل.', connect: 'اتصال وإعادة المحاولة', connecting: 'جارٍ الاتصال…',
    errBusy: 'يوجد تحضير جارٍ. أرسل الوصفة بعد انتهائه.', errNoGrind: 'الوصفات بدون طحن لا يمكن تحميلها على الآلة (ستطحن رغم ذلك). حضّرها من اللوحة، ويصبّها مودوتس خطوة بخطوة.',
    errOther: 'لم تستقبل الآلة الوصفة. حاول مرة أخرى.',
    machOn: 'الآلة متصلة', machOff: 'الآلة غير متصلة', dosel: 'الكمية', water: 'الماء', ratio: 'النسبة', tempL: 'الحرارة', grindL: 'الطحن', poursL: 'الصبّات',
    noGrind: 'بلا', saved: 'تم حفظ الوصفة', deleted: 'تم حذف الوصفة', restored: 'عادت الوصفة الأصلية', empty: 'لا توجد وصفات هنا بعد',
    fromX: 'من حسابك في xBloom', fromS: 'مدمجة', fromN: 'صُنعت في مودوتس', changed: 'معدّلة في مودوتس',
    pats: { 1: 'مركز', 3: 'دائري', 2: 'حلزوني' }, patsLong: { 1: 'صبّ مركزي', 3: 'صبّ دائري', 2: 'صبّ حلزوني' },
    g: 'غ', ml: 'مل',
  },
};
const PAT_ORDER = [1, 3, 2];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const water = (r) => Math.round((r?.pours || []).reduce((a, p) => a + (Number(p.volume_ml) || 0), 0));
const firstTemp = (r) => Math.round(r?.pours?.[0]?.temp_c ?? 93);
const grindOf = (r) => (r && r.grinder_on !== false && r.grind_size > 0 ? r.grind_size : 0);

const blank = () => ({
  id: '', oldName: '', name: '', type: 'hot', dose: 15, grind: 45, temp: 93, tempTouched: true, rpm: 100, cup_type: 3, color: '#E3925A',
  pours: [{ pattern: 1, volume_ml: 45, pause_s: 30 }, { pattern: 2, volume_ml: 100, pause_s: 20 }, { pattern: 3, volume_ml: 100, pause_s: 0 }],
});

function Dots({ n, cls }) {
  return <span className={`rp-dots ${cls || ''}`} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>;
}

function Stepper({ label, val, unit, onDec, onInc, decOff, incOff }) {
  return (
    <div className="rp-step">
      <span className="rp-step-l">{label}</span>
      <button onClick={onDec} disabled={decOff} aria-label="−">−</button>
      <span className="rp-step-v"><b dir="ltr">{val}</b>{unit && <i>{unit}</i>}</span>
      <button onClick={onInc} disabled={incOff} aria-label="+">+</button>
    </div>
  );
}

export default function RecipesPage({ lang, recipes, tags, connected, onBack, onConnect, showToast }) {
  const T = TX[lang] || TX.en;
  const [view, setView] = useState('list');
  const [sel, setSel] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [send, setSend] = useState({ open: false, status: 'idle', name: '', pct: 0, error: '' });
  const pctTimer = useRef(null);

  const cold = (r) => isColdRecipe(r, tags);
  const cur = recipes.find((r) => r.name === sel);
  useEffect(() => { if (view === 'view' && !cur) setView('list'); }, [view, cur]);
  useEffect(() => () => clearInterval(pctTimer.current), []);

  const shown = useMemo(() => recipes.filter((r) => filter === 'all' || (filter === 'on' ? r.on_machine : (filter === 'iced') === cold(r))),
    [recipes, filter, tags]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- send to machine -----------------------------------------------------------------------
  const beginSend = async (name) => {
    clearInterval(pctTimer.current);
    if (!connected) { setSend({ open: true, status: 'error', name, pct: 0, error: 'not_connected' }); return; }
    setSend({ open: true, status: 'sending', name, pct: 0, error: '' });
    pctTimer.current = setInterval(() => setSend((s) => (s.status === 'sending' ? { ...s, pct: Math.min(92, s.pct + 6) } : s)), 120);
    let res;
    try {
      res = await fetch('/api/recipes/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then((r) => r.json());
    } catch { res = { ok: false, error: 'other' }; }
    clearInterval(pctTimer.current);
    setSend(res.ok ? { open: true, status: 'sent', name, pct: 100, error: '' } : { open: true, status: 'error', name, pct: 0, error: res.error || 'other' });
  };
  useEffect(() => {   // "Connect and retry": resend once the machine is connected
    if (send.open && send.status === 'connecting' && connected) beginSend(send.name);
  }, [connected, send.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const connectRetry = () => { onConnect?.(); setSend((s) => ({ ...s, status: 'connecting' })); };
  const closeSend = () => { clearInterval(pctTimer.current); setSend({ open: false, status: 'idle', name: '', pct: 0, error: '' }); };

  // ---- create / edit -------------------------------------------------------------------------
  const startCreate = () => { setDraft(blank()); setErr(''); setView('create'); };
  const startEdit = (r) => {
    setDraft({
      id: r.source === 'nuqta' ? r.id : '', oldName: r.name, name: r.name, type: cold(r) ? 'cold' : 'hot',
      dose: Math.round(r.dose_g || 15), grind: grindOf(r), temp: firstTemp(r), tempTouched: false,
      rpm: r.rpm || 100, cup_type: r.cup_type || 3, color: r.color || '#E3925A',
      pours: (r.pours || []).map((p) => ({ ...p, volume_ml: Math.round(p.volume_ml), pause_s: Math.round(p.pause_s || 0) })),
    });
    setErr(''); setView('create');
  };
  const upd = (fn) => setDraft((d) => { const x = { ...d, pours: d.pours.map((p) => ({ ...p })) }; fn(x); return x; });
  const total = draft.pours.reduce((a, p) => a + p.volume_ml, 0);
  const nameTaken = draft.name.trim() && recipes.some((r) => r.name === draft.name.trim() && r.name !== draft.oldName);

  const save = async (andSend) => {
    if (!draft.name.trim() || nameTaken || busy) return;
    setBusy(true);
    const body = {
      type: draft.type, old_name: draft.oldName,
      recipe: {
        id: draft.id || undefined, name: draft.name.trim(), dose_g: draft.dose, grind_size: draft.grind, rpm: draft.rpm, cup_type: draft.cup_type, color: draft.color,
        pours: draft.pours.map((p) => ({ ...p, temp_c: draft.tempTouched || p.temp_c == null ? draft.temp : p.temp_c, flow: p.flow ?? 3.0 })),
      },
    };
    let res;
    try {
      res = await fetch('/api/my-recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
    } catch { res = { ok: false }; }
    setBusy(false);
    if (!res.ok) { setErr(res.error === 'name_taken' ? T.nameTaken : T.errOther); return; }
    setSel(res.recipe.name); setView('view');
    if (andSend) beginSend(res.recipe.name); else showToast?.(T.saved, 'success');
  };
  const remove = async (r) => {
    const res = await fetch(`/api/my-recipes/${encodeURIComponent(r.id)}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (!res.ok) { showToast?.(T.errOther, 'error'); return; }
    showToast?.(r.overrides ? T.restored : T.deleted, 'success');
    if (!r.overrides) { setView('list'); setSel(''); }
  };

  // ---- pieces ----------------------------------------------------------------------------------
  const typeChip = (r) => <span className={`rp-type ${cold(r) ? 'iced' : 'hot'}`}>{cold(r) ? T.iced : T.hot}</span>;
  const machChip = (r) => <span className={`rp-mach${r.on_machine ? ' on' : ''}`}>{r.on_machine ? `✓ ${T.onM}` : T.notM}</span>;
  const srcText = (r) => (r.source === 'nuqta' ? (r.overrides ? T.changed : T.fromN) : r.source === 'xbloom' ? T.fromX : T.fromS);
  const title = view === 'list' ? T.list : view === 'create' ? (draft.oldName ? T.editTitle : T.newTitle) : (cur?.name || '');

  let body;
  if (view === 'view' && cur) {
    const w = water(cur);
    const g = grindOf(cur);
    body = (
      <div className="rp-two">
        <div className="rp-col">
          <div className="rp-chips">{typeChip(cur)}{machChip(cur)}<span className="rp-src">{srcText(cur)}</span></div>
          <div className="rp-stats">
            {[[T.dosel, Math.round(cur.dose_g), T.g], [T.water, w, T.ml], [T.ratio, `1:${(w / (cur.dose_g || 1)).toFixed(1)}`, ''],
              [T.tempL, `${firstTemp(cur)}°`, ''], [T.grindL, g || T.noGrind, ''], [T.poursL, (cur.pours || []).length, '']].map(([l, v, u]) => (
              <div key={l} className="rp-card rp-stat"><span>{l}</span><span><b dir="ltr">{v}</b>{u && <i>{u}</i>}</span></div>
            ))}
          </div>
          <div className="rp-actions">
            <button className="nb nb-primary rp-grow" onClick={() => beginSend(cur.name)}>{cur.on_machine ? T.resend : T.send}</button>
            <button className="nb nb-secondary" onClick={() => startEdit(cur)}>{T.edit}</button>
            {cur.source === 'nuqta' && <button className="nb rp-danger" onClick={() => remove(cur)}>{cur.overrides ? T.restore : T.del}</button>}
          </div>
        </div>
        <div className="rp-card rp-pours">
          <b className="rp-card-t">{T.pours}</b>
          {(cur.pours || []).map((p, i) => (
            <div key={i} className="rp-pour">
              <span className="rp-n" dir="ltr">{i + 1}</span>
              <div className="rp-pour-m"><span>{T.patsLong[p.pattern] || T.patsLong[2]}</span><Dots n={clamp(Math.round(p.volume_ml / 10), 1, 30)} /></div>
              <span className="rp-num"><b dir="ltr">{Math.round(p.volume_ml)}</b><i>{T.ml}</i></span>
              <span className="rp-num dim"><b dir="ltr">{Math.round(p.pause_s || 0)}</b><i>{T.sec}</i></span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (view === 'create') {
    const d = draft;
    body = (
      <div className="rp-two">
        <div className="rp-card rp-col rp-form">
          <label className="rp-field">
            <span>{T.name}</span>
            <input value={d.name} maxLength={40} placeholder={T.namePh} dir="auto" onChange={(e) => { const v = e.target.value; setErr(''); upd((x) => { x.name = v; }); }} />
            {(nameTaken || err) && <em>{nameTaken ? T.nameTaken : err}</em>}
          </label>
          <div className="rp-field">
            <span>{T.kind}</span>
            <div className="rp-seg">
              {[['hot', T.hot], ['cold', T.iced]].map(([k, n]) => <button key={k} className={d.type === k ? 'on' : ''} onClick={() => upd((x) => { x.type = k; })}>{n}</button>)}
            </div>
          </div>
          <Stepper label={T.dose} val={d.dose} unit={T.g} onDec={() => upd((x) => { x.dose = clamp(x.dose - 1, 8, 40); })} onInc={() => upd((x) => { x.dose = clamp(x.dose + 1, 8, 40); })} decOff={d.dose <= 8} incOff={d.dose >= 40} />
          <Stepper label={T.grind} val={d.grind || T.noGrind} unit="" onDec={() => upd((x) => { x.grind = x.grind <= 1 ? 0 : x.grind - 1; })} onInc={() => upd((x) => { x.grind = clamp(x.grind + 1, 1, 80); })} decOff={d.grind === 0} incOff={d.grind >= 80} />
          <Stepper label={T.temp} val={`${d.temp}°`} unit="" onDec={() => upd((x) => { x.temp = clamp(x.temp - 1, 80, 100); x.tempTouched = true; })} onInc={() => upd((x) => { x.temp = clamp(x.temp + 1, 80, 100); x.tempTouched = true; })} decOff={d.temp <= 80} incOff={d.temp >= 100} />
        </div>
        <div className="rp-col">
          <div className="rp-card rp-pours">
            <div className="rp-pours-h"><b className="rp-card-t">{T.pours}</b><span className="rp-muted">{T.total}</span><b className="rp-total" dir="ltr">{total}</b><i>{T.ml}</i><span className="rp-ratio" dir="ltr">1:{(total / d.dose).toFixed(1)}</span></div>
            {d.pours.map((p, i) => (
              <div key={i} className="rp-pour edit">
                <span className="rp-n" dir="ltr">{i + 1}</span>
                <div className="rp-pats">{PAT_ORDER.map((k) => <button key={k} className={p.pattern === k ? 'on' : ''} onClick={() => upd((x) => { x.pours[i].pattern = k; })}>{T.pats[k]}</button>)}</div>
                <span className="rp-mini rp-vol">
                  <button onClick={() => upd((x) => { x.pours[i].volume_ml = clamp(x.pours[i].volume_ml - 10, 10, 300); })} disabled={p.volume_ml <= 10} aria-label="−">−</button>
                  <span><b dir="ltr">{p.volume_ml}</b> <i>{T.ml}</i></span>
                  <button onClick={() => upd((x) => { x.pours[i].volume_ml = clamp(x.pours[i].volume_ml + 10, 10, 300); })} disabled={p.volume_ml >= 300} aria-label="+">+</button>
                </span>
                <span className="rp-mini rp-wait">
                  <button onClick={() => upd((x) => { x.pours[i].pause_s = clamp(x.pours[i].pause_s - 5, 0, 90); })} disabled={p.pause_s <= 0} aria-label="−">−</button>
                  <span className="dim"><b dir="ltr">{p.pause_s}</b> <i>{T.sec}</i></span>
                  <button onClick={() => upd((x) => { x.pours[i].pause_s = clamp(x.pours[i].pause_s + 5, 0, 90); })} disabled={p.pause_s >= 90} aria-label="+">+</button>
                </span>
                <button className="rp-x" onClick={() => upd((x) => { if (x.pours.length > 1) x.pours.splice(i, 1); })} disabled={d.pours.length <= 1} aria-label={T.del}>×</button>
              </div>
            ))}
            <button className="rp-add" onClick={() => upd((x) => { if (x.pours.length < 8) x.pours.push({ pattern: 3, volume_ml: 50, pause_s: 10 }); })} disabled={d.pours.length >= 8}>+ {T.addPour}</button>
          </div>
          <div className="rp-actions">
            <button className="nb nb-secondary rp-grow" onClick={() => save(false)} disabled={!d.name.trim() || nameTaken || busy}>{T.save}</button>
            <button className="nb nb-primary rp-grow2" onClick={() => save(true)} disabled={!d.name.trim() || nameTaken || busy}>{T.saveSend}</button>
            <button className="nb rp-ghost" onClick={() => setView(d.oldName && recipes.some((r) => r.name === d.oldName) ? 'view' : 'list')}>{T.cancel}</button>
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="rp-col">
        <div className="rp-seg rp-filters" role="tablist">
          {[['all', T.all], ['hot', T.hot], ['iced', T.iced], ['on', T.onM]].map(([k, n]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{n}</button>
          ))}
        </div>
        {shown.length === 0 ? <div className="rp-card rp-empty">{T.empty}</div> : (
          <div className="rp-grid">
            {shown.map((r) => (
              <button key={r.name} className="rp-card rp-rcard" onClick={() => { setSel(r.name); setView('view'); }}>
                <div className="rp-rtop"><span className="rp-rname" dir="auto">{r.name}</span>{typeChip(r)}</div>
                <div className="rp-rnums">
                  <span><b dir="ltr">{water(r)}</b><i>{T.ml}</i></span>
                  <span className="dim"><b dir="ltr">{Math.round(r.dose_g)}</b><i>{T.g}</i></span>
                  <span className="rp-muted" dir="ltr">{firstTemp(r)}°</span>
                </div>
                <Dots n={clamp(Math.round(water(r) / 20), 1, 24)} cls={cold(r) ? 'iced' : ''} />
                {machChip(r)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const sd = send;
  return (
    <div className="rp-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="rp-head">
        <button className="nb nb-secondary rp-back" onClick={() => (view === 'list' ? onBack() : setView(view === 'create' && draft.oldName && cur ? 'view' : 'list'))} aria-label={T.back}>
          <span aria-hidden="true">{lang === 'ar' ? '→' : '←'}</span>
        </button>
        <LogoMark size={30} />
        <div className="rp-title"><h1 dir="auto">{title}</h1><span>{view === 'view' && cur ? srcText(cur) : T.sub}</span></div>
        <span className={`rp-conn${connected ? ' on' : ''}`}><i />{connected ? T.machOn : T.machOff}</span>
        {view === 'list' && <button className="nb nb-primary" onClick={startCreate}>+ {T.create}</button>}
      </div>

      <div className="rp-body">{body}</div>

      {sd.open && createPortal(
        <div className="modal-overlay" onClick={sd.status === 'sending' ? undefined : closeSend}>
          <div className="modal rp-send" role="dialog" aria-label={T.sendTitle} onClick={(e) => e.stopPropagation()} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="rp-send-h"><b>{T.sendTitle}</b><span dir="auto">{sd.name}</span></div>
            {(sd.status === 'sending' || sd.status === 'connecting') && (
              <div className="rp-send-b">
                <span className="rp-muted">{sd.status === 'connecting' ? T.connecting : T.sending}</span>
                <div className="rp-prog" role="progressbar" aria-valuenow={sd.pct}>
                  {Array.from({ length: 24 }, (_, k) => <i key={k} className={k < Math.round(sd.pct / 100 * 24) ? 'on' : ''} />)}
                </div>
                <b className="rp-pct" dir="ltr">{sd.pct}%</b>
              </div>
            )}
            {sd.status === 'sent' && (
              <div className="rp-send-b">
                <div className="rp-ok"><span>✓</span><b>{T.sent}</b></div>
                <span className="rp-muted">{T.sentHint}</span>
                <button className="nb nb-primary" onClick={closeSend}>{T.done}</button>
              </div>
            )}
            {sd.status === 'error' && (
              <div className="rp-send-b">
                <div className="rp-errbox"><i /><span>{sd.error === 'not_connected' ? T.err : sd.error === 'brew_running' ? T.errBusy : sd.error === 'no_grind' ? T.errNoGrind : T.errOther}</span></div>
                <div className="rp-actions">
                  {sd.error === 'not_connected'
                    ? <button className="nb nb-primary rp-grow" onClick={connectRetry}>{T.connect}</button>
                    : sd.error !== 'no_grind' && sd.error !== 'brew_running' && <button className="nb nb-primary rp-grow" onClick={() => beginSend(sd.name)}>{T.resend}</button>}
                  <button className="nb nb-secondary" onClick={closeSend}>{T.cancel}</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.querySelector('.app-shell') || document.body,
      )}
    </div>
  );
}
