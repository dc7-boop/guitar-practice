import * as store from '../store.js';
import { h, icon, sheet, field, ago, toast } from '../dom.js';
import { addDemo } from '../demo.js';

export const STATUSES = [
  ['learning', 'Learning'],
  ['polishing', 'Polishing'],
  ['maintaining', 'Keeping up'],
  ['shelved', 'Shelved'],
];

let filter = 'all';

export function openAddItem() {
  sheet('Add to your list', (body, close) => {
    let type = 'song';
    const title = h('input', { type: 'text', placeholder: 'e.g. Blackbird', autocomplete: 'off' });
    const artist = h('input', { type: 'text', placeholder: 'e.g. The Beatles', autocomplete: 'off' });
    const artistField = field('Artist', artist);
    const seg = h('div', { class: 'seg' });
    const drawSeg = () => {
      seg.replaceChildren(
        ...[['song', 'Song'], ['exercise', 'Exercise']].map(([k, label]) =>
          h('button', {
            type: 'button',
            class: k === type ? 'on' : '',
            onclick: () => {
              type = k;
              artistField.hidden = k !== 'song';
              title.placeholder = k === 'song' ? 'e.g. Blackbird' : 'e.g. Alternate picking, 16ths';
              drawSeg();
            },
          }, label)
        )
      );
    };
    drawSeg();
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (!title.value.trim()) {
          title.focus();
          return;
        }
        const item = store.newItem({ type, title: title.value.trim(), artist: type === 'song' ? artist.value.trim() : '' });
        await store.saveItem(item);
        close();
        location.hash = `#/item/${item.id}`;
      },
    }, seg, field('Title', title), artistField, h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, 'Add')));
    body.append(form);
  });
}

function itemSummary(item) {
  const withTarget = item.sections.map((s) => store.sectionStats(s)).filter((s) => s.progress != null);
  const progress = withTarget.length ? withTarget.reduce((a, s) => a + s.progress, 0) / withTarget.length : null;
  const n = item.sections.length;
  let detail = n === 0 ? 'No sections yet' : n === 1 ? '1 section' : `${n} sections`;
  if (n === 1) {
    const st = store.sectionStats(item.sections[0]);
    if (st.current) detail = item.sections[0].targetBpm ? `${st.current} of ${item.sections[0].targetBpm} bpm` : `${st.current} bpm`;
  }
  return { progress, detail };
}

function card(item) {
  const { progress, detail } = itemSummary(item);
  return h('a', { class: 'card item-card', href: `#/item/${item.id}` },
    h('div', { class: 'item-card-main' },
      h('div', { class: 'item-title' }, item.title),
      h('div', { class: 'muted small' }, [item.type === 'song' ? item.artist || 'Song' : 'Exercise', detail, ago(item.lastPracticedAt)].join(' · '))
    ),
    progress != null ? h('div', { class: 'bar', title: `${Math.round(progress * 100)}% of target tempo` }, h('div', { class: 'bar-fill' + (progress >= 1 ? ' done' : ''), style: { width: `${Math.round(progress * 100)}%` } })) : null
  );
}

export function render(root) {
  const draw = () => {
    const all = store.getItems();
    const shown = all.filter((i) => filter === 'all' || i.type === filter);
    const head = h('header', { class: 'page-head' },
      h('h1', null, 'Practice'),
      h('button', { class: 'btn primary', onclick: openAddItem }, icon('plus', 20), 'Add')
    );

    if (!all.length) {
      root.replaceChildren(head,
        h('div', { class: 'empty' },
          h('h2', null, 'Nothing on the stand yet'),
          h('p', { class: 'muted' }, 'Add a song or an exercise, break it into sections, and log the tempo you can play each one cleanly.'),
          h('div', { class: 'row center gap wrap' },
            h('button', { class: 'btn primary', onclick: openAddItem }, 'Add your first one'),
            h('button', { class: 'btn', onclick: async () => { const item = await addDemo(); toast('Demo exercise added'); location.hash = `#/item/${item.id}`; } }, 'Try the demo exercise')
          )
        )
      );
      return;
    }

    const chips = h('div', { class: 'chips' },
      ...[['all', 'All'], ['song', 'Songs'], ['exercise', 'Exercises']].map(([k, label]) =>
        h('button', { class: 'chip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; draw(); } }, label)
      )
    );

    const groups = STATUSES.map(([key, label]) => {
      const list = shown.filter((i) => i.status === key)
        .sort((a, b) => (b.lastPracticedAt || b.createdAt).localeCompare(a.lastPracticedAt || a.createdAt));
      if (!list.length) return null;
      return h('section', { class: 'group' + (key === 'shelved' ? ' dim' : '') },
        h('h2', { class: 'group-title' }, label, h('span', { class: 'count' }, String(list.length))),
        list.map(card)
      );
    });

    root.replaceChildren(head, chips, ...groups.filter(Boolean),
      shown.length ? null : h('p', { class: 'muted pad' }, 'Nothing of that kind on the list.'));
  };
  draw();
  return store.subscribe(draw);
}
