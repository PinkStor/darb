/* دَرب — مؤثرات تفاعلية للتنقل والتوصيل. تعمل فوق app.js دون تعديله. */
(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  /* لون العلامة يُقرأ من الموقع نفسه ويتبع الوضع الداكن */
  function brand() {
    const l = $('.route-line'); let c = l && getComputedStyle(l).stroke;
    if (!c || c === 'none') { const b = $('.button-primary'); c = b && getComputedStyle(b).backgroundColor; }
    if (c) document.documentElement.style.setProperty('--fx', c);
  }

  /* شريط تقدّم الرحلة أثناء التمرير */
  function progress() {
    const bar = document.createElement('div'); bar.className = 'fx-progress'; bar.innerHTML = '<i></i>'; bar.setAttribute('aria-hidden', 'true');
    document.body.prepend(bar); const i = bar.firstChild; let q = false;
    const upd = () => { q = false; const h = document.documentElement.scrollHeight - innerHeight; i.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%'; };
    addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(upd); } }, { passive: true }); upd();
  }

  /* مشوار توضيحي: يُرسم المسار ثم تسير المركبة من الانطلاق إلى الوجهة وتتكرر */
  function hero() {
    const svg = $('.hero-route svg'), line = svg && $('.route-line', svg), pb = svg && $('.route-point-b', svg), pa = svg && $('.route-point-a', svg);
    if (!line || !pa || !pb || RM) return;
    const L = line.getTotalLength();
    line.style.strokeDasharray = L;
    line.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1800, easing: 'ease-out' });
    const g = mk('g', { 'aria-hidden': 'true', opacity: 0 });
    g.append(mk('circle', { r: 17, class: 'fx-halo' }), mk('circle', { r: 9, class: 'fx-dot' }), mk('path', { d: 'M0-5L4 4 0 2-4 4Z', class: 'fx-arrow' }));
    svg.append(g);
    const ring = p => {
      const c = mk('circle', { cx: p.getAttribute('cx'), cy: p.getAttribute('cy'), r: 12, class: 'fx-ring' }); svg.insertBefore(c, g);
      c.animate([{ transform: 'scale(1)', opacity: .7 }, { transform: 'scale(4)', opacity: 0 }], { duration: 1300, easing: 'ease-out' }).onfinish = () => c.remove();
    };
    const travel = 4400, hold = 1600, cycle = travel + hold, ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    let start = null, visible = true, phase = -1;
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(svg);
    const frame = now => {
      if (start === null) start = now + 1700;
      if (visible && now >= start) {
        const t = (now - start) % cycle;
        const p = ease(Math.min(1, t / travel));
        const a = line.getPointAtLength(p * L), b = line.getPointAtLength(Math.min(L, p * L + 1));
        g.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90})`);
        g.setAttribute('opacity', t > travel + hold * .6 ? 0 : 1);
        const ph = t < travel ? 0 : 1;
        if (ph !== phase) { phase = ph; ring(ph ? pb : pa); }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* الشعار يُرسم عند التحميل */
  function logo() {
    if (RM) return;
    $$('.site-header .brand-mark path').forEach(p => { const L = p.getTotalLength(); p.animate([{ strokeDasharray: L, strokeDashoffset: L }, { strokeDasharray: L, strokeDashoffset: 0 }], { duration: 1400, easing: 'ease-out' }); });
  }

  /* وصول المركبات عند الوصول للقسم، ونبض الخطوات بالتتابع */
  function reveal() {
    if (RM || !('IntersectionObserver' in window)) return;
    const cards = $$('.fleet-card'); cards.forEach(c => c.classList.add('fx-pre'));
    const io1 = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; const c = e.target, i = cards.indexOf(c);
      setTimeout(() => c.classList.remove('fx-pre'), i * 130); io1.unobserve(c);
    }), { threshold: .25 });
    cards.forEach(c => io1.observe(c));
    const steps = $$('.step');
    const io2 = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; const s = e.target, i = steps.indexOf(s);
      setTimeout(() => s.classList.add('fx-ping'), i * 450); io2.unobserve(s);
    }), { threshold: .6 });
    steps.forEach(s => io2.observe(s));
  }

  /* انتقالات النماذج والنتيجة والتقدير */
  function forms() {
    if (RM) return;
    const slide = (el, from) => el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' });
    const mo = new MutationObserver(ms => ms.forEach(m => { const f = m.target; if (!f.hidden) slide(f, f.id === 'bookingResult' ? 'translateY(18px)' : 'translateX(26px)'); }));
    ['#rideForm', '#deliveryForm', '#bookingResult'].forEach(s => { const e = $(s); if (e) mo.observe(e, { attributes: true, attributeFilter: ['hidden'] }); });
    const est = $('#inlineEstimate');
    if (est) new MutationObserver(() => est.animate([{ opacity: .2, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' })).observe(est, { childList: true, characterData: true, subtree: true });
    /* عكس الانطلاق والوجهة: الحقلان يتبادلان مكانيهما بحركة */
    const sw = $('#swapLocations');
    if (sw) sw.addEventListener('click', () => {
      const f = $('#rideFrom'), t = $('#rideTo'); if (!f || !t) return;
      const y0f = f.getBoundingClientRect().top, y0t = t.getBoundingClientRect().top, h = y0t - y0f;
      const o = { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' };
      f.animate([{ transform: `translateY(${h}px)` }, { transform: 'none' }], o);
      t.animate([{ transform: `translateY(${-h}px)` }, { transform: 'none' }], o);
    });
  }

  function init() {
    brand(); progress(); hero(); logo(); reveal(); forms();
    const th = $('#themeToggle'); if (th) th.addEventListener('click', () => setTimeout(brand, 80));
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
