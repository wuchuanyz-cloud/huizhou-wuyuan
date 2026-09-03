// 滚动显影 + 侧边卷目高亮

document.documentElement.classList.add('js');

const reveals = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

reveals.forEach((el) => revealObserver.observe(el));

// 同组元素依次显影
document.querySelectorAll('.timeline, .cards, .seasons, .villages__grid, .figures, .geo, .people')
  .forEach((group) => {
    [...group.querySelectorAll('.reveal')].forEach((el, i) => {
      el.style.setProperty('--d', `${Math.min(i, 6) * 0.09}s`);
    });
  });

// 侧边卷目
const links = [...document.querySelectorAll('.sidenav a')];
const sections = links
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const i = sections.indexOf(entry.target);
    links.forEach((a, j) => a.classList.toggle('is-on', i === j));
  });
}, { rootMargin: '-45% 0px -45% 0px' });

sections.forEach((s) => navObserver.observe(s));
