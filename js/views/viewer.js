import * as store from '../store.js';
import { h, icon } from '../dom.js';
import { metronome } from '../metronome.js';
import { openLogSheet } from '../log.js';

// Scanned tabs: PDFs and photos shown as pages, with a small metronome bar underneath.

async function renderPdf(container, data, isAlive) {
  const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  const width = Math.min(container.clientWidth || window.innerWidth, 1100);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const slots = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const slot = h('div', { class: 'page-slot', style: { aspectRatio: '8.5 / 11' } });
    slots.push(slot);
    container.append(slot);
  }
  // Pages are drawn as they scroll into view, so long PDFs open quickly.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting || entry.target.dataset.drawn) return;
      entry.target.dataset.drawn = '1';
      const n = slots.indexOf(entry.target) + 1;
      const page = await doc.getPage(n);
      if (!isAlive()) return;
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / unscaled.width) * dpr });
      const canvas = h('canvas', { width: Math.floor(viewport.width), height: Math.floor(viewport.height), 'aria-label': `Page ${n}` });
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      entry.target.style.aspectRatio = `${unscaled.width} / ${unscaled.height}`;
      entry.target.replaceChildren(canvas);
    });
  }, { rootMargin: '600px 0px' });
  slots.forEach((s) => observer.observe(s));
  return () => {
    observer.disconnect();
    doc.destroy();
  };
}

export async function render(root, { id }) {
  const hit = store.findFile(id);
  const data = hit ? await store.getFileData(id) : null;
  if (!hit || !data) {
    root.append(h('div', { class: 'empty' }, h('h2', null, 'That file is no longer on this device'), h('a', { class: 'btn', href: '#/' }, 'Back to the practice list')));
    return null;
  }
  const { item, file } = hit;
  let alive = true;
  let disposePdf = null;
  let objectUrl = null;

  root.classList.add('player-view');
  const pages = h('div', { class: 'pages' });
  const viewport = h('div', { class: 'player-viewport paper' }, pages);

  const bpmLabel = h('span', { class: 'num' });
  const startBtn = h('button', { class: 'btn primary play', onclick: () => metronome.toggle() });
  const draw = () => {
    bpmLabel.textContent = `${metronome.bpm}`;
    startBtn.replaceChildren(icon(metronome.running ? 'stop' : 'play', 26));
    startBtn.setAttribute('aria-label', metronome.running ? 'Stop the metronome' : 'Start the metronome');
  };
  const off = metronome.on((type) => {
    if (type !== 'tick') draw();
  });
  const step = (d) => h('button', { class: 'btn step', 'aria-label': `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} bpm`, onclick: () => metronome.setBpm(metronome.bpm + d) }, (d > 0 ? '+' : '−') + Math.abs(d));

  root.append(
    h('header', { class: 'player-top' },
      h('a', { class: 'btn ghost icon-btn', href: `#/item/${item.id}`, 'aria-label': `Back to ${item.title}` }, icon('back')),
      h('div', { class: 'grow head-title' }, h('div', { class: 'player-title clip' }, item.title), h('div', { class: 'muted small clip' }, file.name))),
    viewport,
    h('footer', { class: 'player-controls' },
      startBtn,
      h('div', { class: 'speed' }, step(-5), step(-1), h('div', { class: 'speed-label' }, bpmLabel, h('span', { class: 'muted small' }, 'bpm')), step(1), step(5)),
      h('button', { class: 'btn ghost icon-btn', 'aria-label': 'Log this tempo', onclick: () => openLogSheet({ itemId: item.id, bpm: metronome.bpm }) }, icon('check', 24)))
  );
  draw();

  try {
    if (file.kind === 'pdf') {
      disposePdf = await renderPdf(pages, data, () => alive);
    } else {
      objectUrl = URL.createObjectURL(new Blob([data], { type: file.type || 'image/*' }));
      pages.append(h('img', { src: objectUrl, alt: file.name, class: 'page-image' }));
    }
  } catch (e) {
    console.error(e);
    pages.replaceChildren(h('div', { class: 'empty' }, h('h2', null, 'This file couldn’t be opened'), h('p', { class: 'muted' }, 'It may be damaged or in a format this device can’t show.')));
  }

  return () => {
    alive = false;
    off();
    if (disposePdf) disposePdf();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}
