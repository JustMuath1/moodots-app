import React, { useState, useRef, useCallback, useEffect } from 'react';
import { t } from '../utils/i18n';
import { isColdRecipe } from '../utils/recipes';

const FILTERS = ['all', 'hot', 'cold'];
const FILTER_LABEL = { all: 'filterAll', hot: 'hot', cold: 'cold' };
const LONG_PRESS_MS = 300;

function dropTargetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const filter = el?.closest('[data-drop-filter]');
  if (filter) return { kind: 'filter', value: filter.dataset.dropFilter };
  const row = el?.closest('[data-drop-row]');
  if (row) return { kind: 'row', value: Number(row.dataset.dropRow) };
  return null;
}

// Pointer-based drag (works with touch, unlike HTML5 drag-and-drop):
// touch = press and hold, then drag; mouse = click and drag.
// Drop on Hot/Cold to classify, on All to reset to automatic, on another recipe to reorder.
export default function RecipeList({ recipes, tags, lang, selectedIndex, onSelect, onReorder, onClassify }) {
  const [filter, setFilter] = useState('all');
  const [drag, setDrag] = useState(null); // { idx, x, y, over }
  const gesture = useRef(null);
  const suppressClick = useRef(false);

  const endGesture = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    clearTimeout(g.timer);
    window.removeEventListener('pointermove', g.onMove);
    window.removeEventListener('pointerup', g.onUp);
    window.removeEventListener('pointercancel', g.onCancel);
    window.removeEventListener('touchmove', g.onTouchMove);
    gesture.current = null;
    setDrag(null);
  }, []);

  useEffect(() => endGesture, [endGesture]);

  const startGesture = useCallback((e, idx) => {
    if (e.button !== undefined && e.button !== 0) return;
    endGesture();
    const isMouse = e.pointerType === 'mouse';
    const g = { idx, x0: e.clientX, y0: e.clientY, active: false };

    const activate = (x, y) => {
      g.active = true;
      navigator.vibrate?.(12);
      setDrag({ idx, x, y, over: null });
    };

    g.onMove = (ev) => {
      const dist = Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0);
      if (!g.active) {
        if (isMouse && dist > 5) activate(ev.clientX, ev.clientY);
        else if (!isMouse && dist > 8) endGesture(); // finger moved before the hold: it's a scroll
        return;
      }
      setDrag({ idx, x: ev.clientX, y: ev.clientY, over: dropTargetAt(ev.clientX, ev.clientY) });
    };
    g.onUp = (ev) => {
      if (g.active) {
        suppressClick.current = true;
        const target = dropTargetAt(ev.clientX, ev.clientY);
        const r = recipes[idx];
        if (target?.kind === 'filter' && r) {
          onClassify?.(r.name, target.value === 'all' ? null : target.value);
        } else if (target?.kind === 'row' && target.value !== idx) {
          onReorder?.(idx, target.value);
        }
      }
      endGesture();
    };
    g.onCancel = () => endGesture();
    // stop the page from scrolling while a recipe is being dragged
    g.onTouchMove = (ev) => { if (g.active) ev.preventDefault(); };

    if (!isMouse) g.timer = setTimeout(() => activate(g.x0, g.y0), LONG_PRESS_MS);
    window.addEventListener('pointermove', g.onMove);
    window.addEventListener('pointerup', g.onUp);
    window.addEventListener('pointercancel', g.onCancel);
    window.addEventListener('touchmove', g.onTouchMove, { passive: false });
    gesture.current = g;
  }, [recipes, onClassify, onReorder, endGesture]);

  const handleRowClick = (i) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    onSelect(i);
  };

  if (!recipes.length) return null;

  // keep each recipe's index in the full list so selection and reordering stay global
  const visible = recipes
    .map((r, i) => ({ r, i, cold: isColdRecipe(r, tags) }))
    .filter(({ cold }) => filter === 'all' || (filter === 'cold') === cold);
  const dragging = drag ? recipes[drag.idx] : null;
  const draggingCold = dragging ? isColdRecipe(dragging, tags) : false;

  return (
    <div className={`recipe-list-wrap${drag ? ' is-dragging' : ''}`}>
      <div className="recipe-filters" role="radiogroup" aria-label={t('filterRecipes', lang)}>
        {FILTERS.map((f) => {
          const over = drag?.over?.kind === 'filter' && drag.over.value === f;
          return (
            <button
              key={f}
              role="radio"
              aria-checked={filter === f}
              data-drop-filter={f}
              className={`recipe-filter${filter === f ? ' on' : ''}${drag ? ' drop-target' : ''}${over ? ' drop-over' : ''} ${f}`}
              onClick={() => setFilter(f)}
            >
              <span className={`filter-dot ${f}`} />
              {drag && f === 'all' ? t('autoTag', lang) : t(FILTER_LABEL[f], lang)}
            </button>
          );
        })}
      </div>
      <div className="drag-hint">{t('dragHint', lang)}</div>
      <div className="recipe-panel">
        {visible.length === 0 && <div className="recipe-empty">{t('noFilterMatch', lang)}</div>}
        {visible.map(({ r, i, cold }) => {
          const manual = Boolean(tags?.[r.name]);
          const over = drag?.over?.kind === 'row' && drag.over.value === i && drag.idx !== i;
          return (
            <button
              key={r.id || r.name + i}
              data-drop-row={i}
              className={`recipe-row${selectedIndex === i ? ' selected' : ''}${drag?.idx === i ? ' dragging' : ''}${over ? ' drag-over' : ''}`}
              onClick={() => handleRowClick(i)}
              onPointerDown={(e) => startGesture(e, i)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className={`recipe-dot ${selectedIndex === i ? 'on' : 'off'}`} />
              <span className="recipe-name" dir="auto">{r.name}</span>
              <span className={`recipe-tag ${cold ? 'cold' : 'hot'}${manual ? ' manual' : ''}`}>{t(cold ? 'cold' : 'hot', lang)}</span>
            </button>
          );
        })}
      </div>
      {drag && dragging && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <span className="recipe-name" dir="auto">{dragging.name}</span>
          <span className={`recipe-tag ${draggingCold ? 'cold' : 'hot'}`}>{t(draggingCold ? 'cold' : 'hot', lang)}</span>
        </div>
      )}
    </div>
  );
}
