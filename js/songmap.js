import * as store from './store.js';
import { h, icon, sheet, rater, mapStrip, RATING_LABEL } from './dom.js';

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

export function songMap(item) {
  const form = formOf(item);
  if (!form.length) return h('p', { class: 'muted hint' }, 'Add sections below and they will appear here as a map.');
  const transitions = store.songTransitions(item);
  return h('div', { class: 'stack' },
    mapStrip(form, transitions,
      (section) => rateSheet(section.name, section.bars ? `${section.bars} bars` : '', section, item),
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
