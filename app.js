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
const MISSION_CATEGORIES = ['Todas', 'Vida', 'Estudio', 'Social', 'Salud', 'Trabajo'];
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

function getFailLimit() {
  const value = Number(state?.settings?.monthlyFailLimit || 10);
  return Number.isFinite(value) && value > 0 ? Math.min(99, Math.round(value)) : 10;
}

function setFailLimit(value) {
  const limit = Math.min(99, Math.max(1, Math.round(Number(value) || 10)));
  state.settings.monthlyFailLimit = limit;
  const input = $('#failLimitInput');
  if (input) input.value = String(limit);
  saveState();
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

function getDefaultState() {
  return {
    settings: {
      appName: 'Rutina',
      theme: 'light',
      monthlyFailLimit: 10,
      customChecks: [...DEFAULT_CHECKS]
    },
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
        customChecks: parsed.settings?.customChecks?.length ? parsed.settings.customChecks : [...DEFAULT_CHECKS]
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

function getPiggyTotal() {
  return state.failures.reduce((sum, f) => sum + Number(f.amount || 0), 0);
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
  const strongFails = state.failures.filter((f) => f.date === dateKey && Number(f.amount) >= 5000).length;
  return done >= 3 && strongFails === 0;
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

  $('#monthlyDaysList').innerHTML = summary.rows.length ? [...summary.rows].reverse().map((row) => {
    const dayPercent = Math.round((row.doneCount / checks.length) * 100);
    const status = !row.registered ? 'Sin registrar' : row.doneCount === checks.length ? 'Completo' : row.doneCount >= 3 ? 'Bien' : 'Flojo';
    const doneItems = row.checks.filter((c) => c.done).map((c) => c.title);
    const pendingItems = row.registered
      ? row.checks.filter((c) => !c.done).map((c) => c.title)
      : ['No se abrió o no se cerró el checklist'];
    const failuresLabel = row.failures.length ? `${row.failures.length} falla(s)` : 'sin fallas';
    return `
      <article class="month-day-row ${row.doneCount === checks.length ? 'complete' : ''} ${!row.registered ? 'missing' : ''}">
        <span class="badge">${formatDateLabel(row.dateKey)}</span>
        <div>
          <strong>${status}</strong>
          <span class="muted">${row.doneCount}/${checks.length} checks · ${failuresLabel}</span>
          <p class="log-body muted"><b>Hecho:</b> ${doneItems.length ? escapeHtml(doneItems.join(', ')) : 'Nada marcado'}</p>
          <p class="log-body muted"><b>Faltó:</b> ${pendingItems.length ? escapeHtml(pendingItems.join(', ')) : 'Nada pendiente'}</p>
        </div>
        <span class="badge">${dayPercent}%</span>
      </article>
    `;
  }).join('') : '<div class="empty-state">Todavía no hay días para resumir.</div>';
}

function renderToday() {
  const today = ensureToday();
  const progress = getDailyProgress();
  const monthFailures = getMonthFailures();
  const circumference = 302;
  $('#todayLabel').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#dailyPercent').textContent = `${progress}%`;
  $('#dailyRing').style.strokeDashoffset = String(circumference - (circumference * progress) / 100);
  $('#streakCount').textContent = `${getStreak()} días`;
  const failLimit = getFailLimit();
  $('#failCount').textContent = `${monthFailures.length}/${failLimit}`;
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
    const percent = mission.steps.length ? Math.round((done / mission.steps.length) * 100) : 0;
    return `
      <article class="mission-card" data-mission-id="${mission.id}">
        <div class="mission-header">
          <div>
            <p class="eyebrow">${escapeHtml(mission.category)}</p>
            <h3>${escapeHtml(mission.title)}</h3>
          </div>
          <button class="icon-danger" data-delete-mission="${mission.id}" type="button" aria-label="Eliminar misión">×</button>
        </div>
        <div class="progress-bar"><span style="width:${percent}%"></span></div>
        <p class="muted">${done}/${mission.steps.length} pasos · ${percent}%</p>
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
  const monthFailures = getMonthFailures();
  const failLimit = getFailLimit();
  const used = monthFailures.length;
  const remaining = Math.max(0, failLimit - used);
  const rawPercent = Math.round((used / failLimit) * 100);
  const visualPercent = Math.min(100, Math.max(0, rawPercent));
  $('#piggyTitle').textContent = `${failLimit} fallas por mes`;
  $('#piggyFailCount').textContent = `${used}/${failLimit}`;
  $('#failRemaining').textContent = String(remaining);
  $('#piggyAmount').textContent = formatMoney(getPiggyTotal());
  $('#piggyProgressText').textContent = `${visualPercent}%`;
  $('#piggyProgressBar').style.width = `${visualPercent}%`;
  $('#piggyProgressBar').classList.toggle('full', used >= failLimit);
  $('#piggyProgressHelp').textContent = used >= failLimit
    ? `Llegaste al límite de ${failLimit} fallas este mes.`
    : `Te quedan ${remaining} fallas disponibles.`;
  $('#failList').innerHTML = monthFailures.length ? [...monthFailures].reverse().map((failure) => `
    <article class="log-item">
      <div class="log-meta">
        <span class="badge">${formatDateLabel(failure.date)}</span>
        <span class="badge fail-badge">${escapeHtml(failure.type)}</span>
        <span class="badge">${formatMoney(failure.amount)}</span>
      </div>
      <strong class="repair-label">Reparación: ${escapeHtml(failure.repair)}</strong>
      ${failure.note ? `<p class="log-body muted">${escapeHtml(failure.note)}</p>` : ''}
      <button class="secondary-button small" data-delete-fail="${failure.id}" type="button">Eliminar</button>
    </article>
  `).join('') : '<div class="empty-state">Sin fallas este mes. Bien ahí.</div>';
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
  $('#failLimitInput').value = String(getFailLimit());
  renderCheckEditor();
  updateInstallUI();
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
    if (opener) { $(`#${opener.dataset.open}`)?.showModal(); return; }

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

    if (event.target.id === 'addCheckBtn') { addCustomCheck(); return; }
    if (event.target.id === 'saveChecksBtn') { saveCustomChecks(); return; }
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
      if (step) { step.done = stepInput.checked; saveState(); renderMissions(); }
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
    const monthFailures = getMonthFailures();
    const failLimit = getFailLimit();
    if (monthFailures.length >= failLimit) showToast(`Llegaste a ${failLimit} fallas este mes.`);
    state.failures.push({
      id: uid('fail'),
      date: isoDate(),
      createdAt: new Date().toISOString(),
      type: String(form.get('type')),
      amount: Number(form.get('severity')),
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
    setFailLimit($('#failLimitInput').value);
    render(); showToast('Ajustes guardados');
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

  $('#installAppBtn').addEventListener('click', installApp);
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

function updateInstallUI() {
  const button = $('#installAppBtn');
  const hint = $('#installHint');
  if (!button || !hint) return;
  if (isInstalledApp()) {
    button.disabled = true; button.textContent = 'App instalada';
    hint.textContent = 'Ya estás usando Rutina como app instalada.';
    return;
  }
  button.disabled = false;
  button.textContent = deferredInstallPrompt ? 'Instalar app' : 'Cómo instalar';
  hint.textContent = deferredInstallPrompt
    ? 'Toca el botón para instalarla en el celular.'
    : 'En Android/Chrome usa el menú ⋮ → Instalar app. En iPhone: Compartir → Agregar a pantalla de inicio.';
}

async function installApp() {
  if (!deferredInstallPrompt) { showToast('Abre el menú del navegador y toca Instalar app.'); updateInstallUI(); return; }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  updateInstallUI();
}

function registerInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; updateInstallUI(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; updateInstallUI(); showToast('App instalada'); });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW error', e));
  }
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
