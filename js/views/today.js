import * as store from '../store.js';
import * as session from '../session.js';
import { h, icon, confirmSheet, toast, RATING_LABEL } from '../dom.js';
import { cardLink } from '../cards.js';
import { focusOf, focusText } from '../songmap.js';

const KIND_NOTE = { exercise: 'With the metronome', song: 'Song', changes: 'Your problem changes', improv: 'Your own backing track' };

function blockRow(b, redraw) {
  const item = b.ref ? store.getItem(b.ref) : null;
  let note = KIND_NOTE[b.kind];
  if (b.kind === 'song') note = b.rotation ? 'From your rotation' : item && item.artist ? item.artist : 'Song';
  if (b.kind === 'song' && item && focusOf(item).length) note = focusOf(item).map(focusText).join(' · ');
  if (b.kind === 'changes') {
    const n = store.getChanges().length;
    note = n ? `${n} on your list` : 'Nothing on your list yet';
  }

  const tick = h('button', {
    class: 'tick' + (b.done ? ' on' : ''), 'aria-label': b.done ? `${b.title} is done. Tap to undo.` : `Mark ${b.title} done`, 'aria-pressed': b.done ? 'true' : 'false',
    onclick: async () => {
      if (b.done) await session.update(b.id, { done: false });
      else await session.complete(b.id, null);
      redraw();
    },
  }, b.done ? icon('check', 18) : null);

  const minutes = b.kind === 'song'
    ? h('div', { class: 'seg mins', role: 'group', 'aria-label': 'Minutes' }, [5, 10].map((m) =>
        h('button', { class: b.minutes === m ? 'on' : '', onclick: async () => { await session.update(b.id, { minutes: m }); redraw(); } }, `${m}`)))
    : h('span', { class: 'mins-fixed num' }, `${b.minutes}`);

  return h('div', { class: 'card block-row' + (b.done ? ' done' : '') },
    tick,
    h('a', { class: 'block-main', href: `#/block/${b.id}` },
      h('div', { class: 'block-title' }, b.title),
      h('div', { class: 'muted small' }, [note, b.rating ? RATING_LABEL[b.rating] : null].filter(Boolean).join(' · '))),
    b.rotation && session.rotationPool().length > 1
      ? h('button', { class: 'btn ghost icon-btn', 'aria-label': 'Swap for another rotation song', onclick: async () => { await session.swapRotation(b.id); redraw(); } }, icon('swap', 20))
      : null,
    minutes,
    h('span', { class: 'muted small' }, 'min'));
}

export async function render(root) {
  await session.load();

  const draw = () => {
    const current = session.get();
    const sum = session.summary();
    const stats = h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('div', { class: 'num big' }, String(sum.streak)), h('div', { class: 'muted small' }, sum.streak === 1 ? 'day in a row' : 'days in a row')),
      h('div', { class: 'tile' }, h('div', { class: 'num big' }, String(sum.week)), h('div', { class: 'muted small' }, 'minutes this week')));

    if (!current) {
      const active = store.getItems().filter((i) => i.type === 'song' && i.activity === 'active');
      root.replaceChildren(
        h('header', { class: 'page-head' }, h('h1', null, 'Today')),
        h('div', { class: 'card pad stack' },
          h('p', null, 'How long have you got?'),
          h('div', { class: 'row gap' },
            h('button', { class: 'btn primary grow big-btn', onclick: async () => { await session.start(30); draw(); } }, '30 minutes'),
            h('button', { class: 'btn primary grow big-btn', onclick: async () => { await session.start(60); draw(); } }, '60 minutes')),
          h('p', { class: 'muted small' }, active.length
            ? `Scales, then ${active.map((i) => i.title).join(', ')}, then chord changes. The hour adds improvisation and a song from your rotation.`
            : 'Scales, then chord changes. Mark a song as Active in the Library to put it on the board.')),
        stats,
        h('div', { class: 'pad-top' }, cardLink('learn-song')));
      return;
    }

    const blocks = current.blocks;
    const done = blocks.filter((b) => b.done).length;
    const planned = blocks.reduce((a, b) => a + b.minutes, 0);
    root.replaceChildren(
      h('header', { class: 'page-head' },
        h('div', { class: 'grow head-title' },
          h('h1', null, 'Today'),
          h('div', { class: 'muted small' }, `${done} of ${blocks.length} done · ${planned} minutes planned`))),
      h('div', { class: 'bar board-bar' }, h('div', { class: 'bar-fill' + (done === blocks.length ? ' done' : ''), style: { width: `${Math.round((done / blocks.length) * 100)}%` } })),
      h('div', { class: 'board' }, blocks.map((b) => blockRow(b, draw))),
      h('div', { class: 'row gap pad-top' },
        h('button', { class: 'btn primary grow', onclick: async () => {
          const minutes = session.minutesOf(blocks.filter((b) => b.done || b.spent > 0));
          await session.finish();
          toast(minutes ? `Session saved: ${minutes} minutes` : 'Nothing was ticked, so nothing was saved');
          draw();
        } }, 'Finish session'),
        h('button', { class: 'btn ghost', onclick: () => confirmSheet('Throw this board away?', 'Ticks and ratings from this session won’t be saved. Tempos you logged and section ratings are kept.', 'Throw away', async () => { await session.discard(); draw(); }) }, 'Discard')),
      h('div', { class: 'pad-top' }, cardLink('learn-song')));
  };

  draw();
  return store.subscribe(draw);
}
