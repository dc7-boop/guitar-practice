import * as store from '../store.js';
import { h, icon, sheet, field, ago } from '../dom.js';
import { miniMap, changesList } from '../songmap.js';

// The library: every song, exercise and chord change, whether or not it is on today's board.

export const GOALS = [['recording', 'Recording level'], ['fakebook', 'Fake book'], ['casual', 'Casual']];
export const ACTIVITIES = [['active', 'Active'], ['rotation', 'Rotation'], ['shelved', 'Shelved']];
export const GOAL_NOTE = {
  recording: 'Every part close to note-perfect, as on the record.',
  fakebook: 'All the parts and transitions, with some form of the chords.',
  casual: 'Learning bits as you go. No plan to finish it.',
};

let tab = 'song';

export function openAddItem(type = 'song') {
  const isSong = type === 'song';
  sheet(isSong ? 'Add a song' : 'Add an exercise', (body, close) => {
    const title = h('input', { type: 'text', placeholder: isSong ? 'e.g. Blackbird' : 'e.g. Alternate picking, 16ths', autocomplete: 'off' });
    const artist = h('input', { type: 'text', placeholder: 'e.g. The Beatles', autocomplete: 'off' });
    body.append(h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (!title.value.trim()) { title.focus(); return; }
        const item = store.newItem({ type, title: title.value.trim(), artist: isSong ? artist.value.trim() : '' });
        await store.saveItem(item);
        close();
        location.hash = `#/item/${item.id}`;
      },
    }, field('Title', title), isSong ? field('Artist', artist) : null, h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, 'Add'))));
  });
}

function songCard(item) {
  const goal = (GOALS.find(([k]) => k === item.goal) || GOALS[0])[1];
  return h('a', { class: 'card item-card', href: `#/item/${item.id}` },
    h('div', { class: 'item-title' }, item.title),
    h('div', { class: 'muted small' }, [item.artist, goal, ago(item.lastPracticedAt)].filter(Boolean).join(' · ')),
    item.goal === 'casual' ? null : miniMap(item));
}

function exerciseCard(item) {
  const best = item.sections.map((s) => store.sectionStats(s)).filter((s) => s.current);
  const tempo = best.length ? `${best[0].current} bpm` : 'No tempo logged';
  return h('a', { class: 'card item-card', href: `#/item/${item.id}` },
    h('div', { class: 'item-title' }, item.title),
    h('div', { class: 'muted small' }, [item.warmup ? 'Every session' : null, item.kind === 'improv' ? null : tempo, ago(item.lastPracticedAt)].filter(Boolean).join(' · ')));
}

export function render(root) {
  const content = h('div');
  const draw = () => {
    // Leave the screen alone while a new chord change is being typed.
    const typing = document.activeElement;
    if (tab === 'change' && content.contains(typing) && typing.tagName === 'INPUT' && typing.value) return;

    const head = h('header', { class: 'page-head' },
      h('h1', null, 'Library'),
      tab === 'change' ? null : h('button', { class: 'btn primary', onclick: () => openAddItem(tab) }, icon('plus', 20), tab === 'song' ? 'Song' : 'Exercise'));
    const chips = h('div', { class: 'chips' },
      [['song', 'Songs'], ['exercise', 'Exercises'], ['change', 'Chord changes']].map(([k, label]) =>
        h('button', { class: 'chip' + (tab === k ? ' on' : ''), onclick: () => { tab = k; draw(); } }, label)));

    let body;
    if (tab === 'change') {
      body = [h('section', { class: 'group' }, changesList({ editable: true }))];
    } else {
      const items = store.getItems().filter((i) => i.type === tab);
      body = ACTIVITIES.map(([key, label]) => {
        const list = items.filter((i) => i.activity === key).sort((a, b) => a.title.localeCompare(b.title));
        if (!list.length) return null;
        return h('section', { class: 'group' + (key === 'shelved' ? ' dim' : '') },
          h('h2', { class: 'group-title' }, label, h('span', { class: 'count' }, String(list.length))),
          list.map(tab === 'song' ? songCard : exerciseCard));
      }).filter(Boolean);
      if (!body.length) {
        body = [h('div', { class: 'empty' },
          h('h2', null, tab === 'song' ? 'No songs yet' : 'No exercises yet'),
          h('button', { class: 'btn primary', onclick: () => openAddItem(tab) }, tab === 'song' ? 'Add a song' : 'Add an exercise'))];
      }
    }
    content.replaceChildren(head, chips, ...body);
  };
  root.append(content);
  draw();
  return store.subscribe(draw);
}
