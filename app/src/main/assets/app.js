(() => {
  'use strict';

  const points = [
    { id: 'market', name: 'السوق الكبير (وسط القضارف)', short: 'السوق الكبير', lat: 14.035, lon: 35.385, city: true, region: true, dx: 0, dy: -15 },
    { id: 'station', name: 'المحطة الوسطى', short: 'المحطة', lat: 14.028, lon: 35.372, city: true, region: true, dx: -30, dy: 21 },
    { id: 'university', name: 'جامعة القضارف', short: 'الجامعة', lat: 14.008, lon: 35.393, city: true, region: true, dx: 0, dy: 23 },
    { id: 'hospital', name: 'مستشفى القضارف التعليمي', short: 'المستشفى', lat: 14.047, lon: 35.368, city: true, region: true, dx: -40, dy: -12 },
    { id: 'airport', name: 'مطار القضارف', short: 'المطار', lat: 14.045, lon: 35.407, city: true, region: true, dx: 34, dy: 20 },
    { id: 'doka', name: 'الدوكة', short: 'الدوكة', lat: 13.52, lon: 35.77, region: true, dx: 0, dy: -15 },
    { id: 'gallabat', name: 'القلابات', short: 'القلابات', lat: 12.97, lon: 36.15, region: true, dx: 0, dy: -15 },
    { id: 'kassala', name: 'كسلا (قريباً)', short: 'كسلا', lat: 15.45, lon: 36.4, region: true, soon: true, dx: -10, dy: 22 },
    { id: 'wadmadani', name: 'ود مدني (قريباً)', short: 'ود مدني', lat: 14.4, lon: 33.52, region: true, soon: true, dx: 0, dy: -16 },
    { id: 'sennar', name: 'سنار (قريباً)', short: 'سنار', lat: 13.55, lon: 33.62, region: true, soon: true, dx: 0, dy: -15 },
    { id: 'khartoum', name: 'الخرطوم (قريباً)', short: 'الخرطوم', lat: 15.5, lon: 32.56, region: true, soon: true, dx: 0, dy: 21 }
  ];
  const bounds = {
    city: { x0: 35.345, x1: 35.43, y0: 13.995, y1: 14.065 },
    region: { x0: 32.3, x1: 36.7, y0: 12.7, y1: 15.8 }
  };
  const vehicles = {
    rickshaw: { name: 'ركشة', factor: 1, speed: 22 },
    tuktuk: { name: 'تكتك', factor: 1.1, speed: 22 },
    motorbike: { name: 'موتر', factor: 0.82, speed: 28 },
    car: { name: 'سيارة', factor: 1.6, speed: 45 },
    ebike: { name: 'دراجة كهربائية', factor: 0.72, speed: 18 }
  };
  const state = { from: null, to: null, view: 'city', mode: 'ride', lastPreview: null };
  const HISTORY_KEY = 'darb-quotes-v2';
  const $ = id => document.getElementById(id);
  const routeMap = $('routeMap');
  const result = $('bookingResult');
  const rideForm = $('rideForm');
  const deliveryForm = $('deliveryForm');
  const tabs = [$('rideTab'), $('deliveryTab')];
  const allPointSelects = document.querySelectorAll('select[data-point]');
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = value => `${new Intl.NumberFormat('ar-SD', { maximumFractionDigits: 0 }).format(value)} ج.س`;

  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.style.display = 'block';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.style.display = 'none'; }, 2800);
  }

  function pointById(id) {
    return points.find(point => point.id === id) || null;
  }

  function project(point, view = state.view) {
    const area = bounds[view];
    return [
      (point.lon - area.x0) / (area.x1 - area.x0) * 600,
      (area.y1 - point.lat) / (area.y1 - area.y0) * 420
    ];
  }

  function selectOptions() {
    allPointSelects.forEach(select => {
      const type = select.dataset.point;
      const placeholder = type === 'from' ? 'اختر نقطة الانطلاق' : 'اختر الوجهة';
      const available = points.filter(point => point[state.view]);
      select.innerHTML = `<option value="">${placeholder}</option>` + available.map(point =>
        `<option value="${point.id}"${point.soon ? ' disabled' : ''}>${esc(point.name)}</option>`
      ).join('');
      select.value = state[type] && state[type][state.view] ? state[type].id : '';
    });
  }

  function mapRoads() {
    let svg = '';
    for (let i = 1; i < 6; i += 1) svg += `<line class="map-grid-line" x1="${i * 100}" y1="0" x2="${i * 100}" y2="420"/>`;
    for (let j = 1; j < 5; j += 1) svg += `<line class="map-grid-line" x1="0" y1="${j * 84}" x2="600" y2="${j * 84}"/>`;
    svg += '<path class="map-road" d="M-20 100 C130 140 170 70 305 112 S470 172 630 82"/><path class="map-road minor" d="M-20 325 C105 280 228 352 334 305 S477 265 630 324"/><path class="map-road minor" d="M165 -20 C212 103 143 205 230 440"/><path class="map-road minor" d="M453 -20 C389 103 471 220 408 440"/>';
    return svg;
  }

  function renderMap() {
    const visible = points.filter(point => point[state.view]);
    let svg = mapRoads();
    const from = state.from && state.from[state.view] ? state.from : null;
    const to = state.to && state.to[state.view] ? state.to : null;

    if (from && to) {
      const [x1, y1] = project(from);
      const [x2, y2] = project(to);
      const bend = Math.max(-48, Math.min(48, (x2 - x1) * 0.12));
      svg += `<path class="map-route-shadow" d="M${x1} ${y1} Q${(x1 + x2) / 2 + bend} ${(y1 + y2) / 2 - 17} ${x2} ${y2}"/><path class="map-route-line" d="M${x1} ${y1} Q${(x1 + x2) / 2 + bend} ${(y1 + y2) / 2 - 17} ${x2} ${y2}"/>`;
    }

    visible.forEach(point => {
      const [x, y] = project(point);
      const isFrom = from && from.id === point.id;
      const isTo = to && to.id === point.id;
      const selected = isFrom || isTo;
      const radius = selected ? 11 : 7;
      const labelY = y + point.dy;
      const letter = isFrom ? 'A' : isTo ? 'B' : '';
      const label = point.soon ? `${point.short} · قريباً` : point.short;
      svg += `<g class="map-pin${isFrom ? ' is-from' : ''}${isTo ? ' is-to' : ''}${point.soon ? ' is-soon' : ''}" data-point-id="${point.id}" role="button" tabindex="${point.soon ? '-1' : '0'}" aria-label="${point.soon ? `${esc(point.name)}، غير متاح في التجربة` : `اختيار ${esc(point.name)} كموقع ${state.from && !state.to ? 'الوجهة' : 'انطلاق أو وجهة'}`}"><circle cx="${x}" cy="${y}" r="17" fill="transparent"/><circle class="pin-core" cx="${x}" cy="${y}" r="${radius}"/>${letter ? `<text class="pin-letter" x="${x}" y="${y + 3}" text-anchor="middle">${letter}</text>` : ''}<text x="${x + point.dx}" y="${labelY}" text-anchor="middle">${esc(label)}</text></g>`;
    });
    routeMap.innerHTML = svg;
    routeMap.querySelectorAll('.map-pin:not(.is-soon)').forEach(pin => {
      pin.addEventListener('click', () => choosePoint(pin.dataset.pointId));
      pin.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choosePoint(pin.dataset.pointId);
        }
      });
    });
  }

  function setView(view, notify = false) {
    if (view !== 'city' && view !== 'region') return;
    state.view = view;
    // Keep the selected route when changing the map zoom.
    // Regional stops may be off-screen in city view, but must not be deleted.
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    selectOptions();
    renderMap();
    result.hidden = true;
    state.lastPreview = null;
    estimateInline();
    if (notify) toast(view === 'city' && ((state.from && !state.from.city) || (state.to && !state.to.city)) ? 'المسار محفوظ؛ افتح الإقليم لرؤية جميع نقاطه' : view === 'city' ? 'عرض مدينة القضارف' : 'عرض إقليمي توضيحي');
  }

  function syncSelects() {
    allPointSelects.forEach(select => {
      const selected = state[select.dataset.point];
      select.value = selected && selected[state.view] ? selected.id : '';
      select.setCustomValidity('');
    });
  }

  function choosePoint(id) {
    const point = pointById(id);
    if (!point || point.soon) {
      if (point) toast(`التغطية في ${point.short} غير مفعّلة في هذا النموذج`);
      return;
    }
    if (!point[state.view]) setView(point.city ? 'city' : 'region');
    if (!state.from || (state.from && state.to)) {
      state.from = point;
      state.to = null;
    } else {
      state.to = point;
    }
    syncSelects();
    result.hidden = true;
    state.lastPreview = null;
    renderMap();
    estimateInline();
  }

  allPointSelects.forEach(select => select.addEventListener('change', () => {
    const type = select.dataset.point;
    const point = pointById(select.value);
    state[type] = point;
    if (point && !point[state.view]) setView(point.city ? 'city' : 'region');
    syncSelects();
    result.hidden = true;
    state.lastPreview = null;
    renderMap();
    estimateInline();
  }));

  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view, true)));

  function setMode(mode) {
    state.mode = mode;
    tabs.forEach(tab => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    rideForm.hidden = mode !== 'ride';
    deliveryForm.hidden = mode !== 'delivery';
    result.hidden = true;
    state.lastPreview = null;
    estimateInline();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next = tabs[(index + 1) % tabs.length];
      next.focus();
      setMode(next.dataset.mode);
    });
  });
  document.querySelectorAll('[data-open-mode]').forEach(link => link.addEventListener('click', () => setMode(link.dataset.openMode)));
  document.querySelectorAll('[data-set-vehicle]').forEach(link => link.addEventListener('click', () => {
    $('vehicleSelect').value = link.dataset.setVehicle;
    setMode('ride');
  }));

  function distanceKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1.3;
  }

  function trafficFactor() { return {normal: 1, medium: 1.18, high: 1.38}[($('trafficSelect') || {}).value] || 1; }
  function paymentLabel(mode) { return $(mode === 'ride' ? 'ridePayment' : 'deliveryPayment').value === 'bank' ? 'تحويل مصرفي توضيحي' : 'نقداً'; }
  function estimateInline() {
    const field = $('inlineEstimate');
    if (!field) return;
    if (!state.from || !state.to || state.from.id === state.to.id) {field.textContent='حدّد نقطتين مختلفتين لعرض التقدير';return;}
    const km=Math.max(.2, Math.round(distanceKm(state.from,state.to)*10)/10);
    const v=vehicles[$('vehicleSelect').value];
    const total=state.mode==='ride' ? Math.round((400+km*250*v.factor*trafficFactor())/50)*50 : Math.round((550+km*250)/50)*50;
    field.textContent=`${km.toLocaleString('ar-SD')} كم · ${money(total)} (${state.mode==='ride'?'مشوار':'توصيل'} تجريبي)`;
  }
  function getHistory() { try {const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(h)?h.slice(0,6):[]} catch(_){return [];} }
  function renderHistory(){
    const node=$('historyList');if(!node)return;
    const items=getHistory();
    node.innerHTML=items.length?items.map(x=>`<article class="history-card"><span class="history-mark">${x.mode==='ride'?'↗':'◈'}</span><div><strong>${esc(x.from)} ← ${esc(x.to)}</strong><small>${esc(x.detail)} · ${esc(x.payment)} · ${esc(x.date)}</small></div><b>${money(x.amount)}</b></article>`).join(''):'<p class="history-empty">لم تُسجّل تقديرات بعد</p>';
  }
  function savePreview(){
    if(!state.lastPreview)return;
    const x=state.lastPreview;
    const item={mode:x.mode,from:x.from.name,to:x.to.name,detail:x.detail,payment:paymentLabel(x.mode),amount:x.amount,date:new Date().toLocaleDateString('ar-SD')};
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify([item,...getHistory()].slice(0,6)))}catch(_){}
    renderHistory();
  }
  $('clearHistory').addEventListener('click',()=>{try{localStorage.removeItem(HISTORY_KEY)}catch(_){}renderHistory();toast('تم مسح سجل التقديرات المحلي')});
  $('swapLocations').addEventListener('click',()=>{
    const old=state.from;state.from=state.to;state.to=old;syncSelects();renderMap();result.hidden=true;state.lastPreview=null;estimateInline();
  });
  ['vehicleSelect','trafficSelect','ridePayment','deliveryType','deliveryPayment'].forEach(id=>$(id).addEventListener('change',estimateInline));
  document.querySelectorAll('select[data-point]').forEach(el=>el.addEventListener('change',estimateInline));
  function showPreview(mode) {
    const from = state.from;
    const to = state.to;
    if (!from || !to) return;
    if (from.id === to.id) {
      const destination = $(mode === 'ride' ? 'rideTo' : 'deliveryTo');
      destination.setCustomValidity('يجب أن تختلف الوجهة عن نقطة الانطلاق.');
      destination.reportValidity();
      destination.addEventListener('change', () => destination.setCustomValidity(''), { once: true });
      return;
    }

    const distance = Math.max(0.2, Math.round(distanceKm(from, to) * 10) / 10);
    let minutes;
    let detail;
    let amount;
    let title;
    if (mode === 'ride') {
      const vehicle = vehicles[$('vehicleSelect').value];
      minutes = Math.max(5, Math.round(distance / vehicle.speed * 60 * trafficFactor()));
      detail = vehicle.name;
      amount = Math.round((400 + distance * 250 * vehicle.factor * trafficFactor()) / 50) * 50;
      title = 'مشوار تجريبي';
    } else {
      minutes = Math.max(8, Math.round(distance / 20 * 60));
      detail = $('deliveryType').value;
      amount = Math.round((550 + distance * 250) / 50) * 50;
      title = 'توصيل تجريبي';
    }
    const duration = minutes >= 60 ? `${Math.floor(minutes / 60)} س ${minutes % 60} د` : `${new Intl.NumberFormat('ar-SD').format(minutes)} دقيقة`;
    const mapUrl = new URL('https://www.google.com/maps/dir/');
    mapUrl.searchParams.set('api', '1');
    mapUrl.searchParams.set('origin', `${from.lat},${from.lon}`);
    mapUrl.searchParams.set('destination', `${to.lat},${to.lon}`);
    mapUrl.searchParams.set('travelmode', 'driving');
    state.lastPreview = { mode, from, to, distance, detail, amount };

    result.innerHTML = `<div class="result-head"><div><h3>ملخص ${title}</h3><p>راجع المعلومات قبل التأكيد التجريبي.</p></div><span class="result-badge">تجريبي فقط</span></div>
      <div class="result-grid"><div class="result-item"><small>من</small><strong>${esc(from.name)}</strong></div><div class="result-item"><small>إلى</small><strong>${esc(to.name)}</strong></div><div class="result-item"><small>${mode === 'ride' ? 'وسيلة النقل' : 'نوع الطلب'}</small><strong>${esc(detail)}</strong></div><div class="result-item"><small>المسافة التقريبية</small><strong>${new Intl.NumberFormat('ar-SD', { maximumFractionDigits: 1 }).format(distance)} كم</strong></div><div class="result-item"><small>الزمن المتوقع</small><strong>${duration}</strong></div><div class="result-item"><small>تقدير توضيحي</small><strong class="result-price">${money(amount)}</strong></div><div class="result-item"><small>طريقة الدفع</small><strong>${esc(paymentLabel(mode))}</strong></div>${mode === 'ride' ? `<div class="result-item"><small>حركة المرور</small><strong>${esc($('trafficSelect').selectedOptions[0].textContent)}</strong></div>` : '<div class="result-item"><small>بيانات التواصل</small><strong>لا تُرسل أو تُحفظ</strong></div>'}</div>
      <div class="result-actions"><p>المسافة والزمن محسوبان تقريبياً، ولا يوجد كابتن أو متجر متصل.</p><div><a class="button button-secondary" href="${mapUrl.href}" target="_blank" rel="noopener noreferrer">افتح المسار في Google Maps</a> <button class="button button-primary" id="confirmPreview" type="button">تأكيد تجريبي</button></div></div><div class="result-confirmed" id="confirmedMessage" role="status" hidden>تم تسجيل التأكيد داخل هذه الصفحة فقط — لم يتم إرسال طلب حقيقي.</div>`;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('confirmPreview').addEventListener('click', event => {
      if (!state.lastPreview) return;
      $('confirmedMessage').hidden = false;
      savePreview();
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = 'تم التأكيد التجريبي';
    });
  }

  renderHistory();
  rideForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!rideForm.reportValidity()) return;
    showPreview('ride');
  });
  deliveryForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!deliveryForm.reportValidity()) return;
    showPreview('delivery');
  });

  const menuToggle = document.querySelector('.menu-toggle');
  const mainNav = $('mainNav');
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    mainNav.classList.toggle('is-open', open);
  });
  mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mainNav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'فتح القائمة');
  }));

  const themeToggle = $('themeToggle');
  const themeIcon = $('themeIcon');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themeKey = 'darb-theme-v1';
  function setTheme(theme, persist = true) {
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    const dark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeIcon.textContent = dark ? '☼' : '◐';
    themeToggle.setAttribute('aria-label', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن');
    themeMeta.setAttribute('content', dark ? '#0e1411' : '#f7f8f5');
    if (persist && (theme === 'dark' || theme === 'light')) {
      try { localStorage.setItem(themeKey, theme); } catch (_) { /* storage is optional */ }
    }
  }
  try { setTheme(localStorage.getItem(themeKey), false); } catch (_) { setTheme(null, false); }
  themeToggle.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'light' : 'dark');
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (!document.documentElement.dataset.theme) setTheme(null, false);
  });

  selectOptions();
  renderMap();
})();
