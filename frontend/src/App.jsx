import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { t, isRTL } from './utils/i18n';
import Header from './components/Header';
import DotMatrix, { CELEBRATIONS } from './components/DotMatrix';
import GrinderStrip from './components/GrinderStrip';
import BrewerStrip from './components/BrewerStrip';
import BrewControls, { MachineChip, WaterPanel, WATER_PATTERNS } from './components/BrewControls';
import TankStrip, { tankInfo } from './components/TankStrip';
import BeanSheet from './components/BeanSheet';
import AnalyticsPage from './components/AnalyticsPage';
import NotifySheet from './components/NotifySheet';
import { pushState } from './utils/push';
import RatingSheet from './components/RatingSheet';
import Skeleton, { SkeletonRows } from './components/Skeleton';
import Clock from './components/Clock';
import RecipeList from './components/RecipeList';
import RecipeSheet from './components/RecipeSheet';
import ScheduleList from './components/ScheduleList';
import ScheduleSheet from './components/ScheduleSheet';
import CloudAccount from './components/CloudAccount';
import ConnectionModal from './components/ConnectionModal';
import ToastContainer from './components/ToastContainer';
import FaultBanner, { isMachineFault } from './components/FaultBanner';
import { installAudioUnlock, playReadyChime, playClick } from './utils/sound';
import { requestNotifyPermission, notifyReady } from './utils/notify';
import { loadTheme, applyTheme } from './utils/themes';
import PourTimeline from './components/PourTimeline';
import StepTracker from './components/StepTracker';
import ThemeBoard from './components/ThemeBoard';
import HomeGrid, { EditBar, AddTray } from './components/HomeGrid';
import { SPANS, loadLayout, saveLayout, DEFAULT_LAYOUT } from './utils/layout';
import { loadAddonSettings, saveAddonSettings, VERSES } from './services/addons';
import Background from './components/Background';
import Standby, { STANDBY_MODES, THEME_STANDBY } from './components/Standby';
import { isColdRecipe } from './utils/recipes';
import { useAppHeight, useFullscreen } from './hooks/useScreenFit';

const SOUND_KEY = 'xbloom_sound';
function loadSoundPref() { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } }

const SCALE_TARGET_KEY = 'nuqta_scale_target';
function loadScaleTarget() {
  try { const v = Number(localStorage.getItem(SCALE_TARGET_KEY)); return v >= 10 && v <= 990 ? v : 250; } catch { return 250; }
}
const CELEBRATE_MS = 8000;

const STANDBY_MODE_KEY = 'nuqta_standby_mode';
const STANDBY_IDLE_MS = 60_000;
const STANDBY_SCHEDULE_LEAD_MS = 2 * 60_000;
function loadStandbyMode() {
  try {
    const m = localStorage.getItem(STANDBY_MODE_KEY);
    if (m === 'saudi') return 'dalla'; // older name
    return STANDBY_MODES.includes(m) ? m : 'cup';
  } catch { return 'cup'; }
}

// True when an enabled schedule fires within `leadMs` (days use server.py's Mon=0 … Sun=6)
function scheduleDueSoon(schedules, leadMs, now = new Date()) {
  return schedules.some((s) => {
    if (s.enabled === false || !s.time) return false;
    const [h, m] = s.time.split(':').map(Number);
    for (const dayOffset of [0, 1]) {
      const target = new Date(now);
      target.setDate(now.getDate() + dayOffset);
      target.setHours(h, m, 0, 0);
      const lead = target - now;
      const weekday = (target.getDay() + 6) % 7;
      if (lead >= 0 && lead <= leadMs && (s.days || []).includes(weekday)) return true;
    }
    return false;
  });
}

// Activity codes from server.py ACTIVITY_NAMES
const ACT_GRINDING = 34;
const ACT_POURING = [30, 35, 16];
const TRANSFER_MS = 2400;     // grinder → brewer sweep after the grind ends
const GRIND_EXPECT_MS = 18000; // typical grind time, for the hopper/dose animation
const GRIND_ONLY_FULL_S = 18;   // grind-only: dosing cup looks full after this long
const GRIND_ONLY_MAX_S = 45;    // grind-only: safety stop (the machine grinds until told to stop)

const RECIPE_ORDER_KEY = 'xbloom_recipe_order';
function loadSavedOrder() { try { return JSON.parse(localStorage.getItem(RECIPE_ORDER_KEY)) || null; } catch { return null; } }
function saveOrder(recipes) { try { localStorage.setItem(RECIPE_ORDER_KEY, JSON.stringify(recipes.map((r) => r.id || r.name))); } catch {} }
function applyOrder(recipes, savedIds) {
  if (!savedIds?.length) return recipes;
  const map = new Map(recipes.map((r) => [r.id || r.name, r]));
  const ordered = [];
  for (const id of savedIds) { const r = map.get(id); if (r) { ordered.push(r); map.delete(id); } }
  for (const r of map.values()) ordered.push(r);
  return ordered;
}

