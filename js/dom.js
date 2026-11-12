// Small DOM helpers shared by every screen.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && k !== 'list' && k !== 'type') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
  restart: '<path d="M6 5v14"/><path d="M19 5.5v13L9 12z" fill="currentColor" stroke="none"/>',
  loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
  metronome: '<path d="M9 3h6l4 18H5z"/><path d="M12 15l5-9"/><path d="M7.5 15h9"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  tracks: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="7" cy="17" r="2" fill="var(--surface)"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.700-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.300M11 8.500v5M8.500 11h5"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.300M8.500 11h5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.500 6.500l4 4"/>',
  today: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M8.5 13l2.5 2.500 4.500-5"/>',
  stats: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.500 11a6.500 6.500 0 0013 0M12 17.500V21"/>',
  swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h13a4 4 0 014 4"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8a4 4 0 01-4-4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 114 2c-.9.600-1.500 1.200-1.500 2.300"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="17.500" cy="16" r="2.500"/>',
};

export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span;
}

// ---- toast ----

let toastTimer = null;
export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---- bottom sheet ----

export function sheet(title, build) {
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  const body = h('div', { class: 'sheet-body' });
  const panel = h(
    'div',
    { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' }, h('h2', null, title), h('button', { class: 'btn ghost small', onclick: close }, 'Close')),
    body
  );
  const backdrop = h('div', {
    class: 'backdrop',
    onclick: (e) => {
      if (e.target === backdrop) close();
    },
  }, panel);
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  build(body, close);
  const first = body.querySelector('input, textarea, select');
  if (first) setTimeout(() => first.focus(), 60);
  return close;
}

export function confirmSheet(title, message, confirmLabel, onConfirm) {
  sheet(title, (body, close) => {
    body.append(
      h('p', { class: 'muted' }, message),
      h('div', { class: 'row end gap' },
        h('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
        h('button', { class: 'btn danger', onclick: () => { close(); onConfirm(); } }, confirmLabel)
      )
    );
  });
}

// A labelled form field.
export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

// ---- formatting ----

export function ago(iso) {
  if (!iso) return 'not yet practised';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Tiny line chart of a section's BPM history.
export function sparkline(log, target, width = 96, height = 30) {
  if (!log || log.length < 2) return null;
  const values = log.slice(-30).map((e) => e.bpm);
  const max = Math.max(...values, target || 0);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const pad = 3;
  const x = (i) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v) => height - pad - ((v - min) * (height - pad * 2)) / span;
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const targetLine = target
    ? `<line x1="${pad}" x2="${width - pad}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" class="spark-target"/>`
    : '';
  const el = document.createElement('span');
  el.className = 'spark';
  el.innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Tempo history">` +
    `${targetLine}<polyline points="${pts}" class="spark-line"/>` +
    `<circle cx="${x(values.length - 1).toFixed(1)}" cy="${y(values[values.length - 1]).toFixed(1)}" r="2.6" class="spark-dot"/></svg>`;
  return el;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', style: { display: 'none' } });
    if (accept) input.accept = accept;
    input.addEventListener('change', () => {
      resolve(input.files && input.files[0] ? input.files[0] : null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

// ---- ratings ----

export const RATING_LABEL = { rough: 'Rough', ok: 'Okay', clean: 'Clean' };

// Three buttons: Rough, Okay, Clean. The current one is filled in.
export function rater(current, onPick, { small = false } = {}) {
  return h('div', { class: 'rater' + (small ? ' small' : ''), role: 'group', 'aria-label': 'How did it go?' },
    Object.entries(RATING_LABEL).map(([key, label]) =>
      h('button', { type: 'button', class: `rate ${key}` + (current === key ? ' on' : ''), 'aria-pressed': current === key ? 'true' : 'false', onclick: () => onPick(key) }, label)));
}

// A song drawn as its sections in playing order, coloured by rating, with the joins between them.
export function mapStrip(form, transitions, onSection, onJoin) {
  const strip = h('div', { class: 'map' + (onSection ? '' : ' mini') });
  form.forEach((section, i) => {
    if (i > 0) {
      const tr = transitions.find((t) => t.from.id === form[i - 1].id && t.to.id === section.id);
      const cls = 'join ' + (tr && tr.state.rating ? tr.state.rating : '');
      strip.append(tr && onJoin
        ? h('button', { class: cls, 'aria-label': `${tr.from.name} into ${tr.to.name}: ${RATING_LABEL[tr.state.rating] || 'not rated'}`, onclick: () => onJoin(tr) })
        : h('span', { class: cls }));
    }
    const cls = 'part ' + (section.rating || '') + (section.focus ? ' focus' : '');
    const fb = section.focus ? section.focusBars : null;
    strip.append(onSection
      ? h('button', { class: cls, onclick: () => onSection(section) }, section.name,
          fb ? h('small', null, fb.from === fb.to ? ` ${fb.from}` : ` ${fb.from}–${fb.to}`) : null)
      : h('span', { class: cls, title: section.name }));
  });
  return strip;
}

// A larger line chart: values over time, with an optional dashed target.
export function lineChart(points, { target = null, width = 320, height = 110, unit = '' } = {}) {
  if (!points.length) return null;
  const values = points.map((p) => p.v);
  const max = Math.max(...values, target || 0);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const padX = 8, padTop = 16, padBottom = 18;
  const x = (i) => (points.length === 1 ? width / 2 : padX + (i * (width - padX * 2)) / (points.length - 1));
  const y = (v) => height - padBottom - ((v - min) * (height - padTop - padBottom)) / span;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const el = document.createElement('div');
  el.className = 'chart';
  el.innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="From ${values[0]} to ${values[last]} ${unit}">` +
    (target ? `<line x1="${padX}" x2="${width - padX}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" class="spark-target"/>` : '') +
    (points.length > 1 ? `<polyline points="${line}" class="spark-line"/>` : '') +
    points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i === last ? 3.6 : 2.2}" class="spark-dot"/>`).join('') +
    `<text x="${padX}" y="${height - 4}" class="chart-label">${points[0].label}</text>` +
    `<text x="${width - padX}" y="${height - 4}" text-anchor="end" class="chart-label">${points[last].label}</text>` +
    `<text x="${Math.min(width - padX, Math.max(padX + 14, x(last)))}" y="${Math.max(11, y(values[last]) - 8)}" text-anchor="end" class="chart-value">${values[last]}</text>` +
    '</svg>';
  return el;
}

export function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
