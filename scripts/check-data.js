// 一次性校验脚本：核对 18 个条目的必填字段与 related 指向
// 用法：node scripts/check-data.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const window = {};
['people', 'villages', 'culture'].forEach((f) => {
  const src = fs.readFileSync(path.join(root, 'assets/data', f + '.js'), 'utf8');
  new Function('window', src)(window);
});

const REG = {
  people: window.WY_PEOPLE,
  villages: window.WY_VILLAGES,
  culture: window.WY_CULTURE
};

const ids = [];
Object.entries(REG).forEach(([cat, bucket]) => {
  Object.keys(bucket).forEach((slug) => ids.push(cat + '.' + slug));
});

const problems = [];
const REQUIRED = ['name', 'dates', 'kind', 'lede', 'sections', 'facts', 'caveats', 'related'];

ids.forEach((id) => {
  const [cat, slug] = id.split('.');
  const e = REG[cat][slug];

  REQUIRED.forEach((k) => {
    const v = e[k];
    const empty = v === undefined || v === null || v === '' ||
                  (Array.isArray(v) && v.length === 0);
    if (empty) problems.push(`${id}: 缺少或为空的字段 ${k}`);
  });

  (e.sections || []).forEach((s, i) => {
    if (!s.t) problems.push(`${id}: sections[${i}] 缺少小节标题 t`);
    if (!Array.isArray(s.p) || !s.p.length) problems.push(`${id}: sections[${i}] 无正文段落`);
    (s.p || []).forEach((p, j) => {
      if (!p || !p.trim()) problems.push(`${id}: sections[${i}].p[${j}] 为空`);
      if (/[a-zA-Z]{4,}/.test(p) && !/Moyune/.test(p)) {
        problems.push(`${id}: sections[${i}].p[${j}] 含可疑英文串 → ${p.match(/[a-zA-Z]{4,}/)[0]}`);
      }
    });
  });

  (e.facts || []).forEach((f, i) => {
    if (!f.k || !f.v) problems.push(`${id}: facts[${i}] 的 k/v 不完整`);
  });

  (e.related || []).forEach((rid) => {
    const [rc, rs] = String(rid).split('.');
    if (!REG[rc] || !REG[rc][rs]) problems.push(`${id}: related 指向不存在的条目 ${rid}`);
    if (rid === id) problems.push(`${id}: related 指向了自己`);
  });

  if (e.hero) {
    if (!fs.existsSync(path.join(root, e.hero))) {
      problems.push(`${id}: hero 指向的图片不存在 → ${e.hero}`);
    }
    if (!e.heroCap) problems.push(`${id}: 有 hero 但缺图说 heroCap`);
    if (!e.heroAlt) problems.push(`${id}: 有 hero 但缺替代文本 heroAlt`);

    // 图说紧接导语显示，两者高度重复会显得冗余
    const strip = (s) => String(s || '').replace(/[，。；、「」\u2014\s]/g, '');
    if (e.heroCap && e.lede) {
      const a = strip(e.heroCap);
      const b = strip(e.lede);
      if (a === b || a.includes(b) || b.includes(a)) {
        problems.push(`${id}: heroCap 与 lede 重复 → ${e.heroCap}`);
      }
    }
  }
});

// 首页链接与数据键名是否对得上
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const linked = [...html.matchAll(/detail\.html\?id=([a-z]+\.[a-zA-Z_]+)/g)].map((m) => m[1]);
linked.forEach((id) => {
  if (!ids.includes(id)) problems.push(`index.html 链到了不存在的条目 ${id}`);
});
ids.forEach((id) => {
  if (!linked.includes(id)) problems.push(`条目 ${id} 在首页没有入口`);
});

const withHero = ids.filter((id) => {
  const [c, s] = id.split('.');
  return !!REG[c][s].hero;
});

console.log(`条目总数 ${ids.length}　首页入口 ${linked.length}　配图 ${withHero.length}　无图 ${ids.length - withHero.length}`);
console.log(ids.join('  '));
console.log('配图条目：' + withHero.join('  '));
if (problems.length) {
  console.log('\n发现 ' + problems.length + ' 处问题：');
  problems.forEach((p) => console.log('  · ' + p));
  process.exit(1);
}
console.log('\n全部通过：必填字段齐全，related 指向有效，首页入口与数据键名一一对应。');
