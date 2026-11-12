import * as store from '../store.js';
import * as session from '../session.js';
import { h, icon, toast, rater, clock } from '../dom.js';
import { metronome, keepAwake } from '../metronome.js';
import { mountFace } from '../face.js';
import { recordButton } from '../clips.js';
import { songMap, changesList } from '../songmap.js';
import { cardLink } from '../cards.js';

// One block of today's session: a countdown, whatever that block needs, and a rating at the end.

function chime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1175, 0.18], [1568, 0.36]].forEach(([freq, at]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.5);
      osc.connect(gain).connect(ac.destination);
      osc.start(ac.currentTime + at);
      osc.stop(ac.currentTime + at + 0.55);
    });
    setTimeout(() => ac.close(), 1500);
  } catch (e) { /* no sound available */ }
  if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
}

export async function render(root, { id }) {
  await session.load();
  const b = session.getBlock(id);
  if (!b) {
    root.append(h('div', { class: 'empty' }, h('h2', null, 'That block isn’t on today’s board'), h('a', { class: 'btn', href: '#/' }, 'Back to today')));
    return null;
  }
  const item = b.ref ? store.getItem(b.ref) : null;
  const cleanups = [];
  root.classList.add('block-view');

  // ---- timer ----
  const goal = () => b.minutes * 60;
  let startedAt = null;
  let base = b.spent || 0;
  let rang = base >= goal();
  let lastSave = 0;
  const spent = () => base + (startedAt ? (Date.now() - startedAt) / 1000 : 0);
  const timeEl = h('div', { class: 'timer-num' });
  const timeNote = h('div', { class: 'muted small' });
  const ring = h('div', { class: 'bar timer-bar' }, h('div', { class: 'bar-fill' }));
  const startBtn = h('button', { class: 'btn primary big-btn grow' });

  const drawTimer = () => {
    const s = spent();
    const left = goal() - s;
    timeEl.textContent = left >= 0 ? clock(left) : `+${clock(-left)}`;
    timeEl.classList.toggle('over', left < 0);
    timeNote.textContent = left >= 0 ? `of ${b.minutes} minutes` : 'over time';
    ring.firstChild.style.width = `${Math.min(100, (s / goal()) * 100)}%`;
    ring.firstChild.classList.toggle('done', left <= 0);
    startBtn.replaceChildren(icon(startedAt ? 'pause' : 'play', 24), startedAt ? 'Pause' : s > 0 ? 'Resume' : 'Start');
  };
  const save = () => session.update(b.id, { spent: Math.round(spent()) });
  const pause = () => {
    if (!startedAt) return;
    base = spent();
    startedAt = null;
    keepAwake(metronome.running);
    save();
    drawTimer();
  };
  startBtn.addEventListener('click', () => {
    if (startedAt) { pause(); return; }
    startedAt = Date.now();
    keepAwake(true);
    drawTimer();
  });
  const interval = setInterval(() => {
    if (!startedAt) return;
    drawTimer();
    if (!rang && spent() >= goal()) {
      rang = true;
      chime();
      toast(`${b.minutes} minutes are up`);
    }
    if (Date.now() - lastSave > 5000) { lastSave = Date.now(); save(); }
  }, 250);
  cleanups.push(() => { clearInterval(interval); if (startedAt) { base = spent(); startedAt = null; } save(); keepAwake(false); });

  // ---- what the block needs ----
  const body = h('div', { class: 'stack block-body' });

  if (b.kind === 'exercise' && item) {
    let section = item.sections[0] || null;
    const style = await store.getSetting('metroStyle', 'pendulum');
    const face = mountFace(style);
    cleanups.push(face.off, () => metronome.stop());
    const st = section ? store.sectionStats(section) : null;
    if (section && (section.lastBpm || st.current)) metronome.setBpm(section.lastBpm || st.current);
    const bpmEl = h('div', { class: 'bpm-mid num' });
    const toggle = h('button', { class: 'btn grow' });
    const logBtn = h('button', { class: 'btn log' });
    const lastEl = h('div', { class: 'muted small center' });
    const step = (d) => h('button', { class: 'btn step', 'aria-label': `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} bpm`, onclick: () => metronome.setBpm(metronome.bpm + d) }, (d > 0 ? '+' : '−') + Math.abs(d));
    const pick = item.sections.length > 1
      ? h('div', { class: 'chips' }, item.sections.map((s) => h('button', { class: 'chip' + (s === section ? ' on' : ''), onclick: (e) => {
          section = s;
          for (const c of e.target.parentNode.children) c.classList.toggle('on', c === e.target);
          if (s.lastBpm) metronome.setBpm(s.lastBpm);
          drawMetro();
        } }, s.name)))
      : null;
    const drawMetro = () => {
      bpmEl.replaceChildren(String(metronome.bpm), h('span', { class: 'bpm-unit' }, 'bpm'));
      toggle.replaceChildren(icon(metronome.running ? 'stop' : 'play', 20), metronome.running ? 'Stop the click' : 'Start the click');
      logBtn.replaceChildren(icon('check', 20), `Log ${metronome.bpm} bpm as clean`);
      const cur = section ? store.sectionStats(section) : null;
      lastEl.textContent = cur && cur.current ? `Last clean at ${cur.current} bpm · best ${cur.best}` : 'No tempo logged yet';
    };
    toggle.addEventListener('click', () => metronome.toggle());
    logBtn.addEventListener('click', async () => {
      if (!section) section = await store.addSection(item.id, { name: 'Whole thing' });
      await store.logBpm(item.id, section.id, metronome.bpm);
      toast(`Logged ${metronome.bpm} bpm`);
      drawMetro();
    });
    cleanups.push(metronome.on((type) => { if (type !== 'tick') drawMetro(); }));
    cleanups.push(() => { if (section && section.lastBpm !== metronome.bpm) { section.lastBpm = metronome.bpm; store.saveItem(item); } });
    const rec = recordButton(item.id);
    cleanups.push(rec.stop);
    drawMetro();
    body.append(...[pick, face.el,
      h('div', { class: 'tempo-row center' }, step(-5), step(-1), bpmEl, step(1), step(5)),
      lastEl,
      h('div', { class: 'row gap' }, toggle),
      logBtn,
      h('div', { class: 'row gap' }, rec.el, h('a', { class: 'btn ghost', href: `#/item/${item.id}` }, 'History'))].filter(Boolean));
  } else if (b.kind === 'song' && item) {
    const songsterr = item.links.find((l) => /songsterr\.com/i.test(l.url)) || item.links[0];
    const mapHolder = h('div');
    const drawMap = () => mapHolder.replaceChildren(item.goal === 'casual'
      ? h('p', { class: 'muted hint' }, 'A casual song: no map, just play around with it.')
      : songMap(item));
    drawMap();
    cleanups.push(store.subscribe(drawMap));
    body.append(
      h('p', { class: 'muted small' }, 'Tap a section, or the join between two, to rate it.'),
      mapHolder,
      h('div', { class: 'row gap wrap' },
        songsterr ? h('a', { class: 'btn', href: songsterr.url, target: '_blank', rel: 'noopener noreferrer' }, icon('note', 18), 'Open the tab') : null,
        h('a', { class: 'btn ghost', href: `#/item/${item.id}` }, 'Song page')),
      cardLink('learn-song'));
  } else if (b.kind === 'changes') {
    const holder = h('div');
    const drawList = () => {
      if (holder.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' && document.activeElement.value) return;
      holder.replaceChildren(changesList());
    };
    drawList();
    cleanups.push(store.subscribe(drawList));
    body.append(holder);
  } else if (b.kind === 'improv') {
    body.append(h('p', { class: 'muted' }, item && item.notes ? item.notes : 'Put on a backing track and play.'));
  }

  // ---- finishing ----
  const finish = h('div', { class: 'card pad stack finish' },
    h('div', { class: 'field-label' }, b.kind === 'changes' ? 'Rate each change above, then finish.' : 'How did it go?'),
    b.kind === 'changes'
      ? h('button', { class: 'btn primary', onclick: async () => { pause(); await session.complete(b.id, null); location.hash = '#/'; } }, 'Done')
      : rater(b.rating, async (r) => {
          pause();
          if (item) { store.setRating(item, r); await store.saveItem(item); }
          await session.complete(b.id, r);
          location.hash = '#/';
        }));

  root.append(
    h('header', { class: 'page-head' },
      h('a', { class: 'btn ghost icon-btn', href: '#/', 'aria-label': 'Back to today' }, icon('back')),
      h('div', { class: 'grow head-title' }, h('h1', null, b.title), item && item.artist ? h('div', { class: 'muted small' }, item.artist) : null)),
    h('div', { class: 'timer' }, timeEl, timeNote, ring,
      h('div', { class: 'row gap timer-actions' }, startBtn,
        h('button', { class: 'btn', 'aria-label': 'Add a minute', onclick: async () => { b.minutes += 1; rang = spent() >= goal(); await session.update(b.id, { minutes: b.minutes }); drawTimer(); } }, '+1 min'))),
    body, finish);
  drawTimer();

  return () => cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}
