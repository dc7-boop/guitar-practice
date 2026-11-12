import { h, icon } from './dom.js';

// Instruction cards: short how-to sheets that open over whatever screen you are on.
// To add one, give it an id, a title and a list of paragraphs or steps here.

export const CARDS = {
  'learn-song': {
    title: 'How to learn a song',
    body: [],
  },
};

export function cardLink(id) {
  const card = CARDS[id];
  if (!card) return null;
  return h('button', { class: 'card-link', type: 'button', onclick: () => openCard(id) }, icon('help', 18), card.title);
}

export function openCard(id) {
  const card = CARDS[id];
  if (!card) return;
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const panel = h('div', { class: 'how-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': card.title },
    h('button', { class: 'btn ghost icon-btn how-close', 'aria-label': 'Close', onclick: close }, icon('close', 22)),
    h('h2', null, card.title),
    card.body.length
      ? card.body.map((line) => h('p', null, line))
      : h('p', { class: 'muted' }, 'This card hasn’t been written yet.'));
  const backdrop = h('div', { class: 'backdrop center', onclick: (e) => { if (e.target === backdrop) close(); } }, panel);
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
}
