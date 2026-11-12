/* Noor — content: ayat, adhkar, prayer names, reciters. Edit freely.
   Cities are in cities.js, the background photos in backgrounds.js. */
window.NOOR_CONTENT = {
  prayers: [
    { key: 'fajr',    ar: 'الفجر',  en: 'Fajr' },
    { key: 'sunrise', ar: 'الشروق', en: 'Sunrise', notPrayer: true },
    { key: 'dhuhr',   ar: 'الظهر',  en: 'Dhuhr' },
    { key: 'asr',     ar: 'العصر',  en: 'Asr' },
    { key: 'maghrib', ar: 'المغرب', en: 'Maghrib' },
    { key: 'isha',    ar: 'العشاء', en: 'Isha' }
  ],

  // Short verses. English lines are brief meanings, not a formal translation.
  ayat: [
    { ar: 'الذين آمنوا وتطمئن قلوبهم بذكر الله ألا بذكر الله تطمئن القلوب', ref: 'الرعد ٢٨', en: 'Truly, in the remembrance of Allah do hearts find rest.' },
    { ar: 'فإن مع العسر يسرا ۝ إن مع العسر يسرا', ref: 'الشرح ٥–٦', en: 'With hardship comes ease — indeed, with hardship comes ease.' },
    { ar: 'وقال ربكم ادعوني أستجب لكم', ref: 'غافر ٦٠', en: 'Your Lord said: call upon Me, and I will answer you.' },
    { ar: 'فاذكروني أذكركم واشكروا لي ولا تكفرون', ref: 'البقرة ١٥٢', en: 'Remember Me and I will remember you; be grateful to Me.' },
    { ar: 'ومن يتق الله يجعل له مخرجا ۝ ويرزقه من حيث لا يحتسب', ref: 'الطلاق ٢–٣', en: 'Whoever is mindful of Allah, He makes a way out for him and provides from where he never expected.' },
    { ar: 'لا يكلف الله نفسا إلا وسعها', ref: 'البقرة ٢٨٦', en: 'Allah does not burden a soul beyond what it can bear.' },
    { ar: 'وإذا سألك عبادي عني فإني قريب أجيب دعوة الداع إذا دعان', ref: 'البقرة ١٨٦', en: 'When My servants ask about Me — I am near; I answer the one who calls.' },
    { ar: 'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار', ref: 'البقرة ٢٠١', en: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the Fire.' },
    { ar: 'رب اشرح لي صدري ۝ ويسر لي أمري', ref: 'طه ٢٥–٢٦', en: 'My Lord, open my heart and make my task easy for me.' },
    { ar: 'وقل رب زدني علما', ref: 'طه ١١٤', en: 'And say: my Lord, increase me in knowledge.' },
    { ar: 'إن الله مع الصابرين', ref: 'البقرة ١٥٣', en: 'Indeed, Allah is with the patient.' },
    { ar: 'ولسوف يعطيك ربك فترضى', ref: 'الضحى ٥', en: 'And your Lord will give you, and you will be content.' },
    { ar: 'وما توفيقي إلا بالله عليه توكلت وإليه أنيب', ref: 'هود ٨٨', en: 'My success is only through Allah; in Him I trust and to Him I turn.' },
    { ar: 'حسبنا الله ونعم الوكيل', ref: 'آل عمران ١٧٣', en: 'Allah is sufficient for us, and He is the best Disposer of affairs.' },
    { ar: 'ربنا هب لنا من أزواجنا وذرياتنا قرة أعين واجعلنا للمتقين إماما', ref: 'الفرقان ٧٤', en: 'Our Lord, grant us comfort in our spouses and children, and make us an example for the righteous.' },
    { ar: 'ومن يتوكل على الله فهو حسبه', ref: 'الطلاق ٣', en: 'Whoever relies on Allah — He is sufficient for him.' },
    { ar: 'لئن شكرتم لأزيدنكم', ref: 'إبراهيم ٧', en: 'If you are grateful, I will surely give you more.' },
    { ar: 'رب اجعلني مقيم الصلاة ومن ذريتي ربنا وتقبل دعاء', ref: 'إبراهيم ٤٠', en: 'My Lord, make me steadfast in prayer, and my offspring too. Our Lord, accept my prayer.' },
    { ar: 'إن الصلاة كانت على المؤمنين كتابا موقوتا', ref: 'النساء ١٠٣', en: 'Prayer is prescribed for the believers at fixed times.' },
    { ar: 'وهو معكم أين ما كنتم', ref: 'الحديد ٤', en: 'And He is with you wherever you are.' },
    { ar: 'ادعوا ربكم تضرعا وخفية', ref: 'الأعراف ٥٥', en: 'Call upon your Lord humbly and in private.' },
    { ar: 'ورحمتي وسعت كل شيء', ref: 'الأعراف ١٥٦', en: 'And My mercy encompasses all things.' }
  ],

  adhkar: {
    morning: [
      'أصبحنا وأصبح الملك لله، والحمد لله',
      'اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور',
      'رضيت بالله ربا، وبالإسلام دينا، وبمحمد ﷺ نبيا',
      'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم'
    ],
    evening: [
      'أمسينا وأمسى الملك لله، والحمد لله',
      'اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير',
      'أعوذ بكلمات الله التامات من شر ما خلق',
      'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم'
    ],
    always: [
      'سبحان الله وبحمده، سبحان الله العظيم',
      'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',
      'لا حول ولا قوة إلا بالله',
      'اللهم صل وسلم على نبينا محمد',
      'أستغفر الله وأتوب إليه',
      'سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر',
      'يا حي يا قيوم برحمتك أستغيث'
    ]
  },

  hijriMonths: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
                'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
  hijriMonthsEn: ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula', 'Jumada al-Akhirah',
                  'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah'],
  weekdaysAr: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],

  // Reciters (surah files: <mp3><SSS>.mp3 on mp3quran.net, with Al Quran Cloud CDN as a backup where it exists)
  reciters: [
    { id: 'alafasy',   ar: 'مشاري العفاسي',            en: 'Mishary Alafasy',            mp3: 'https://server8.mp3quran.net/afs/', cdn: 'ar.alafasy' },
    { id: 'husary',    ar: 'محمود خليل الحصري',        en: 'Mahmoud Al-Husary',          mp3: 'https://server13.mp3quran.net/husr/', cdn: 'ar.husary' },
    { id: 'husary_m',  ar: 'الحصري · مجوّد',            en: 'Al-Husary · Mujawwad',       mp3: 'https://server13.mp3quran.net/husr/Almusshaf-Al-Mojawwad/', cdn: 'ar.husarymujawwad' },
    { id: 'minshawi',  ar: 'محمد صديق المنشاوي',       en: 'Muhammad Al-Minshawi',       mp3: 'https://server10.mp3quran.net/minsh/', cdn: 'ar.minshawi' },
    { id: 'minshawi_m',ar: 'المنشاوي · مجوّد',          en: 'Al-Minshawi · Mujawwad',     mp3: 'https://server10.mp3quran.net/minsh/Almusshaf-Al-Mojawwad/', cdn: 'ar.minshawimujawwad' },
    { id: 'basit',     ar: 'عبد الباسط عبد الصمد',      en: 'Abdul Basit Abdul Samad',    mp3: 'https://server7.mp3quran.net/basit/', cdn: 'ar.abdulbasitmurattal' },
    { id: 'basit_m',   ar: 'عبد الباسط · مجوّد',        en: 'Abdul Basit · Mujawwad',     mp3: 'https://server7.mp3quran.net/basit/Almusshaf-Al-Mojawwad/' },
    { id: 'tablawi',   ar: 'محمد محمود الطبلاوي',       en: 'Muhammad Al-Tablawi',        mp3: 'https://server12.mp3quran.net/tblawi/' },
    { id: 'mustafa',   ar: 'مصطفى إسماعيل',             en: 'Mustafa Ismail',             mp3: 'https://server8.mp3quran.net/mustafa/' },
    { id: 'sudais',    ar: 'عبد الرحمن السديس',         en: 'Abdurrahman As-Sudais',      mp3: 'https://server11.mp3quran.net/sds/', cdn: 'ar.abdurrahmaansudais' },
    { id: 'shuraim',   ar: 'سعود الشريم',               en: 'Saud Ash-Shuraim',           mp3: 'https://server7.mp3quran.net/shur/', cdn: 'ar.saoodshuraym' },
    { id: 'maher',     ar: 'ماهر المعيقلي',             en: 'Maher Al-Muaiqly',           mp3: 'https://server12.mp3quran.net/maher/', cdn: 'ar.mahermuaiqly' },
    { id: 'ghamdi',    ar: 'سعد الغامدي',               en: 'Saad Al-Ghamdi',             mp3: 'https://server7.mp3quran.net/s_gmd/' },
    { id: 'dosari',    ar: 'ياسر الدوسري',              en: 'Yasser Al-Dosari',           mp3: 'https://server11.mp3quran.net/yasser/' }
  ],

  // What the play buttons play
  audio: {
    kahf:    { ar: 'سورة الكهف',  en: 'Surat Al-Kahf',  surah: 18 },
    mulk:    { ar: 'سورة الملك',  en: 'Surat Al-Mulk',  surah: 67 },
    baqarah: { ar: 'سورة البقرة', en: 'Surat Al-Baqarah', surah: 2 },
    takbeer: { ar: 'تكبيرات العيد', en: 'Eid takbeer', urls: [ 'https://makkahlive.net/audio/eid-takbeer.mp3' ] }
  },

  // Home-screen tiles. "match" finds the installed app by name; "ids" are fallbacks.
  defaultTiles: [
    { label: 'YouTube', ar: 'يوتيوب', match: ['youtube'], ids: ['9Ur5IzDKqV.TizenYouTube', '111299001912'], color: '#ff2a2a' },
    { label: 'Shahid', ar: 'شاهد', match: ['shahid', 'شاهد'], ids: [], color: '#19c37d' }
  ]
};
