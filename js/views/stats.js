import * as store from '../store.js';
import * as session from '../session.js';
import { h, lineChart, shortDate, RATING_LABEL } from '../dom.js';
import { miniMap, formOf } from '../songmap.js';

// Progress over time: practice minutes, picking speed per exercise, and how each song is coming along.

function minutesChart(sessions) {
  const days = [];
  const d = new Date();
  d.setDate(d.getDate() - 13);
  for (let i = 0; i < 14; i++) {
    const key = session.dayKey(d);
    days.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), minutes: sessions.filter((s) => session.dayKey(s.t) === key).reduce((a, s) => a + (s.minutes || 0), 0) });
    d.setDate(d.getDate() + 1);
  }
  const max = Math.max(30, ...days.map((x) => x.minutes));
  return h('div', { class: 'bars', role: 'img', 'aria-label': 'Minutes practised on each of the last 14 days' },
    days.map((x) => h('div', { class: 'bar-col' },
      h('div', { class: 'bar-val muted' }, x.minutes ? String(x.minutes) : ''),
      h('div', { class: 'bar-track' }, h('div', { class: 'bar-stick' + (x.minutes ? '' : ' zero'), style: { height: `${Math.max(3, (x.minutes / max) * 100)}%` } })),
      h('div', { class: 'bar-day muted' }, x.label))));
}

// A row of small coloured squares: one per time the thing was rated, oldest first.
function ratingTrail(ratings) {
  if (!ratings || !ratings.length) return h('span', { class: 'muted small' }, 'Not rated yet');
  return h('span', { class: 'trail', role: 'img', 'aria-label': 'Ratings over time: ' + ratings.slice(-16).map((r) => RATING_LABEL[r.r]).join(', ') },
    ratings.slice(-16).map((r) => h('i', { class: `swatch ${r.r}`, title: `${RATING_LABEL[r.r]} · ${shortDate(r.t)}` })));
}

export function render(root) {
  const sum = session.summary();
  const items = store.getItems();
  const exercises = items.filter((i) => i.type === 'exercise' && i.kind !== 'improv');
  const songs = items.filter((i) => i.type === 'song' && i.activity !== 'shelved');
  const improv = items.filter((i) => i.kind === 'improv');
  const changes = store.getChanges();

  const speed = exercises.flatMap((item) => item.sections.map((section) => ({ item, section }))).filter((x) => x.section.log.length);

  root.append(...[
    h('header', { class: 'page-head' }, h('h1', null, 'Stats')),
    h('div', { class: 'tiles three' },
      h('div', { class: 'tile' }, h('div', { class: 'num big' }, String(sum.streak)), h('div', { class: 'muted small' }, sum.streak === 1 ? 'day in a row' : 'days in a row')),
      h('div', { class: 'tile' }, h('div', { class: 'num big' }, String(sum.week)), h('div', { class: 'muted small' }, 'minutes this week')),
      h('div', { class: 'tile' }, h('div', { class: 'num big' }, String(sum.count)), h('div', { class: 'muted small' }, sum.count === 1 ? 'session' : 'sessions'))),

    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Minutes, last 14 days'),
      h('div', { class: 'card pad' }, minutesChart(sum.sessions))),

    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Picking speed'),
      speed.length
        ? speed.map(({ item, section }) => {
            const st = store.sectionStats(section);
            const name = item.sections.length > 1 ? `${item.title} · ${section.name}` : item.title;
            return h('a', { class: 'card pad stack tight', href: `#/item/${item.id}` },
              h('div', { class: 'row gap' }, h('div', { class: 'grow item-title' }, name),
                h('div', { class: 'num' }, `${st.current} bpm`)),
              lineChart(section.log.slice(-40).map((e) => ({ v: e.bpm, label: shortDate(e.t) })), { target: section.targetBpm, unit: 'bpm' }),
              h('div', { class: 'muted small' }, st.count > 1 ? `Started at ${st.first} · best ${st.best} · ${st.count} entries` : 'One entry so far. The line appears with the second.'));
          })
        : h('p', { class: 'muted hint' }, 'Log a clean tempo during a scale block and a chart will start here.')),

    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Songs'),
      songs.length
        ? songs.map((item) => {
            const form = formOf(item);
            const parts = item.sections;
            const clean = parts.filter((s) => s.rating === 'clean').length;
            const rated = parts.filter((s) => s.rating).length;
            return h('a', { class: 'card pad stack tight', href: `#/item/${item.id}` },
              h('div', { class: 'row gap' }, h('div', { class: 'grow item-title' }, item.title),
                h('div', { class: 'muted small' }, parts.length ? `${clean} of ${parts.length} clean` : '')),
              form.length && item.goal !== 'casual' ? miniMap(item) : null,
              h('div', { class: 'row gap' }, h('span', { class: 'muted small' }, 'Sessions'), ratingTrail(item.ratings)),
              rated || !parts.length ? null : h('div', { class: 'muted small' }, 'No sections rated yet.'));
          })
        : h('p', { class: 'muted hint' }, 'No songs on the go.')),

    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Chord changes'),
      changes.length
        ? h('div', { class: 'card pad' }, h('ul', { class: 'plain rate-list' }, changes.map((c) =>
            h('li', null, h('span', { class: 'grow change-name' }, c.title), ratingTrail(c.ratings)))))
        : h('p', { class: 'muted hint' }, 'Nothing on your list yet.')),

    improv.some((i) => i.ratings && i.ratings.length) ? h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Improvisation'),
      h('div', { class: 'card pad' }, h('ul', { class: 'plain rate-list' }, improv.map((i) =>
        h('li', null, h('span', { class: 'grow' }, i.title), ratingTrail(i.ratings)))))) : null
  ].filter(Boolean));
  return null;
}
