import * as store from './store.js';
import { h, icon } from './dom.js';
import { metronome, keepAwake } from './metronome.js';
import * as listView from './views/list.js';
import * as itemView from './views/item.js';
import * as metronomeView from './views/metronome.js';
import * as playerView from './views/player.js';
import * as viewerView from './views/viewer.js';
import * as settingsView from './views/settings.js';

const routes = [
  { match: /^\/$/, view: listView, nav: 'list' },
  { match: /^\/item\/([^/]+)$/, view: itemView, nav: 'list' },
  { match: /^\/metronome$/, view: metronomeView, nav: 'metronome' },
  { match: /^\/play\/([^/]+)$/, view: playerView, nav: null },
  { match: /^\/view\/([^/]+)$/, view: viewerView, nav: null },
  { match: /^\/settings$/, view: settingsView, nav: 'settings' },
];

const viewEl = document.getElementById('view');
const navEl = document.getElementById('nav');
let cleanup = null;
let current = null;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path, query: new URLSearchParams(query) };
}

function renderNav(active) {
  navEl.hidden = active === null;
  document.body.classList.toggle('immersive', active === null);
  navEl.replaceChildren(
    ...[
      ['list', '#/', 'Practice', 'list'],
      ['metronome', '#/metronome', 'Metronome', 'metronome'],
      ['settings', '#/settings', 'Settings', 'settings'],
    ].map(([key, href, label, ic]) =>
      h('a', { href, class: 'nav-link' + (key === active ? ' active' : ''), 'aria-current': key === active ? 'page' : null }, icon(ic, 24), h('span', null, label))
    )
  );
}

async function route() {
  const { path, query } = parseHash();
  if (cleanup) {
    try { cleanup(); } catch (e) { console.error(e); }
    cleanup = null;
  }
  const hit = routes.find((r) => r.match.test(path)) || routes[0];
  const params = path.match(hit.match) || [];
  // The metronome keeps running only on screens that show its controls.
  if (hit.view !== metronomeView && hit.view !== viewerView && metronome.running) metronome.stop();
  current = hit;
  renderNav(hit.nav);
  viewEl.replaceChildren();
  viewEl.className = 'view';
  window.scrollTo(0, 0);
  try {
    cleanup = (await hit.view.render(viewEl, { id: params[1] ? decodeURIComponent(params[1]) : null, query })) || null;
  } catch (e) {
    console.error(e);
    viewEl.replaceChildren(
      h('div', { class: 'empty' }, h('h2', null, 'Something went wrong on this screen'), h('p', { class: 'muted' }, String(e.message || e)), h('a', { class: 'btn', href: '#/' }, 'Back to the practice list'))
    );
  }
}

metronome.on((type) => {
  if (type === 'state') keepAwake(metronome.running);
});

async function boot() {
  await store.init();
  const saved = await store.getSetting('metronome');
  if (saved) metronome.set(saved);
  window.addEventListener('hashchange', route);
  await route();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
