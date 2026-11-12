/* Noor — prayer time calculation (offline, astronomical).
 * Based on the standard solar-position method used by most prayer apps.
 * Accuracy is typically within ±1–2 minutes of official timetables.
 */
(function (global) {
  var DEG = Math.PI / 180;
  function dsin(d) { return Math.sin(d * DEG); }
  function dcos(d) { return Math.cos(d * DEG); }
  function dtan(d) { return Math.tan(d * DEG); }
  function darcsin(x) { return Math.asin(x) / DEG; }
  function darccos(x) { return Math.acos(x) / DEG; }
  function darctan2(y, x) { return Math.atan2(y, x) / DEG; }
  function darccot(x) { return Math.atan(1 / x) / DEG; }
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }

  // Calculation methods. fajr: degrees below the horizon. isha: degrees, or {minutes: n} after
  // maghrib. maghrib (optional): degrees below the horizon instead of sunset.
  var METHODS = {
    mwl:       { name: 'Muslim World League',           ar: 'رابطة العالم الإسلامي',        fajr: 18,   isha: 17 },
    makkah:    { name: 'Umm al-Qura (Makkah)',          ar: 'أم القرى',                      fajr: 18.5, isha: { minutes: 90 } },
    egypt:     { name: 'Egyptian General Authority',    ar: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
    karachi:   { name: 'Karachi (Univ. of Islamic Sciences)', ar: 'جامعة العلوم الإسلامية بكراتشي', fajr: 18, isha: 18 },
    isna:      { name: 'North America (ISNA)',          ar: 'أمريكا الشمالية (إسنا)',        fajr: 15,   isha: 15 },
    kuwait:    { name: 'Kuwait',                        ar: 'الكويت',                        fajr: 18,   isha: 17.5 },
    jordan:    { name: 'Jordan (Awqaf)',                ar: 'الأردن (الأوقاف)',              fajr: 18,   isha: 18 },
    qatar:     { name: 'Qatar',                         ar: 'قطر',                           fajr: 18,   isha: { minutes: 90 } },
    dubai:     { name: 'UAE (Dubai)',                   ar: 'الإمارات (دبي)',                fajr: 18.2, isha: 18.2 },
    turkey:    { name: 'Turkey (Diyanet)',              ar: 'تركيا (ديانت)',                 fajr: 18,   isha: 17 },
    singapore: { name: 'Singapore, Malaysia, Indonesia', ar: 'سنغافورة وماليزيا وإندونيسيا', fajr: 20,   isha: 18 },
    morocco:   { name: 'Morocco',                       ar: 'المغرب',                        fajr: 19,   isha: 17 },
    algeria:   { name: 'Algeria',                       ar: 'الجزائر',                       fajr: 18,   isha: 17 },
    tunisia:   { name: 'Tunisia',                       ar: 'تونس',                          fajr: 18,   isha: 18 },
    france:    { name: 'France (12°)',                  ar: 'فرنسا (١٢°)',                   fajr: 12,   isha: 12 },
    russia:    { name: 'Russia',                        ar: 'روسيا',                         fajr: 16,   isha: 15 },
    tehran:    { name: 'Tehran (Institute of Geophysics)', ar: 'طهران (معهد الجيوفيزياء)',   fajr: 17.7, isha: 14, maghrib: 4.5 }
  };
  // The usual method in each country; anywhere else: Muslim World League.
  var BY_COUNTRY = {
    SA: 'makkah', BH: 'makkah', OM: 'makkah', YE: 'makkah', KW: 'kuwait', JO: 'jordan', QA: 'qatar', AE: 'dubai',
    EG: 'egypt', SD: 'egypt', LY: 'egypt', SY: 'egypt', LB: 'egypt', IQ: 'egypt', PS: 'egypt', IL: 'egypt',
    PK: 'karachi', IN: 'karachi', BD: 'karachi', AF: 'karachi', TR: 'turkey', IR: 'tehran', US: 'isna', CA: 'isna',
    SG: 'singapore', MY: 'singapore', ID: 'singapore', BN: 'singapore', MA: 'morocco', DZ: 'algeria', TN: 'tunisia',
    FR: 'france', RU: 'russia'
  };
  function methodFor(cc) { return BY_COUNTRY[cc] || 'mwl'; }

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fix(357.529 + 0.98560028 * D, 360);
    var q = fix(280.459 + 0.98564736 * D, 360);
    var L = fix(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = fix(darctan2(dcos(e) * dsin(L), dcos(L)) / 15, 24);
    return { decl: darcsin(dsin(e) * dsin(L)), eqt: q / 15 - RA };
  }

  /**
   * @param {Date} date      local date
   * @param {number} lat
   * @param {number} lng
   * @param {number} tz      hours from UTC (e.g. 3)
   * @param {string} method  key of METHODS
   * @param {number} asrFactor 1 = Shafi'i/Maliki/Hanbali (standard), 2 = Hanafi
   * @returns {{fajr:Date,sunrise:Date,dhuhr:Date,asr:Date,maghrib:Date,isha:Date}}
   */
  function compute(date, lat, lng, tz, method, asrFactor) {
    var p = METHODS[method] || METHODS.mwl;
    asrFactor = asrFactor || 1;
    var jDate = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

    function midDay(t) { var eqt = sunPosition(jDate + t).eqt; return fix(12 - eqt, 24); }
    function sunAngleTime(angle, t, ccw) {
      var decl = sunPosition(jDate + t).decl;
      var noon = midDay(t);
      var T = darccos((-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15;
      return noon + (ccw ? -T : T);
    }
    function asrTime(factor, t) {
      var decl = sunPosition(jDate + t).decl;
      var angle = -darccot(factor + dtan(Math.abs(lat - decl)));
      return sunAngleTime(angle, t);
    }

    // initial guesses (hours / 24), single refinement pass
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
    var r;
    for (var pass = 0; pass < 2; pass++) {
      r = {
        fajr: sunAngleTime(p.fajr, t.fajr / 24, true),
        sunrise: sunAngleTime(0.833, t.sunrise / 24, true),
        dhuhr: midDay(t.dhuhr / 24),
        asr: asrTime(asrFactor, t.asr / 24),
        sunset: sunAngleTime(0.833, t.sunset / 24),
        maghrib: p.maghrib ? sunAngleTime(p.maghrib, t.maghrib / 24) : 18,
        isha: typeof p.isha === 'number' ? sunAngleTime(p.isha, t.isha / 24) : 18
      };
      t = r;
    }
    // Far north or south the sun never gets that far below the horizon in summer (the angle has no
    // time). Then the night is shared out by the angle (the "angle based" rule): fajr is
    // angle/60 of the night before sunrise, isha angle/60 of it after sunset.
    if (isNaN(r.sunrise) || isNaN(r.sunset)) { r.sunrise = 6; r.sunset = 18; }   // no sunrise at all: a plain day
    var night = 24 - (r.sunset - r.sunrise);
    var fPart = p.fajr / 60 * night;
    if (isNaN(r.fajr) || r.sunrise - r.fajr > fPart) r.fajr = r.sunrise - fPart;
    if (typeof p.isha === 'number') {
      var iPart = p.isha / 60 * night;
      if (isNaN(r.isha) || r.isha - r.sunset > iPart) r.isha = r.sunset + iPart;
    }
    if (p.maghrib && (isNaN(r.maghrib) || r.maghrib - r.sunset > p.maghrib / 60 * night)) r.maghrib = r.sunset + p.maghrib / 60 * night;
    if (isNaN(r.asr)) r.asr = (r.dhuhr + r.sunset) / 2;
    var shift = tz - lng / 15;
    var out = {};
    var keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'sunset', 'maghrib', 'isha'];
    for (var i = 0; i < keys.length; i++) out[keys[i]] = r[keys[i]] + shift;
    if (!p.maghrib) out.maghrib = out.sunset;
    if (typeof p.isha !== 'number') out.isha = out.maghrib + p.isha.minutes / 60;
    // Small safety offset most ministries apply to dhuhr
    out.dhuhr += 1 / 60;

    // Convert hours to Date objects in the device's local clock, adjusted for city tz
    var deviceTz = -date.getTimezoneOffset() / 60;
    var base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
    function toDate(h) {
      // round to nearest minute, convert from city time to device time
      var mins = Math.round((h - tz + deviceTz) * 60);
      return new Date(base + mins * 60000);
    }
    return {
      fajr: toDate(out.fajr), sunrise: toDate(out.sunrise), dhuhr: toDate(out.dhuhr),
      asr: toDate(out.asr), maghrib: toDate(out.maghrib), isha: toDate(out.isha)
    };
  }

  global.PrayTimes = { compute: compute, METHODS: METHODS, methodFor: methodFor };
})(window);
