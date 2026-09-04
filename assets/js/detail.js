// 详情页渲染 — 按 ?id=分类.条目 从数据文件取条目并生成页面

const CATEGORIES = {
  people:   { data: window.WY_PEOPLE,   juan: '卷三 · 人物村居', anchor: 'index.html#ren' },
  villages: { data: window.WY_VILLAGES, juan: '卷三 · 人物村居', anchor: 'index.html#ren' },
  culture:  { data: window.WY_CULTURE,  juan: '卷二 · 文华物候', anchor: 'index.html#wen' }
};

const ORDINALS = ['壹', '貳', '叄', '肆', '伍', '陸', '柒', '捌'];

function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  (children || []).forEach((c) => c && node.appendChild(c));
  return node;
}

function parseId(raw) {
  const [category, slug] = String(raw || '').split('.');
  const bucket = CATEGORIES[category];
  const entry = bucket && bucket.data && bucket.data[slug];
  return entry ? { category, slug, entry, bucket } : null;
}

function verticalName(name) {
  const h1 = el('h1', { class: 'entry__name', 'aria-label': name });
  [...name].forEach((ch) => h1.appendChild(el('span', { text: ch })));
  return h1;
}

function renderSections(sections) {
  return (sections || []).map((sec, i) =>
    el('section', { class: 'sect' }, [
      el('h2', { class: 'sect__t' }, [
        el('b', { class: 'sect__ord', text: ORDINALS[i] || '' }),
        el('span', { text: sec.t })
      ]),
      ...(sec.p || []).map((text) => el('p', { text }))
    ])
  );
}

function renderCaveats(caveats) {
  if (!caveats || !caveats.length) return null;
  return el('section', { class: 'caveats' }, [
    el('h2', { class: 'caveats__t', text: '待考订' }),
    el('p', { class: 'caveats__note', text: '以下各项在不同文献中说法不一或缺乏确证，定稿前需逐条核实。' }),
    el('ol', { class: 'caveats__list' }, caveats.map((c) => el('li', { text: c })))
  ]);
}

function renderFacts(facts) {
  if (!facts || !facts.length) return null;
  return el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__t', text: '小档案' }),
    el('dl', { class: 'facts' }, facts.flatMap((f) => [
      el('dt', { text: f.k }),
      el('dd', { text: f.v })
    ]))
  ]);
}

function renderRelated(related) {
  const links = (related || [])
    .map((rid) => ({ rid, hit: parseId(rid) }))
    .filter((x) => x.hit);
  if (!links.length) return null;

  return el('div', { class: 'panel' }, [
    el('h2', { class: 'panel__t', text: '延伸' }),
    el('ul', { class: 'related' }, links.map(({ rid, hit }) =>
      el('li', {}, [
        el('a', { href: 'detail.html?id=' + rid }, [
          el('b', { text: hit.entry.name }),
          el('span', { text: hit.entry.kind || '' })
        ])
      ])
    ))
  ]);
}

function renderNav(category, slug) {
  const nav = document.getElementById('topbarNav');
  const keys = Object.keys(CATEGORIES[category].data);
  const i = keys.indexOf(slug);
  const make = (targetSlug, label) => {
    if (!targetSlug) return el('span', { class: 'topbar__link is-off', text: label });
    const entry = CATEGORIES[category].data[targetSlug];
    return el('a', {
      class: 'topbar__link',
      href: 'detail.html?id=' + category + '.' + targetSlug,
      title: entry.name
    }, [el('span', { text: label + ' ' + entry.name })]);
  };
  nav.appendChild(make(keys[i - 1], '←'));
  nav.appendChild(el('i', { class: 'topbar__sep' }));
  nav.appendChild(make(keys[i + 1], '→'));
}

function renderNotFound(rawId) {
  document.title = '此卷未录 · 徽州婺源';
  return el('div', { class: 'wrap wrap--narrow' }, [
    el('div', { class: 'notfound' }, [
      el('div', { class: 'notfound__seal', text: '未' }),
      el('h1', { text: '此卷未录' }),
      el('p', {
        text: rawId
          ? '所寻条目「' + rawId + '」不在册中。或是链接有误，或是该篇尚未撰写。'
          : '未指定条目。请从卷首择一篇进入。'
      }),
      el('a', { class: 'notfound__back', href: 'index.html', text: '← 返回卷首' })
    ])
  ]);
}

function renderEntry(hit) {
  const { entry, bucket, category, slug } = hit;
  document.title = entry.name + ' · 徽州婺源';

  const head = el('div', { class: 'entry__head' }, [
    el('p', { class: 'entry__juan' }, [
      el('a', { href: bucket.anchor, text: bucket.juan })
    ]),
    verticalName(entry.name),
    el('p', {
      class: 'entry__meta',
      text: [entry.dates, entry.kind].filter(Boolean).join('　·　')
    }),
    entry.lede ? el('p', { class: 'entry__lede', text: entry.lede }) : null
  ]);

  const body = el('div', { class: 'entry__body' }, [
    el('div', { class: 'entry__main' }, [
      ...renderSections(entry.sections),
      renderCaveats(entry.caveats)
    ]),
    el('aside', { class: 'entry__side' }, [
      renderFacts(entry.facts),
      renderRelated(entry.related)
    ])
  ]);

  renderNav(category, slug);

  return el('article', { class: 'entry' }, [
    el('div', { class: 'wrap wrap--entry' }, [head, body])
  ]);
}

const rawId = new URLSearchParams(location.search).get('id');
const hit = parseId(rawId);
document.getElementById('entry').appendChild(hit ? renderEntry(hit) : renderNotFound(rawId));