export default function App() {
  const [lang, setLang] = useState('en');
  const [machineState, setMachineState] = useState({
    link: 'disconnected', machine_name: '', weight_g: 0, water_ml: 0,
    activity: '', activity_code: 0, sleeping: false, fault: '', brew_active: false,
  });
  const [cloudStatus, setCloudStatus] = useState({ signed_in: false, email: '' });
  const [recipes, setRecipes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(0);
  const [showRecipeSheet, setShowRecipeSheet] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [showConnection, setShowConnection] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [showBeans, setShowBeans] = useState(false);
  const [liveCurve, setLiveCurve] = useState([]);   // [[seconds, ml], …] for the brew in progress
  const curveStartRef = useRef(0);
  const [curves, setCurves] = useState({ best: null, last: null });
  const [tlView, setTlView] = useState(() => { try { return localStorage.getItem('nuqta_tl_view') || 'path'; } catch { return 'path'; } });
  const pickTlView = useCallback((v) => { setTlView(v); try { localStorage.setItem('nuqta_tl_view', v); } catch {} }, []);
  const [tankBack, setTankBack] = useState(null);
  const [showNotify, setShowNotify] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [caps, setCaps] = useState({ analytics: true, push: true, cloud: true, alexa: true }); // { prev, cap } after the tank is put back
  const [rateBrew, setRateBrew] = useState(null); // { id, recipe } after a finished brew
  // pages: home (/) and analytics (/analytics); the browser's back button works
  const [page, setPage] = useState(() => (window.location.pathname.startsWith('/analytics') ? 'analytics' : 'home'));
  useEffect(() => {
    const onPop = () => setPage(window.location.pathname.startsWith('/analytics') ? 'analytics' : 'home');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const goPage = useCallback((p) => {
    const path = p === 'analytics' ? '/analytics' : '/';
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setPage(p);
  }, []);
  const [tab, setTab] = useState('recipes');
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const savedOrderRef = useRef(loadSavedOrder());

  const [grinder, setGrinder] = useState({ size: 0, rpm: 0 });
  const [brewer, setBrewer] = useState({ temp: 0, volume: 0, flow: 0 });
  const [frame, setFrame] = useState(0);
  const [soundOn, setSoundOn] = useState(loadSoundPref);
  const [dismissedFault, setDismissedFault] = useState('');
  const [devices, setDevices] = useState({ scanning: false, list: [], error: '' });
  const [received, setReceived] = useState({ state: false, recipes: false });
  const [minBootDone, setMinBootDone] = useState(false);
  const [standby, setStandby] = useState(false);
  const [scale, setScale] = useState(null);
  const [grindMode, setGrindMode] = useState(null); // grind only: { running, secs, size, rpm }
  const [waterMode, setWaterMode] = useState(null); // water only: { temp, vol, pat, running, poured, base, secs }
  const [celebrate, setCelebrate] = useState(null);
  const [recipeTags, setRecipeTags] = useState({});
  const celebrateTimer = useRef(null);
  const [standbyMode, setStandbyMode] = useState(loadStandbyMode);
  const [theme, setTheme] = useState(loadTheme);
  const [showThemes, setShowThemes] = useState(false);
  const [weather, setWeather] = useState(null);
  const [standbyItems, setStandbyItems] = useState(() => { try { return JSON.parse(localStorage.getItem('nuqta_standby_items')) || {}; } catch { return {}; } });
  // v4 home: customisable layout (tablet) and add-ons
  const [layout, setLayoutState] = useState(loadLayout);
  const setLayout = useCallback((next) => { setLayoutState(next); saveLayout(next); }, []);
  const [editing, setEditing] = useState(false);
  const [showTray, setShowTray] = useState(false);
  const [addons, setAddonsState] = useState(loadAddonSettings);
  const setAddons = useCallback((next) => { setAddonsState(next); saveAddonSettings(next); }, []);
  const [verseIndex, setVerseIndex] = useState(() => Math.floor(Date.now() / 3600000) % VERSES.length);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => { const iv = setInterval(() => setClockNow(new Date()), 15000); return () => clearInterval(iv); }, []);
  useEffect(() => { applyTheme(theme); }, [theme]);
  // Saudi, Riyadh and Dammam each bring their own standby scene; other themes go back to the cup
  const changeTheme = useCallback((k) => {
    setTheme(k);
    const scene = THEME_STANDBY[k];
    setStandbyMode((m) => {
      const next = scene || (Object.values(THEME_STANDBY).includes(m) ? 'cup' : m);
      try { localStorage.setItem(STANDBY_MODE_KEY, next); } catch {}
      return next;
    });
  }, []);
  const lastActivityRef = useRef(Date.now());
  const booted = received.state && received.recipes && minBootDone;
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const prevActivityRef = useRef(null);
  const pausedRef = useRef(false);
  const stopRequestedAt = useRef(0);
  const langRef = useRef(lang);
  const loadAnalyticsRef = useRef(null);
  langRef.current = lang;

  const buildRef = useRef(null);
  const grindRef = useRef({ start: 0, end: 0 });
  const elapsedRef = useRef({ base: 0, at: 0 });
  const waitRef = useRef({ left: 0, at: 0 });

  // Before every brew (here, another screen, a schedule or Alexa): zero the scale, timer and readouts
  const resetForBrew = useCallback(() => {
    setLiveCurve([]);
    curveStartRef.current = Date.now();
    clearTimeout(celebrateTimer.current);
    setCelebrate(null);
    setFrame(0);
    setGrinder((g) => ({ ...g, rpm: 0 }));
    setBrewer({ temp: 0, volume: 0, flow: 0 });
    grindRef.current = { start: 0, end: 0 };
    elapsedRef.current = { base: 0, at: Date.now() };
    waitRef.current = { left: 0, at: 0 };
    setMachineState((m) => ({
      ...m, weight_g: 0, water_ml: 0, waiting: false, wait_left: 0, brew_elapsed: 0,
      activity: m.activity === 'Done' ? 'Ready' : m.activity,
    }));
    lastActivityRef.current = Date.now();
    setStandby(false);
  }, []);

  const showToast = useCallback((msg, level = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, level }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    }, 3000);
  }, []);

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'state' || msg.type === 'recipes') {
      setReceived((r) => (r[msg.type] ? r : { ...r, [msg.type]: true }));
    }
    if (msg.type === 'state') {
      setMachineState((prev) => ({ ...prev, ...msg.data }));
      const d = msg.data || {};
      if (d.brew_elapsed !== undefined) elapsedRef.current = { base: d.brew_elapsed, at: Date.now() };
      if (d.wait_left !== undefined) waitRef.current = { left: d.wait_left, at: Date.now() };
      const act = d.activity;
      const prevAct = prevActivityRef.current;
      prevActivityRef.current = act;
      // prevAct === null means first state after (re)connect: don't replay an old event
      if (prevAct !== null && act !== prevAct && act === 'Abandoned' && Date.now() - stopRequestedAt.current > 10000) {
        showToast(t('brewStopped', langRef.current), 'info');
      }
    } else if (msg.type === 'hello') {
      // a new dashboard build is live (after a restart or rebuild): reload to pick it up
      const b = msg.build;
      if (buildRef.current === null) buildRef.current = b;
      else if (b && b !== buildRef.current) window.location.reload();
    } else if (msg.type === 'weather') {
      setWeather(msg.data && msg.data.city ? msg.data : null);
    } else if (msg.type === 'server_restarting') {
      showToast(t('restarting', langRef.current), 'info');
    } else if (msg.type === 'brew_logged') {
      setTimeout(() => loadAnalyticsRef.current?.(), 500);
      // ★ sheet a few seconds after the celebration starts (finished recipe brews only)
      if (msg.data?.completed && msg.data?.id) {
        const b = { id: msg.data.id, recipe: msg.data.recipe };
        setTimeout(() => setRateBrew(b), 4000);
      }
    } else if (msg.type === 'tank_back') {
      setTankBack(msg.data || null);
      showToast(t('tankBackToast', langRef.current), 'info');
    } else if (msg.type === 'brew_rated') {
      setRateBrew((b) => (b && b.id === msg.data?.id ? null : b));
      setTimeout(() => loadAnalyticsRef.current?.(), 300);
    } else if (msg.type === 'brew_reset') {
      resetForBrew();
    } else if (msg.type === 'brew_finished') {
      // sent once by the server when the machine finishes the recipe (not only when the target weight is reached)
      const L = langRef.current;
      const name = msg.data?.recipe || '';
      showToast(t('coffeeReady', L), 'success');
      setCelebrate(CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]);
      clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setCelebrate(null), CELEBRATE_MS);
      if (soundOnRef.current) playReadyChime();
      notifyReady(t('readyNotifTitle', L), name ? `${name} ${t('readyNotifBody', L)}` : t('coffeeReady', L));
      setStandby(false);
      lastActivityRef.current = Date.now();
    } else if (msg.type === 'devices') {
      const d = msg.data || {};
      setDevices((prev) => ({
        scanning: false,
        // keep the last good list if a rescan is refused while the machine is connecting
        list: d.ok ? d.devices || [] : prev.list,
        error: d.ok ? '' : d.error || '',
      }));
    } else if (msg.type === 'error') {
      showToast(`${t('machineError', langRef.current)}: ${msg.msg}`, 'error');
    } else if (msg.type === 'recipes') {
      const ordered = applyOrder(msg.data || [], savedOrderRef.current);
      setRecipes(ordered);
    } else if (msg.type === 'recipe_tags') {
      setRecipeTags(msg.data || {});
    } else if (msg.type === 'schedules') {
      setSchedules(msg.data || []);
    } else if (msg.type === 'cloud_status') {
      setCloudStatus(msg.data || { signed_in: false, email: '' });
    } else if (msg.type === 'toast') {
      showToast(msg.msg, msg.level || 'info');
    } else if (msg.type === 'grinder') {
      setGrinder((prev) => ({ ...prev, ...msg.data }));
    } else if (msg.type === 'brewer') {
      setBrewer((prev) => ({ ...prev, ...msg.data }));
    }
  }, [showToast, resetForBrew]);

  const { send } = useWebSocket(handleMessage);
  // report this screen's size and control sizes to the server log (layout debugging on real devices)
  useEffect(() => {
    const report = () => {
      const btns = [...document.querySelectorAll('.brew-controls .ctl-btn')].map((b) => {
        const r = b.getBoundingClientRect();
        return `${b.className.split(' ').filter((c) => c.startsWith('ctl-') && c !== 'ctl-btn').join('.')}=${Math.round(r.width)}x${Math.round(r.height)}`;
      });
      send({ action: 'client_info', w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio, ua: navigator.userAgent, btns });
    };
    const tm = setTimeout(report, 4000);
    window.addEventListener('orientationchange', () => setTimeout(report, 1500));
    return () => clearTimeout(tm);
  }, [send]);
  useAppHeight();
  const fullscreen = useFullscreen();

  useEffect(() => {
    fetch('/api/schedules').then((r) => r.json()).then(setSchedules).catch(() => {});
  }, []);

  useEffect(() => {
    const tm = setTimeout(() => setMinBootDone(true), 900);
    return () => clearTimeout(tm);
  }, []);

  useEffect(() => {
    installAudioUnlock();
    const onTap = (e) => {
      if (soundOnRef.current && e.target.closest?.('button:not(:disabled), [role="button"]')) playClick();
    };
    window.addEventListener('pointerdown', onTap);
    return () => window.removeEventListener('pointerdown', onTap);
  }, []);

  useEffect(() => {
    if (!machineState.brew_active) return;
    setFrame(0);
    const iv = setInterval(() => { if (!pausedRef.current) setFrame((f) => f + 1); }, 200);
    return () => clearInterval(iv);
  }, [machineState.brew_active]);

  useEffect(() => {
    if (!machineState.fault) setDismissedFault('');
  }, [machineState.fault]);

  const scanDevices = useCallback(() => {
    setDevices((d) => ({ ...d, scanning: true, error: '' }));
    send({ action: 'scan_devices' });
  }, [send]);

  const selectMachine = useCallback((name) => {
    send({ action: 'connect', machine: name });
    if ((machineState.machine_name || '').toUpperCase() !== name.toUpperCase()) {
      showToast(`${t('switchingMachine', lang)} ${name}`, 'info');
    }
  }, [send, showToast, machineState.machine_name, lang]);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch {}
      if (next) playReadyChime();
      return next;
    });
  }, []);

  const sendAction = useCallback((action, extra) => send({ action, ...extra }), [send]);
  const refreshPush = useCallback(() => { pushState().then((s) => setPushOn(Boolean(s.on))).catch(() => {}); }, []);
  useEffect(() => { fetch('/api/capabilities').then((r) => r.json()).then((c) => c && setCaps(c)).catch(() => {}); }, []);
  useEffect(() => { refreshPush(); }, [refreshPush]);

  // Analytics: computed on the server; refreshed after each logged brew and every 10 minutes
  const loadAnalytics = useCallback(() => {
    fetch('/api/analytics').then((r) => r.json()).then((d) => { if (d && d.heatmap) setAnalytics(d); }).catch(() => {});
  }, []);
  loadAnalyticsRef.current = loadAnalytics;
  useEffect(() => {
    loadAnalytics();
    const iv = setInterval(loadAnalytics, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadAnalytics]);
  const restartServer = useCallback(async () => {
    try {
      const res = await fetch('/api/restart', { method: 'POST' });
      const data = await res.json().catch(() => ({ ok: true }));
      if (!data.ok) showToast(data.error || 'Restart failed', 'error');
    } catch { /* the server went down mid-request: it's restarting */ }
  }, [showToast]);
  const toggleLang = useCallback(() => setLang((l) => (l === 'en' ? 'ar' : 'en')), []);

  const isConnected = machineState.link === 'connected';
  const isBrewing = machineState.brew_active;
  // a recipe "wait" between pours is the machine working, not a pause
  const isWaiting = isBrewing && Boolean(machineState.waiting);
  const isPaused = isBrewing && !isWaiting && machineState.activity === 'Paused';
  pausedRef.current = isPaused;
  const isGrinding = isBrewing && !isPaused && (machineState.activity_code === ACT_GRINDING || grinder.rpm > 0);
  const weight = machineState.weight_g || 0;
  const waterMl = machineState.water_ml || 0;
  const pourStarted = waterMl > 0.5 || weight > 1.5;
  const now = Date.now();
  if (isGrinding && (!grindRef.current.start || grindRef.current.end)) grindRef.current = { start: now, end: 0 };
  if (!isGrinding && grindRef.current.start && !grindRef.current.end) grindRef.current.end = now;
  const isTransfer = isBrewing && !isPaused && !isGrinding && !pourStarted
    && grindRef.current.end > 0 && now - grindRef.current.end < TRANSFER_MS;
  const isHeating = isBrewing && !isPaused && !isGrinding && !isTransfer && !isWaiting && !pourStarted;
  const isPouring = isBrewing && !isPaused && !isWaiting && !isGrinding && !isTransfer && !isHeating
    && (ACT_POURING.includes(machineState.activity_code) || brewer.flow > 0 || pourStarted);
  const grindProgress = isGrinding ? Math.min(0.95, (now - grindRef.current.start) / GRIND_EXPECT_MS) : 1;
  const transferProgress = isTransfer ? (now - grindRef.current.end) / TRANSFER_MS : 0;
  const waitLeft = isWaiting && waitRef.current.left > 0
    ? Math.max(0, Math.ceil(waitRef.current.left - (now - waitRef.current.at) / 1000)) : 0;
  const activeFault = isConnected && isMachineFault(machineState.fault) && machineState.fault !== dismissedFault
    ? machineState.fault : '';

  const togglePause = useCallback(() => {
    sendAction(isPaused ? 'resume' : 'pause');
    showToast(t(isPaused ? 'brewResumed' : 'brewPaused', lang), 'info');
  }, [isPaused, sendAction, showToast, lang]);

  const stopBrew = useCallback(() => {
    sendAction('stop');
    stopRequestedAt.current = Date.now();
    showToast(t('brewStopped', lang), 'info');
  }, [sendAction, showToast, lang]);

  // Scale-only mode: the machine's scale with a dashboard-side timer
  const enterScale = useCallback(() => {
    if (!isConnected || isBrewing) return;
    sendAction('scale_enter');
    setScale({ running: false, secs: 0, target: loadScaleTarget() });
    setFrame(0);
  }, [isConnected, isBrewing, sendAction]);
  const exitScale = useCallback(() => {
    sendAction('quit_module', { module: 'scale' });
    setScale(null);
    setFrame(0);
  }, [sendAction]);
  const adjustScaleTarget = useCallback((delta) => {
    setScale((s) => {
      if (!s) return s;
      const target = Math.min(990, Math.max(10, s.target + delta));
      try { localStorage.setItem(SCALE_TARGET_KEY, String(target)); } catch {}
      return { ...s, target };
    });
  }, []);
  const toggleScaleTimer = useCallback(() => setScale((s) => (s ? { ...s, running: !s.running } : s)), []);
  const tareScale = useCallback(() => {
    sendAction('tare');
    setScale((s) => (s ? { ...s, secs: 0 } : s));
  }, [sendAction]);

  useEffect(() => {
    if (scale && (!isConnected || isBrewing)) setScale(null);
  }, [scale, isConnected, isBrewing]);

  // Alexa's "xbloom" plug brews the recipe selected here
  const selectedName = recipes[selectedRecipe]?.name;
  useEffect(() => {
    if (selectedName && isConnected) sendAction('select_recipe', { name: selectedName });
  }, [selectedName, isConnected, sendAction]);

  // Grind only: the machine's grinder module, started and stopped from here
  const enterGrind = useCallback(() => {
    if (!isConnected || isBrewing || scale) return;
    const r = recipes[selectedRecipe];
    const size = r?.grind_size > 0 ? r.grind_size : 48;
    const rpm = r?.rpm || 100;
    sendAction('grinder_enter', { size, rpm });
    setTimeout(() => sendAction('grinder_start', { size, rpm }), 500);
    setGrindMode({ running: true, secs: 0, size, rpm });
    setCelebrate(null);
    setFrame(0);
  }, [isConnected, isBrewing, scale, recipes, selectedRecipe, sendAction]);
  const toggleGrind = useCallback(() => {
    setGrindMode((g) => {
      if (!g) return g;
      if (g.running) { sendAction('grinder_stop'); return { ...g, running: false }; }
      sendAction('grinder_start', { size: g.size, rpm: g.rpm });
      setFrame(0);
      return { ...g, running: true, secs: 0 };
    });
  }, [sendAction]);
  const exitGrind = useCallback(() => {
    sendAction('quit_module', { module: 'grinder' });   // server stops the grinder then leaves the screen
    setGrindMode(null);
    setFrame(0);
  }, [sendAction]);
  const grindRunning = Boolean(grindMode?.running);
  useEffect(() => {
    if (!grindRunning) return undefined;
    const iv = setInterval(() => {
      setFrame((f) => f + 1);
      setGrindMode((g) => {
        if (!g) return g;
        const secs = g.secs + 0.2;
        if (secs >= GRIND_ONLY_MAX_S) { sendAction('grinder_stop'); return { ...g, secs, running: false }; }
        return { ...g, secs };
      });
    }, 200);
    return () => clearInterval(iv);
  }, [grindRunning, sendAction]);
  useEffect(() => {
    if (grindMode && (!isConnected || isBrewing)) setGrindMode(null);
  }, [grindMode, isConnected, isBrewing]);

  // Water only: the machine's brewer module (temperature, volume, pour pattern), started and stopped here
  const patApi = (k) => (WATER_PATTERNS.find(([n]) => n === k) || [])[1] || 2;
  const enterWater = useCallback(() => {
    if (!isConnected || isBrewing || scale || grindMode) return;
    const w = { temp: 93, vol: 200, pat: 'spiral', running: false, poured: 0, base: 0, secs: 0 };
    sendAction('brewer_enter', { pattern: patApi(w.pat), temp_c: w.temp });
    setWaterMode(w);
    setCelebrate(null);
    setFrame(0);
  }, [isConnected, isBrewing, scale, grindMode, sendAction]);
  const changeWater = useCallback((patch) => {
    setWaterMode((w) => {
      if (!w || w.running) return w;
      const next = { ...w, ...patch };
      if (patch.temp !== undefined || patch.pat !== undefined) sendAction('brewer_enter', { pattern: patApi(next.pat), temp_c: next.temp });
      return next;
    });
  }, [sendAction]);
  const toggleWater = useCallback(() => {
    setWaterMode((w) => {
      if (!w) return w;
      if (w.running) { sendAction('brewer_stop'); return { ...w, running: false }; }
      const again = w.poured >= w.vol - 1;
      const done = again ? 0 : w.poured;
      const left = Math.max(30, Math.round(w.vol - done));
      sendAction('brewer_start', { volume_ml: left, temp_c: w.temp, pattern: patApi(w.pat), flow: 3.0 });
      setFrame(0);
      return { ...w, running: true, heating: true, base: done, poured: done, secs: again ? 0 : w.secs, startWater: null };
    });
  }, [sendAction]);
  const exitWater = useCallback(() => {
    sendAction('quit_module', { module: 'brewer' });   // server stops the pour then leaves the screen
    setWaterMode(null);
    setFrame(0);
  }, [waterMode, sendAction]);
  const waterRunning = Boolean(waterMode?.running);
  // follow the machine's water counter (ml for the current pour) while pouring
  const liveWater = machineState.water_ml || 0;
  useEffect(() => {
    if (!waterRunning) return;
    setWaterMode((w) => {
      if (!w || !w.running) return w;
      const start = w.startWater === null ? liveWater : w.startWater;
      const thisPour = liveWater >= start ? liveWater - start : liveWater;
      const poured = Math.min(w.vol, w.base + thisPour);
      const heating = thisPour < 0.5;
      const finished = poured >= w.vol - 1;
      return { ...w, startWater: start, poured: finished ? w.vol : poured, heating, running: !finished };
    });
  }, [liveWater, waterRunning]);
  useEffect(() => {
    if (!waterRunning) return undefined;
    const iv = setInterval(() => {
      setFrame((f) => f + 1);
      setWaterMode((w) => (w && w.running && !w.heating ? { ...w, secs: w.secs + 0.2 } : w));
    }, 200);
    return () => clearInterval(iv);
  }, [waterRunning]);
  useEffect(() => {
    if (waterMode && (!isConnected || isBrewing)) setWaterMode(null);
  }, [waterMode, isConnected, isBrewing]);
  const refillTank = useCallback(() => sendAction('tank_refill'), [sendAction]);

  const scaleRunning = Boolean(scale?.running);
  useEffect(() => {
    if (!scaleRunning) return;
    const iv = setInterval(() => {
      setScale((s) => (s ? { ...s, secs: s.secs + 0.2 } : s));
      setFrame((f) => f + 1);
    }, 200);
    return () => clearInterval(iv);
  }, [scaleRunning]);

  const isLinking = machineState.link === 'scanning' || machineState.link === 'connecting';
  const isDone = !isBrewing && machineState.activity === 'Done';
  // while brewing, show the water poured: the same number the machine shows on its own display
  const showPoured = (isBrewing || isDone) && !scale && !grindMode && !waterMode && waterMl > 0.5;
  // a residual scale reading at rest reads as 0 on the hero; live modes still show the real value
  const activeNum = isBrewing || isDone || scale || grindMode || waterMode;
  const heroNum = waterMode ? waterMode.poured : showPoured ? waterMl : activeNum ? weight : 0;
  // the recipe the machine is running (a schedule may brew a different one than the selected row)
  const activeRecipe = ((isBrewing || isDone) && recipes.find((r) => r.name === machineState.recipe_name)) || recipes[selectedRecipe];
  const pours = activeRecipe?.pours || [];
  // brew curve: sample the machine's water counter while brewing (seconds since the brew began)
  const curveWater = machineState.water_ml || 0;
  useEffect(() => {
    if (!isBrewing) return;
    if (!curveStartRef.current) curveStartRef.current = Date.now();
    const t = Math.round((Date.now() - curveStartRef.current) / 100) / 10;
    setLiveCurve((c) => {
      const last = c[c.length - 1];
      if (last && t - last[0] < 1 && Math.abs(curveWater - last[1]) < 2) return c;
      return [...c, [t, Math.round(curveWater * 10) / 10]];
    });
  }, [curveWater, isBrewing]);
  useEffect(() => { if (!isBrewing && !isDone) curveStartRef.current = 0; }, [isBrewing, isDone]);
  const curveRecipe = activeRecipe?.name;
  const curvesTick = analytics?.totalBrews;
  useEffect(() => {
    if (!curveRecipe) return;
    fetch(`/api/brews/curves?recipe=${encodeURIComponent(curveRecipe)}`).then((r) => r.json()).then(setCurves).catch(() => {});
  }, [curveRecipe, curvesTick]);
  let pourIdx = 0;
  for (let i = 0, cum = 0; i < pours.length; i++) {
    cum += pours[i].volume_ml || 0;
    pourIdx = i;
    if (waterMl < cum - 0.5) break;
  }
  const pourLabel = pourIdx === 0 && pours.length > 1 ? t('stepBloom', lang) : `${t('stepPour', lang)} ${pourIdx + 1}`;
  const waitLabel = t(waterMl <= (pours[0]?.volume_ml || 0) + 3 ? 'bloomWait' : 'drawdownWait', lang);
  // target for the step in progress: beans while grinding, that pour's water mark while pouring
  const cumTo = (i) => pours.slice(0, i + 1).reduce((sum, p) => sum + (p.volume_ml || 0), 0);
  const stepTarget = Math.round(cumTo(pourIdx));
  const nextTarget = Math.round(cumTo(Math.min(pours.length - 1, waterMl >= stepTarget - 0.5 ? pourIdx + 1 : pourIdx)));
  const doseG = activeRecipe?.dose_g || 15;
  const firstTemp = pours[0]?.temp_c || 93;
  const noGrind = !(activeRecipe?.grinder_on !== false && activeRecipe?.grind_size > 0);
  const trackerStep = isGrinding || isTransfer ? 0 : isHeating ? 1
    : isWaiting ? (waterMl <= (pours[0]?.volume_ml || 0) + 3 ? 2 : 3)
    : isBrewing ? (pourIdx === 0 && pours.length > 1 ? 2 : 3) : -1;
  const waitSuffix = waitLeft > 0 ? ` · ${waitLeft} ${t('secShort', lang)}` : '';
  const scaleWeight = Math.max(0, machineState.weight_g || 0);
  const overTarget = Boolean(scale) && scaleWeight > scale.target;
  const patName = waterMode ? t(`pat_${waterMode.pat}`, lang) : '';
  const phase = waterMode ? (waterMode.running ? (waterMode.heating ? `${t('heatingTo', lang)} ${waterMode.temp === 20 ? t('roomTemp', lang) : waterMode.temp + '°'}` : `${t('pouringWater', lang)} · ${patName}`)
      : waterMode.poured >= waterMode.vol - 1 ? t('pourDone', lang) : t('waterOnly', lang))
    : grindMode ? t(grindMode.running ? 'grindOnlyRunning' : 'grindDone', lang)
    : scale ? t(overTarget ? 'overTarget' : scaleRunning ? 'scaleTimerRunning' : 'scaleMode', lang)
    : isLinking ? t('connecting', lang)
    : !isConnected ? t('disconnected', lang)
    : !isBrewing ? (isDone ? t('coffeeReady', lang) : t('ready', lang))
    : isPaused ? t('paused', lang)
    : isGrinding ? t('grinding', lang)
    : isTransfer ? t('transferGrounds', lang)
    : isHeating ? `${t('heatingWater', lang)}…`
    : isWaiting ? waitLabel + waitSuffix
    : pours.length ? pourLabel : t('pouring', lang);
  const phaseClass = overTarget ? 'over' : isWaiting || isHeating || waterMode?.heating && waterRunning ? 'waiting'
    : (isBrewing && !isPaused) || scaleRunning || grindRunning || waterRunning ? 'active' : isDone ? 'done' : 'idle';
  const dotMode = waterMode ? (waterRunning ? (waterMode.heating ? 'heat' : 'pour') : waterMode.poured > 0.5 ? 'pour' : 'idle')
    : grindMode ? 'grind' : isBrewing
    ? (isPaused ? 'paused' : isGrinding ? 'grind' : isTransfer ? 'transfer' : isHeating ? 'heat' : isWaiting ? 'wait' : 'pour')
    : isDone ? 'done' : 'idle';
  const selectedCold = isColdRecipe(recipes[selectedRecipe], recipeTags);
  const pourRate = scale && scale.secs > 0 ? (Math.max(0, machineState.weight_g || 0) / scale.secs).toFixed(1) : '0.0';
  // Skeletons: until the first state + recipes arrive, and during the short BLE connect step
  const loading = !booted || machineState.link === 'connecting';
  const targetMl = ((isBrewing || isDone) && machineState.target_ml) || pours.reduce((sum, p) => sum + (p.volume_ml || 0), 0);
  const tankEmpty = tankInfo(machineState.tank_ml, machineState.tank_cap, targetMl, isConnected).empty || Boolean(isConnected && machineState.tank_out);

  const brewSecs = scale ? scale.secs : grindMode ? grindMode.secs : waterMode ? waterMode.secs
    : isBrewing && !isPaused && (waterMl > 0.5 || elapsedRef.current.base > 0) ? elapsedRef.current.base + (now - elapsedRef.current.at) / 1000
    : elapsedRef.current.base;
  const timerM = Math.floor(brewSecs / 60);
  const timerS = Math.floor(brewSecs % 60);
  const timerStr = String(timerM).padStart(2, '0') + ':' + String(timerS).padStart(2, '0');

  const reorderRecipes = useCallback((fromIdx, toIdx) => {
    setRecipes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      saveOrder(next);
      savedOrderRef.current = next.map((r) => r.id || r.name);
      return next;
    });
  }, []);

  const startBrew = useCallback(() => {
    const r = recipes[selectedRecipe];
    if (!r) return;
    requestNotifyPermission();
    resetForBrew();
    showToast(t('loadingRecipe', lang), 'info');
    sendAction('load_recipe', { recipe: r });
    setTimeout(() => {
      sendAction('execute');
      showToast(`Brewing ${r.name}`, 'success');
    }, 1500);
  }, [recipes, selectedRecipe, sendAction, showToast, lang, resetForBrew]);

  // Standby: after 60s without touches while no brew runs; woken by a tap, a brew,
  // a machine fault, or a scheduled brew coming up.
  const wakeReason = isBrewing || scaleRunning || grindRunning || Boolean(activeFault) || scheduleDueSoon(schedules, STANDBY_SCHEDULE_LEAD_MS);
  const wakeReasonRef = useRef(wakeReason);
  wakeReasonRef.current = wakeReason;

  useEffect(() => {
    const touch = () => { lastActivityRef.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const iv = setInterval(() => {
      if (wakeReasonRef.current) return;
      if (Date.now() - lastActivityRef.current >= STANDBY_IDLE_MS) setStandby(true);
    }, 5000);
    return () => { events.forEach((e) => window.removeEventListener(e, touch)); clearInterval(iv); };
  }, []);

  useEffect(() => {
    if (wakeReason) { setStandby(false); lastActivityRef.current = Date.now(); }
  }, [wakeReason]);

  // schedules can come due while already in standby; re-check every 15s
  useEffect(() => {
    if (!standby) return;
    const iv = setInterval(() => {
      if (scheduleDueSoon(schedules, STANDBY_SCHEDULE_LEAD_MS)) { setStandby(false); lastActivityRef.current = Date.now(); }
    }, 15000);
    return () => clearInterval(iv);
  }, [standby, schedules]);

  // The machine going to sleep shows our standby screen. Tapping it only changes the screen and
  // never sends "wake" — a wake handshake during a brew can stop the pour.
  const machineAsleep = Boolean(machineState.sleeping) && !isBrewing;
  useEffect(() => {
    if (machineAsleep && !wakeReasonRef.current) setStandby(true);
  }, [machineAsleep]);

  const exitStandby = useCallback(() => { setStandby(false); lastActivityRef.current = Date.now(); }, []);
  const changeStandbyMode = useCallback((m) => {
    setStandbyMode(m);
    try { localStorage.setItem(STANDBY_MODE_KEY, m); } catch {}
  }, []);

  const classifyRecipe = useCallback(async (name, tag) => {
    setRecipeTags((prev) => {
      const next = { ...prev };
      if (tag) next[name] = tag; else delete next[name];
      return next;
    });
    showToast(`${name} → ${t(tag ? tag : 'autoTag', lang)}`, 'success');
    try {
      const res = await fetch('/api/recipe-tags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, tag }),
      });
      const data = await res.json();
      if (data.ok) setRecipeTags(data.tags || {});
      else showToast(data.error || 'Could not save', 'error');
    } catch (e) { showToast(e.message, 'error'); }
  }, [showToast, lang]);

  const startDemo = useCallback(async () => {
    requestNotifyPermission();
    try {
      const res = await fetch('/api/demo/brew', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) showToast(data.error || 'Demo failed', 'error');
    } catch (e) { showToast(e.message, 'error'); }
  }, [showToast]);

  const openScheduleEdit = useCallback((sched) => setEditSchedule(sched), []);
  const closeScheduleEdit = useCallback(() => setEditSchedule(null), []);

  const saveSchedule = useCallback(async (data) => {
    try {
      if (data.id) {
        const res = await fetch(`/api/schedules/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const { ok, schedule, error } = await res.json();
        if (!ok) throw new Error(error || 'Save failed');
        setSchedules((prev) => prev.map((s) => (s.id === data.id ? schedule : s)));
      } else {
        const res = await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const { ok, schedule, error } = await res.json();
        if (!ok) throw new Error(error || 'Save failed');
        setSchedules((prev) => (prev.some((s) => s.id === schedule.id) ? prev : [...prev, schedule]));
      }
      closeScheduleEdit();
      showToast('Schedule saved', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }, [closeScheduleEdit, showToast]);

  const deleteSchedule = useCallback(async (id) => {
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      closeScheduleEdit();
      showToast('Schedule deleted', 'info');
    } catch (e) { showToast(e.message, 'error'); }
  }, [closeScheduleEdit, showToast]);

  const dir = isRTL(lang) ? 'rtl' : 'ltr';


  // brewing path: one node per step (waits merged into the step before) + ready
  const ar = lang === 'ar';
  const timelineNodes = (() => {
    const nodes = [];
    const iso = (x) => `\u2066${x}\u2069`; // keep numbers like +30 in order inside Arabic text
    if (!noGrind) nodes.push({ key: 'grind', name: t('stepGrind', lang), detail: `${iso(activeRecipe?.dose_g ?? 15)} ${ar ? 'غ' : 'g'} · ${iso(`#${activeRecipe?.grind_size ?? ''}`)}` });
    nodes.push({ key: 'heat', name: t('stepHeat', lang), detail: iso(`${pours[0]?.temp_c ?? 93}°`) });
    pours.forEach((pr, i) => nodes.push({
      key: `pour${i}`,
      name: i === 0 && pours.length > 1 ? t('stepBloom', lang) : `${t('stepPour', lang)} ${i + 1}`,
      detail: `${iso(Math.round(pr.volume_ml || 0))} ${ar ? 'مل' : 'ml'}${pr.pause_s > 0 ? ` · ${iso(`+${pr.pause_s}`)}${ar ? 'ث' : 's'}` : ''}`,
    }));
    nodes.push({ key: 'done', name: t('stepDone', lang), detail: `${iso(targetMl)} ${ar ? 'مل' : 'ml'}` });
    let cum = 0; let poursDone = 0;
    pours.forEach((pr) => { cum += pr.volume_ml || 0; if (waterMl >= cum - 0.5) poursDone += 1; });
    let active = -1;
    if (isDone) active = nodes.length - 1;
    else if (isBrewing) {
      if (isGrinding || isTransfer) active = 0;
      else if (isHeating) active = noGrind ? 0 : 1;
      else {
        const pourIndex = isWaiting ? Math.max(0, poursDone - 1) : Math.min(poursDone, pours.length - 1);
        active = (noGrind ? 1 : 2) + pourIndex;
      }
    }
    return nodes.map((n, i) => ({ ...n, active: i === active, done: isDone ? i < nodes.length - 1 : active >= 0 && i < active }));
  })();

  // next scheduled brew (days use Mon=0 … Sun=6)
  const nextSchedule = (() => {
    let best = null;
    schedules.forEach((sc) => {
      if (sc.enabled === false || !sc.time) return;
      const [h, m] = sc.time.split(':').map(Number);
      if (sc.date) {
        const d = new Date(`${sc.date}T00:00`); d.setHours(h, m, 0, 0);
        if (d > clockNow && (!best || d < best.at)) best = { at: d, sc };
        return;
      }
      for (let off = 0; off < 8; off++) {
        const d = new Date(clockNow); d.setDate(clockNow.getDate() + off); d.setHours(h, m, 0, 0);
        if (d <= clockNow || !(sc.days || []).includes((d.getDay() + 6) % 7)) continue;
        if (!best || d < best.at) best = { at: d, sc };
        break;
      }
    });
    if (!best) return null;
    const dayName = best.at.toLocaleDateString(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'long' });
    const off = Math.round((new Date(best.at).setHours(0, 0, 0, 0) - new Date(clockNow).setHours(0, 0, 0, 0)) / 86400000);
    const rel = off === 0 ? (ar ? 'اليوم' : 'Today') : off === 1 ? (ar ? 'غداً' : 'Tomorrow') : '';
    return { time: best.sc.time, recipe: best.sc.recipe?.name || '', dayLabel: rel ? `${rel} · ${dayName}` : dayName };
  })();

  const coldSuggestion = recipes.find((r) => isColdRecipe(r, recipeTags))?.name || '';
  const tareAction = scale ? tareScale : () => sendAction('tare');
  const scaleTimerToggle = () => {
    if (!scale) { enterScale(); setTimeout(() => setScale((sc) => (sc ? { ...sc, running: true } : sc)), 0); }
    else toggleScaleTimer();
  };
  const grinderSize = isConnected ? (grinder?.size || recipes[selectedRecipe]?.grind_size || 48) : 0;

  /* ── blocks shared by the phone layout and the tablet grid ── */
  const heroBlock = (
    <section className="hero-card">
      <div className="hero-top">
        <div className="hero-status">
          {booted
            ? <span className={`phase-pill ${phaseClass}`}>{phase}</span>
            : <Skeleton className="skel-pill" />}
          {booted && !scale && !grindMode && !waterMode && (
            <StepTracker lang={lang} current={trackerStep} done={isDone} brewing={isBrewing} waiting={isWaiting} noGrind={noGrind} />
          )}
        </div>
        <MachineChip
          lang={lang}
          connected={isConnected}
          machineName={machineState.machine_name || machineState.selected_machine}
          onChangeMachine={() => setShowConnection(true)}
        />
      </div>
      <div className="hero-body">
        <DotMatrix
          weight={heroNum}
          frame={frame}
          mode={dotMode}
          target={waterMode ? waterMode.vol : targetMl || 250}
          transferProgress={transferProgress}
          connecting={isLinking}
          theme={theme}
          grindProgress={grindMode ? Math.min(1, grindMode.secs / GRIND_ONLY_FULL_S) : grindProgress}
          grindRunning={grindMode ? grindMode.running : true}
          scaleMode={Boolean(scale)}
          scaleRunning={scaleRunning}
          cold={selectedCold}
          scaleTarget={scale?.target}
          celebrate={isBrewing || scale || grindMode || waterMode ? null : celebrate}
        />
        <div className="hero-info" aria-busy={loading}>
          {loading ? (
            <>
              <Skeleton className="skel-weight" />
              <Skeleton className="skel-sub" />
            </>
          ) : (
            <>
              <div className="weight-num" dir="ltr">{heroNum.toFixed(1)}</div>
              <div className="weight-unit">
                {waterMode ? `${t('mlPoured', lang)} · ${t('target', lang)} ${waterMode.vol}`
                  : scale ? `${t('grams', lang)} · ${pourRate} ${t('gPerSec', lang)}`
                  : grindMode ? t('grams', lang)
                  : isBrewing && (isGrinding || isTransfer) ? `${t('beansTarget', lang)} ${doseG} ${t('g', lang)}`
                  : isBrewing && isHeating ? `${t('heatingTo', lang)} ${firstTemp}° · ${t('next', lang)} ${Math.round(pours[0]?.volume_ml || 0)} ${t('ml', lang)}`
                  : isBrewing && isWaiting ? `${t('waiting', lang)}${waitSuffix} · ${t('next', lang)} ${nextTarget} ${t('ml', lang)}`
                  : isBrewing && pours.length ? `${t('mlPoured', lang)} · ${pourLabel} ${t('to', lang)} ${stepTarget} ${t('ml', lang)}`
                  : isDone && showPoured ? `${t('mlPoured', lang)} · ${t('target', lang)} ${targetMl} ${t('ml', lang)}`
                  : targetMl ? `${t('grams', lang)} · ${t('recipeWater', lang)} ${targetMl} ${t('ml', lang)}` : t('grams', lang)}
              </div>
              <div className="timer-num" dir="ltr">{timerStr}</div>
              {waterMode && <WaterPanel lang={lang} water={waterMode} onChange={changeWater} />}
              {scale && (
                <div className="scale-gauge">
                  <div className={`gauge-bar${overTarget ? ' over' : ''}`} role="progressbar" aria-label={t('fillLevel', lang)}
                    aria-valuemin={0} aria-valuemax={scale.target} aria-valuenow={Math.round(scaleWeight)}>
                    <div className="gauge-fill" style={{ width: `${Math.min(100, (100 * scaleWeight) / scale.target)}%` }} />
                  </div>
                  <div className="gauge-labels">
                    <span className="gauge-pct" dir="ltr">{Math.round((100 * scaleWeight) / scale.target)}%</span>
                    <span>
                      <span dir="ltr">{Math.round(Math.abs(scale.target - scaleWeight))}</span>{' '}
                      {t(overTarget ? 'gramsOver' : 'gramsLeft', lang)}
                    </span>
                  </div>
                  <div className="gauge-target">
                    <button className="target-btn" onClick={() => adjustScaleTarget(-10)} aria-label={t('decreaseTarget', lang)}>−</button>
                    <span className="target-val">
                      <span className="target-num" dir="ltr">{scale.target}</span>
                      <span className="target-label">{t('targetG', lang)}</span>
                    </span>
                    <button className="target-btn" onClick={() => adjustScaleTarget(10)} aria-label={t('increaseTarget', lang)}>+</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <BrewControls
        lang={lang}
        connected={isConnected}
        brewing={isBrewing}
        paused={isPaused}
        recipeName={recipes[selectedRecipe]?.name}
        onBrew={startBrew}
        onTare={scale ? tareScale : () => sendAction('tare')}
        onDemo={startDemo}
        scale={scale}
        onEnterScale={enterScale}
        onExitScale={exitScale}
        onTimerToggle={toggleScaleTimer}
        grind={grindMode}
        onEnterGrind={enterGrind}
        onToggleGrind={toggleGrind}
        onExitGrind={exitGrind}
        water={waterMode}
        onEnterWater={enterWater}
        onToggleWater={toggleWater}
        onExitWater={exitWater}
        tankEmpty={tankEmpty}
        onPause={togglePause}
        onStop={stopBrew}
      />
    </section>
  );
  // live curve while brewing / just brewed; otherwise the recipe's last brew as the "now" line
  const showLive = (isBrewing || isDone) && liveCurve.length > 1;
  const hasCurve = showLive || Boolean(curves.last?.curve?.length > 1);
  const curveData = {
    live: showLive ? liveCurve : curves.last?.curve || null,
    best: curves.best && curves.best.id !== (showLive ? null : curves.last?.id) ? curves.best : (showLive ? curves.best : null),
    nowLabel: showLive ? null : (lang === 'ar' ? 'آخر تحضير' : 'Last brew'),
  };
  const timelineBlock = (!scale && !grindMode && !waterMode && <PourTimeline
    recipe={activeRecipe}
    lang={lang}
    brewing={isBrewing}
    done={isDone}
    grinding={isGrinding || isTransfer}
    heating={isHeating}
    waiting={isWaiting}
    waitLeft={waitLeft}
    paused={isPaused}
    poured={waterMl > 0.5 ? waterMl : Math.max(0, weight)}
    view={wide ? tlView : (hasCurve ? 'both' : 'path')}
    onView={wide ? pickTlView : undefined}
    curve={curveData}
  />);
  const timelineBlockL = (!scale && !grindMode && !waterMode && <PourTimeline
    recipe={activeRecipe} lang={lang} brewing={isBrewing} done={isDone} grinding={isGrinding || isTransfer}
    heating={isHeating} waiting={isWaiting} paused={isPaused}
    poured={waterMl > 0.5 ? waterMl : Math.max(0, weight)} view="both" curve={curveData}
  />);
  const grinderBlock = (
    <GrinderStrip
      lang={lang}
      grinding={isGrinding || grindRunning}
      grindDone={(isBrewing && !isGrinding) || (grindMode && !grindRunning && grindMode.secs > 0)}
      grindSize={grinderSize}
      rpm={grindRunning ? grindMode.rpm : isGrinding ? (grinder?.rpm || 100) : 0}
      loading={loading}
    />
  );
  const brewerBlock = (
    <BrewerStrip
      lang={lang}
      pouring={isPouring || (waterRunning && !waterMode.heating)}
      grinding={isGrinding}
      transfer={isTransfer}
      heating={isHeating || (waterRunning && waterMode.heating)}
      waiting={isWaiting}
      waitLeft={waitLeft}
      paused={isPaused}
      hot={isBrewing || Boolean(waterMode)}
      temp={waterMode ? waterMode.temp : isBrewing ? (brewer?.temp || 93) : 0}
      volume={waterMode ? Math.round(waterMode.poured) : scale ? 0 : Math.max(0, Math.round(weight))}
      flow={waterRunning && !waterMode.heating ? 180 : isPouring ? (brewer?.flow || 270) : 0}
      loading={loading}
    />
  );
  const tankBlock = (
    <TankStrip
      lang={lang}
      connected={isConnected}
      tankMl={machineState.tank_ml}
      tankCap={machineState.tank_cap}
      cupMl={targetMl || 250}
      loading={loading}
      onRefill={refillTank}
      out={Boolean(machineState.tank_out)}
      back={tankBack}
      onBackDone={() => setTankBack(null)}
      onKeep={() => { sendAction('tank_set', { ml: tankBack?.prev ?? 0 }); setTankBack(null); }}
    />
  );
  const recipesBlock = (
    <div className="side-panel">
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'recipes' ? 'active' : 'inactive'}`} onClick={() => setTab('recipes')}>
          {t('recipes', lang)}
        </button>
        <button className={`tab-btn ${tab === 'schedules' ? 'active' : 'inactive'}`} onClick={() => setTab('schedules')}>
          {t('schedules', lang)}
        </button>
      </div>
    
      {tab === 'recipes' && (loading && !recipes.length ? <SkeletonRows /> :
        <RecipeList
          recipes={recipes}
          lang={lang}
          selectedIndex={selectedRecipe}
          onSelect={setSelectedRecipe}
          onReorder={reorderRecipes}
          tags={recipeTags}
          onClassify={classifyRecipe}
        />
      )}
    
      {tab === 'schedules' && (
        schedules.length > 0 ? (
          <ScheduleList schedules={schedules} lang={lang} onEdit={openScheduleEdit} onAdd={() => openScheduleEdit({})} />
        ) : (
          <div className="schedules-empty">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>
            </svg>
            <div className="schedules-empty-title">{t('noSchedulesTitle', lang)}</div>
            <div className="schedules-empty-desc">{t('noSchedulesDesc', lang)}</div>
            <button className="schedules-add-btn" onClick={() => openScheduleEdit({})}>
              {t('addSchedule', lang)}
            </button>
          </div>
        )
      )}
    </div>
  );

  const ctx = {
    lang, now: clockNow, weight: heroNum, targetMl, phase, phaseClass, isConnected, isBrewing, isPaused, isWaiting,
    recipeName: activeRecipe?.name || '', recipes, selectedRecipe, selectRecipe: setSelectedRecipe, recipeTags,
    startBrew, tare: tareAction, enterGrind, enterScale, togglePause, stopBrew,
    tank: { ml: machineState.tank_ml, cap: machineState.tank_cap }, grinder: { size: grinderSize }, brewer: { temp: isBrewing ? (brewer?.temp || 93) : 0, hot: isBrewing },
    scale, scaleTarget: loadScaleTarget(), pourRate, scaleTimerToggle,
    timelineNodes, nextSchedule, weather, coldSuggestion,
    analytics, openBeans: () => setShowBeans(true),
    verseIndex, nextVerse: () => setVerseIndex((i) => i + 1),
    blocks: { brewL: heroBlock, grinderM: grinderBlock, brewerM: brewerBlock, tankM: tankBlock, recipesL: recipesBlock, timelineM: timelineBlock || <section className="pour-timeline" />, timelineL: timelineBlockL || <section className="pour-timeline" /> },
  };

  return (
    <div className="app-shell" dir={dir}>
      <Background live={isBrewing && !isPaused} />
      <Header
        lang={lang}
        ble={machineState.link}
        soundOn={soundOn}
        fullscreen={fullscreen}
        onToggleSound={toggleSound}
        onOpenConnection={() => setShowConnection(true)}
        onOpenAccount={() => setShowAccount(true)}
        onRestart={restartServer}
        onToggleLang={toggleLang}
        theme={theme}
        onOpenThemes={() => setShowThemes(true)}
        showAnalytics={caps.analytics}
        canCustomise={wide && page === 'home'}
        page={page}
        onNotify={() => setShowNotify(true)}
        pushOn={pushOn}
        onAnalytics={() => { setEditing(false); setShowTray(false); goPage(page === 'analytics' ? 'home' : 'analytics'); if (page !== 'analytics') loadAnalytics(); }}
        editing={editing}
        onCustomise={() => { setEditing((e) => !e); setShowTray(false); }}
      />
      <Clock lang={lang} className="clock-strip" />

      {page === 'analytics' ? (
        <div className="app-content an-content">
          <AnalyticsPage lang={lang} analytics={analytics} onBack={() => goPage('home')} onAddBag={() => setShowBeans(true)} />
        </div>
      ) : wide ? (
        <div className="app-content wide">
          {activeFault && (
            <FaultBanner fault={activeFault} lang={lang} onDismiss={() => setDismissedFault(activeFault)} />
          )}
          {editing && <EditBar lang={lang} onAdd={() => setShowTray(true)} onReset={() => setLayout(DEFAULT_LAYOUT.map((w) => ({ ...w })))} onDone={() => { setEditing(false); setShowTray(false); }} />}
          <HomeGrid lang={lang} layout={layout} setLayout={setLayout} edit={editing} ctx={ctx} addons={addons} caps={caps} />
        </div>
      ) : (
        <div className="app-content">
          {/* ── Main column ── */}
          <div className="main-col">
            {activeFault && (
              <FaultBanner fault={activeFault} lang={lang} onDismiss={() => setDismissedFault(activeFault)} />
            )}
            {heroBlock}
            {timelineBlock}
            <div className="strips-row">
              {grinderBlock}
              {brewerBlock}
              {tankBlock}
            </div>
          </div>

          {/* ── Side column ── */}
          <div className="side-col">
            {recipesBlock}
          </div>
        </div>
      )}

      {showConnection && (
        <ConnectionModal
          lang={lang}
          ble={machineState.link}
          machineName={machineState.machine_name}
          selectedMachine={machineState.selected_machine}
          sleeping={machineState.sleeping}
          devices={devices}
          onScanDevices={scanDevices}
          onSelectMachine={selectMachine}
          onConnect={() => sendAction('connect', machineState.selected_machine ? { machine: machineState.selected_machine } : undefined)}
          onDisconnect={() => sendAction('disconnect')}
          onWake={() => sendAction('wake')}
          onClose={() => setShowConnection(false)}
        />
      )}

      {rateBrew && <RatingSheet lang={lang} brew={rateBrew} onClose={(saved) => { setRateBrew(null); if (saved) loadAnalytics(); }} />}
      {showNotify && <NotifySheet lang={lang} soundOn={soundOn} onToggleSound={toggleSound} pushAvailable={caps.push} onClose={() => { setShowNotify(false); refreshPush(); }} />}
      {showBeans && <BeanSheet lang={lang} onClose={() => setShowBeans(false)} onSaved={loadAnalytics} />}
      {showAccount && (
        <CloudAccount
          lang={lang}
          loggedIn={cloudStatus.signed_in}
          email={cloudStatus.email}
          showToast={showToast}
          onClose={() => setShowAccount(false)}
        />
      )}

      {editSchedule && (
        <ScheduleSheet
          schedule={editSchedule} recipes={recipes} lang={lang}
          onClose={closeScheduleEdit} onSave={saveSchedule} onDelete={deleteSchedule}
        />
      )}

      {editing && showTray && (
        <AddTray
          lang={lang}
          layout={layout}
          addons={addons}
          onAddons={setAddons}
          onClose={() => setShowTray(false)}
          caps={caps}
          onAdd={(k) => {
            const opts = SPANS[k];
            setLayout(layout.concat([{ id: `${k}-${Date.now()}`, kind: k, variant: opts.M ? 'M' : Object.keys(opts)[0] }]));
            setShowTray(false);
          }}
        />
      )}

      {showThemes && (
        <ThemeBoard lang={lang} theme={theme} onTheme={changeTheme} onClose={() => setShowThemes(false)} />
      )}

      {standby && (
        <Standby lang={lang} mode={standbyMode} onModeChange={changeStandbyMode} onExit={exitStandby}
          weather={addons.weather && weather ? weather : null} verse={addons.verse ? VERSES[verseIndex % VERSES.length] : null}
          nextSchedule={nextSchedule}
          items={standbyItems} onItems={(next) => { setStandbyItems(next); try { localStorage.setItem('nuqta_standby_items', JSON.stringify(next)); } catch {} }} />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
