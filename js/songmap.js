import * as store from './store.js';
import { h, icon, sheet, rater, mapStrip, toast, RATING_LABEL } from './dom.js';

// The song map (sections in playing order, with the joins between them) and the chord-change list.
// Both are used on the practice board and in the library.

export function formOf(item) {
  return store.songForm(item).map((id) => item.sections.find((s) => s.id === id));
}

function rateSheet(title, hint, target, item) {
  sheet(title, (body, close) => {
    body.append(
      hint ? h('p', { class: 'muted small' }, hint) : null,
      rater(target.rating, async (r) => {
        store.setRating(target, r);
        await store.saveItem(item);
        close();
      }));
  });
}

// ---- the sections being worked on right now: two at most per song, each with an optional bar range ----

const MAX_FOCUS = 2;

export function barCount(section) {
  if (section.barCount) return section.barCount;
  const nums = (section.bars || '').match(/\d+/g);
  if (!nums) return 0;
  return Math.max(...nums.map(Number)) + (/half/.test(section.bars) ? 1 : 0);
}

export function focusOf(item) {
  return item.sections.filter((s) => s.focus);
}

export function focusText(section) {
  const b = section.focusBars;
  if (!b) return section.name;
  return b.from === b.to ? `${section.name}, bar ${b.from}` : `${section.name}, bars ${b.from} to ${b.to}`;
}

export function focusLine(item) {
  const focus = focusOf(item);
  if (!focus.length) return null;
  return h('div', { class: 'focus-line' }, h('span', { class: 'muted small' }, 'Working on'), focus.map((s) => h('strong', null, focusText(s))));
}

function sectionSheet(item, section) {
  sheet(section.name, (body, close) => {
    let anchor = null;
    const save = async () => { await store.saveItem(item); draw(); };
    const draw = () => {
      const n = barCount(section);
      const fb = section.focusBars;
      const count = (d) => h('button', { class: 'btn step', type: 'button', 'aria-label': d > 0 ? 'One more bar' : 'One fewer bar', onclick: () => {
        section.barCount = Math.max(1, Math.min(64, (n || 0) + d));
        if (fb && fb.to > section.barCount) section.focusBars = null;
        anchor = null;
        save();
      } }, d > 0 ? '+' : '−');
      body.replaceChildren(...[
        h('div', { class: 'field-label' }, 'How solid is it?'),
        rater(section.rating, (r) => { store.setRating(section, r); save(); }),
        h('label', { class: 'option' }, h('span', null, 'I’m working on this now'),
          h('input', { type: 'checkbox', checked: !!section.focus, onchange: (e) => {
            if (e.target.checked && focusOf(item).length >= MAX_FOCUS) {
              e.target.checked = false;
              toast(`You’re already working on ${focusOf(item).map((s) => s.name).join(' and ')}. Take one off first.`);
              return;
            }
            section.focus = e.target.checked;
            if (!section.focus) section.focusBars = null;
            anchor = null;
            save();
          } })),
        section.focus ? h('div', { class: 'stack tight' },
          h('div', { class: 'row gap' },
            h('div', { class: 'grow' },
              h('div', { class: 'field-label' }, fb ? (fb.from === fb.to ? `Bar ${fb.from}` : `Bars ${fb.from} to ${fb.to}`) : 'The whole section'),
              h('div', { class: 'muted small' }, anchor ? 'Now tap the last bar.' : 'Tap the first bar, then the last.')),
            count(-1), h('span', { class: 'num' }, n ? `${n} bars` : 'bars'), count(1)),
          n ? h('div', { class: 'bar-grid' }, Array.from({ length: n }, (_, i) => {
            const k = i + 1;
            const on = fb && k >= fb.from && k <= fb.to;
            return h('button', { class: 'bar-cell' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': `Bar ${k}`, onclick: () => {
              if (anchor == null) { anchor = k; section.focusBars = { from: k, to: k }; }
              else { section.focusBars = { from: Math.min(anchor, k), to: Math.max(anchor, k) }; anchor = null; }
              save();
            } }, String(k));
          })) : h('p', { class: 'muted small' }, 'Tap + until it shows how many bars this section has.'),
          fb ? h('div', null, h('button', { class: 'btn small', type: 'button', onclick: () => { section.focusBars = null; anchor = null; save(); } }, 'Whole section')) : null) : null,
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'button', onclick: close }, 'Done')),
      ].filter(Boolean));
    };
    draw();
  });
}

