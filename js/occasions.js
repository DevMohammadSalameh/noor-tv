/* Noor — Islamic calendar awareness.
 * Works out what is special about "now" (Friday, Ramadan, Eid, Arafah, white days…)
 * The Islamic day starts at Maghrib, so after sunset we look at the next Hijri day.
 *
 * get(ctx) -> { card: {...} | null, pills: [ 'text', ... ] }
 *   ctx = { now, times:{fajr,sunrise,dhuhr,asr,maghrib,isha}, tomorrowFajr,
 *           h: {y,m,d} hijri date of the Islamic day, dow: 0-6 weekday of the Islamic day,
 *           afterMaghrib: bool }
 */
(function (global) {
  var MIN = 60000, HOUR = 3600000;
  var TAKBEER = 'اللهُ أكبرُ اللهُ أكبرُ، لا إلهَ إلا الله، واللهُ أكبرُ اللهُ أكبرُ ولله الحمد';

  function ar(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); }); }

  function get(c) {
    var now = c.now, t = c.times, h = c.h, dow = c.dow;
    var pills = [];
    var card = null;
    var beforeMaghrib = !c.afterMaghrib;
    var night = c.afterMaghrib || now < t.fajr;   // Islamic night (before dawn)

    /* ---------- Eid al-Fitr: 1–3 Shawwal (incl. the night before) ---------- */
    if (h.m === 10 && h.d <= 3) {
      card = { id: 'fitr', tone: 'eid', title: 'عيد فطر مبارك', sub: 'EID AL-FITR MUBARAK',
        body: TAKBEER, note: 'تقبّل الله منا ومنكم صالح الأعمال',
        actions: [{ id: 'takbeer', label: 'تكبيرات العيد', audio: 'takbeer' }] };
    }
    /* ---------- Eid al-Adha & Tashreeq: 10–13 Dhul-Hijjah ---------- */
    else if (h.m === 12 && h.d >= 10 && h.d <= 13) {
      card = { id: 'adha', tone: 'eid', title: h.d === 10 ? 'عيد أضحى مبارك' : 'أيام التشريق', sub: 'EID AL-ADHA MUBARAK',
        body: TAKBEER, note: h.d === 10 ? 'تقبّل الله منا ومنكم' : '«أيام التشريق أيام أكل وشرب وذكر لله» — رواه مسلم',
        actions: [{ id: 'takbeer', label: 'تكبيرات العيد', audio: 'takbeer' }] };
    }
    /* ---------- Day of Arafah ---------- */
    else if (h.m === 12 && h.d === 9) {
      card = { id: 'arafah', tone: 'hajj', title: 'يوم عرفة', sub: 'DAY OF ARAFAH',
        body: 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',
        note: '«خير الدعاء دعاء يوم عرفة» — رواه الترمذي · صيامه يكفّر سنتين',
        actions: [{ id: 'takbeer', label: 'التكبير', audio: 'takbeer' }] };
    }
    /* ---------- First days of Dhul-Hijjah ---------- */
    else if (h.m === 12 && h.d <= 8) {
      card = { id: 'dhulhijjah', tone: 'hajj', title: 'العشر من ذي الحجة', sub: 'THE BLESSED TEN DAYS',
        body: '«ما من أيامٍ العملُ الصالحُ فيهنّ أحبُّ إلى الله من هذه الأيام العشر»',
        note: 'رواه البخاري · أكثروا من التكبير والتهليل والتحميد',
        actions: [{ id: 'takbeer', label: 'التكبير', audio: 'takbeer' }] };
    }
    /* ---------- Ramadan ---------- */
    else if (h.m === 9) {
      var iftar = t.maghrib, imsak = new Date((now < t.fajr ? t.fajr : c.tomorrowFajr).getTime() - 10 * MIN);
      var fasting = now >= t.fajr && now < t.maghrib;
      var lastTen = h.d >= 21;
      card = { id: 'ramadan', tone: 'ramadan', title: 'رمضان كريم', sub: 'RAMADAN · DAY ' + h.d,
        badge: 'اليوم ' + ar(h.d) + ' من رمضان',
        countLabel: fasting ? 'الإفطار بعد' : 'الإمساك بعد',
        countTo: fasting ? iftar : imsak,
        body: fasting && (iftar - now) < 30 * MIN ? 'ذهب الظمأ، وابتلّت العروق، وثبت الأجر إن شاء الله'
          : (night && lastTen ? 'اللهم إنك عفوٌّ تحب العفو فاعفُ عني' : '«من صام رمضان إيمانًا واحتسابًا غُفر له ما تقدّم من ذنبه»'),
        note: night && lastTen ? 'العشر الأواخر · التمسوا ليلة القدر' : (fasting && (iftar - now) < 30 * MIN ? 'دعاء الإفطار — رواه أبو داود' : 'متفق عليه'),
        actions: [{ id: 'baqarah', label: 'سورة البقرة', audio: 'baqarah' }] };
    }
    /* ---------- Friday (Thursday Maghrib → Friday Maghrib) ---------- */
    else if (dow === 5) {
      var friAfterAsr = !c.afterMaghrib && now >= t.asr && now < t.maghrib && new Date(now).getDay() === 5;
      card = { id: 'friday', tone: 'friday', title: 'سورة الكهف', sub: 'FRIDAY · SURAT AL-KAHF',
        badge: c.afterMaghrib || new Date(now).getDay() === 4 ? 'ليلة الجمعة' : 'يوم الجمعة',
        body: '«من قرأ سورة الكهف يوم الجمعة أضاء له من النور ما بين الجمعتين»',
        note: friAfterAsr ? 'ساعة الاستجابة — أكثروا من الدعاء' : 'رواه الحاكم والبيهقي · أكثروا من الصلاة على النبي ﷺ',
        actions: [{ id: 'kahf', label: 'استماع', audio: 'kahf' }] };
    }

    /* ---------- small reminders ---------- */
    if (h.m === 1 && h.d === 1) pills.push('عام هجري مبارك ' + ar(h.y) + ' هـ');
    if (h.m === 1 && (h.d === 9 || h.d === 10)) pills.push('صيام عاشوراء يكفّر السنة الماضية');
    else if (h.m === 1) pills.push('شهر الله المحرّم');
    if (h.m === 10 && h.d > 3) pills.push('صيام ست من شوال');
    if (h.m !== 9 && h.m !== 12 && h.d >= 13 && h.d <= 15) pills.push('الأيام البيض · يُستحب صيامها');
    if (h.m !== 9 && (dow === 1 || dow === 4) && !(h.m === 12 && h.d >= 10 && h.d <= 13) && !(h.m === 10 && h.d <= 3))
      pills.push(dow === 1 ? 'صيام يوم الاثنين سنّة' : 'صيام يوم الخميس سنّة');
    if (h.m === 8 && h.d >= 15) pills.push('رمضان بعد ' + ar(30 - h.d) + ' أيام تقريبًا');

    // Ordinary nights after Isha: Surat al-Mulk before sleep
    if (!card && (now >= t.isha || now < t.fajr)) {
      card = { id: 'mulk', tone: 'night', title: 'سورة الملك', sub: 'BEFORE SLEEP · AL-MULK',
        body: '«سورةٌ من القرآن ثلاثون آية شفعت لرجلٍ حتى غُفر له، وهي: تبارك الذي بيده الملك»',
        note: 'رواه أبو داود والترمذي',
        actions: [{ id: 'mulk', label: 'استماع', audio: 'mulk' }] };
    }
    return { card: card, pills: pills };
  }

  global.NoorOccasions = { get: get };
})(window);
