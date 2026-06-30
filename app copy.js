const STORAGE_KEY = 'rutina-v1';
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DEFAULT_CHECKS = [
  'Cuidé mi cuerpo / fui al gym',
  'Hice una tarea importante',
  'Frené el sobrepensar',
  'Respondí bien / controlé impulsos',
  'Descansé o preparé mejor mi día'
];
const DEFAULT_FAIL_TYPES = [
  'Sobrepensé demasiado',
  'Respondí mal',
  'Procrastiné',
  'Me comparé',
  'Gasté tiempo en algo que no quería',
  'No cumplí algo importante',
  'Otro'
];
const DEFAULT_REPAIRS = [
  'Respirar 2 minutos',
  'Escribir qué pasó',
  'Pedir disculpas si aplica',
  'Hacer una acción pequeña ahora',
  'Soltar y continuar'
];
const MISSION_CATEGORIES = ['Todas', 'Vida', 'Estudio', 'Social', 'Salud', 'Trabajo'];
const CATEGORY_COLORS = {
  'Vida':    { cls: 'cat-vida',    dot: '#f0c040' },
  'Estudio': { cls: 'cat-estudio', dot: '#a78bfa' },
  'Social':  { cls: 'cat-social',  dot: '#34d399' },
  'Salud':   { cls: 'cat-salud',   dot: '#f87171' },
  'Trabajo': { cls: 'cat-trabajo', dot: '#38bdf8' },
};
const KIND_COLORS = {
  'Principal': 'kind-main',
  'Pequeño':   'kind-small',
  'Gym':       'kind-gym',
  'Descanso':  'kind-rest',
  'Ocupado':   'kind-busy'
};
let activeView = 'today';
let lastMainView = 'today';
let activeMissionFilter = 'Todas';
let activeDay = 'Lunes';
let toastTimer = null;
let deferredInstallPrompt = null;
let activeMonthOffset = 0; // 0 = mes actual, -1 = anterior

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isoDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return isoDate(date).slice(0, 7);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function formatDateLabel(value) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function todayName() {
  return DAY_NAMES[new Date().getDay()];
}

/* ── CHECKS PERSONALIZABLES ─────────────────────────────────── */
function getCustomChecks() {
  return state.settings.customChecks?.length ? state.settings.customChecks : [...DEFAULT_CHECKS];
}

/* ── TIPOS DE FALLA / REPARACIONES PERSONALIZABLES ───────────── */
function getCustomFailTypes() {
  return state.settings.customFailTypes?.length ? state.settings.customFailTypes : [...DEFAULT_FAIL_TYPES];
}

function getCustomRepairs() {
  return state.settings.customRepairs?.length ? state.settings.customRepairs : [...DEFAULT_REPAIRS];
}

function getDefaultState() {
  return {
    settings: {
      appName: 'Rutina',
      theme: 'light',
      monthlyFailLimit: 10,
      customChecks: [...DEFAULT_CHECKS],
      customFailTypes: [...DEFAULT_FAIL_TYPES],
      customRepairs: [...DEFAULT_REPAIRS]
    },
    piggyStartDate: isoDate(),
    daily: {},
    missions: [
      {
        id: uid('mission'),
        title: 'Aprender a cocinar',
        category: 'Vida',
        steps: [
          { id: uid('step'), title: 'Escoger 3 comidas básicas', done: false },
          { id: uid('step'), title: 'Hacer una lista de mercado simple', done: false },
          { id: uid('step'), title: 'Cocinar una receta esta semana', done: false },
          { id: uid('step'), title: 'Guardar receta y calificación', done: false }
        ]
      },
      {
        id: uid('mission'),
        title: 'Conducción',
        category: 'Vida',
        steps: [
          { id: uid('step'), title: 'Estudiar examen teórico', done: false },
          { id: uid('step'), title: 'Hacer simulacros', done: false },
          { id: uid('step'), title: 'Programar clases prácticas', done: false },
          { id: uid('step'), title: 'Presentar examen práctico', done: false }
        ]
      },
      {
        id: uid('mission'),
        title: 'Baile desde cero',
        category: 'Salud',
        steps: [
          { id: uid('step'), title: 'Escoger estilo', done: false },
          { id: uid('step'), title: 'Practicar 20 minutos', done: false },
          { id: uid('step'), title: 'Repetir dos veces por semana', done: false },
          { id: uid('step'), title: 'Grabar un progreso opcional', done: false }
        ]
      },
      {
        id: uid('mission'),
        title: 'Carta',
        category: 'Social',
        steps: [
          { id: uid('step'), title: 'Hacer borrador', done: false },
          { id: uid('step'), title: 'Revisar tono', done: false },
          { id: uid('step'), title: 'Enviar o guardar', done: false }
        ]
      },
      {
        id: uid('mission'),
        title: 'Dos artículos',
        category: 'Estudio',
        steps: [
          { id: uid('step'), title: 'Definir tema del artículo 1', done: false },
          { id: uid('step'), title: 'Escribir borrador del artículo 1', done: false },
          { id: uid('step'), title: 'Definir tema del artículo 2', done: false },
          { id: uid('step'), title: 'Escribir borrador del artículo 2', done: false }
        ]
      },
      {
        id: uid('mission'),
        title: 'LinkedIn',
        category: 'Trabajo',
        steps: [
          { id: uid('step'), title: 'Actualizar foto y titular', done: false },
          { id: uid('step'), title: 'Agregar proyectos académicos', done: false },
          { id: uid('step'), title: 'Escribir acerca de mí', done: false },
          { id: uid('step'), title: 'Publicar primer post', done: false }
        ]
      },
      {
        id: uid('mission'),
        title: '10 mensajes a 10 personas',
        category: 'Social',
        steps: Array.from({ length: 10 }, (_, index) => ({
          id: uid('step'),
          title: `Mensaje ${index + 1}`,
          done: false
        }))
      }
    ],
    failures: [],
    notes: [],
    schedule: getSuggestedSchedule()
  };
}