export function songMap(item) {
  const form = formOf(item);
  if (!form.length) return h('p', { class: 'muted hint' }, 'Add sections below and they will appear here as a map.');
  const transitions = store.songTransitions(item);
  return h('div', { class: 'stack' },
    mapStrip(form, transitions,
      (section) => sectionSheet(item, section),
      (tr) => rateSheet(`${tr.from.name} into ${tr.to.name}`, 'The change from one section to the next.', tr.state, item)),
    h('div', { class: 'legend muted small' },
      ['rough', 'ok', 'clean'].map((k) => h('span', null, h('i', { class: `swatch ${k}` }), RATING_LABEL[k])),
      h('span', null, h('i', { class: 'swatch' }), 'Not rated')));
}

export function miniMap(item) {
  const form = formOf(item);
  return form.length ? mapStrip(form, store.songTransitions(item)) : null;
}

export function transitionList(item) {
  const transitions = store.songTransitions(item);
  if (!transitions.length) return null;
  return h('ul', { class: 'plain rate-list' }, transitions.map((tr) =>
    h('li', null,
      h('span', { class: 'grow' }, `${tr.from.name} into ${tr.to.name}`),
      rater(tr.state.rating, async (r) => { store.setRating(tr.state, r); await store.saveItem(item); }, { small: true }))));
}

// Lets the playing order be rebuilt by tapping sections in turn.
export function openOrderSheet(item) {
  sheet('Song order', (body, close) => {
    let order = store.songForm(item).slice();
    const draw = () => {
      const name = (id) => (item.sections.find((s) => s.id === id) || {}).name;
      body.replaceChildren(
        h('p', { class: 'muted small' }, 'Tap sections in the order they are played. A section can appear more than once.'),
        h('div', { class: 'order' }, order.length
          ? order.map((id, i) => h('button', { class: 'chip on', 'aria-label': `Remove ${name(id)} from position ${i + 1}`, onclick: () => { order.splice(i, 1); draw(); } }, `${i + 1}. ${name(id)} ×`))
          : h('span', { class: 'muted' }, 'Nothing in the order yet.')),
        h('h3', null, 'Add to the end'),
        h('div', { class: 'order' }, item.sections.map((s) => h('button', { class: 'chip', onclick: () => { order.push(s.id); draw(); } }, s.name))),
        h('div', { class: 'row end gap' },
          h('button', { class: 'btn ghost', onclick: () => { order = []; draw(); } }, 'Clear'),
          h('button', { class: 'btn primary', onclick: async () => { item.form = order; await store.saveItem(item); close(); } }, 'Save order')));
    };
    draw();
  });
}

export function changesList({ editable = false } = {}) {
  const changes = store.getChanges();
  const input = h('input', { type: 'text', placeholder: 'e.g. G to C, F to Bm', autocomplete: 'off' });
  const form = h('form', { class: 'row gap add-change', onsubmit: async (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    await store.addChange(title);
  } }, input, h('button', { class: 'btn', type: 'submit' }, icon('plus', 18), 'Add'));
  return h('div', { class: 'stack' },
    changes.length
      ? h('ul', { class: 'plain rate-list' }, changes.map((c) =>
          h('li', null,
            h('span', { class: 'grow change-name' }, c.title),
            rater(c.rating, async (r) => { store.setRating(c, r); await store.saveItem(c); }, { small: true }),
            editable ? h('button', { class: 'btn ghost icon-btn', 'aria-label': `Remove ${c.title}`, onclick: () => store.removeRecord(c.id) }, icon('trash', 18)) : null)))
      : h('p', { class: 'muted hint' }, 'A running list of the chord changes that trip you up. Add one, practise it, and rate how it feels at the end.'),
    form);
}
