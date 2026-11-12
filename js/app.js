/* Noor — TV home dashboard logic (ES5 for older Samsung TVs).
 *
 * The clock-behind-the-scenery look (the glass clock, the cut-out drawn over it, the frosted fill)
 * and the shape of the settings screen (sections on one side, rows on the other) follow couch-tv,
 * https://github.com/Seagey/couch-tv — MIT licence, Copyright (c) 2026 Seagey. See CREDITS.md.
 */
(function () {
  'use strict';
  var VERSION = '1.8.0';
  var C = window.NOOR_CONTENT;
  var CT = window.NOOR_CITIES || { countries: {}, cities: [] };
  var QS = (window.NOOR_QURAN && window.NOOR_QURAN.surahs) || [];
  var IS_TIZEN = typeof window.tizen !== 'undefined' && window.tizen.application;
  var SELF_ID = IS_TIZEN ? safe(function () { return tizen.application.getCurrentApplication().appInfo.id; }) : 'noor';

  function $(id) { return document.getElementById(id); }
  // Preview helpers for a browser, ignored on the TV. None of them saves anything.
  //   ?now=2027-02-20T17:30  shifts the clock      ?fresh=1  a new install (the first-run setup)
  //   ?look=scene            a layout: classic, centered, ambient or scene (skips the setup)
  //   ?bg=scene-night        stays on one photo    ?lang=en  or ar
  //   ?open=look             opens Settings at a section (general, location, prayer, look, bg, screen, about),
  //                          ?open=quran the Quran player
  var NOW_OFFSET = 0, FRESH = false, PREVIEW = {};
  (function () {
    if (IS_TIZEN) return;
    var q = location.search || '', m = /[?&]now=([^&]+)/.exec(q);
    if (m) { var t = new Date(decodeURIComponent(m[1])); if (!isNaN(t)) NOW_OFFSET = t - new Date(); }
    ['look', 'bg', 'lang', 'glass', 'clear', 'open'].forEach(function (k) { var v = new RegExp('[?&]' + k + '=([^&]+)').exec(q); if (v) PREVIEW[k] = decodeURIComponent(v[1]); });
    FRESH = /[?&]fresh=1/.test(q) || !!(PREVIEW.look || PREVIEW.bg || PREVIEW.lang);
  })();
  function NOW() { return new Date(Date.now() + NOW_OFFSET); }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function arDigits(s) { return String(s).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); }); }
  // menu text in one language: T('عربي', 'English') for the home, tr() where the page is drawn again anyway
  function T(a, e) { return '<span class="t-ar ar">' + a + '</span><span class="t-en">' + e + '</span>'; }
  function tr(a, e) { return S.lang === 'ar' ? a : e; }
  function L(x) { return x == null ? '' : (x instanceof Array ? tr(x[0], x[1]) : String(x)); }
  var _txt = {};
  function setText(id, v) { if (_txt[id] !== v) { _txt[id] = v; $(id).innerHTML = v; } }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

  /* ---------------- backgrounds: the photos in the repo, then your own (js/mine.js) ---------------- */
  var BGS = (function () {
    var out = [], seen = {};
    function add(list, mine) {
      (list instanceof Array ? list : []).forEach(function (b) {
        if (!b || typeof b.id !== 'string' || seen[b.id]) return;
        seen[b.id] = 1;
        b = copy(b);
        if (mine) b.mine = true;
        if (['dawn', 'day', 'dusk', 'night'].indexOf(b.mood) < 0) b.mood = 'day';
        if (!b.accent) { b.accent = '#d8b56a'; b.hi = '#f1d38f'; b.argb = '216,181,106'; b.panel = '8,26,24'; }
        out.push(b);
      });
    }
    add(window.NOOR_BACKGROUNDS, false);
    add(window.NOOR_MINE && window.NOOR_MINE.backgrounds, true);
    return out;
  })();
  function bgFile(b, suffix, ext) { return 'img/bg/' + (b.mine ? 'mine/' : '') + b.id + (suffix || '') + (ext || '.jpg'); }
  function bgThumb(b) { return 'img/thumb/' + (b.mine ? 'mine/' : '') + b.id + '.jpg'; }
  function bgName(b) { return b.name ? L(b.name) : b.id; }

  /* ---------------- cities ---------------- */
  function cityAt(i) { var c = CT.cities[i]; return c ? { cc: c[0], en: c[1], ar: c[2] || '', lat: c[3], lng: c[4] } : null; }
  function findCity(cc, en) {
    for (var i = 0; i < CT.cities.length; i++) if (CT.cities[i][0] === cc && CT.cities[i][1] === en) return cityAt(i);
    return null;
  }
  // Noor 1.6 kept a city id; these are its eight cities
  var LEGACY_CITY = {
    kuwait: { cc: 'KW', en: 'Kuwait City', ar: 'مدينة الكويت', lat: 29.3759, lng: 47.9774 },
    jahra: { cc: 'KW', en: 'Al Jahra', ar: 'الجهراء', lat: 29.3375, lng: 47.6581 },
    ahmadi: { cc: 'KW', en: 'Al Ahmadi', ar: 'الأحمدي', lat: 29.0769, lng: 48.0839 },
    amman: { cc: 'JO', en: 'Amman', ar: 'عمّان', lat: 31.9539, lng: 35.9106 },
    irbid: { cc: 'JO', en: 'Irbid', ar: 'إربد', lat: 32.5556, lng: 35.8500 },
    zarqa: { cc: 'JO', en: 'Zarqa', ar: 'الزرقاء', lat: 32.0728, lng: 36.0880 },
    makkah: { cc: 'SA', en: 'Makkah', ar: 'مكة المكرمة', lat: 21.4225, lng: 39.8262 },
    madinah: { cc: 'SA', en: 'Madinah', ar: 'المدينة المنورة', lat: 24.4672, lng: 39.6111 }
  };
  // The TV's time zone usually names a city ("Asia/Riyadh"): offered first on a new install.
  function guessCity() {
    var tz = safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, '') || '';
    var name = tz.split('/').pop().replace(/_/g, ' ').toLowerCase();
    if (!name) return null;
    for (var i = 0; i < CT.cities.length; i++) {
      var n = CT.cities[i][1].toLowerCase();
      if (n === name || n === name + ' city') return cityAt(i);
    }
    return null;
  }
  function cityName(loc) { return S.lang === 'ar' && loc.ar ? loc.ar : (loc.en || loc.ar); }
  function countryName(cc) { var c = CT.countries[cc]; return c ? (S.lang === 'ar' && c[1] ? c[1] : c[0]) : (cc || ''); }

  /* ---------------- settings ---------------- */
  var DEFAULTS = { loc: null, method: 'auto', hour12: true, hijriAdjust: 0, asrFactor: 1, alerts: true, preAlert: 0, adj: null, pinned: [],
    bgMode: 'time', bgSel: [], bgDur: 60, bgMotion: true, lang: 'ar', tiles: 'auto', greet: false, reciter: 'alafasy',
    preset: 'classic', w: null, night: 'off', shift: true, glass: 'frosted', glassAmt: 3, idleMin: 0, idleAct: 'dim', setup: false,
    afterSurah: 'next', q: null, qFav: [] };
  var PRESETS = {
    classic:  { clockVis: 'always', clockStyle: 'large',  prVis: 'always', prStyle: 'arch',  cardVis: 'always', cardStyle: 'glass',   weatherVis: 'always', dhikrVis: 'always' },
    centered: { clockVis: 'always', clockStyle: 'center', prVis: 'always', prStyle: 'strip', cardVis: 'always', cardStyle: 'minimal', weatherVis: 'always', dhikrVis: 'off' },
    ambient:  { clockVis: 'always', clockStyle: 'corner', prVis: 'always', prStyle: 'next',  cardVis: 'press',  cardStyle: 'minimal', weatherVis: 'press',  dhikrVis: 'off' },
    scene:    { clockVis: 'always', clockStyle: 'scene',  prVis: 'always', prStyle: 'strip', cardVis: 'always', cardStyle: 'minimal', weatherVis: 'always', dhikrVis: 'always' }
  };
  var PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  var S = (function () {
    var saved = FRESH ? null : safe(function () { return JSON.parse(localStorage.getItem('noor.settings')); }, null);
    var s = saved && typeof saved === 'object' ? saved : {};
    for (var k in DEFAULTS) if (!(k in s)) s[k] = DEFAULTS[k];
    if (!s.w) s.w = copy(PRESETS[s.preset] || PRESETS.classic);
    if (!s.adj || typeof s.adj !== 'object') s.adj = {};
    PRAYER_KEYS.forEach(function (p) { if (typeof s.adj[p] !== 'number') s.adj[p] = 0; });
    if (!(s.bgSel instanceof Array)) s.bgSel = [];
    if (!(s.pinned instanceof Array)) s.pinned = [];
    if (!(s.qFav instanceof Array)) s.qFav = [];
    if (!s.q || typeof s.q.n !== 'number') s.q = null;
    if (!s.loc || typeof s.loc.lat !== 'number' || typeof s.loc.lng !== 'number') {
      s.loc = copy(LEGACY_CITY[s.cityId] || guessCity() || LEGACY_CITY.makkah);
    }
    if (saved) s.setup = true;   // a TV that already ran Noor never sees the first-run screens
    else s.lang = /^ar/i.test(navigator.language || '') ? 'ar' : 'en';
    if (PREVIEW.lang === 'ar' || PREVIEW.lang === 'en') s.lang = PREVIEW.lang;
    if (PREVIEW.look && PRESETS[PREVIEW.look]) { s.preset = PREVIEW.look; s.w = copy(PRESETS[s.preset]); }
    if (PREVIEW.look || PREVIEW.bg || PREVIEW.lang) s.setup = true;
    if (PREVIEW.bg) { s.bgSel = [PREVIEW.bg]; s.bgMode = 'all'; }
    if (PREVIEW.glass === 'liquid') s.glass = 'liquid';
    if (+PREVIEW.clear >= 1 && +PREVIEW.clear <= 5) s.glassAmt = +PREVIEW.clear;
    return s;
  })();
  function saveSettings() { if (FRESH) return; safe(function () { localStorage.setItem('noor.settings', JSON.stringify(S)); }); }
  function method() { return S.method !== 'auto' && PrayTimes.METHODS[S.method] ? S.method : PrayTimes.methodFor(S.loc.cc); }
  function sceneOn() { return S.w.clockStyle === 'scene' && S.w.clockVis !== 'off'; }
  // the arch panel would cover the big clock, so with the scenery clock it becomes the strip
  function prStyle() { return sceneOn() && S.w.prStyle === 'arch' ? 'strip' : S.w.prStyle; }

  /* ---------------- scaling ---------------- */
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var st = $('stage').style;
    st.transform = st.webkitTransform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit);


  /* ---------------- time formatting ---------------- */
  function fmtTime(d, withSuffix) {
    var h = d.getHours(), m = d.getMinutes();
    if (!S.hour12) return pad(h) + ':' + pad(m);
    var suf = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12;
    return h + ':' + pad(m) + (withSuffix ? '<small> ' + suf + '</small>' : '');
  }
  function plainTime(d) { return fmtTime(d, false) + (S.hour12 ? (d.getHours() < 12 ? ' AM' : ' PM') : ''); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------------- hijri ---------------- */
  function hijri(date) {
    var d = new Date(date.getTime() + S.hijriAdjust * 86400000);
    var r = safe(function () {
      var s = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)));
      var n = s.match(/\d+/g);
      if (!n || n.length < 3) return null;
      var y = +n[2], m = +n[0], day = +n[1];
      if (y < 1300 || y > 1600) return null; // calendar not supported -> fallback
      return { y: y, m: m, d: day };
    }, null);
    if (r) return r;
    // Tabular (Kuwaiti) algorithm fallback
    var jd = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) + 2440588;
    var l = jd - 1948440 + 10632, n2 = Math.floor((l - 1) / 10631);
    l = l - 10631 * n2 + 354;
    var j = Math.floor((10985 - l) / 5316) * Math.floor(50 * l / 17719) + Math.floor(l / 5670) * Math.floor(43 * l / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor(17719 * j / 50) - Math.floor(j / 16) * Math.floor(15238 * j / 43) + 29;
    var mm = Math.floor(24 * l / 709);
    return { y: 30 * n2 + j - 30, m: mm, d: l - Math.floor(709 * mm / 24) };
  }

  /* ---------------- prayers ---------------- */
  var today = null, times = null, tomorrowFajr = null, ayahIdx = -1, lastAlertKey = '', lastPreKey = '';
  // The times for a day: worked out for the chosen place, shown in the TV's own time (its clock
  // and time zone, so summer time is followed), then moved by the minutes set in Settings.
  function prayerTimes(date) {
    var c = S.loc, t = PrayTimes.compute(date, c.lat, c.lng, -date.getTimezoneOffset() / 60, method(), S.asrFactor);
    PRAYER_KEYS.forEach(function (k) { if (S.adj[k]) t[k] = new Date(+t[k] + S.adj[k] * 60000); });
    return t;
  }
  function computeDay(now) {
    times = prayerTimes(now);
    tomorrowFajr = prayerTimes(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)).fajr;
    today = now.toDateString();

    // dates
    $('dayAr').innerHTML = C.weekdaysAr[now.getDay()];
    $('dateEn').innerHTML = now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
    var h = hijri(now);
    $('hijriAr').innerHTML = arDigits(h.d) + ' ' + C.hijriMonths[h.m - 1] + ' ' + arDigits(h.y) + ' هـ';
    $('hijriEn').innerHTML = h.d + ' ' + C.hijriMonthsEn[h.m - 1] + ' ' + h.y;
    $('cityEn').innerHTML = esc(cityName(S.loc));

    // verse of the day
    var start = new Date(now.getFullYear(), 0, 0);
    var doy = Math.floor((now - start) / 86400000);
    ayahIdx = (doy + now.getFullYear()) % C.ayat.length;
    var a = C.ayat[ayahIdx];
    $('ayahAr').innerHTML = esc(a.ar);
    $('ayahRef').innerHTML = esc(a.ref);
    $('ayahEn').innerHTML = esc(a.en);
  }

  function nextPrayer(now) {
    for (var i = 0; i < C.prayers.length; i++) {
      var p = C.prayers[i];
      if (p.notPrayer) continue;
      if (times[p.key] > now) return { p: p, t: times[p.key] };
    }
    return { p: C.prayers[0], t: tomorrowFajr };
  }

  function renderPrayers(now) {
    var nx = nextPrayer(now), ul = $('plist'), html = '';
    for (var i = 0; i < C.prayers.length; i++) {
      var p = C.prayers[i], t = (p.key === 'fajr' && nx.t === tomorrowFajr) ? tomorrowFajr : times[p.key];
      var cls = p === nx.p ? 'is-next' : (t <= now ? 'past' : '');
      if (p.notPrayer) cls += ' minor';
      var isJumuah = p.key === 'dhuhr' && now.getDay() === 5;
      html += '<li class="' + cls + '"><span class="pn"><span class="en">' + (isJumuah ? 'Jumuah' : p.en) + '</span><span class="ar">' + (isJumuah ? 'الجمعة' : p.ar) +
        '</span></span><span class="pt">' + fmtTime(t, true) + '</span></li>';
    }
    ul.innerHTML = html;
    var nj = nx.p.key === 'dhuhr' && nx.t.getDay() === 5;
    $('nextAr').innerHTML = nj ? 'الجمعة' : nx.p.ar;
    $('nextEn').innerHTML = nj ? 'Jumuah' : nx.p.en;
    // bottom strip
    var sh = '';
    for (var j = 0; j < C.prayers.length; j++) {
      var q = C.prayers[j], tq = (q.key === 'fajr' && nx.t === tomorrowFajr) ? tomorrowFajr : times[q.key];
      var jq = q.key === 'dhuhr' && now.getDay() === 5;
      var cq = 'sc' + (q === nx.p ? ' is-next' : (tq <= now ? ' past' : '')) + (q.notPrayer ? ' minor' : '');
      sh += '<div class="' + cq + '"><div class="n">' + (jq ? 'الجمعة' : q.ar) + '</div><div class="e">' + (jq ? 'Jumuah' : q.en) +
        '</div><div class="t">' + fmtTime(tq, true) + '</div>' + (q === nx.p ? '<div class="c" id="stripCount"></div>' : '') + '</div>';
    }
    $('wStrip').innerHTML = sh;
    delete _txt.stripCount;
    // next-prayer chip
    $('nxName').innerHTML = (nj ? 'الجمعة' : nx.p.ar) + ' <span class="en">' + (nj ? 'Jumuah' : nx.p.en) + '</span>';
    $('nxTime').innerHTML = fmtTime(nx.t, true);
    return nx;
  }

  var alertT = null;
  function showAlert(html, ms) {
    $('alertText').innerHTML = html;
    $('alert').className = 'alert show';
    clearTimeout(alertT);
    alertT = setTimeout(function () { $('alert').className = 'alert'; }, ms);
  }
  function checkAlert(now) {
    if (!S.alerts && !S.preAlert) return;
    var day = [[today, times]], pre = S.preAlert * 60000;
    if (pre && tomorrowFajr) day.push(['next', { fajr: tomorrowFajr }]);   // a reminder before tomorrow's Fajr, late at night
    for (var d = 0; d < day.length; d++) for (var i = 0; i < C.prayers.length; i++) {
      var p = C.prayers[i], t = day[d][1][p.key];
      if (p.notPrayer || !t) continue;
      var diff = now - t, key = day[d][0] + p.key;
      if (S.alerts && d === 0 && diff >= 0 && diff < 60000 && lastAlertKey !== key) {
        lastAlertKey = key;
        showAlert('حان الآن موعد صلاة ' + p.ar + ' <span class="en" style="font-size:26px;opacity:.75">· Time for ' + p.en + '</span>', 120000);
      } else if (pre && -diff <= pre && -diff > pre - 60000 && lastPreKey !== key) {
        lastPreKey = key;
        showAlert('صلاة ' + p.ar + ' بعد ' + arDigits(S.preAlert) + ' دقيقة <span class="en" style="font-size:26px;opacity:.75">· ' + p.en + ' in ' + S.preAlert + ' min</span>', 60000);
      }
    }
  }

  /* ---------------- clock loop ---------------- */
  var lastMinute = -1, nx = null;
  function clockHM(now) {
    var h = now.getHours(), m = now.getMinutes();
    return S.hour12 ? (h % 12 || 12) + ':' + pad(m) : pad(h) + ':' + pad(m);
  }
  function tick() {
    var now = NOW();
    if (now.toDateString() !== today) computeDay(now);
    var h = now.getHours(), m = now.getMinutes();
    setText('clockHM', clockHM(now)); setText('clockAmPm', S.hour12 ? (h < 12 ? 'AM' : 'PM') : '');
    setText('clockS', pad(now.getSeconds()));
    if (m !== lastMinute || !nx || now >= nx.t) { lastMinute = m; nx = renderPrayers(now); renderOccasions(now); glassClock(); }
    tickOccasionCount(now);
    var left = Math.max(0, Math.floor((nx.t - now) / 1000));
    var cd = pad(Math.floor(left / 3600)) + ':' + pad(Math.floor(left / 60) % 60) + ':' + pad(left % 60);
    setText('nextCount', cd); setText('nxCount', cd); if ($('stripCount')) setText('stripCount', cd);
    checkAlert(now);
  }

  /* ---------------- dhikr ---------------- */
  var dIdx = 0;
  function dhikrPool() {
    var now = NOW(), pool = C.adhkar.always.slice();
    if (times) {
      if (now >= times.fajr && now < times.dhuhr) pool = C.adhkar.morning.concat(pool);
      else if (now >= times.asr && now < times.isha) pool = C.adhkar.evening.concat(pool);
    }
    return pool;
  }
  function rotateDhikr() {
    var e = $('dhikr'), pool = dhikrPool();
    e.style.opacity = 0;
    setTimeout(function () { e.innerHTML = esc(pool[dIdx++ % pool.length]); e.style.opacity = 1; }, 800);
  }

  /* ---------------- weather (Open-Meteo, no key) ---------------- */
  var W_ICONS = {
    sun: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="12" fill="#f1d38f"/><g stroke="#f1d38f" stroke-width="3" stroke-linecap="round"><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.7 5.7M44.7 44.7l5.7 5.7M13.6 50.4l5.7-5.7M44.7 19.3l5.7-5.7"/></g></svg>',
    moon: '<svg viewBox="0 0 64 64"><path d="M40 10a22 22 0 1 0 14 38A18 18 0 1 1 40 10z" fill="#f1d38f"/></svg>',
    cloud: '<svg viewBox="0 0 64 64"><circle cx="22" cy="22" r="9" fill="#f1d38f"/><path d="M20 50h28a10 10 0 0 0 0-20 14 14 0 0 0-27-2A11 11 0 0 0 20 50z" fill="#c9d3d0"/></svg>',
    rain: '<svg viewBox="0 0 64 64"><path d="M18 40h30a10 10 0 0 0 0-20 14 14 0 0 0-27-2A11 11 0 0 0 18 40z" fill="#c9d3d0"/><g stroke="#7fc6e8" stroke-width="3" stroke-linecap="round"><path d="M22 46l-3 8M32 46l-3 8M42 46l-3 8"/></g></svg>',
    fog: '<svg viewBox="0 0 64 64"><g stroke="#c9d3d0" stroke-width="4" stroke-linecap="round"><path d="M12 24h40M8 34h44M14 44h36"/></g></svg>',
    storm: '<svg viewBox="0 0 64 64"><path d="M18 38h30a10 10 0 0 0 0-20 14 14 0 0 0-27-2A11 11 0 0 0 18 38z" fill="#9aa6a3"/><path d="M34 40l-8 12h7l-4 10 12-15h-7l4-7z" fill="#f1d38f"/></svg>'
  };
  function wDesc(code, isDay) {
    if (code === 0) return isDay ? ['sun', 'صحو'] : ['moon', 'صافٍ'];
    if (code <= 3) return ['cloud', 'غائم جزئياً'];
    if (code === 45 || code === 48) return ['fog', 'ضباب'];
    if (code >= 95) return ['storm', 'عواصف رعدية'];
    if (code >= 51) return ['rain', 'أمطار'];
    return ['cloud', 'غائم'];
  }
  function loadWeather() {
    var c = S.loc;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lng + '&current=temperature_2m,weather_code,is_day&timezone=auto';
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 10000;
    x.onload = function () {
      var j = safe(function () { return JSON.parse(x.responseText).current; }, null);
      if (!j || c !== S.loc) return;   // the city changed while this was on its way
      var d = wDesc(j.weather_code, j.is_day);
      $('wTemp').innerHTML = Math.round(j.temperature_2m) + '°';
      $('wIcon').innerHTML = W_ICONS[d[0]];
      $('wDescAr').innerHTML = '<span class="ar">' + d[1] + '</span>';
    };
    x.send();
  }

  /* ---------------- apps ---------------- */
  var APPS = [];
  var MOCK_APPS = [
    { id: '9Ur5IzDKqV.TizenYouTube', name: 'YouTube' }, { id: 'shahid.mock', name: 'Shahid' },
    { id: 'netflix.mock', name: 'Netflix' }, { id: 'org.tizen.browser', name: 'Internet' },
    { id: 'tvplus.mock', name: 'Samsung TV Plus' }, { id: 'spotify.mock', name: 'Spotify' },
    { id: 'gallery.mock', name: 'Gallery' }, { id: 'prime.mock', name: 'Prime Video' }
  ];
  function loadApps(cb) {
    if (!IS_TIZEN) { APPS = MOCK_APPS; cb(); return; }
    try {
      tizen.application.getAppsInfo(function (list) {
        APPS = [];
        for (var i = 0; i < list.length; i++) {
          var a = list[i];
          if (a.show === false || a.id === SELF_ID || !a.name || !a.iconPath) continue;
          APPS.push({ id: a.id, name: a.name, icon: a.iconPath });
        }
        APPS.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        cb();
      }, function () { cb(); });
    } catch (e) { cb(); }
  }
  function findApp(terms) {
    var best = null;
    for (var i = 0; i < APPS.length; i++) {
      var n = APPS[i].name.toLowerCase();
      for (var j = 0; j < terms.length; j++) if (n.indexOf(terms[j].toLowerCase()) !== -1) {
        var a = APPS[i], score = (a.icon ? 10 : 0) + (/^com\.samsung\.tv\.cobalt/.test(a.id) ? -5 : 0) + (n === terms[j].toLowerCase() ? 2 : 0);
        if (!best || score > best.s) best = { s: score, a: a };
      }
    }
    return best ? best.a : null;
  }
  function appById(id) { for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i]; return null; }

  function launch(ids, label) {
    ids = ids.filter(function (x) { return !!x; });
    if (!IS_TIZEN) { toast('Would open ' + label + ' (preview mode)'); return; }
    (function attempt(i) {
      if (i >= ids.length) { toast(T('لم يتم العثور على ' + label, label + ' not found on this TV')); return; }
      try { tizen.application.launch(ids[i], function () {}, function () { attempt(i + 1); }); }
      catch (e) { attempt(i + 1); }
    })(0);
  }

  var toastT = null;
  function toast(msg) {
    var t = $('toast'); t.innerHTML = msg; t.className = 'toast show';
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 3200);
  }

  // Tizen gives icon paths like /opt/usr/... — they need a file:// prefix, and fall back to a letter badge if unreadable
  function iconSrc(p) { if (!p) return ''; return /^[a-z]+:/i.test(p) ? p : 'file://' + p; }
  function iconHtml(app, fallbackLabel, color) {
    var letter = (fallbackLabel || '?').charAt(0).toUpperCase();
    var ph = '<div class="ph' + (app && app.icon ? '' : ' only') + '" style="background:' + (color || '#1f6f5c') + '">' + esc(letter) + '</div>';
    if (app && app.icon) return '<img src="' + esc(iconSrc(app.icon)) + '" alt="" onerror="this.parentNode.className+=\' noicon\'">' + ph;
    return ph;
  }

  /* ---------------- settings button (appears on any key press) ---------------- */
  /* The home's two buttons: the Quran player and Settings. hIdx: 0 Quran, 1 Settings. */
  var focusIdx = 0, zone = 'gear', hIdx = 0;
  function buildTiles() { paintFocus(); }
  function paintFocus() {
    $('quranBtn').className = 'gear' + (zone === 'gear' && hIdx === 0 ? ' focus' : '');
    $('gear').className = 'gear' + (zone === 'gear' && hIdx === 1 ? ' focus' : '');
  }
  function activate() { if (hIdx === 0) openQuran(); else openSettings(); }

  /* ---------------- all apps overlay ---------------- */
  var mode = 'home', aIdx = 0, aNodes = [], COLS = 6;
  function setCls(n, c) { if (n.className !== c) n.className = c; }
  function openApps() {
    mode = 'apps'; aIdx = 0;
    var g = $('appsGrid'); g.innerHTML = '';
    var sc = el('div', 'scroller'); g.appendChild(sc); aNodes = [];
    APPS.forEach(function (a, i) {
      var d = el('div', 'tile');
      d.innerHTML = iconHtml(a, a.name) + '<div class="tl">' + esc(a.name) + '</div>' + (S.pinned.indexOf(a.id) !== -1 ? '<span class="pin">★</span>' : '');
      d.onclick = function () { aIdx = i; paintApps(); launch([a.id], a.name); };
      sc.appendChild(d); aNodes.push(d);
    });
    if (!APPS.length) sc.innerHTML = '<div style="font-size:28px;color:#9fb3ad;padding:40px">No apps found</div>';
    $('appsOverlay').className = 'overlay open';
    paintApps();
  }
  function paintApps() {
    aNodes.forEach(function (n, i) { setCls(n, 'tile' + (i === aIdx ? ' focus' : '')); });
    var row = Math.floor(aIdx / COLS), sc = $('appsGrid').firstChild;
    var y = Math.max(0, row - 2) * 190;
    if (sc) sc.style.transform = sc.style.webkitTransform = 'translateY(' + (-y) + 'px)';
  }
  function togglePin() {
    var a = APPS[aIdx]; if (!a) return;
    var k = S.pinned.indexOf(a.id);
    if (k === -1) { S.pinned.push(a.id); toast(T('تم التثبيت: ', 'Pinned: ') + esc(a.name)); }
    else { S.pinned.splice(k, 1); toast(T('أزيل من الرئيسية: ', 'Unpinned: ') + esc(a.name)); }
    saveSettings();
    var keep = aIdx; openApps(); aIdx = keep; paintApps();
  }

  /* =====================================================================
     Settings: sections on one side, their rows on the other (after couch-tv's Home settings).
     Up and down move, OK changes a row, the side arrows change a value or step back to the
     sections, Back goes back a step and then closes. Everything is kept on the TV (localStorage).
     ===================================================================== */
  var IC = {
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9s1.3-6.4 3.8-9z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.500C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z"/></svg>',
    look: '<svg viewBox="0 0 24 24"><path d="M4 7h8M18 7h2M4 17h2M12 17h8"/><circle cx="15" cy="7" r="2.500"/><circle cx="9" cy="17" r="2.500"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="4.500" width="18" height="15" rx="2.500"/><path d="M3 16l5-4.500 4 3 3-2.500 6 5"/><circle cx="8.500" cy="9" r="1.200"/></svg>',
    screen: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12.500" rx="2"/><path d="M8 20h8M12 16.500V20"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.300v.400"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'
  };
  var SECS = [
    ['general', ['عام', 'General'], 'globe'], ['location', ['الموقع', 'Location'], 'pin'], ['prayer', ['الصلاة', 'Prayer'], 'moon'],
    ['look', ['المظهر', 'Look'], 'look'], ['bg', ['الخلفيات', 'Backgrounds'], 'image'], ['screen', ['الشاشة', 'Screen'], 'screen'],
    ['about', ['حول نور', 'About'], 'info']
  ];
  var SET = { col: 'secs', sec: 0, ri: 0, stack: [], confirm: null, typing: null, msg: '', wiz: null, dirty: {}, dom: null };
  var VIS = ['always', 'press', 'off'];
  var VIS_T = { always: ['دائمًا', 'Always'], press: ['عند الضغط', 'On button press'], off: ['إخفاء', 'Hidden'] };
  var PRESET_T = { classic: ['كلاسيكي', 'Classic'], centered: ['متوسط', 'Centered'], ambient: ['هادئ', 'Ambient'], scene: ['ساعة المشهد', 'Scenery clock'], custom: ['مخصص', 'Custom'] };
  var PRESET_SUB = {
    classic: ['ساعة كبيرة وقوس المواقيت وبطاقة الآية', 'Large clock, the prayer arch and the verse card'],
    centered: ['ساعة في المنتصف وشريط المواقيت في الأسفل', 'Clock in the middle, prayer times along the bottom'],
    ambient: ['ساعة صغيرة والصلاة القادمة فقط', 'A small clock and the next prayer only'],
    scene: ['ساعة زجاجية كبيرة خلف الجبال', 'A big glass clock behind the mountains']
  };
  var NIGHT = [['off', 'إيقاف', 'Off'], ['dim', 'تخفيف الإضاءة', 'Dim'], ['ambient', 'الساعة فقط', 'Clock only'], ['both', 'الساعة فقط + تخفيف', 'Clock only + dim']];
  var IDLE_ACT = [['dim', 'تخفيف الإضاءة', 'Dim'], ['clock', 'الساعة فقط', 'Clock only'], ['both', 'الساعة فقط + تخفيف', 'Clock only + dim']];
  var IDLE_MIN = [0, 5, 10, 15, 30, 60], PRE_MIN = [0, 5, 10, 15, 20, 30];
  var AFTER = [['next', 'السورة التالية', 'Next surah'], ['stop', 'توقف', 'Stop'], ['repeat', 'إعادة السورة', 'Repeat it'], ['shuffle', 'سورة عشوائية', 'Shuffle']];
  var GLASS_T = [['ضبابي', 'Frosted'], ['ناعم', 'Soft'], ['متوازن', 'Balanced'], ['شفاف', 'Clear'], ['شفاف جدًا', 'Very clear']];
  var DURS = [20, 40, 60, 120, 300, 600, 1800, 0];   // 0 = never change

  function cyc(list, cur, d) { var i = list.indexOf(cur); if (i < 0) i = 0; return list[(i + d + list.length) % list.length]; }
  function optText(opts, v) { for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return [opts[i][1], opts[i][2]]; return ''; }
  function onOff(v) { return v ? ['تشغيل', 'On'] : ['إيقاف', 'Off']; }
  function head(label) { return { kind: 'head', key: 'h:' + label[1], label: label }; }
  function info(key, label, value, sub) { return { kind: 'info', key: key, label: label, value: value, sub: sub }; }
  function mins(n) { return n ? [arDigits(n) + ' دقيقة', n + ' min'] : ['إيقاف', 'Off']; }
  function touched(what) { SET.dirty[what] = true; saveSettings(); }

  function visRow(lbl, key) {
    return { kind: 'cycle', key: 'vis:' + key, label: lbl, value: VIS_T[S.w[key]],
      step: function (d) { S.w[key] = cyc(VIS, S.w[key], d); S.preset = 'custom'; touched('look'); applyBody(); } };
  }
  function styleRow(lbl, key, opts, sub) {   // opts: [[value, ar, en], ...]
    return { kind: 'cycle', key: 'style:' + key, label: lbl, sub: sub, value: optText(opts, S.w[key]),
      step: function (d) { S.w[key] = cyc(opts.map(function (o) { return o[0]; }), S.w[key], d); S.preset = 'custom'; touched('look'); applyBody(); } };
  }
  function presetRows(after) {
    return ['classic', 'centered', 'ambient', 'scene'].map(function (id) {
      return { kind: 'choice', key: 'preset:' + id, label: PRESET_T[id], sub: PRESET_SUB[id], checked: S.preset === id,
        act: function () { S.preset = id; S.w = copy(PRESETS[id]); touched('look'); applyBody(); if (after) after(); } };
    });
  }

  function generalRows() {
    return [
      head(['اللغة', 'Language']),
      { kind: 'choice', key: 'lang:ar', label: 'العربية', checked: S.lang === 'ar', act: function () { S.lang = 'ar'; touched('lang'); applyBody(); } },
      { kind: 'choice', key: 'lang:en', label: 'English', checked: S.lang === 'en', act: function () { S.lang = 'en'; touched('lang'); applyBody(); } },
      head(['الساعة', 'Clock']),
      { kind: 'cycle', key: 'hour12', label: ['نظام الساعة', 'Clock format'], value: S.hour12 ? ['١٢ ساعة', '12-hour'] : ['٢٤ ساعة', '24-hour'],
        step: function () { S.hour12 = !S.hour12; touched('time'); } },
      head(['الصوت', 'Audio']),
      { kind: 'cycle', key: 'reciter', label: ['القارئ', 'Reciter'], sub: ['لسور بطاقة المناسبات (الكهف، الملك، البقرة)', 'For the surahs on the occasion card (Al-Kahf, Al-Mulk, Al-Baqarah)'],
        value: [reciter().ar, reciter().en],
        step: function (d) { var i = 0; C.reciters.forEach(function (r, k) { if (r.id === S.reciter) i = k; });
          S.reciter = C.reciters[(i + d + C.reciters.length) % C.reciters.length].id; touched('audio'); if (track && track.n) stopAudio(); } },
      { kind: 'cycle', key: 'afterSurah', label: ['بعد انتهاء السورة', 'After a surah'], sub: ['في مشغّل القرآن', 'In the Quran player'], value: optText(AFTER, S.afterSurah),
        step: function (d) { S.afterSurah = cyc(AFTER.map(function (a) { return a[0]; }), S.afterSurah, d); touched('audio'); } },
      head(['الشاشة الرئيسية', 'Home']),
      { kind: 'cycle', key: 'greet', label: ['التحية والشعار', 'Greeting & logo'], value: S.greet ? ['ظاهر', 'Shown'] : ['مخفي', 'Hidden'],
        step: function () { S.greet = !S.greet; touched('look'); applyBody(); } }
    ];
  }

  function coord(loc) {
    function one(v, pos, neg) { return Math.abs(v).toFixed(2) + '° ' + (v >= 0 ? pos : neg); }
    return one(loc.lat, 'N', 'S') + '  ' + one(loc.lng, 'E', 'W');
  }
  function cityPickRows() {
    return [
      { kind: 'nav', key: 'pick-list', label: ['اختر من القائمة', 'Choose from the list'],
        sub: [arDigits(CT.cities.length) + ' مدينة، تعمل دون إنترنت', CT.cities.length + ' cities, works without the internet'], act: openCountries },
      { kind: 'nav', key: 'pick-search', label: ['ابحث عن مدينة أو بلدة', 'Search for any city or town'],
        sub: ['بالاسم، عبر الإنترنت (Open-Meteo)', 'By name, over the internet (Open-Meteo)'], act: searchCity }
    ];
  }
  function locationRows() {
    var m = method(), M = PrayTimes.METHODS[m];
    var ang = 'Fajr ' + M.fajr + '° · Isha ' + (typeof M.isha === 'number' ? M.isha + '°' : M.isha.minutes + ' min');
    var angAr = 'الفجر ' + arDigits(M.fajr) + '° · العشاء ' + (typeof M.isha === 'number' ? arDigits(M.isha) + '°' : arDigits(M.isha.minutes) + ' دقيقة');
    var keys = ['auto'].concat(Object.keys(PrayTimes.METHODS));
    return [
      head(['مدينتك', 'Your city']),
      info('loc-now', cityName(S.loc), countryName(S.loc.cc), coord(S.loc))
    ].concat(cityPickRows(), [
      head(['طريقة الحساب', 'Calculation']),
      { kind: 'cycle', key: 'method', label: ['طريقة حساب المواقيت', 'Calculation method'], sub: [angAr, ang],
        value: S.method === 'auto' ? ['تلقائي · ' + M.ar, 'Auto · ' + M.name] : [M.ar, M.name],
        step: function (d) { S.method = cyc(keys, S.method, d); touched('time'); } },
      info('tz-note', ['تُعرض المواقيت بتوقيت هذا التلفاز', 'Times are shown in this TV\'s own time'], '',
        ['إن بدت متقدمة أو متأخرة ساعة فاضبط ساعة التلفاز ومنطقته الزمنية', 'If they look an hour out, check the TV\'s clock and time zone'])
    ]);
  }

  var countryCache = {};
  function countryList() {
    var lang = S.lang;
    if (countryCache[lang]) return countryCache[lang];
    var count = {}, i;
    for (i = 0; i < CT.cities.length; i++) count[CT.cities[i][0]] = (count[CT.cities[i][0]] || 0) + 1;
    var codes = Object.keys(count).filter(function (cc) { return !!CT.countries[cc]; });
    codes.sort(function (a, b) {
      var x = countryName(a), y = countryName(b);
      return safe(function () { return x.localeCompare(y, lang); }, x < y ? -1 : (x > y ? 1 : 0));
    });
    return (countryCache[lang] = codes.map(function (cc) { return [cc, count[cc]]; }));
  }
  function openCountries() {
    pushPage({ id: 'countries', title: ['اختر الدولة', 'Choose the country'], rows: function () {
      return countryList().map(function (c) {
        return { kind: 'nav', key: 'cc:' + c[0], label: countryName(c[0]), value: S.lang === 'ar' ? arDigits(c[1]) : String(c[1]), act: function () { openCities(c[0]); } };
      });
    } }, 'cc:' + S.loc.cc);
  }
  function openCities(cc) {
    var list = [];
    for (var i = 0; i < CT.cities.length; i++) if (CT.cities[i][0] === cc) list.push(cityAt(i));
    pushPage({ id: 'cities:' + cc, title: countryName(cc), rows: function () {
      return list.map(function (c, k) {
        var here = Math.abs(c.lat - S.loc.lat) < 0.0002 && Math.abs(c.lng - S.loc.lng) < 0.0002;
        return { kind: 'choice', key: 'city:' + k, label: [c.ar || c.en, c.en], checked: here, act: function () { pickCity(c); } };
      });
    } });
  }
  function searchCity() {
    startTyping({ label: ['اكتب اسم المدينة ثم اضغط «تم»', 'Type the place name, then press Done'], submit: function (q) {
      q = String(q || '').replace(/^\s+|\s+$/g, '');
      if (!q) return;
      SET.msg = tr('جارٍ البحث…', 'Searching…'); paintSettings(true);
      var x = new XMLHttpRequest();
      x.open('GET', 'https://geocoding-api.open-meteo.com/v1/search?count=10&format=json&language=' + S.lang + '&name=' + encodeURIComponent(q), true);
      x.timeout = 12000;
      x.onload = function () {
        var list = safe(function () { return JSON.parse(x.responseText).results; }, null) || [];
        list = list.filter(function (r) { return r && typeof r.latitude === 'number' && typeof r.longitude === 'number' && r.name; });
        if (mode !== 'settings') return;
        if (!list.length) { SET.msg = tr('لم نجد مكانًا بهذا الاسم', 'No place found by that name'); paintSettings(true); return; }
        SET.msg = '';
        pushPage({ id: 'search', title: ['نتائج «' + q + '»', 'Results for "' + q + '"'], rows: function () {
          return list.map(function (r, k) {
            var where = [r.admin1, r.country].filter(function (v) { return !!v; }).join(S.lang === 'ar' ? '، ' : ', ');
            return { kind: 'choice', key: 'hit:' + k, label: r.name, sub: where, act: function () {
              var loc = { cc: r.country_code || '', en: r.name, ar: S.lang === 'ar' ? r.name : '', lat: Math.round(r.latitude * 10000) / 10000, lng: Math.round(r.longitude * 10000) / 10000 };
              otherName(r.id, loc);
              pickCity(loc);
            } };
          });
        } });
        paintSettings(true);
      };
      x.onerror = x.ontimeout = function () { SET.msg = tr('تعذّر الاتصال بالإنترنت. جرّب القائمة.', 'Could not reach the internet. Try the list instead.'); if (mode === 'settings') paintSettings(true); };
      x.send();
    } });
  }
  // the place's name in the other language, so switching language later still names it properly
  function otherName(id, loc) {
    if (!id) return;
    var other = S.lang === 'ar' ? 'en' : 'ar', x = new XMLHttpRequest();
    x.open('GET', 'https://geocoding-api.open-meteo.com/v1/get?id=' + encodeURIComponent(id) + '&language=' + other, true);
    x.timeout = 10000;
    x.onload = function () {
      var n = safe(function () { return JSON.parse(x.responseText).name; }, '');
      if (!n || S.loc !== loc) return;
      if (other === 'en') loc.en = n; else if (/[؀-ۿ]/.test(n)) loc.ar = n;
      saveSettings();
    };
    x.send();
  }
  function pickCity(loc) {
    S.loc = loc; touched('loc');
    SET.stack = []; SET.dom = null;
    if (SET.wiz) { wizNext(); return; }
    SET.focusKey = 'pick-list';
    SET.msg = tr('تم: ', 'Set: ') + cityName(loc);
  }

  function prayerRows() {
    var rows = [
      head(['التنبيه', 'Alert']),
      { kind: 'cycle', key: 'alerts', label: ['تنبيه عند دخول الوقت', 'Alert at prayer time'], sub: ['شريط أعلى الشاشة لدقيقتين', 'A banner at the top of the screen for two minutes'],
        value: onOff(S.alerts), step: function () { S.alerts = !S.alerts; touched('time'); } },
      { kind: 'cycle', key: 'preAlert', label: ['تنبيه قبل الصلاة', 'Reminder before the prayer'], value: mins(S.preAlert),
        step: function (d) { S.preAlert = cyc(PRE_MIN, S.preAlert, d); touched('time'); } },
      head(['الحساب', 'Calculation']),
      { kind: 'cycle', key: 'asr', label: ['حساب العصر', 'Asr method'], value: S.asrFactor === 1 ? ['الجمهور', 'Standard'] : ['الحنفي', 'Hanafi'],
        step: function () { S.asrFactor = S.asrFactor === 1 ? 2 : 1; touched('time'); } },
      { kind: 'cycle', key: 'hijri', label: ['تعديل التاريخ الهجري', 'Hijri date adjust'],
        value: (function () { var v = (S.hijriAdjust > 0 ? '+' : '') + S.hijriAdjust; return [arDigits(v) + ' يوم', v + ' day']; })(),
        step: function (d) { S.hijriAdjust = Math.max(-2, Math.min(2, S.hijriAdjust + d)); touched('time'); } },
      head(['ضبط المواقيت بالدقائق (لتوافق مسجدك)', 'Fine-tune, in minutes (to match your mosque)'])
    ];
    var t = prayerTimes(NOW()), any = false;
    C.prayers.forEach(function (p) {
      var a = S.adj[p.key] || 0, v = (a > 0 ? '+' : '') + a;
      if (a) any = true;
      rows.push({ kind: 'cycle', key: 'adj:' + p.key, label: [p.ar, p.en], sub: [tr('اليوم ', 'Today ') + plainTime(t[p.key]), tr('اليوم ', 'Today ') + plainTime(t[p.key])],
        value: [arDigits(v) + ' د', v + ' min'],
        step: function (d) { S.adj[p.key] = Math.max(-30, Math.min(30, (S.adj[p.key] || 0) + d)); touched('time'); } });
    });
    if (any) rows.push({ kind: 'action', key: 'adj-reset', label: ['إلغاء كل التعديلات', 'Clear all fine-tuning'],
      act: function () { PRAYER_KEYS.forEach(function (k) { S.adj[k] = 0; }); touched('time'); SET.focusKey = 'adj:fajr'; } });
    return rows;
  }

  function lookRows() {
    var rows = [head(['التخطيط الجاهز', 'Layout'])].concat(presetRows());
    rows.push(head(['الساعة', 'Clock']));
    rows.push(visRow(['الساعة والتاريخ', 'Clock & date'], 'clockVis'));
    rows.push(styleRow(['شكل الساعة', 'Clock style'], 'clockStyle', [['large', 'كبيرة يسار', 'Large · left'], ['center', 'في المنتصف', 'Centered'],
      ['corner', 'صغيرة في الزاوية', 'Small · corner'], ['scene', 'خلف المشهد', 'Behind the scenery']]));
    if (S.w.clockStyle === 'scene') {
      rows.push({ kind: 'cycle', key: 'glass', label: ['زجاج الساعة', 'Clock glass'],
        sub: S.glass === 'liquid' ? ['زجاج صافٍ يكبّر ما خلفه قليلًا', 'Clear glass that slightly magnifies what is behind it'] : ['أرقام من زجاج ضبابي', 'Digits of frosted glass'],
        value: S.glass === 'liquid' ? ['سائل', 'Liquid'] : ['ضبابي', 'Frosted'],
        step: function () { S.glass = S.glass === 'liquid' ? 'frosted' : 'liquid'; touched('look'); applyBody(); repaintScene(); } });
      rows.push({ kind: 'slider', key: 'glassAmt', label: ['صفاء الزجاج', 'How clear the glass is'], value: GLASS_T[S.glassAmt - 1], level: S.glassAmt,
        step: function (d) { var n = Math.max(1, Math.min(5, S.glassAmt + d)); if (n === S.glassAmt) return; S.glassAmt = n; touched('look'); applyBody(); repaintScene(); } });
    }
    rows.push(head(['مواقيت الصلاة', 'Prayer times']));
    rows.push(visRow(['مواقيت الصلاة', 'Prayer times'], 'prVis'));
    rows.push(styleRow(['شكل المواقيت', 'Prayer times style'], 'prStyle', [['arch', 'قوس جانبي', 'Arch panel'], ['strip', 'شريط سفلي', 'Bottom strip'], ['next', 'الصلاة القادمة فقط', 'Next prayer only']],
      sceneOn() && S.w.prStyle === 'arch' ? ['مع ساعة المشهد يظهر القوس شريطًا سفليًا', 'With the scenery clock the arch shows as the bottom strip'] : null));
    rows.push(head(['البطاقة', 'Card']));
    rows.push(visRow(['البطاقة (الآية والمناسبات)', 'Card (verse & occasions)'], 'cardVis'));
    rows.push(styleRow(['شكل البطاقة', 'Card style'], 'cardStyle', [['glass', 'زجاجية', 'Glass'], ['minimal', 'نص فقط', 'Text only']]));
    rows.push(head(['عناصر أخرى', 'More']));
    rows.push(visRow(['الطقس', 'Weather'], 'weatherVis'));
    rows.push(visRow(['سطر الأذكار', 'Dhikr line'], 'dhikrVis'));
    return rows;
  }

  function bgCountText() { var n = S.bgSel.length || BGS.length, t = BGS.length; return [arDigits(n) + ' من ' + arDigits(t), n + ' of ' + t]; }
  function bgRows() {
    var rows = [
      { kind: 'cycle', key: 'bgMode', label: ['ترتيب الخلفيات', 'Background order'],
        sub: S.bgMode === 'time' ? ['صور الفجر فجرًا وصور الليل ليلًا', 'Dawn photos at dawn, night photos at night'] : null,
        value: S.bgMode === 'time' ? ['حسب وقت اليوم', 'By time of day'] : ['عشوائي', 'Shuffle'],
        step: function () { S.bgMode = S.bgMode === 'time' ? 'all' : 'time'; touched('bg'); } },
      { kind: 'cycle', key: 'bgDur', label: ['مدة كل خلفية', 'Change every'],
        value: (function () { var d = S.bgDur; if (d === 0) return ['لا تتغير', 'Never']; return d < 60 ? [arDigits(d) + ' ثانية', d + ' seconds'] : [arDigits(d / 60) + ' دقيقة', (d / 60) + ' min']; })(),
        step: function (dir) { var i = DURS.indexOf(S.bgDur); if (i < 0) i = 2; S.bgDur = DURS[(i + dir + DURS.length) % DURS.length]; touched('bg'); } },
      { kind: 'cycle', key: 'bgMotion', label: ['حركة الخلفية', 'Background motion'],
        sub: sceneOn() ? ['الصورة ثابتة مع ساعة المشهد', 'The photo stays still with the scenery clock'] : null,
        value: onOff(S.bgMotion), step: function () { S.bgMotion = !S.bgMotion; touched('bg'); } },
      { kind: 'nav', key: 'gallery', label: ['اختيار من شبكة الصور', 'Pick in a grid'], sub: ['لاختيار عدة صور بسرعة', 'Quicker for choosing many at once'], act: openGallery },
      head([tr('الصور', 'Photos') + ' · ' + bgCountText()[0], 'Photos · ' + bgCountText()[1]])
    ];
    BGS.forEach(function (b) {
      var m = MOOD_AR[b.mood];
      rows.push({ kind: 'check', key: 'bg:' + b.id, label: bgName(b), thumb: bgThumb(b), checked: bgSelected(b.id),
        sub: [m[0] + (b.fg ? ' · الساعة خلف المشهد' : '') + (b.by ? ' · ' + b.by : ''), m[1] + (b.fg ? ' · clock behind the scenery' : '') + (b.by ? ' · ' + b.by : '')],
        act: function () { toggleBgId(b.id); touched('bg'); } });
    });
    return rows;
  }

  function screenRows() {
    return [
      head(['الليل', 'Night']),
      { kind: 'cycle', key: 'night', label: ['وضع الليل (بعد العشاء)', 'Night mode (after Isha)'], sub: ['من نصف ساعة بعد العشاء حتى قبيل الفجر', 'From half an hour after Isha until just before Fajr'],
        value: optText(NIGHT, S.night), step: function (d) { S.night = cyc(NIGHT.map(function (n) { return n[0]; }), S.night, d); touched('screen'); checkNight(true); } },
      head(['عند ترك التلفاز', 'When the TV is left alone']),
      { kind: 'cycle', key: 'idleMin', label: ['تهدئة الشاشة بعد', 'Quieten the screen after'], sub: ['دون ضغط أي زر. أي زر يعيدها', 'With no button pressed. Any button brings it back'],
        value: mins(S.idleMin), step: function (d) { S.idleMin = cyc(IDLE_MIN, S.idleMin, d); touched('screen'); } },
      { kind: 'cycle', key: 'idleAct', label: ['ماذا يحدث', 'What happens'], value: optText(IDLE_ACT, S.idleAct),
        step: function (d) { S.idleAct = cyc(IDLE_ACT.map(function (n) { return n[0]; }), S.idleAct, d); touched('screen'); } },
      head(['حماية الشاشة', 'Screen care']),
      { kind: 'cycle', key: 'shift', label: ['إزاحة خفيفة للعناصر', 'Gentle shift'], sub: ['تتحرك العناصر بضعة بكسلات كل ثلاث دقائق', 'Everything moves a few pixels every three minutes'],
        value: onOff(S.shift), step: function () { S.shift = !S.shift; touched('screen'); shiftUi(); } }
    ];
  }

  function aboutRows() {
    return [
      info('ver', ['نور', 'Noor'], VERSION, ['لوحة منزلية إسلامية لتلفاز سامسونج. تعمل على التلفاز وحده، دون حاسوب.', 'An Islamic home dashboard for Samsung TVs. It runs on the TV alone, no computer needed.']),
      info('cr1', ['مواقيت الصلاة', 'Prayer times'], '', ['تُحسب على التلفاز نفسه. الطقس والبحث عن المدن من Open-Meteo.', 'Worked out on the TV itself. Weather and city search come from Open-Meteo.']),
      info('cr2', ['ساعة المشهد وشكل الإعدادات', 'Scenery clock and settings layout'], '', ['من مشروع couch-tv (رخصة MIT، © 2026 Seagey)', 'From couch-tv (MIT licence, © 2026 Seagey)']),
      info('cr3', ['الصور والخطوط والمدن', 'Photos, fonts and cities'], '', ['أسماء أصحابها ورخصها في ملف CREDITS.md', 'Named with their licences in CREDITS.md']),
      head(['الإعداد', 'Setup']),
      { kind: 'action', key: 'rerun', label: ['إعادة الإعداد الأول', 'Run the first-time setup again'], sub: ['اللغة ثم المدينة ثم الشكل', 'Language, then city, then look'], act: function () { startWizard(); } },
      { kind: 'action', key: 'reset', danger: true, confirm: true, label: ['مسح كل الإعدادات', 'Reset all settings'], sub: ['تعود نور كما كانت عند التثبيت', 'Noor goes back to how it was when installed'],
        act: function () { safe(function () { localStorage.removeItem('noor.settings'); }); location.reload(); } }
    ];
  }

  function sectionRows(id) {
    return id === 'general' ? generalRows() : id === 'location' ? locationRows() : id === 'prayer' ? prayerRows() : id === 'look' ? lookRows() :
      id === 'bg' ? bgRows() : id === 'screen' ? screenRows() : aboutRows();
  }

  /* ---- first-run setup: language, city, look ---- */
  var WIZ = ['lang', 'city', 'look'];
  function startWizard() {
    mode = 'settings';
    SET.wiz = 'lang'; SET.col = 'rows'; SET.stack = []; SET.ri = 0; SET.confirm = null; SET.msg = ''; SET.dom = null; SET.focusKey = 'lang:' + S.lang;
    $('setOverlay').className = 'overlay set2 wiz open';
    paintSettings(true);
  }
  function wizNext() {
    var i = WIZ.indexOf(SET.wiz);
    SET.stack = []; SET.ri = 0; SET.msg = ''; SET.dom = null;
    if (i < WIZ.length - 1) { SET.wiz = WIZ[i + 1]; SET.focusKey = SET.wiz === 'look' ? 'preset:' + S.preset : null; applyBody(); return; }
    S.setup = true; SET.wiz = null; saveSettings();
    closeSettings();
  }
  function wizRows() {
    if (SET.wiz === 'lang') return [
      { kind: 'choice', key: 'lang:ar', label: 'العربية', checked: S.lang === 'ar', act: function () { S.lang = 'ar'; saveSettings(); wizNext(); } },
      { kind: 'choice', key: 'lang:en', label: 'English', checked: S.lang === 'en', act: function () { S.lang = 'en'; saveSettings(); wizNext(); } }
    ];
    if (SET.wiz === 'city') {
      var g = guessCity(), rows = [];
      if (g) rows.push({ kind: 'choice', key: 'guess', label: [g.ar || g.en, g.en], value: countryName(g.cc), sub: ['حسب المنطقة الزمنية للتلفاز', 'From the TV\'s time zone'], act: function () { pickCity(g); } });
      return rows.concat(cityPickRows());
    }
    return presetRows(wizNext);
  }
  var WIZ_TEXT = {
    lang: ['اختر اللغة', 'Choose your language'],
    city: ['أين هذا التلفاز؟ تُحسب مواقيت الصلاة على التلفاز نفسه من موقع مدينتك.', 'Where is this TV? Prayer times are worked out on the TV itself from where your city is.'],
    look: ['اختر شكل الشاشة الرئيسية. يمكنك تغييره لاحقًا من الإعدادات.', 'Pick how the home looks. You can change it later in Settings.']
  };

  /* ---- drawing ---- */
  function rowsNow() { return SET.stack.length ? SET.stack[SET.stack.length - 1].rows() : (SET.wiz ? wizRows() : sectionRows(SECS[SET.sec][0])); }
  function focusable(r) { return !!r && r.kind !== 'head' && r.kind !== 'info'; }
  function firstRow(rows) { for (var i = 0; i < rows.length; i++) if (focusable(rows[i])) return i; return -1; }
  function stepRow(rows, i, d) { for (var j = i + d; j >= 0 && j < rows.length; j += d) if (focusable(rows[j])) return j; return i; }
  function indexOfKey(rows, k) { for (var i = 0; i < rows.length; i++) if (rows[i].key === k) return i; return -1; }
  function pushPage(page, focusKey) { SET.stack.push(page); SET.ri = 0; SET.focusKey = focusKey || null; SET.msg = ''; SET.confirm = null; SET.dom = null; page.from = SET.lastKey; }
  function pageKey() { return (SET.wiz || '') + '|' + SET.sec + '|' + SET.stack.map(function (p) { return p.id; }).join('/') + '|' + S.lang; }

  function rowHTML(r, i) {
    if (r.kind === 'head') return '<div class="shead">' + esc(L(r.label)) + '</div>';
    var f = SET.col === 'rows' && i === SET.ri;
    var cls = 'srow k-' + r.kind + (f ? ' focus' : '') + (r.danger ? ' danger' : '') + (r.step ? ' adj' : '');
    var lead = r.thumb ? '<img class="sthumb" src="' + esc(r.thumb) + '" alt="">' : '';
    var label = SET.confirm === r.key ? tr('اضغط OK مرة أخرى للتأكيد', 'Press OK again to confirm') : L(r.label);
    var tail = '';
    if (r.kind === 'choice') tail = r.checked ? '<i class="smark">' + IC.check + '</i>' : '';
    else if (r.kind === 'check') tail = '<i class="sbox' + (r.checked ? ' on' : '') + '">' + (r.checked ? IC.check : '') + '</i>';
    else if (r.kind === 'nav') tail = '<i class="smark faint chev">' + IC.chevron + '</i>';
    else if (r.kind === 'slider') {
      for (var lv = 1; lv <= 5; lv++) tail += '<i class="sstep' + (lv <= r.level ? ' on' : '') + '"></i>';
      tail = '<span class="sslide">' + tail + '</span>';
    }
    var v = L(r.value), value = v !== '' ? '<span class="sv">' + esc(v) + '</span>' : '';
    var sub = r.sub ? '<small>' + esc(L(r.sub)) + '</small>' : '';
    return '<div class="' + cls + '" data-i="' + i + '">' + lead + '<span class="sl"><b>' + esc(label) + '</b>' + sub + '</span>' + value + tail + '</div>';
  }

  // full: something changed, so the rows are drawn again; otherwise only the focus moves
  // (a list of two hundred countries is not rebuilt on every arrow press)
  function paintSettings(full) {
    var rows = rowsNow(), box = $('setRows'), i;
    if (!rows.length && SET.stack.length) { SET.stack.pop(); rows = rowsNow(); full = true; }
    if (SET.col === 'rows') {
      var k = SET.focusKey ? indexOfKey(rows, SET.focusKey) : -1;
      if (k >= 0 && focusable(rows[k])) SET.ri = k;
      else {
        SET.ri = Math.max(0, Math.min(SET.ri, rows.length - 1));
        if (!focusable(rows[SET.ri])) { var back = stepRow(rows, SET.ri, -1); SET.ri = focusable(rows[back]) ? back : stepRow(rows, SET.ri, 1); }
      }
      SET.focusKey = null;
      if (!focusable(rows[SET.ri])) { if (SET.wiz) SET.ri = Math.max(0, firstRow(rows)); else SET.col = 'secs'; }
    }
    var key = pageKey();
    if (full || SET.dom !== key || box.children.length !== rows.length) {
      box.innerHTML = rows.map(rowHTML).join('');
      SET.dom = key;
    } else {
      for (i = 0; i < box.children.length; i++) {
        var n = box.children[i], on = SET.col === 'rows' && i === SET.ri, has = / focus/.test(n.className);
        if (on && !has) n.className += ' focus'; else if (!on && has) n.className = n.className.replace(' focus', '');
      }
    }
    var page = SET.stack[SET.stack.length - 1];
    $('setOverlay').className = 'overlay set2 open' + (SET.wiz ? ' wiz' : '');
    $('setTitle').innerHTML = SET.wiz ? '<span class="kufi">نـور</span>' : esc(tr('الإعدادات', 'Settings'));
    $('setSecs').innerHTML = SET.wiz ? '' : SECS.map(function (sc, n) {
      return '<div class="ssec' + (n === SET.sec ? (SET.col === 'secs' ? ' focus' : ' on') : '') + '" data-i="' + n + '"><i>' + IC[sc[2]] + '</i><span>' + esc(L(sc[1])) + '</span></div>';
    }).join('');
    $('setWiz').innerHTML = SET.wiz ? '<div class="wiz-step">' + esc(tr('الخطوة ' + arDigits(WIZ.indexOf(SET.wiz) + 1) + ' من ٣', 'Step ' + (WIZ.indexOf(SET.wiz) + 1) + ' of 3')) + '</div>' +
      (SET.wiz === 'lang' ? '<div class="wiz-text ar">' + WIZ_TEXT.lang[0] + '</div><div class="wiz-text">' + WIZ_TEXT.lang[1] + '</div>' : '<div class="wiz-text">' + esc(L(WIZ_TEXT[SET.wiz])) + '</div>') : '';
    var secName = SET.wiz ? L({ lang: ['اللغة · Language', 'اللغة · Language'], city: ['المدينة', 'Your city'], look: ['الشكل', 'Look'] }[SET.wiz]) : L(SECS[SET.sec][1]);
    $('setCrumb').innerHTML = page ? esc(secName) : '';
    $('setHead').innerHTML = esc(page ? L(page.title) : secName);
    $('setMsg').innerHTML = esc(SET.msg || '');
    var cur = rows[SET.ri];
    $('setHint').innerHTML = SET.typing ? tr('<b>تم</b> بحث &nbsp;&nbsp; <b>BACK</b> إلغاء', '<b>Done</b> Search &nbsp;&nbsp; <b>BACK</b> Cancel') :
      SET.col === 'secs' ? tr('<b>▲ ▼</b> تنقل &nbsp;&nbsp; <b>OK</b> فتح &nbsp;&nbsp; <b>BACK</b> حفظ وإغلاق', '<b>▲ ▼</b> Move &nbsp;&nbsp; <b>OK</b> Open &nbsp;&nbsp; <b>BACK</b> Save &amp; close') :
      cur && cur.step ? tr('<b>◀ ▶</b> تغيير &nbsp;&nbsp; <b>▲ ▼</b> تنقل &nbsp;&nbsp; <b>BACK</b> رجوع', '<b>◀ ▶</b> Change &nbsp;&nbsp; <b>▲ ▼</b> Move &nbsp;&nbsp; <b>BACK</b> Back') :
      tr('<b>OK</b> اختيار &nbsp;&nbsp; <b>▲ ▼</b> تنقل &nbsp;&nbsp; <b>BACK</b> رجوع', '<b>OK</b> Select &nbsp;&nbsp; <b>▲ ▼</b> Move &nbsp;&nbsp; <b>BACK</b> Back');
    // keep the focused row well inside the list (a quarter of it from either edge)
    var f = box.querySelector('.srow.focus');
    if (!f) { box.scrollTop = 0; return; }
    var top = f.offsetTop, bottom = top + f.offsetHeight, view = box.clientHeight, edge = view / 4;
    if (top - edge < box.scrollTop) box.scrollTop = Math.max(0, top - edge);
    else if (bottom + edge > box.scrollTop + view) box.scrollTop = bottom + edge - view;
  }

  function openSettings() {
    mode = 'settings';
    SET.col = 'secs'; SET.sec = 0; SET.ri = 0; SET.stack = []; SET.confirm = null; SET.msg = ''; SET.wiz = null; SET.dom = null; SET.focusKey = null;
    paintSettings(true);
  }
  function closeSettings() {
    if (SET.typing) stopTyping();
    var d = SET.dirty; SET.dirty = {};
    $('setOverlay').className = 'overlay set2';
    saveSettings();
    mode = 'home';
    today = null; nx = null; tick();
    if (d.loc) loadWeather();
    if (d.bg || d.look) nextBackground(d.bg ? null : (bgCur && bgCur.id));
    checkNight(true); armIdle();
    buildTiles(); applyBody(); renderActions();
  }

  /* ---- typing a place name with the TV's on-screen keyboard ---- */
  function startTyping(spec) {
    SET.typing = spec; SET.msg = '';
    var inp = $('setInput');
    $('setTypeLabel').innerHTML = esc(L(spec.label));
    inp.value = '';
    $('setType').className = 'set-type on';
    paintSettings(false);
    safe(function () { inp.focus(); });
  }
  function stopTyping() {
    SET.typing = null;
    $('setType').className = 'set-type';
    safe(function () { $('setInput').blur(); });
  }
  // true: the key belonged to the text box
  function typingKey(e) {
    if (!SET.typing) return false;
    var k = e.keyCode, inp = $('setInput');
    if (k === 13 || k === 65376) {   // Enter, or Done on Samsung's keyboard
      e.preventDefault();
      var spec = SET.typing, v = inp.value;
      if (!v.replace(/\s+/g, '')) { if (document.activeElement !== inp) safe(function () { inp.focus(); }); return true; }
      stopTyping(); spec.submit(v);
      if (mode === 'settings') paintSettings(true);
      return true;
    }
    if (k === K.BACK || k === K.ESC || k === 65385) { e.preventDefault(); stopTyping(); paintSettings(true); return true; }   // 65385: Cancel on Samsung's keyboard
    if (k === K.UP || k === K.DOWN) { e.preventDefault(); stopTyping(); paintSettings(true); return true; }
    return true;   // everything else is typing (Backspace deletes here, it does not go back)
  }

  /* ---- keys on the settings screen ---- */
  function setBack() {
    SET.confirm = null; SET.msg = '';
    if (SET.stack.length) { var p = SET.stack.pop(); SET.focusKey = p.from || null; SET.dom = null; return; }
    if (SET.wiz) { var i = WIZ.indexOf(SET.wiz); if (i > 0) { SET.wiz = WIZ[i - 1]; SET.ri = 0; SET.dom = null; } return; }
    if (SET.col === 'rows') { SET.col = 'secs'; return; }
    closeSettings();
  }
  function setActivate(r) {
    if (!r) return;
    SET.lastKey = r.key; SET.msg = '';
    if (r.confirm && SET.confirm !== r.key) { SET.confirm = r.key; return; }
    SET.confirm = null;
    if (r.act) r.act(); else if (r.step) r.step(1);
  }
  function setKey(k) {
    var rows = rowsNow(), fwd = S.lang === 'ar' ? K.LEFT : K.RIGHT, full = false, n;
    if (SET.col === 'secs') {
      if (k === K.UP || k === K.DOWN) { n = Math.max(0, Math.min(SECS.length - 1, SET.sec + (k === K.UP ? -1 : 1))); if (n !== SET.sec) { SET.sec = n; SET.ri = 0; SET.msg = ''; full = true; } }
      else if (k === K.ENTER || k === fwd) { n = firstRow(rows); if (n >= 0) { SET.col = 'rows'; SET.ri = n; } }
      else return;
    } else {
      var r = rows[SET.ri];
      if (k === K.UP || k === K.DOWN) { SET.ri = stepRow(rows, SET.ri, k === K.UP ? -1 : 1); if (SET.confirm) { SET.confirm = null; full = true; } }
      else if (k === K.PGUP || k === K.PGDN || k === K.CHUP || k === K.CHDN) { for (n = 0; n < 7; n++) SET.ri = stepRow(rows, SET.ri, (k === K.PGUP || k === K.CHUP) ? -1 : 1); }
      else if (k === K.LEFT || k === K.RIGHT) {
        if (r && r.step) { SET.lastKey = r.key; SET.msg = ''; r.step(k === fwd ? 1 : -1); full = true; }
        else if (k !== fwd) { if (SET.stack.length || !SET.wiz) { setBack(); full = true; } }
        else if (r && r.kind === 'nav') { setActivate(r); full = true; }
      }
      else if (k === K.ENTER) { setActivate(r); full = true; }
      else return;
    }
    if (mode === 'settings') paintSettings(full);
  }
  function wireSettingsPointer() {   // a mouse in the browser preview, or a pointer remote
    function idx(t, box) { for (; t && t !== box; t = t.parentNode) if (t.getAttribute && t.getAttribute('data-i') != null) return +t.getAttribute('data-i'); return -1; }
    $('setSecs').addEventListener('click', function (e) {
      var i = idx(e.target, this); if (i < 0 || SET.typing) return;
      SET.stack = []; SET.sec = i; SET.col = 'secs'; SET.ri = 0; SET.msg = ''; paintSettings(true);
    });
    $('setRows').addEventListener('click', function (e) {
      var i = idx(e.target, this), rows = rowsNow(); if (i < 0 || SET.typing || !focusable(rows[i])) return;
      SET.col = 'rows'; SET.ri = i; setActivate(rows[i]);
      if (mode === 'settings') paintSettings(true);
    });
  }

  function closeOverlays() {
    if (mode === 'gallery') { saveSettings(); $('galOverlay').className = 'overlay'; mode = 'settings'; SET.focusKey = 'gallery'; SET.dirty.bg = true; paintSettings(true); return; }
    if (mode === 'settings') { setBack(); if (mode === 'settings') paintSettings(true); return; }
    $('appsOverlay').className = 'overlay'; $('galOverlay').className = 'overlay'; $('quranOverlay').className = 'overlay';
    mode = 'home'; buildTiles(); applyBody(); renderActions();
  }

  /* ---------------- animated background + palette ----------------
     Two layers cross-fade. Each holds the photo and, for the scenery clock, the glass clock and the
     cut-out of the photo that stands in front of it (after couch-tv's scenes):
       img/bg/<id>.jpg        the photo, 1920x1080
       img/bg/<id>-glass.jpg  a blurred, brightened copy that fills the clock's digits (glass: 1)
       img/bg/<id>-fg.webp    everything in front of the sky, the sky transparent (fg: 1) */
  var bgLayers = null, bgFront = 0, bgCur = null, kb = 0, bgTimer = null, swapT = null;
  function moodNow(now) {
    if (!times) return 'day';
    var M = 60000;
    if (now >= new Date(times.fajr - 20 * M) && now < new Date(+times.sunrise + 90 * M)) return 'dawn';
    if (now >= new Date(times.maghrib - 75 * M) && now < new Date(+times.isha + 20 * M)) return 'dusk';
    if (now >= new Date(+times.isha + 20 * M) || now < new Date(times.fajr - 20 * M)) return 'night';
    return 'day';
  }
  function bgById(id) { for (var i = 0; i < BGS.length; i++) if (BGS[i].id === id) return BGS[i]; return null; }
  function bgSelected(id) { return !S.bgSel.length || S.bgSel.indexOf(id) !== -1; }
  function bgPool() {
    var sel = BGS.filter(function (b) { return bgSelected(b.id); });
    if (!sel.length) sel = BGS;
    if (S.bgMode === 'time' && sel.length > 1) {
      var m = moodNow(NOW()), byMood = sel.filter(function (b) { return b.mood === m; });
      if (byMood.length) return byMood;
    }
    return sel;
  }
  function applyPalette(b) {
    var r = document.documentElement.style;
    r.setProperty('--accent', b.accent); r.setProperty('--hi', b.hi);
    r.setProperty('--argb', b.argb); r.setProperty('--panel', b.panel);
  }
  function buildLayers() {
    bgLayers = [$('bgA'), $('bgB')];
    bgLayers.forEach(function (l) {
      l.innerHTML = '<div class="ph"></div><div class="shade"></div><div class="gclock"></div><div class="gclock under"></div><img class="fg" alt="">';
      l.querySelector('.fg').onerror = function () { this.style.display = 'none'; };   // fg: 1 but no file: the clock stays in front
    });
  }
  // where a photo's clock sits: the built-in look unless the photo says otherwise (js/backgrounds.js)
  function clockOf(b) {
    var c = (b && b.clock) || {};
    return { top: typeof c.top === 'number' ? c.top : 150, size: typeof c.size === 'number' ? c.size : 400, left: c.x === 'left', dark: !!c.dark };
  }
  function sceneKind(b) { return /^scene-[a-z]+$/.test(b.id) && !b.mine ? b.id.slice(6) : 'photo'; }
  function paintLayer(l, b) {
    var on = sceneOn(), c = clockOf(b), ph = l.querySelector('.ph'), fg = l.querySelector('.fg');
    l._bg = b;
    ph.style.backgroundImage = 'url("' + bgFile(b) + '")';
    l.setAttribute('data-kind', on ? sceneKind(b) : '');
    l.setAttribute('data-x', on && c.left ? 'left' : '');
    l.setAttribute('data-tone', on && c.dark ? 'dark' : '');
    l.setAttribute('data-glass', on && !b.glass ? 'none' : '');
    l.setAttribute('data-water', on && b.water ? '1' : '');
    if (on && b.fg) { fg.style.display = ''; if (fg.getAttribute('data-id') !== b.id) { fg.setAttribute('data-id', b.id); fg.src = bgFile(b, '-fg', '.webp'); } }
    else { fg.style.display = 'none'; fg.removeAttribute('data-id'); fg.removeAttribute('src'); }
    var cs = l.querySelectorAll('.gclock');
    for (var i = 0; i < cs.length; i++) { cs[i].style.top = c.top + 'px'; cs[i].style.fontSize = c.size + 'px'; if (!on) cs[i].innerHTML = ''; }
    return on;
  }
  // The clock's fill is the frosted copy of the photo exactly behind each digit, so it is lined up
  // again whenever the time changes or a photo is about to show.
  function drawClock(l) {
    var b = l && l._bg;
    if (!b || !sceneOn()) return;
    var hm = clockHM(NOW()), cs = l.querySelectorAll('.gclock'), liquid = S.glass === 'liquid';
    for (var k = 0; k < cs.length; k++) {
      var c = cs[k];
      if (k === 1 && !b.water) { c.innerHTML = ''; continue; }
      c.innerHTML = '<span class="edge">' + hm + '</span><span class="fill">' + hm + '</span><span class="sheen">' + hm + '</span><span class="rim">' + hm + '</span>';
      var f = c.querySelector('.fill'), ex = c.offsetLeft + f.offsetLeft, ey = c.offsetTop + f.offsetTop;
      if (liquid) {
        // Liquid glass: the sharp photo seen through the digits, magnified a little about the
        // clock's middle, the way thick clear glass bends what is behind it. The two most
        // frosted steps use the blurred copy instead.
        var cx = c.offsetLeft + c.offsetWidth / 2, cy = c.offsetTop + c.offsetHeight / 2, LENS = 1.07;
        f.style.backgroundImage = 'url("' + bgFile(b, S.glassAmt <= 2 && b.glass ? '-glass' : '') + '")';
        f.style.backgroundSize = (LENS * 1920) + 'px ' + (LENS * 1080) + 'px';
        f.style.backgroundPosition = (-ex - (LENS - 1) * cx) + 'px ' + (-ey - (LENS - 1) * cy) + 'px';
      } else {
        f.style.backgroundImage = 'url("' + bgFile(b, b.glass ? '-glass' : '') + '")';
        f.style.backgroundSize = '1920px 1080px';
        f.style.backgroundPosition = -ex + 'px ' + -ey + 'px';
      }
    }
    if (b.water) {   // above the waterline sharp, below it a blurred reflection
      var line = 1080 * b.water - cs[0].offsetTop, out = '-50%';
      var top = 'inset(' + out + ' ' + out + ' ' + (cs[0].offsetHeight - line) + 'px ' + out + ')', under = 'inset(' + line + 'px ' + out + ' ' + out + ' ' + out + ')';
      cs[0].style.webkitClipPath = cs[0].style.clipPath = top;
      cs[1].style.webkitClipPath = cs[1].style.clipPath = under;
    } else { cs[0].style.webkitClipPath = cs[0].style.clipPath = ''; }
  }
  function glassClock() { if (bgLayers && bgCur) drawClock(bgLayers[bgFront]); }
  // the look changed in Settings: draw the photo on screen again in the new look
  function repaintScene() { if (!bgLayers || !bgCur) return; paintLayer(bgLayers[bgFront], bgCur); drawClock(bgLayers[bgFront]); applyBody(); }
  function scheduleBackground() {
    clearTimeout(bgTimer);
    if (S.bgDur > 0) bgTimer = setTimeout(function () { nextBackground(); }, S.bgDur * 1000);
  }
  function nextBackground(forceId) {
    if (!bgLayers) buildLayers();
    var b = forceId ? bgById(forceId) : null;
    if (!b) {
      var pool = bgPool();
      b = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1) while (bgCur && b.id === bgCur.id) b = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!b) return;
    var url = bgFile(b);
    var img = new Image();
    img.onload = function () {
      var back = bgLayers[1 - bgFront], front = bgLayers[bgFront], ph = back.querySelector('.ph');
      var scene = paintLayer(back, b);
      back.className = 'bg';
      ph.className = 'ph';
      void back.offsetWidth;
      // motion length follows the chosen duration (min 30s) so the drift never stops early
      var dur = Math.max(30, S.bgDur > 0 ? S.bgDur + 5 : 120);
      ph.style.webkitAnimationDuration = ph.style.animationDuration = dur + 's';
      if (S.bgDur === 0) { ph.style.webkitAnimationDirection = ph.style.animationDirection = 'alternate'; ph.style.webkitAnimationIterationCount = ph.style.animationIterationCount = 'infinite'; }
      else { ph.style.animationDirection = ph.style.webkitAnimationDirection = 'normal'; ph.style.animationIterationCount = ph.style.webkitAnimationIterationCount = '1'; }
      // with the scenery clock the photo stays still, so the cut-out and the glass stay lined up
      ph.className = 'ph ' + (scene ? 'flat' : (S.bgMotion ? 'kb' + (kb++ % 4) : 'still'));
      drawClock(back);
      back.className = 'bg on' + (scene ? ' sc' : '');
      front.className = front.className.replace(' on', '');
      bgFront = 1 - bgFront;
      var first = !bgCur;
      bgCur = b; applyPalette(b);
      // the date sits just above each photo's clock: it fades out while the photos swap
      clearTimeout(swapT);
      if (scene && !first) { $('wClock').className = 'w w-clock swap'; swapT = setTimeout(function () { applyBody(); $('wClock').className = 'w w-clock'; }, 900); }
      else { $('wClock').className = 'w w-clock'; applyBody(); }
    };
    img.onerror = function () {   // a photo named in the list but not on this TV: it leaves the turns
      var i = BGS.indexOf(b); if (i >= 0 && BGS.length > 1) { BGS.splice(i, 1); nextBackground(); }
    };
    img.src = url;
    scheduleBackground();
  }

  /* ---------------- background gallery ---------------- */
  var gIdx = 0, gNodes = [], GCOLS = 6;
  var MOOD_AR = { dawn: ['فجر', 'Dawn'], day: ['نهار', 'Day'], dusk: ['غروب', 'Dusk'], night: ['ليل', 'Night'] };
  function openGallery() {
    mode = 'gallery';
    $('setOverlay').className = 'overlay set2';
    var g = $('galGrid'); g.innerHTML = ''; var sc = el('div', 'scroller'); g.appendChild(sc); gNodes = [];
    BGS.forEach(function (b, i) {
      var d = el('div', 'thumb', '<span class="chk">✓</span><span class="mood">' + T(MOOD_AR[b.mood][0], MOOD_AR[b.mood][1]) + '</span><span class="sw" style="background:' + b.accent + '"></span>');
      d.style.backgroundImage = 'url("' + bgThumb(b) + '")';
      d.onclick = function () { gIdx = i; toggleBg(); };
      sc.appendChild(d); gNodes.push(d);
    });
    gIdx = Math.min(gIdx, BGS.length - 1);
    $('galOverlay').className = 'overlay open';
    paintGallery();
  }
  function paintGallery() {
    gNodes.forEach(function (n, i) {
      var b = BGS[i];
      n.className = 'thumb' + (bgSelected(b.id) ? ' sel' : '') + (i === gIdx ? ' focus' : '') + (bgCur && bgCur.id === b.id ? ' current' : '');
    });
    var row = Math.floor(gIdx / GCOLS), sc = $('galGrid').firstChild;
    var y = Math.max(0, row - 2) * 170;
    sc.style.transform = sc.style.webkitTransform = 'translateY(' + (-y) + 'px)';
    var c = bgCountText();
    $('galCount').innerHTML = T(c[0], c[1]);
  }
  function toggleBgId(id) {
    if (!S.bgSel.length) S.bgSel = BGS.map(function (b) { return b.id; });
    var k = S.bgSel.indexOf(id);
    if (k === -1) S.bgSel.push(id);
    else if (S.bgSel.length > 1) S.bgSel.splice(k, 1);   // the last one stays on
    S.bgSel = S.bgSel.filter(function (x) { return !!bgById(x); });
    if (S.bgSel.length === BGS.length) S.bgSel = [];
  }
  function toggleBg() { var id = BGS[gIdx].id; toggleBgId(id); paintGallery(); nextBackground(id); }
  function onlyThisBg() { S.bgSel = [BGS[gIdx].id]; paintGallery(); nextBackground(S.bgSel[0]); toast(T('خلفية واحدة فقط', 'Only this background')); }
  function allBgs() { S.bgSel = []; paintGallery(); toast(T('كل الخلفيات', 'All backgrounds')); }

  /* ---------------- the Quran player ----------------
     One track at a time: a surah { n: 1..114, list: 'all' | 'fav' } or a clip { clip: 'takbeer' }.
     Surahs stream from the reciter's folder on mp3quran.net, with Al Quran Cloud as a backup where
     it has that reciter. When a surah ends the next one starts (Settings, General, After a surah).
     Where you stopped is kept (S.q), so "Continue" picks it up; nothing ever starts by itself. */
  var player = null, track = null, srcIdx = 0, fails = 0, resumeAt = 0, lastSaved = -1, lastShown = -1;
  function reciter() { for (var i = 0; i < C.reciters.length; i++) if (C.reciters[i].id === S.reciter) return C.reciters[i]; return C.reciters[0]; }
  function surah(n) { return QS[n - 1] || null; }
  function trackTitle(t) {
    if (t.clip) return [C.audio[t.clip].ar, C.audio[t.clip].en];
    var q = surah(t.n);
    return ['سورة ' + q[1], q[2]];
  }
  function trackUrls(t) {
    if (t.clip) return C.audio[t.clip].urls;
    var r = reciter(), u = [r.mp3 + ('00' + t.n).slice(-3) + '.mp3'];
    if (r.cdn) u.push('https://cdn.islamic.network/quran/audio-surah/128/' + r.cdn + '/' + t.n + '.mp3');
    return u;
  }
  function fmtDur(x) {
    x = Math.max(0, Math.floor(x || 0));
    var h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(x % 60);
  }
  function isPlaying() { return !!track && !!player && !player.paused; }
  function startAudio() { var pr = player.play(); if (pr && pr['catch']) pr['catch'](function () {}); }
  // the surahs a list plays, in mushaf order
  function listOrder(list) {
    if (list === 'fav' && S.qFav.length) return S.qFav.slice().sort(function (x, y) { return x - y; });
    return QS.map(function (q) { return q[0]; });
  }
  function neighbour(dir) {
    if (!track || !track.n) return 0;
    var o = listOrder(track.list), i = o.indexOf(track.n);
    if (i < 0) { for (i = 0; i < o.length && o[i] < track.n; i++); return dir > 0 ? (o[i] || 0) : (o[i - 1] || 0); }
    return o[i + dir] || 0;
  }
  function remember() {
    if (!track || !track.n || !player) return;
    S.q = { n: track.n, t: Math.floor(player.currentTime || 0), list: track.list };
    lastSaved = S.q.t;
    saveSettings();
  }
  function playTrack(t, from) {
    player = player || $('player');
    if (track && track.n && !t.auto) remember();
    track = t; srcIdx = 0; resumeAt = from > 5 ? from : 0; lastShown = -1;
    player.src = trackUrls(t)[0];
    startAudio();
    var tt = trackTitle(t), R = reciter();
    if (!t.auto) toast('▶ ' + T(tt[0] + (t.n ? ' · ' + R.ar : ''), tt[1] + (t.n ? ' · ' + R.en : '')) + (resumeAt ? ' <small>' + fmtDur(resumeAt) + '</small>' : ''));
    if (t.n) { S.q = { n: t.n, t: resumeAt, list: t.list }; saveSettings(); }
    audioChanged();
  }
  function playSurah(n, from, list, auto) { if (surah(n)) playTrack({ n: n, list: list === 'fav' ? 'fav' : 'all', auto: !!auto }, from); }
  // where you stopped, or the start of the Quran
  function resumeLast() { var q = S.q; if (q && surah(q.n)) playSurah(q.n, q.t, q.list); else playSurah(1); }
  function togglePlay() {
    if (!track) { resumeLast(); return; }
    if (player.paused) startAudio(); else { player.pause(); remember(); }
    audioChanged();
  }
  function stepSurah(dir) {
    if (!track || !track.n) { if (!track) resumeLast(); return; }
    var n = neighbour(dir);
    if (n) playSurah(n, 0, track.list);
    else toast(dir > 0 ? T('هذه آخر سورة', 'This is the last surah') : T('هذه أول سورة', 'This is the first surah'));
  }
  function seekAudio(sec) {
    if (!track || !player || !player.duration) return;
    player.currentTime = Math.max(0, Math.min(player.duration - 1, player.currentTime + sec));
    paintAudio(true);
  }
  function stopAudio() {
    if (player && track) { remember(); player.pause(); player.removeAttribute('src'); }
    track = null; audioChanged();
  }
  function toggleFav(n) {
    var k = S.qFav.indexOf(n);
    if (k === -1) S.qFav.push(n); else S.qFav.splice(k, 1);
    saveSettings();
  }
  function audioChanged() { applyBody(); renderActions(); paintAudio(true); if (mode === 'quran') paintQuran(); }
  // the now-playing bar on the home, the bar in the player, the card's progress line
  function paintAudio(force) {
    var bar = $('nowBar');
    if (!track) { if (force) { bar.innerHTML = ''; paintQBar(); } return; }
    var sec = Math.floor(player.currentTime || 0);
    if (!force && sec === lastShown) return;
    lastShown = sec;
    var tt = trackTitle(track), R = reciter(), dur = player.duration || 0, pct = dur ? (100 * player.currentTime / dur).toFixed(2) : 0;
    bar.innerHTML = (isPlaying() ? PLAY_IC : PAUSE_IC).replace('#10221f', 'currentColor') +
      '<span class="nb-text"><b>' + T(esc(tt[0]), esc(tt[1])) + '</b><small>' + (track.n ? T(esc(R.ar), esc(R.en)) + ' · ' : '') + fmtDur(sec) + (dur ? ' / ' + fmtDur(dur) : '') + '</small></span>' +
      '<span class="nb-line"><i style="width:' + pct + '%"></i></span>';
    $('occProg').style.width = pct + '%';
    paintQBar();
    if (track.n && Math.abs(sec - lastSaved) >= 10 && isPlaying()) remember();
  }
  (function wireAudio() {
    var a = $('player');
    a.addEventListener('loadedmetadata', function () {
      if (resumeAt && a.duration && resumeAt < a.duration - 10) a.currentTime = resumeAt;
      resumeAt = 0;
    });
    a.addEventListener('playing', function () { fails = 0; audioChanged(); });
    a.addEventListener('pause', function () { if (track) audioChanged(); });
    a.addEventListener('error', function () {
      if (!track) return;
      var urls = trackUrls(track);
      if (++srcIdx < urls.length) { a.src = urls[srcIdx]; startAudio(); return; }
      var tt = trackTitle(track), t = track;
      fails++;
      toast(T('تعذّر تشغيل ' + tt[0], tt[1] + ' could not be played'));
      // carrying on by itself: skip a surah that will not play, but not for ever with no internet
      if (t.auto && t.n && fails < 3) { var nx = neighbour(1); if (nx) { playSurah(nx, 0, t.list, true); return; } }
      track = null; audioChanged();
    });
    a.addEventListener('ended', function () {
      if (!track) return;
      var t = track, next = 0;
      if (!t.n) { track = null; audioChanged(); return; }
      if (S.afterSurah === 'repeat') next = t.n;
      else if (S.afterSurah === 'shuffle') { var o = listOrder(t.list); next = o[Math.floor(Math.random() * o.length)]; if (o.length > 1) while (next === t.n) next = o[Math.floor(Math.random() * o.length)]; }
      else next = neighbour(1);
      if (S.afterSurah === 'stop' || !next) {   // "Continue" then offers what comes next
        S.q = { n: next || listOrder(t.list)[0] || 1, t: 0, list: t.list }; saveSettings();
        track = null; audioChanged(); return;
      }
      playSurah(next, 0, t.list, true);
    });
    a.addEventListener('timeupdate', function () { paintAudio(false); });
  })();

  /* ---------------- the Quran player screen: every surah, favourites, what is playing ---------------- */
  var qIdx = 0, qNodes = [], qItems = [], qList = 'all', QCOLS = 6;
  function openQuran() {
    mode = 'quran';
    if (qList === 'fav' && !S.qFav.length) qList = 'all';
    buildQuran((track && track.n) || (S.q && S.q.n) || 1);
    $('quranOverlay').className = 'overlay open';
    paintQuran();
  }
  function buildQuran(focusN) {
    var g = $('qGrid'); g.innerHTML = ''; var sc = el('div', 'scroller'); g.appendChild(sc); qNodes = [];
    qItems = listOrder(qList);
    qItems.forEach(function (n, i) {
      var q = surah(n);
      var d = el('div', 'qtile', '<span class="qn">' + (S.lang === 'ar' ? arDigits(n) : n) + '</span><span class="qt"><b class="ar">' + esc(q[1]) + '</b><small>' + esc(q[2]) + ' · ' +
        T(arDigits(q[3]) + ' آية', q[3] + ' ayahs') + '</small></span><span class="qf">★</span><span class="qp"></span>');
      d.onclick = function () { qIdx = i; quranOk(); };
      sc.appendChild(d); qNodes.push(d);
    });
    qIdx = Math.max(0, qItems.indexOf(focusN));
  }
  function paintQuran() {
    qNodes.forEach(function (nd, i) {
      var n = qItems[i];
      setCls(nd, 'qtile' + (i === qIdx ? ' focus' : '') + (track && track.n === n ? (isPlaying() ? ' playing' : ' paused') : '') + (S.qFav.indexOf(n) !== -1 ? ' fav' : ''));
    });
    var row = Math.floor(qIdx / QCOLS), sc = $('qGrid').firstChild;
    var y = Math.max(0, row - 2) * 124;
    if (sc) sc.style.transform = sc.style.webkitTransform = 'translateY(' + (-y) + 'px)';
    $('qCount').innerHTML = qList === 'fav' ? T('المفضلة · ' + arDigits(qItems.length), 'Favourites · ' + qItems.length) : T('كل السور · ' + arDigits(S.qFav.length) + ' مفضلة', 'All surahs · ' + S.qFav.length + ' favourites');
    paintQBar();
  }
  function paintQBar() {
    if (mode !== 'quran') return;
    var R = reciter(), after = optText(AFTER, S.afterSurah), html;
    if (track) {
      var tt = trackTitle(track), dur = player.duration || 0, pct = dur ? (100 * player.currentTime / dur).toFixed(2) : 0;
      html = '<span class="qb-ic">' + (isPlaying() ? PLAY_IC : PAUSE_IC).replace('#10221f', 'currentColor') + '</span><span class="qb-text"><b>' + T(esc(tt[0]), esc(tt[1])) + '</b><small>' +
        (track.n ? T(esc(R.ar), esc(R.en)) + ' · ' : '') + T('بعدها: ' + after[0], 'Then: ' + after[1]) + '</small></span><span class="qb-time">' + fmtDur(player.currentTime) + (dur ? ' / ' + fmtDur(dur) : '') +
        '</span><span class="qb-line"><i style="width:' + pct + '%"></i></span>';
    } else {
      var q = S.q && surah(S.q.n);
      html = '<span class="qb-text"><b>' + (q ? T('توقفت عند سورة ' + esc(q[1]) + (S.q.t > 5 ? ' · ' + fmtDur(S.q.t) : ''), 'You stopped at ' + esc(q[2]) + (S.q.t > 5 ? ' · ' + fmtDur(S.q.t) : '')) : T('اختر سورة واضغط OK', 'Pick a surah and press OK')) +
        '</b><small>' + T(esc(R.ar), esc(R.en)) + ' · ' + T('بعدها: ' + after[0], 'Then: ' + after[1]) + '</small></span>';
    }
    $('qBar').innerHTML = html;
  }
  // OK on a surah: the one playing pauses and carries on; the one you stopped at resumes; any other starts
  function quranOk() {
    var n = qItems[qIdx];
    if (!n) return;
    if (track && track.n === n) togglePlay();
    else playSurah(n, S.q && S.q.n === n ? S.q.t : 0, qList);
    paintQuran();
  }
  function quranKey(k) {
    var n = qItems.length, fwd = S.lang === 'ar' ? K.LEFT : K.RIGHT;   // in Arabic the grid runs right to left
    if (k === K.LEFT || k === K.RIGHT) qIdx = Math.max(0, Math.min(n - 1, qIdx + (k === fwd ? 1 : -1)));
    else if (k === K.UP) qIdx = Math.max(0, qIdx - QCOLS);
    else if (k === K.DOWN) qIdx = Math.min(n - 1, qIdx + QCOLS);
    else if (k === K.ENTER) return quranOk();
    else if (k === K.YELLOW || k === K.Y) {
      toggleFav(qItems[qIdx]);
      if (qList === 'fav') { var keep = qItems[Math.min(qIdx + 1, n - 1)]; if (!S.qFav.length) qList = 'all'; buildQuran(keep); }
    }
    else if (k === K.GREEN || k === K.G) {
      if (qList === 'all' && !S.qFav.length) { toast(T('لا مفضلة بعد. الزر الأصفر يضيف سورة', 'No favourites yet. The yellow button adds a surah')); return; }
      var cur = qItems[qIdx]; qList = qList === 'all' ? 'fav' : 'all'; buildQuran(cur);
    }
    else if (k === K.RED || k === K.R) {
      var i = 0; C.reciters.forEach(function (r, x) { if (r.id === S.reciter) i = x; });
      S.reciter = C.reciters[(i + 1) % C.reciters.length].id; saveSettings();
      toast(T('القارئ: ' + reciter().ar, 'Reciter: ' + reciter().en));
      if (track && track.n) playTrack({ n: track.n, list: track.list, auto: true }, 0);
    }
    else if (k === K.BLUE || k === K.B) { S.afterSurah = cyc(AFTER.map(function (a) { return a[0]; }), S.afterSurah, 1); saveSettings(); }
    else return;
    paintQuran();
  }

  /* ---------------- occasions ---------------- */
  var occ = null, occKey = '', aFocus = 0;
  var PLAY_IC = '<svg class="ic" viewBox="0 0 30 30"><path d="M9 6l16 9-16 9z" fill="#10221f"/></svg>';
  var PAUSE_IC = '<svg class="ic" viewBox="0 0 30 30"><rect x="8" y="6" width="5" height="18" fill="#10221f"/><rect x="17" y="6" width="5" height="18" fill="#10221f"/></svg>';
  function islamicContext(now) {
    var after = !!(times && now >= times.maghrib);
    var base = after ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now;
    return { now: now, times: times, tomorrowFajr: tomorrowFajr, h: hijri(base), dow: base.getDay(), afterMaghrib: after };
  }
  function renderOccasions(now) {
    var r = NoorOccasions.get(islamicContext(now));
    // pills
    var ph = '';
    r.pills.forEach(function (p) { ph += '<span class="pill ar">' + esc(p) + '</span>'; });
    setText('pills', ph);
    // card
    var c = r.card, key = c ? c.id + '|' + c.title + '|' + c.body + '|' + (c.badge || '') + '|' + (c.countLabel || '') : '';
    occ = c;
    if (key === occKey) return;
    occKey = key;
    var card = $('occCard');
    if (!c) { card.className = 'occ-card'; $('ayahCard').className = 'ayah-card'; aFocus = 0; renderActions(); return; }
    $('ayahCard').className = 'ayah-card hide';
    card.className = 'occ-card show tone-' + c.tone;
    $('occTitle').innerHTML = esc(c.title);
    $('occBadge').innerHTML = esc(c.badge || '');
    $('occSub').innerHTML = esc(c.sub || '');
    $('occBody').innerHTML = esc(c.body);
    $('occNote').innerHTML = esc(c.note || '');
    $('occCountWrap').className = 'occ-count' + (c.countTo ? '' : ' hide');
    $('occCountLabel').innerHTML = esc(c.countLabel || '');
    aFocus = 0;
    renderActions();
  }
  // The card's buttons. An occasion keeps its own suggestion (Al-Kahf on Friday, Al-Mulk at night,
  // the takbeer on Eid); otherwise the verse card offers to carry on where you stopped. Every card
  // ends with the button that opens the whole list.
  var LIST_IC = '<svg class="ic" viewBox="0 0 30 30"><path d="M7 9h16M7 15h16M7 21h10" fill="none" stroke="#10221f" stroke-width="2.6" stroke-linecap="round"/></svg>';
  function cardActions() {
    var list = [];
    if (occ && occ.actions) occ.actions.forEach(function (a) { var A = C.audio[a.audio]; list.push({ label: a.label, n: A.surah || 0, clip: A.surah ? '' : a.audio }); });
    else list.push({ resume: true });
    list.push({ open: true });
    return list;
  }
  function actionOn(a) { return isPlaying() && (a.resume ? !!track.n : a.n ? track.n === a.n : track.clip === a.clip); }
  function actionGo(a) {
    if (a.open) return openQuran();
    if (a.resume) return track && track.n ? togglePlay() : resumeLast();
    if (track && (a.n ? track.n === a.n : track.clip === a.clip)) return togglePlay();
    if (a.n) playSurah(a.n, S.q && S.q.n === a.n ? S.q.t : 0); else playTrack({ clip: a.clip });
  }
  function renderActions() {
    var acts = cardActions(), box = $(occ ? 'occActions' : 'ayahActions');
    $(occ ? 'ayahActions' : 'occActions').innerHTML = ''; box.innerHTML = '';
    aFocus = Math.min(aFocus, acts.length - 1);
    acts.forEach(function (a, i) {
      var on = actionOn(a), html;
      if (a.open) html = LIST_IC + T('كل السور', 'All surahs');
      else if (on) html = PAUSE_IC + T('إيقاف مؤقت', 'Pause');
      else if (a.resume) {
        var cur = track && track.n ? track.n : (S.q && surah(S.q.n) ? S.q.n : 0), q = surah(cur || 1);
        html = PLAY_IC + (cur ? T('متابعة: سورة ' + esc(q[1]), 'Continue: ' + esc(q[2])) : T('ابدأ: سورة الفاتحة', 'Start: Al-Fatihah'));
      }
      else html = PLAY_IC + '<span class="ar">' + esc(a.label + (a.n ? ' · ' + reciter().ar : '')) + '</span>';
      var b = el('div', 'occ-btn' + (a.open ? ' ghost' : '') + (on ? ' playing' : '') + (zone === 'card' && i === aFocus ? ' focus' : ''), html);
      b.onclick = function () { actionGo(a); };
      box.appendChild(b);
    });
    $('occCard').querySelector('.occ-progress').className = 'occ-progress' + (track ? ' on' : '');
  }
  function tickOccasionCount(now) {
    if (!occ || !occ.countTo) return;
    var left = Math.max(0, Math.floor((occ.countTo - now) / 1000));
    setText('occCount', pad(Math.floor(left / 3600)) + ':' + pad(Math.floor(left / 60) % 60) + ':' + pad(left % 60));
  }

  /* ---------------- body state: language, layout, awake, night, idle ---------------- */
  var awake = false, awakeTimer = null, isNight = false, idle = false, idleTimer = null;
  function applyBody() {
    var w = S.w, scene = sceneOn(), c = ['lang-' + S.lang, 'clock-' + (w.clockStyle === 'scene' && !scene ? 'large' : w.clockStyle), 'pr-' + prStyle(), 'card-' + w.cardStyle,
      'vis-clock-' + w.clockVis, 'vis-prayers-' + w.prVis, 'vis-card-' + w.cardVis, 'vis-weather-' + w.weatherVis, 'vis-dhikr-' + w.dhikrVis];
    if (!S.greet) c.push('no-greet');
    if (awake) c.push('awake');
    if (awake) c.push('tiles-shown');
    if (track) c.push('has-audio');
    // quiet: after Isha (night mode) or after a while with no button pressed (idle)
    var dim = (isNight && (S.night === 'dim' || S.night === 'both')) || (idle && (S.idleAct === 'dim' || S.idleAct === 'both'));
    var amb = (isNight && (S.night === 'ambient' || S.night === 'both')) || (idle && (S.idleAct === 'clock' || S.idleAct === 'both'));
    if (dim) c.push('q-dim');
    if (amb) c.push('q-ambient');
    if (scene) {
      var k = clockOf(bgCur);
      if (k.left) c.push('sc-left');
      if (k.dark) c.push('sc-dark');
      c.push(S.glass === 'liquid' ? 'clock-liquid' : 'clock-frosted', 'ga-' + S.glassAmt);
      $('wClock').style.top = Math.max(40, k.top - 54) + 'px';
    } else $('wClock').style.top = '';
    document.body.className = c.join(' ');
  }
  function wake() {
    awake = true; applyBody();
    clearTimeout(awakeTimer);
    awakeTimer = setTimeout(function () {
      if (mode !== 'home') return;
      awake = false;
      if (zone === 'card') { zone = 'gear'; renderActions(); }
      applyBody(); paintFocus();
    }, 10000);
  }
  function checkNight(force) {
    var now = NOW(), n = false;
    if (times) n = now >= new Date(+times.isha + 30 * 60000) || now < new Date(times.fajr - 15 * 60000);
    if (n !== isNight || force) { isNight = n; applyBody(); }
  }
  // Idle: counted from the last button press, and only while the home is showing.
  function armIdle() {
    clearTimeout(idleTimer);
    if (idle) { idle = false; applyBody(); }
    if (S.idleMin > 0) idleTimer = setTimeout(function () {
      if (mode !== 'home') { armIdle(); return; }
      idle = true; applyBody();
    }, S.idleMin * 60000);
  }
  function shiftUi() {
    var u = $('ui').style, t = 'none';
    if (S.shift) t = 'translate(' + Math.round(Math.random() * 16 - 8) + 'px,' + Math.round(Math.random() * 12 - 6) + 'px)';
    u.transform = u.webkitTransform = t;
  }

  /* ---------------- remote keys ---------------- */
  var K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BKSP: 8, YELLOW: 405, Y: 89, GREEN: 404, G: 71, PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413,
    PGUP: 33, PGDN: 34, CHUP: 427, CHDN: 428,
    RED: 403, R: 82, BLUE: 406, B: 66, NEXT: 10233, PREV: 10232, FF: 417, RW: 412, N: 78, P: 80, DOT: 190, COMMA: 188 };
  if (IS_TIZEN && tizen.tvinputdevice) {
    ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
      'MediaTrackNext', 'MediaTrackPrevious', 'MediaFastForward', 'MediaRewind'].forEach(function (k) { safe(function () { tizen.tvinputdevice.registerKey(k); }); });
  }
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    armIdle();
    if (mode === 'settings' && typingKey(e)) return;
    if (k === K.BACK || k === K.ESC || k === K.BKSP) {
      e.preventDefault();
      if (mode !== 'home') closeOverlays();
      else if (zone === 'card') { zone = 'gear'; paintFocus(); renderActions(); }
      else if (IS_TIZEN) safe(function () { tizen.application.getCurrentApplication().hide(); });
      return;
    }
    // the remote's media keys work everywhere: on the home, in the player, in Settings
    if (k === K.STOP) return stopAudio();
    if (k === K.PLAYPAUSE || k === K.PLAY || k === K.PAUSE) {
      if (!track && occ && occ.actions && occ.actions[0]) return actionGo(cardActions()[0]);   // the occasion's own suggestion
      return togglePlay();
    }
    if (k === K.NEXT || k === K.PREV) return stepSurah(k === K.NEXT ? 1 : -1);
    if (k === K.FF || k === K.RW) return seekAudio(k === K.FF ? 30 : -30);
    if (mode !== 'settings' && (k === K.N || k === K.P)) return stepSurah(k === K.N ? 1 : -1);          // keyboard stand-ins, for a browser
    if (mode !== 'settings' && (k === K.DOT || k === K.COMMA)) return seekAudio(k === K.DOT ? 30 : -30);
    if (mode === 'home') {
      var wasAwake = awake;
      wake();
      if (!wasAwake && zone === 'gear' && k !== K.UP && k !== K.ENTER) { paintFocus(); return; }
      var acts = cardActions(), hasCard = S.w.cardVis !== 'off';
      if (zone === 'card') {
        // card buttons are laid out right-to-left
        if (k === K.LEFT) aFocus = Math.min(acts.length - 1, aFocus + 1);
        else if (k === K.RIGHT) aFocus = Math.max(0, aFocus - 1);
        else if (k === K.DOWN) zone = 'gear';
        else if (k === K.ENTER) return actionGo(acts[aFocus]);
      } else {
        if (k === K.UP && hasCard) zone = 'card';
        else if (k === K.LEFT) hIdx = 0;
        else if (k === K.RIGHT) hIdx = 1;
        else if (k === K.ENTER) return activate();
      }
      paintFocus(); renderActions();
    } else if (mode === 'apps') {
      var n = APPS.length;
      if (k === K.LEFT) aIdx = Math.max(0, aIdx - 1);
      else if (k === K.RIGHT) aIdx = Math.min(n - 1, aIdx + 1);
      else if (k === K.UP) aIdx = Math.max(0, aIdx - COLS);
      else if (k === K.DOWN) aIdx = Math.min(n - 1, aIdx + COLS);
      else if (k === K.ENTER && APPS[aIdx]) return launch([APPS[aIdx].id], APPS[aIdx].name);
      else if (k === K.YELLOW || k === K.Y) return togglePin();
      paintApps();
    } else if (mode === 'settings') {
      if ([K.LEFT, K.RIGHT, K.UP, K.DOWN, K.PGUP, K.PGDN].indexOf(k) >= 0) e.preventDefault();
      setKey(k);
    } else if (mode === 'quran') {
      if ([K.LEFT, K.RIGHT, K.UP, K.DOWN].indexOf(k) >= 0) e.preventDefault();
      quranKey(k);
    } else if (mode === 'gallery') {
      var gn = BGS.length;
      if (k === K.LEFT) gIdx = Math.max(0, gIdx - 1);
      else if (k === K.RIGHT) gIdx = Math.min(gn - 1, gIdx + 1);
      else if (k === K.UP) gIdx = Math.max(0, gIdx - GCOLS);
      else if (k === K.DOWN) gIdx = Math.min(gn - 1, gIdx + GCOLS);
      else if (k === K.ENTER) return toggleBg();
      else if (k === K.YELLOW || k === K.Y) return onlyThisBg();
      else if (k === K.GREEN || k === K.G) return allBgs();
      paintGallery();
    }
  });

  // Back from another app, or the TV woke with Noor still open: the day, the times and the
  // countdown are worked out again straight away.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { remember(); return; }
    today = null; nx = null; tick(); checkNight(true); armIdle();
  });

  /* ---------------- boot ---------------- */
  S.bgSel = S.bgSel.filter(function (id) { return !!bgById(id); });   // photos that are no longer on this TV
  applyBody();
  fit();
  tick();
  checkNight(true);
  setInterval(checkNight, 60000);
  setInterval(shiftUi, 180000);
  nextBackground();
  setInterval(tick, 1000);
  rotateDhikr();
  setInterval(rotateDhikr, 15000);
  buildTiles();
  renderActions();
  $('quranBtn').onclick = function () { hIdx = 0; openQuran(); };
  $('gear').onclick = function () { hIdx = 1; openSettings(); };
  wireSettingsPointer();
  armIdle();
  setTimeout(loadWeather, 1500);
  setInterval(loadWeather, 30 * 60000);
  if (!S.setup) startWizard();
  else if (PREVIEW.open === 'quran') openQuran();
  else if (PREVIEW.open) { openSettings(); SECS.forEach(function (sc, i) { if (sc[0] === PREVIEW.open) SET.sec = i; }); paintSettings(true); }
})();