function getSuggestedSchedule() {
  return {
    Lunes: [
      { id: uid('block'), time: 'Gym', title: 'Entrenamiento 2 h', kind: 'Gym' },
      { id: uid('block'), time: 'Noche', title: 'Conducción teórica 45 min', kind: 'Principal' }
    ],
    Martes: [
      { id: uid('block'), time: 'Gym', title: 'Entrenamiento 2 h', kind: 'Gym' },
      { id: uid('block'), time: 'Noche', title: 'Artículo 1 — 90 min', kind: 'Principal' },
      { id: uid('block'), time: 'Rato corto', title: 'Enviar 2 mensajes', kind: 'Pequeño' }
    ],
    Miércoles: [
      { id: uid('block'), time: 'Gym', title: 'Entrenamiento 2 h', kind: 'Gym' },
      { id: uid('block'), time: 'Noche', title: 'Cocinar una receta básica', kind: 'Principal' },
      { id: uid('block'), time: 'Rato corto', title: 'Baile 20–30 min', kind: 'Pequeño' }
    ],
    Jueves: [
      { id: uid('block'), time: 'Gym', title: 'Entrenamiento 2 h', kind: 'Gym' },
      { id: uid('block'), time: 'Noche', title: 'Artículo 2 — 90 min', kind: 'Principal' },
      { id: uid('block'), time: 'Rato corto', title: 'Enviar 2 mensajes', kind: 'Pequeño' }
    ],
    Viernes: [
      { id: uid('block'), time: 'Gym', title: 'Entrenamiento 2 h', kind: 'Gym' },
      { id: uid('block'), time: 'Noche', title: 'LinkedIn 60 min', kind: 'Principal' },
      { id: uid('block'), time: 'Rato corto', title: 'Carta 30 min', kind: 'Pequeño' }
    ],
    Sábado: [
      { id: uid('block'), time: 'Todo el día', title: 'Ocupado — sin tareas obligatorias', kind: 'Ocupado' }
    ],
    Domingo: [
      { id: uid('block'), time: 'Hasta 6 p.m.', title: 'Ocupado — sin presión', kind: 'Ocupado' },
      { id: uid('block'), time: '6:30 p.m.', title: 'Planear semana 30 min', kind: 'Principal' },
      { id: uid('block'), time: '7:00 p.m.', title: 'Revisar racha y alcancía', kind: 'Pequeño' }
    ]
  };
}

function loadState() {
  try {
    // migrate old key
    const oldRaw = localStorage.getItem('modo-mejor-v1');
    if (oldRaw && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, oldRaw);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultState();
    return {
      ...defaults,
      ...parsed,
      settings: {
        ...defaults.settings,
        ...(parsed.settings || {}),
        customChecks: parsed.settings?.customChecks?.length ? parsed.settings.customChecks : [...DEFAULT_CHECKS],
        customFailTypes: parsed.settings?.customFailTypes?.length ? parsed.settings.customFailTypes : [...DEFAULT_FAIL_TYPES],
        customRepairs: parsed.settings?.customRepairs?.length ? parsed.settings.customRepairs : [...DEFAULT_REPAIRS]
      },
      daily: parsed.daily || {},
      missions: parsed.missions?.length ? parsed.missions : defaults.missions,
      failures: parsed.failures || [],
      notes: parsed.notes || [],
      schedule: { ...defaults.schedule, ...(parsed.schedule || {}) }
    };
  } catch (error) {
    console.error(error);
    return getDefaultState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureToday() {
  const key = isoDate();
  const checks = getCustomChecks();
  if (!state.daily[key]) {
    state.daily[key] = {
      checks: checks.map((title, index) => ({ id: `check-${index}`, title, done: false }))
    };
    saveState();
  }
  // sync check titles if customChecks changed but count stayed same
  const day = state.daily[key];
  if (day.checks.length !== checks.length) {
    day.checks = checks.map((title, index) => ({ id: `check-${index}`, title, done: false }));
    saveState();
  }
  return day;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function setTheme(theme) {
  state.settings.theme = theme;
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  $('#themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
  saveState();
}

function setAppName(name) {
  const safeName = name?.trim() || 'Rutina';
  state.settings.appName = safeName;
  document.title = safeName;
  $('h1').textContent = safeName;
  const input = $('#appNameInput');
  if (input) input.value = safeName;
  saveState();
}

function navigate(view) {
  let targetView = view;
  if (targetView === 'settings' && activeView === 'settings') {
    targetView = lastMainView || 'today';
  }
  const target = $(`#view-${targetView}`);
  if (!target) return;
  if (targetView !== 'settings') lastMainView = targetView;
  activeView = targetView;
  $$('.view').forEach((el) => el.classList.remove('active-view'));
  target.classList.add('active-view');
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === targetView));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

function getMonthFailures() {
  const current = monthKey();
  return state.failures.filter((f) => f.date.startsWith(current));
}

function getDaysWithFailures() {
  const uniqueDays = new Set(state.failures.map((f) => f.date));
  return uniqueDays.size;
}

function getPiggyDaysElapsed() {
  const start = state.piggyStartDate || isoDate();
  const startDate = new Date(`${start}T00:00:00`);
  const today = new Date(`${isoDate()}T00:00:00`);
  const diffDays = Math.round((today - startDate) / 86400000) + 1; // incluye hoy
  return Math.max(1, diffDays);
}

function getPiggyTotal() {
  return getPiggyDaysElapsed() * 1000;
}

function getDailyProgress() {
  const today = ensureToday();
  const completed = today.checks.filter((c) => c.done).length;
  return Math.round((completed / today.checks.length) * 100);
}

function isGoodDay(dateKey) {
  const day = state.daily[dateKey];
  if (!day) return false;
  const done = day.checks.filter((c) => c.done).length;
  return done >= 3;
}

function getStreak() {
  let count = 0;
  const cursor = new Date(`${isoDate()}T12:00:00`);
  while (count < 365) {
    const key = isoDate(cursor);
    if (!isGoodDay(key)) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function formatMonthLabel(date = new Date()) {
  const label = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getActiveMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + activeMonthOffset, 1, 12, 0, 0);
}

function getMonthDateKeys(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const lastDay = isCurrentMonth ? now.getDate() : new Date(year, month + 1, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => isoDate(new Date(year, month, i + 1, 12, 0, 0)));
}

function getChecksForDate(dateKey) {
  const checks = getCustomChecks();
  const saved = state.daily[dateKey]?.checks || [];
  return checks.map((title, i) => ({
    id: saved[i]?.id || `check-${i}`,
    title: saved[i]?.title || title,
    done: Boolean(saved[i]?.done)
  }));
}

function getMonthlySummaryData() {
  const activeDate = getActiveMonthDate();
  const dates = getMonthDateKeys(activeDate);
  const checks = getCustomChecks();
  const rows = dates.map((dateKey) => {
    const registered = Boolean(state.daily[dateKey]);
    const dayChecks = getChecksForDate(dateKey);
    const doneCount = dayChecks.filter((c) => c.done).length;
    const failures = state.failures.filter((f) => f.date === dateKey);
    return { dateKey, registered, checks: dayChecks, doneCount, pendingCount: checks.length - doneCount, failures, good: registered && isGoodDay(dateKey) };
  });

  const totalPossible = dates.length * checks.length;
  const totalDone = rows.reduce((sum, r) => sum + r.doneCount, 0);
  const percent = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;
  const registeredDays = rows.filter((r) => r.registered).length;
  const fullDays = rows.filter((r) => r.doneCount === checks.length).length;
  const goodDays = rows.filter((r) => r.good).length;
  const pendingDays = rows.filter((r) => r.doneCount < checks.length).length;
  const unregisteredDays = rows.filter((r) => !r.registered).length;
  const monthFailures = getMonthFailures();

  const checkStats = checks.map((title, i) => {
    const done = rows.filter((r) => r.checks[i]?.done).length;
    const pending = dates.length - done;
    return { title, done, pending, percent: dates.length ? Math.round((done / dates.length) * 100) : 0 };
  });

  const bestCheck = [...checkStats].sort((a, b) => b.done - a.done || b.percent - a.percent)[0];
  const weakestCheck = [...checkStats].sort((a, b) => b.pending - a.pending || a.percent - b.percent)[0];

  return { dates, rows, totalPossible, totalDone, percent, registeredDays, fullDays, goodDays, pendingDays, unregisteredDays, monthFailures, checkStats, bestCheck, weakestCheck };
}

function renderSummary() {
  const summary = getMonthlySummaryData();
  const checks = getCustomChecks();
  const activeDate = getActiveMonthDate();
  const monthLabel = formatMonthLabel(activeDate);
  const lastDateKey = summary.dates[summary.dates.length - 1] || isoDate();
  const todayLabel = formatDateLabel(lastDateKey);

  // Update month nav
  const navLabel = $('#monthNavLabel');
  if (navLabel) navLabel.textContent = monthLabel;
  const nextBtn = $('#nextMonthBtn');
  if (nextBtn) nextBtn.disabled = activeMonthOffset >= 0;

  $('#summaryTitle').textContent = `Resumen de ${monthLabel}`;
  $('#summarySubtitle').textContent = `Del 1 al ${todayLabel}: mira el mes sin castigarte.`;
  $('#summaryPercent').textContent = `${summary.percent}%`;
  $('#summaryDone').textContent = `${summary.totalDone}/${summary.totalPossible}`;
  $('#summaryGoodDays').textContent = `${summary.goodDays}`;
  $('#summaryPendingDays').textContent = `${summary.pendingDays}`;
  $('#summaryProgressText').textContent = `${summary.percent}%`;
  $('#summaryProgressBar').style.width = `${summary.percent}%`;
  $('#summaryProgressHelp').textContent = summary.totalDone
    ? `Registraste ${summary.registeredDays} día(s), completaste ${summary.fullDays} checklist(s) completos, ${summary.unregisteredDays} día(s) sin registro.`
    : 'Aún no hay checks completados este mes. Empieza por marcar aunque sea uno hoy.';

  const bestText = summary.bestCheck?.done
    ? `Lo más constante: ${escapeHtml(summary.bestCheck.title)} (${summary.bestCheck.done}/${summary.dates.length} días).`
    : 'Sin hábito fuerte este mes todavía.';
  const weakestText = summary.weakestCheck
    ? `Lo que más quedó pendiente: ${escapeHtml(summary.weakestCheck.title)} (${summary.weakestCheck.pending} día(s)).`
    : 'No hay suficientes datos aún.';
  const failuresText = summary.monthFailures.length
    ? `${summary.monthFailures.length} falla(s) este mes. Úsalas como señal, no como castigo.`
    : 'Sin fallas este mes. Mantén el ritmo.';

  $('#summaryInsight').innerHTML = `
    <article class="insight-card"><strong>Hiciste</strong><p class="muted">${bestText}</p></article>
    <article class="insight-card"><strong>Te faltó</strong><p class="muted">${weakestText}</p></article>
    <article class="insight-card"><strong>Fallas</strong><p class="muted">${failuresText}</p></article>
  `;

  $('#checkBreakdown').innerHTML = summary.checkStats.map((item) => `
    <article class="breakdown-row">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="progress-bar compact-progress"><span style="width:${item.percent}%"></span></div>
        <p class="muted">Hecho ${item.done}/${summary.dates.length} días · Faltó ${item.pending} día(s)</p>
      </div>
      <span class="badge">${item.percent}%</span>
    </article>
  `).join('');

  // Grilla estilo GitHub contributions
  const totalDaysInMonth = new Date(getActiveMonthDate().getFullYear(), getActiveMonthDate().getMonth() + 1, 0).getDate();
  const allDays = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const d = new Date(getActiveMonthDate().getFullYear(), getActiveMonthDate().getMonth(), i + 1, 12);
    return isoDate(d);
  });
  const cells = allDays.map((dateKey) => {
    const row = summary.rows.find((r) => r.dateKey === dateKey);
    const isFuture = dateKey > isoDate();
    const percent = row ? Math.round((row.doneCount / checks.length) * 100) : 0;
    let level = 'day-empty';
    if (isFuture) level = 'day-future';
    else if (!row || !row.registered) level = 'day-none';
    else if (percent === 100) level = 'day-full';
    else if (percent >= 60) level = 'day-good';
    else if (percent >= 20) level = 'day-low';
    else level = 'day-none';
    const dayNum = parseInt(dateKey.split('-')[2]);
    const tooltip = isFuture ? `Día ${dayNum}` : row ? `Día ${dayNum} · ${percent}%` : `Día ${dayNum} · sin registro`;
    return `<div class="contrib-cell ${level}" title="${tooltip}" data-date="${dateKey}"><span>${dayNum}</span></div>`;
  }).join('');

  $('#monthlyDaysList').innerHTML = `
    <div class="contrib-legend">
      <span class="contrib-dot day-none"></span><span>Sin registro</span>
      <span class="contrib-dot day-low"></span><span>Flojo</span>
      <span class="contrib-dot day-good"></span><span>Bien</span>
      <span class="contrib-dot day-full"></span><span>Completo</span>
    </div>
    <div class="contrib-grid">${cells}</div>
  `;
}

function renderToday() {
  const today = ensureToday();
  const progress = getDailyProgress();
  const monthFailures = getMonthFailures();
  const circumference = 302;
  $('#todayLabel').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#dailyPercent').textContent = `${progress}%`;
  $('#dailyRing').style.strokeDashoffset = String(circumference - (circumference * progress) / 100);
  const streak = getStreak();
  const streakEl = $('#streakCount');
  const prevStreak = Number(streakEl.dataset.prev || 0);
  streakEl.textContent = `${streak} días`;
  streakEl.dataset.prev = streak;
  if (streak > prevStreak && prevStreak > 0) {
    streakEl.closest('.stat-card')?.classList.add('streak-bump');
    setTimeout(() => streakEl.closest('.stat-card')?.classList.remove('streak-bump'), 700);
  }
  $('#failCount').textContent = `${getDaysWithFailures()}`;
  $('#piggyTotal').textContent = formatMoney(getPiggyTotal());

  $('#dailyChecklist').innerHTML = today.checks.map((check, index) => `
    <label class="check-row ${check.done ? 'done' : ''}">
      <input type="checkbox" data-check-index="${index}" ${check.done ? 'checked' : ''} />
      <span>${escapeHtml(check.title)}</span>
      <span class="badge">${check.done ? '✓ Hecho' : 'Pendiente'}</span>
    </label>
  `).join('');

  const blocks = state.schedule[todayName()] || [];
  $('#todaySchedule').innerHTML = blocks.length
    ? blocks.map((block) => timeBlockTemplate(block, false)).join('')
    : '<div class="empty-state">No hay bloques para hoy.</div>';
}

function renderMissions() {
  $('#missionFilters').innerHTML = MISSION_CATEGORIES.map((cat) => `
    <button class="chip ${activeMissionFilter === cat ? 'active' : ''}" data-mission-filter="${cat}" type="button">${cat}</button>
  `).join('');

  const filtered = state.missions.filter((m) => activeMissionFilter === 'Todas' || m.category === activeMissionFilter);
  $('#missionsList').innerHTML = filtered.length ? filtered.map((mission) => {
    const done = mission.steps.filter((s) => s.done).length;
    const total = mission.steps.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const completed = done === total && total > 0;
    const cat = CATEGORY_COLORS[mission.category] || { cls: '', dot: '#888' };
    return `
      <article class="mission-card ${cat.cls} ${completed ? 'mission-complete' : ''}" data-mission-id="${mission.id}">
        <div class="mission-header">
          <div>
            <p class="eyebrow" style="color:${cat.dot}">${escapeHtml(mission.category)}</p>
            <h3>${escapeHtml(mission.title)} ${completed ? '<span class="complete-badge">✓ Completa</span>' : ''}</h3>
          </div>
          <button class="icon-danger" data-delete-mission="${mission.id}" type="button" aria-label="Eliminar misión">×</button>
        </div>
        <div class="progress-bar"><span style="width:${percent}%;background:${cat.dot}"></span></div>
        <p class="muted">${done}/${total} pasos · ${percent}%</p>
        ${completed ? '<div class="mission-celebration">🎯 ¡Misión completada!</div>' : ''}
        <div class="step-list">
          ${mission.steps.map((step) => `
            <label class="step-row ${step.done ? 'done' : ''}">
              <input type="checkbox" data-step="${mission.id}|${step.id}" ${step.done ? 'checked' : ''} />
              <span>${escapeHtml(step.title)}</span>
              <button class="icon-danger" data-delete-step="${mission.id}|${step.id}" type="button" aria-label="Eliminar paso">×</button>
            </label>
          `).join('')}
        </div>
        <form class="inline-form" data-add-step="${mission.id}">
          <input name="step" placeholder="Agregar paso pequeño" />
          <button class="secondary-button small" type="submit">Añadir</button>
        </form>
      </article>
    `;
  }).join('') : '<div class="empty-state">No hay misiones en esta categoría.</div>';
}

function renderPiggy() {
  $('#piggyDaysCount').textContent = String(getPiggyDaysElapsed());
  $('#piggyAmount').textContent = formatMoney(getPiggyTotal());
  $('#piggyFailCount').textContent = String(state.failures.length);
  $('#failList').innerHTML = state.failures.length ? [...state.failures].reverse().map((failure) => `
    <article class="log-item">
      <div class="log-meta">
        <span class="badge">${formatDateLabel(failure.date)}</span>
        <span class="badge fail-badge">${escapeHtml(failure.type)}</span>
      </div>
      <strong class="repair-label">Reparación: ${escapeHtml(failure.repair)}</strong>
      ${failure.note ? `<p class="log-body muted">${escapeHtml(failure.note)}</p>` : ''}
      <button class="secondary-button small" data-delete-fail="${failure.id}" type="button">Eliminar</button>
    </article>
  `).join('') : '<div class="empty-state">Sin fallas registradas. Bien ahí.</div>';
}

function renderSchedule() {
  $('#dayTabs').innerHTML = WEEK_DAYS.map((day) => `
    <button class="chip ${activeDay === day ? 'active' : ''}" data-day="${day}" type="button">${day.slice(0, 3)}</button>
  `).join('');
  $('#activeDayLabel').textContent = activeDay;
  const blocks = state.schedule[activeDay] || [];
  $('#scheduleList').innerHTML = blocks.length
    ? blocks.map((block) => timeBlockTemplate(block, true)).join('')
    : '<div class="empty-state">Este día está vacío. Añade un bloque.</div>';
}

function timeBlockTemplate(block, editable) {
  const kindClass = KIND_COLORS[block.kind] || '';
  return `
    <article class="time-block ${kindClass}">
      <span class="block-time">${escapeHtml(block.time)}</span>
      <div class="block-body">
        <strong>${escapeHtml(block.title)}</strong>
        <span class="block-kind">${escapeHtml(block.kind)}</span>
      </div>
      ${editable ? `<button class="icon-danger" data-delete-block="${block.id}" type="button" aria-label="Eliminar bloque">×</button>` : ''}
    </article>
  `;
}

function renderSettings() {
  $('#appNameInput').value = state.settings.appName;
  $('#piggyStartHint').textContent = `Empezó a contar el ${formatDateLabel(state.piggyStartDate || isoDate())}. Lleva ${getPiggyDaysElapsed()} día(s) y ${formatMoney(getPiggyTotal())}.`;
  renderCheckEditor();
  renderFailTypeEditor();
}

/* ── CHECKLIST EDITOR ───────────────────────────────────────── */
function renderCheckEditor() {
  const checks = getCustomChecks();
  const container = $('#checkEditor');
  if (!container) return;
  container.innerHTML = checks.map((title, i) => `
    <div class="check-edit-row">
      <span class="check-edit-num">${i + 1}</span>
      <input class="check-edit-input" data-check-edit="${i}" value="${escapeHtml(title)}" maxlength="60" />
      <button class="icon-danger" data-delete-check="${i}" type="button" aria-label="Eliminar hábito">×</button>
    </div>
  `).join('');
}

function saveCustomChecks() {
  const inputs = $$('[data-check-edit]');
  const checks = inputs.map((input) => input.value.trim()).filter(Boolean);
  if (!checks.length) { showToast('Necesitas al menos un hábito'); return; }
  state.settings.customChecks = checks;
  // reset today's checks to sync with new list
  const todayKey = isoDate();
  if (state.daily[todayKey]) {
    state.daily[todayKey].checks = checks.map((title, i) => ({ id: `check-${i}`, title, done: false }));
  }
  saveState();
  showToast('Hábitos actualizados');
  renderCheckEditor();
}

function addCustomCheck() {
  const checks = getCustomChecks();
  if (checks.length >= 10) { showToast('Máximo 10 hábitos'); return; }
  state.settings.customChecks = [...checks, 'Nuevo hábito'];
  saveState();
  renderCheckEditor();
  // focus the new input
  setTimeout(() => {
    const inputs = $$('[data-check-edit]');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  }, 50);
}

/* ── TIPOS DE FALLA EDITABLES ─────────────────────────────────── */
function renderFailTypeEditor() {
  const types = getCustomFailTypes();
  const container = $('#failTypeEditor');
  if (container) {
    container.innerHTML = types.map((title, i) => `
      <div class="check-edit-row">
        <span class="check-edit-num">${i + 1}</span>
        <input class="check-edit-input" data-failtype-edit="${i}" value="${escapeHtml(title)}" maxlength="60" />
        <button class="icon-danger" data-delete-failtype="${i}" type="button" aria-label="Eliminar tipo">×</button>
      </div>
    `).join('');
  }

  const repairs = getCustomRepairs();
  const repairContainer = $('#repairEditor');
  if (repairContainer) {
    repairContainer.innerHTML = repairs.map((title, i) => `
      <div class="check-edit-row">
        <span class="check-edit-num">${i + 1}</span>
        <input class="check-edit-input" data-repair-edit="${i}" value="${escapeHtml(title)}" maxlength="60" />
        <button class="icon-danger" data-delete-repair="${i}" type="button" aria-label="Eliminar reparación">×</button>
      </div>
    `).join('');
  }
}

function saveCustomFailTypes() {
  const inputs = $$('[data-failtype-edit]');
  const types = inputs.map((input) => input.value.trim()).filter(Boolean);
  if (!types.length) { showToast('Necesitas al menos un tipo de falla'); return; }
  state.settings.customFailTypes = types;
  saveState();
  showToast('Tipos de falla actualizados');
  renderFailTypeEditor();
}

function saveCustomRepairs() {
  const inputs = $$('[data-repair-edit]');
  const repairs = inputs.map((input) => input.value.trim()).filter(Boolean);
  if (!repairs.length) { showToast('Necesitas al menos una reparación'); return; }
  state.settings.customRepairs = repairs;
  saveState();
  showToast('Reparaciones actualizadas');
  renderFailTypeEditor();
}

function addCustomFailType() {
  const types = getCustomFailTypes();
  if (types.length >= 12) { showToast('Máximo 12 tipos'); return; }
  state.settings.customFailTypes = [...types, 'Nuevo tipo'];
  saveState();
  renderFailTypeEditor();
  setTimeout(() => {
    const inputs = $$('[data-failtype-edit]');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  }, 50);
}

function addCustomRepair() {
  const repairs = getCustomRepairs();
  if (repairs.length >= 12) { showToast('Máximo 12 reparaciones'); return; }
  state.settings.customRepairs = [...repairs, 'Nueva reparación'];
  saveState();
  renderFailTypeEditor();
  setTimeout(() => {
    const inputs = $$('[data-repair-edit]');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  }, 50);
}

function populateFailModalSelects() {
  const typeSelect = $('#failTypeSelect');
  const repairSelect = $('#failRepairSelect');
  if (typeSelect) {
    typeSelect.innerHTML = getCustomFailTypes().map((t) => `<option>${escapeHtml(t)}</option>`).join('');
  }
  if (repairSelect) {
    repairSelect.innerHTML = getCustomRepairs().map((r) => `<option>${escapeHtml(r)}</option>`).join('');
  }
}

function render() {
  if (activeView === 'today')    renderToday();
  if (activeView === 'summary')  renderSummary();
  if (activeView === 'missions') renderMissions();
  if (activeView === 'piggy')    renderPiggy();
  if (activeView === 'schedule') renderSchedule();
  if (activeView === 'settings') renderSettings();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function attachEvents() {
  $$('.nav-item').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  $$('[data-view-shortcut]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.viewShortcut)));
  $('#themeToggle').addEventListener('click', () => setTheme(state.settings.theme === 'dark' ? 'light' : 'dark'));

  document.body.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open]');
    if (opener) {
      if (opener.dataset.open === 'failModal') populateFailModalSelects();
      $(`#${opener.dataset.open}`)?.showModal();
      return;
    }

    const missionFilter = event.target.closest('[data-mission-filter]');
    if (missionFilter) { activeMissionFilter = missionFilter.dataset.missionFilter; renderMissions(); return; }

    const day = event.target.closest('[data-day]');
    if (day) { activeDay = day.dataset.day; renderSchedule(); return; }

    const deleteMission = event.target.closest('[data-delete-mission]');
    if (deleteMission) {
      if (confirm('¿Eliminar esta misión?')) {
        state.missions = state.missions.filter((m) => m.id !== deleteMission.dataset.deleteMission);
        saveState(); renderMissions(); showToast('Misión eliminada');
      }
      return;
    }

    const deleteStep = event.target.closest('[data-delete-step]');
    if (deleteStep) {
      const [missionId, stepId] = deleteStep.dataset.deleteStep.split('|');
      const mission = state.missions.find((m) => m.id === missionId);
      if (mission) { mission.steps = mission.steps.filter((s) => s.id !== stepId); saveState(); renderMissions(); }
      return;
    }

    const deleteFail = event.target.closest('[data-delete-fail]');
    if (deleteFail) { state.failures = state.failures.filter((f) => f.id !== deleteFail.dataset.deleteFail); saveState(); renderPiggy(); showToast('Registro eliminado'); return; }

    const deleteBlock = event.target.closest('[data-delete-block]');
    if (deleteBlock) { state.schedule[activeDay] = (state.schedule[activeDay] || []).filter((b) => b.id !== deleteBlock.dataset.deleteBlock); saveState(); renderSchedule(); return; }

    const deleteCheck = event.target.closest('[data-delete-check]');
    if (deleteCheck) {
      const checks = getCustomChecks();
      if (checks.length <= 1) { showToast('Necesitas al menos un hábito'); return; }
      const idx = Number(deleteCheck.dataset.deleteCheck);
      checks.splice(idx, 1);
      state.settings.customChecks = checks;
      saveState(); renderCheckEditor();
      return;
    }

    const deleteFailType = event.target.closest('[data-delete-failtype]');
    if (deleteFailType) {
      const types = getCustomFailTypes();
      if (types.length <= 1) { showToast('Necesitas al menos un tipo'); return; }
      const idx = Number(deleteFailType.dataset.deleteFailtype);
      types.splice(idx, 1);
      state.settings.customFailTypes = types;
      saveState(); renderFailTypeEditor();
      return;
    }

    const deleteRepair = event.target.closest('[data-delete-repair]');
    if (deleteRepair) {
      const repairs = getCustomRepairs();
      if (repairs.length <= 1) { showToast('Necesitas al menos una reparación'); return; }
      const idx = Number(deleteRepair.dataset.deleteRepair);
      repairs.splice(idx, 1);
      state.settings.customRepairs = repairs;
      saveState(); renderFailTypeEditor();
      return;
    }

    if (event.target.id === 'addCheckBtn') { addCustomCheck(); return; }
    if (event.target.id === 'saveChecksBtn') { saveCustomChecks(); return; }
    if (event.target.id === 'addFailTypeBtn') { addCustomFailType(); return; }
    if (event.target.id === 'saveFailTypesBtn') { saveCustomFailTypes(); return; }
    if (event.target.id === 'addRepairBtn') { addCustomRepair(); return; }
    if (event.target.id === 'saveRepairsBtn') { saveCustomRepairs(); return; }
  });

  document.body.addEventListener('change', (event) => {
    const checkInput = event.target.closest('[data-check-index]');
    if (checkInput) {
      const today = ensureToday();
      today.checks[Number(checkInput.dataset.checkIndex)].done = checkInput.checked;
      saveState(); renderToday(); return;
    }

    const stepInput = event.target.closest('[data-step]');
    if (stepInput) {
      const [missionId, stepId] = stepInput.dataset.step.split('|');
      const mission = state.missions.find((m) => m.id === missionId);
      const step = mission?.steps.find((s) => s.id === stepId);
      if (step) {
        step.done = stepInput.checked;
        saveState();
        renderMissions();
        // Celebrar si se completa la misión
        const allDone = mission.steps.every((s) => s.done);
        if (allDone && stepInput.checked) {
          showToast(`🎯 ¡"${mission.title}" completada!`);
          triggerConfetti();
        }
      }
    }
  });

  document.body.addEventListener('submit', (event) => {
    const addStep = event.target.closest('[data-add-step]');
    if (addStep) {
      event.preventDefault();
      const input = addStep.querySelector('input[name="step"]');
      const title = input.value.trim();
      if (!title) return;
      const mission = state.missions.find((m) => m.id === addStep.dataset.addStep);
      mission.steps.push({ id: uid('step'), title, done: false });
      input.value = '';
      saveState(); renderMissions();
    }
  });

  $('#missionForm').addEventListener('submit', (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const steps = String(form.get('steps') || '').split(',').map((s) => s.trim()).filter(Boolean).map((title) => ({ id: uid('step'), title, done: false }));
    state.missions.push({
      id: uid('mission'),
      title: String(form.get('title')).trim(),
      category: String(form.get('category')),
      steps: steps.length ? steps : [{ id: uid('step'), title: 'Primer paso pequeño', done: false }]
    });
    saveState(); event.currentTarget.reset(); $('#missionModal').close(); activeView = 'missions'; renderMissions(); showToast('Misión creada');
  });

  $('#failForm').addEventListener('submit', (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.failures.push({
      id: uid('fail'),
      date: isoDate(),
      createdAt: new Date().toISOString(),
      type: String(form.get('type')),
      amount: 1000,
      repair: String(form.get('repair')),
      note: String(form.get('note') || '').trim()
    });
    saveState(); event.currentTarget.reset(); $('#failModal').close(); render(); showToast('Registrado. Repara y sigue.');
  });

  $('#scheduleForm').addEventListener('submit', (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.schedule[activeDay] = state.schedule[activeDay] || [];
    state.schedule[activeDay].push({ id: uid('block'), time: String(form.get('time')).trim(), title: String(form.get('title')).trim(), kind: String(form.get('kind')) });
    saveState(); event.currentTarget.reset(); $('#scheduleModal').close(); renderSchedule(); showToast('Bloque agregado');
  });

  $('#resetTodayBtn').addEventListener('click', () => {
    if (!confirm('¿Limpiar los checks de hoy?')) return;
    const today = ensureToday();
    today.checks.forEach((c) => c.done = false);
    saveState(); renderToday();
  });

  $('#resetScheduleBtn').addEventListener('click', () => {
    if (!confirm('¿Reemplazar el horario por el sugerido?')) return;
    state.schedule = getSuggestedSchedule();
    saveState(); renderSchedule(); showToast('Horario sugerido cargado');
  });

  $('#saveSettingsBtn').addEventListener('click', () => {
    setAppName($('#appNameInput').value);
    render(); showToast('Ajustes guardados');
  });

  $('#resetPiggyBtn').addEventListener('click', () => {
    if (!confirm('¿Reiniciar la alcancía desde hoy? El monto acumulado anterior se pierde.')) return;
    state.piggyStartDate = isoDate();
    saveState(); render(); showToast('Alcancía reiniciada desde hoy');
  });

  // Navegacion entre meses en resumen
  $('#prevMonthBtn').addEventListener('click', () => {
    activeMonthOffset -= 1;
    renderSummary();
  });

  $('#nextMonthBtn').addEventListener('click', () => {
    if (activeMonthOffset < 0) {
      activeMonthOffset += 1;
      renderSummary();
    }
  });

  $('#exportBtn').addEventListener('click', exportData);
  $('#importInput').addEventListener('change', importData);
  $('#resetAllBtn').addEventListener('click', () => {
    if (!confirm('¿Seguro que quieres borrar todo?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = getDefaultState();
    setAppName(state.settings.appName);
    setTheme(state.settings.theme);
    navigate('today');
    showToast('Datos reiniciados');
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rutina-backup-${isoDate()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!imported || !Array.isArray(imported.missions)) throw new Error('Formato inválido');
      state = { ...getDefaultState(), ...imported };
      saveState(); setAppName(state.settings.appName); setTheme(state.settings.theme); render(); showToast('Datos importados');
    } catch (error) {
      console.error(error); showToast('No pude importar ese archivo');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function registerInstallPrompt() {
  // Mantiene el prompt nativo del navegador disponible (banner de "Instalar app")
  window.addEventListener('beforeinstallprompt', (event) => { deferredInstallPrompt = event; });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; showToast('App instalada'); });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW error', e));
  }
}

function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#f0c040', '#00ffb3', '#a78bfa', '#38bdf8', '#f87171'];
  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 2,
    life: 1
  }));
  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.life -= 0.015;
      if (p.life <= 0) continue;
      alive = true;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (alive) { frame = requestAnimationFrame(draw); }
    else { canvas.remove(); }
  }
  draw();
  setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 3000);
}

function init() {
  ensureToday();
  // Default dark para nuevos usuarios
  if (!state.settings.theme) state.settings.theme = 'dark';
  document.documentElement.dataset.theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  setAppName(state.settings.appName || 'Rutina');
  $('#themeToggle').textContent = state.settings.theme === 'dark' ? '☀' : '☾';
  activeDay = WEEK_DAYS.includes(todayName()) ? todayName() : 'Lunes';
  registerInstallPrompt();
  attachEvents();
  render();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
