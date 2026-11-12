#!/usr/bin/env python3
"""Build js/cities.js for Noor (bundled, offline city list).

Sources
  GeoNames cities15000.txt + countryInfo.txt (CC BY 4.0, geonames.org)
  Wikidata Arabic labels, looked up by GeoNames ID (P1566) and ISO code (P297) (CC0)

Run (from anywhere):
  python3 scripts/build-cities.py [output.js]

Expects cities15000.txt, countryInfo.txt and admin1CodesASCII.txt in build/cities/ at the top of
the repo (git ignores build/). Download them, and unzip cities15000.zip, from
https://download.geonames.org/export/dump/ . Wikidata answers are cached in
build/cities/wikidata/ ; delete that folder to ask Wikidata again.
"""
import collections
import json
import math
import os
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

# ----------------------------------------------------------------------------
# Thresholds (the knobs)
# ----------------------------------------------------------------------------
MILLION = 1000000          # rule 2: every city this big, anywhere
OIC_MIN_POP = 100000       # rule 3: OIC members (+ a few Muslim-majority extras)
OIC_CAP = 25               #         at most this many per country
COMMUNITY_MIN_POP = 300000  # rule 4: countries with large Muslim communities
COMMUNITY_CAP = 25         #         at most this many per country
FALLBACK_KM = 30           # a Wikidata item found by name must be this close to the GeoNames row
SAME_TOWN_KM = 40          # two rows with one name this close together are one town

# The 57 OIC member states (the State of Palestine is one of them).
OIC = set(
    'AF AL DZ AZ BH BD BJ BN BF CM TD KM CI DJ EG GA GM GN GW GY ID IR IQ JO KZ '
    'KW KG LB LY MY MV ML MR MA MZ NE NG OM PK PS QA SA SN SL SO SD SR SY TJ TG '
    'TN TR TM UG AE UZ YE'.split())
assert len(OIC) == 57
# Treated like OIC members: Bosnia and Herzegovina (OIC observer), Kosovo and
# Western Sahara (Muslim-majority, not members).
OIC_LIKE = OIC | {'BA', 'XK', 'EH'}
COMMUNITY = set(
    'IN CN RU GB FR DE NL BE SE NO DK AT CH IT ES US CA AU NZ ZA SG LK PH TH ET '
    'TZ KE GH MK BG GR CY'.split())
ARAB_LEAGUE = set('DZ BH KM DJ EG IQ JO KW LB LY MR MA OM PS QA SA SO SD SY TN AE YE'.split())

# GeoNames feature codes that are not towns in their own right
# (PPLX = section of a populated place, i.e. a district or suburb).
SKIP_FEATURE_CODES = {'PPLX', 'STLMT', 'PPLH', 'PPLQ', 'PPLW'}

USER_AGENT = 'NoorTVDashboard/1.7 (open-source TV dashboard; city list build)'
SPARQL = 'https://query.wikidata.org/sparql'
ENWIKI_API = 'https://en.wikipedia.org/w/api.php'

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), 'build', 'cities')
CACHE = os.path.join(DATA, 'wikidata')
DEFAULT_OUT = os.path.join(os.path.dirname(HERE), 'js', 'cities.js')

# ----------------------------------------------------------------------------
# Hand corrections
# ----------------------------------------------------------------------------
# Capitals GeoNames does not mark PPLC: country -> geonameid.
CAPITAL_IDS = {
    'IL': '281184',   # Jerusalem (countryInfo.txt names it; the row is PPLA)
    'EH': '2462881',  # Laayoune (countryInfo.txt: El-Aaiun)
}

# The app's current cities: exact names and coordinates, whatever GeoNames says.
# geonameid -> (English, Arabic, lat, lon)
PINNED = {
    '285787': ('Kuwait City', 'مدينة الكويت', 29.3759, 47.9774),
    '285799': ('Al Jahra', 'الجهراء', 29.3375, 47.6581),
    '285839': ('Al Ahmadi', 'الأحمدي', 29.0769, 48.0839),
    '250441': ('Amman', 'عمّان', 31.9539, 35.9106),
    '248946': ('Irbid', 'إربد', 32.5556, 35.8500),
    '250090': ('Zarqa', 'الزرقاء', 32.0728, 36.0880),
    '104515': ('Makkah', 'مكة المكرمة', 21.4225, 39.8262),
    '109223': ('Madinah', 'المدينة المنورة', 24.4672, 39.6111),
}

# Always in the list, whatever their GeoNames population says.
FORCE_IDS = set(PINNED)

# Entries that are not GeoNames rows: (country, English, Arabic, lat, lon, capital?, population for sorting)
EXTRA = [
    # GeoNames has "East Jerusalem" under PS as a district (PPLX); list the city
    # itself so Arabic users find it.
    ('PS', 'Jerusalem (Al-Quds)', 'القدس', 31.7767, 35.2345, True, 428304),
]

# Rows dropped by hand: districts, suburbs and duplicates that GeoNames lists as
# towns. geonameid -> why. Filled in below (EXCLUDE.update).
EXCLUDE = {}

# English names fixed by hand: geonameid or 'CC:GeoNames asciiname' -> name.
NAME_EN = {}

# Arabic names fixed or filled by hand: geonameid or 'CC:GeoNames asciiname' -> name
# ('' blanks a bad label).
NAME_AR = {}

# Country names fixed by hand: ISO code -> (English or None, Arabic or None).
COUNTRY_NAMES = {
    'PS': ('Palestine', 'فلسطين'),
}

FORCE_IDS |= {
    '250774',   # JO Aqaba (95k, but 300 km south of Amman: its own prayer times)
    '282239',   # PS Ramallah (seat of the Palestinian Authority)
    '290594',   # AE Umm Al Quwain (an emirate's capital)
    '1735106',  # MY George Town, Penang (GeoNames counts only the old town)
}

EXCLUDE.update({
    # United Arab Emirates
    '12042053': 'Musaffah: industrial area of Abu Dhabi',
    '11524601': 'Jebel Ali: part of Dubai',
    '290503': 'Warisan: district of Dubai',
    # Djibouti
    '7648070': 'Balbala: suburb of Djibouti',
    # Algeria
    '2505854': 'Bab Ezzouar: suburb of Algiers',
    '2498766': 'El Achir: small town, GeoNames population is wrong',
    # Egypt
    '13680149': 'Az-Zuhur: district of Port Said',
    # Iraq
    '7802746': 'Sadr City: district of Baghdad',
    '10303650': 'Simele: duplicate of Sumayl',
    # Jordan
    '248460': 'Khuraybat as Suq: district of Amman',
    '246013': 'Wadi as Sir: district of Amman',
    '13286467': 'Suwaylih: district of Amman',
    # Libya
    '2216885': 'Zawiya: duplicate of Az Zawiyah',
    # Saudi Arabia
    '101760': 'Sultanah: district of Madinah',
    # Sudan
    '379302': 'El Geneina Fort: duplicate of Al-Junaynah',
    # Turkey: districts of Istanbul, Ankara, Bursa, Izmir, Antalya, Denizli
    '747323': 'Esenyurt', '742394': 'Kucukcekmece', '751324': 'Bagcilar',
    '7627067': 'Bahcelievler', '738377': 'Umraniye', '738329': 'Uskudar',
    '747340': 'Esenler', '7628420': 'Sancaktepe', '7628416': 'Sultangazi',
    '741763': 'Maltepe', '6947640': 'Beylikduzu', '6947637': 'Atasehir',
    '7628419': 'Sultanbeyli', '747158': 'Fatih', '739549': 'Sisli',
    '737071': 'Zeytinburnu', '751868': 'Arnavutkoy', '6947639': 'Basaksehir',
    '6947641': 'Buyukcekmece', '6955677': 'Cankaya', '314133': 'Golbasi',
    '10346824': 'Nilufer', '7701384': 'Karabaglar', '320857': 'Bornova',
    '308988': 'Karsiyaka', '306641': 'Konak', '320257': 'Cigli',
    '8074174': 'Muratpasa', '11238838': 'Merkezefendi',
    # Malaysia: neighbourhoods and villages inside Kuala Lumpur, Johor Bahru, Penang
    '1771023': 'Kampung Baru Subang', '13118225': 'Bukit Rahman Putra',
    '1732747': 'Pelentong', '6847550': 'Kota Kuala Muda (same as Sungai Petani)',
    '7795834': 'Selayang Baru Utara', '12750654': 'Mukim Pulai',
    '1732724': 'Kampung Larkin Lama', '12514556': 'Kota Damansara',
    '12557764': 'Taman Petaling', '1762110': 'Kampung Kangkar Teberau',
    '1735162': 'Setapak', '1735166': 'Batu Caves', '13100478': 'Paya Terubong',
    '13118272': 'Bandar Seri Alam', '12750606': 'Wangsa Maju',
    '13118277': 'Bandar Utama', '13118362': 'Bukit Jalil', '1732901': 'Kapar',
    # Bangladesh: Dhaka thanas and sub-districts counted as towns
    '1194041': 'Mohammadpur', '1199503': 'Kafrul', '1209106': 'Bhatara',
    '13589478': 'Motijheel', '9827976': 'Paltan', '1193745': 'Nagar Naluakot',
    '1185159': 'Nagarpur', '8299875': 'Karnaphuli',
    # Nigeria: parts of Lagos
    '2351943': 'Agege', '2566636': 'Ajegunle', '7732748': 'Lekki',
    # Iran
    '124878': 'Maragheh listed again in the wrong province',
    # Pakistan
    '1166547': 'Sahiwal (Sargodha district): the district population of the other Sahiwal',
    # Guinea: districts of Conakry
    '2422488': 'Camayenne', '2421820': 'Dixinn',
    # Ivory Coast: communes of Abidjan
    '2293521': 'Abobo', '2285853': 'Koumassi', '2595323': 'Marcory',
    # Senegal
    '2244799': 'Thies Nones: duplicate of Thies',
    # India
    '1258393': 'Rasapudipalem: a village, GeoNames population is wrong',
    '1262111': 'Najafgarh: part of Delhi',
    '1259652': 'Pimpri: duplicate of Pimpri-Chinchwad',
    # Philippines
    '1723510': 'Budta: a village, GeoNames population is wrong',
    '1978681': 'Malingao: a village, GeoNames population is wrong',
    '1701500': 'Mansilingan: part of Bacolod',
    '13118244': 'Mandaluyong: duplicate of Mandaluyong City',
    # China: districts of Shanghai and Shenzhen, and two villages with wrong populations
    '1798524': 'Pudong', '1800480': 'Minhang', '1816917': 'Baoshan',
    '1794035': 'Songjiang', '1806508': 'Jiading', '1797798': 'Qingpu',
    '1798439': 'Putuo', '1787375': 'Yangpu', '13608002': 'Fengxiang',
    '1787957': 'Xuhui', '13308620': "Bao'an", '1793036': 'Chengtangcun',
    '1802875': 'Guankou',
    # United States: boroughs of New York City
    '5110302': 'Brooklyn', '5133273': 'Queens', '5125771': 'Manhattan',
    '5110266': 'The Bronx', '5139568': 'Staten Island',
    # Others
    '3526683': 'Iztapalapa: borough of Mexico City',
    '3514674': 'Gustavo Adolfo Madero: borough of Mexico City',
    '5950268': 'Etobicoke: part of Toronto',
    '2646003': 'Islington: borough of London',
    '12278193': 'Marne La Vallee: new town area east of Paris',
    '2187404': 'Manukau City: part of Auckland',
})

EXCLUDE['99106'] = 'Al Madinah (Basra): small town carrying its district population'

NAME_EN.update({
    'AE:Al Ain City': 'Al Ain', 'AE:Umm Al Quwain City': 'Umm Al Quwain',
    'BH:Al Muharraq': 'Muharraq', 'BH:Madinat Hamad': 'Hamad Town', "BH:Ar Rifa'": 'Riffa',
    'EG:Shubra al Khaymah': 'Shubra El Kheima', 'EG:Al Mansurah': 'Mansoura',
    'EG:Al Mahallah al Kubra': 'El Mahalla El Kubra', 'EG:Al Fayyum': 'Faiyum',
    'EG:Bani Suwayf': 'Beni Suef', 'EG:Shibin al Kawm': 'Shibin El Kom', 'EG:Qina': 'Qena',
    "EG:Al 'Ashir min Ramadan": '10th of Ramadan City', 'EG:Halwan': 'Helwan',
    'IQ:Basrah': 'Basra', 'IQ:Dihok': 'Duhok', "IQ:Al 'Amarah": 'Amarah',
    'IQ:Al Diwaniyah': 'Diwaniyah', 'IQ:Al-Kut': 'Kut', 'IQ:Zaxo': 'Zakho', 'IQ:Kelar': 'Kalar',
    'IQ:Al Fallujah': 'Fallujah', 'IQ:Al Hillah': 'Hillah', 'IQ:As Samawah': 'Samawah',
    'IQ:Abu al-Kahsib': 'Abu Al-Khaseeb', 'IQ:Abu Ghurayb': 'Abu Ghraib', 'IQ:Ash Shatrah': 'Shatrah',
    "JO:'Ajlun": 'Ajloun', 'JO:As Salt': 'Salt', 'JO:Ar Ramtha': 'Ramtha',
    'KW:Sabah as Salim': 'Sabah Al-Salem',
    'LB:Nabatiye et Tahta': 'Nabatieh',
    'LY:Misratah': 'Misrata', 'LY:Al Khums': 'Khoms', 'LY:Az Zawiyah': 'Zawiya',
    "LY:Al Bayda'": 'Bayda', 'LY:Darnah': 'Derna', 'LY:Al Ajaylat': 'Ajaylat', 'LY:Al Jumayl': 'Jumayl',
    'OM:As Suwayq': 'Suwayq',
    'QA:Ar Rayyan': 'Al Rayyan',
    "SA:Ta'if": 'Taif', "SA:Ha'il": 'Hail', 'SA:Al Hufuf': 'Hofuf', 'SA:Al Jubayl': 'Jubail',
    'SA:Az Zulfi': 'Zulfi', 'SA:Bishah': 'Bisha', 'SA:Sabt Alalayah': 'Sabt Al Alayah',
    'SD:Al Qadarif': 'Gedaref', 'SD:Al-Junaynah': 'Geneina', 'SD:Ad-Damazin': 'Damazin',
    'SD:Ad-Damir': 'Ed Damer', 'SD:An Nuhud': 'En Nahud', 'SD:Al Manaqil': 'Managil',
    'SO:Hargeysa': 'Hargeisa',
    'SY:Hamah': 'Hama', 'SY:Ar Raqqah': 'Raqqa', 'SY:Al Hasakah': 'Hasakah',
    'SY:Al Qamishli': 'Qamishli', 'SY:Duma': 'Douma',
    'TN:Aryanah': 'Ariana', 'TN:Sukrah': 'La Soukra', 'TN:Sidi Husayn': 'Sidi Hassine',
    'YE:Al Hudaydah': 'Hodeidah',
    'DE:Koeln': 'Cologne', 'DE:Frankfurt am Main': 'Frankfurt', 'ES:Sevilla': 'Seville',
    'KG:Manas': 'Manas (Jalal-Abad)', 'MM:Nay Pyi Taw': 'Naypyidaw', 'MN:Ulan Bator': 'Ulaanbaatar',
    'UZ:Andijon': 'Andijan', "UZ:Qo'qon": 'Kokand', "UZ:Marg'ilon": 'Margilan', 'UZ:Tirmiz': 'Termez',
    'UZ:Jizzax': 'Jizzakh', 'UZ:Urganch': 'Urgench', 'UZ:Navoiy': 'Navoi', 'UZ:Xiva': 'Khiva',
    'UZ:Olmaliq': 'Almalyk',
    'ET:Nazret': 'Adama', "ET:Mek'ele": 'Mekelle', 'ET:Gonder': 'Gondar', 'ET:Awasa': 'Hawassa',
    'NG:Ebute Ikorodu': 'Ikorodu', 'ID:Jambi City': 'Jambi', 'PK:Jhang Sadr': 'Jhang',
    'BD:Tungi': 'Tongi', 'CN:Zhu Cheng City': 'Zhucheng', 'IR:Orumiyeh': 'Urmia',
    'KR:Goyang-si': 'Goyang', 'MX:Santiago de Queretaro': 'Queretaro', 'MX:Leon de los Aldama': 'Leon',
})

NAME_AR.update({
    # Arab League: gaps Wikidata left, and labels that named a district or governorate
    'AE:Ras Al Khaimah': 'رأس الخيمة', 'AE:Umm Al Quwain City': 'أم القيوين',
    'DZ:El Oued': 'الوادي', 'EG:Al Khusus': 'الخصوص', 'EG:Halwan': 'حلوان',
    'IQ:Abu al-Kahsib': 'أبو الخصيب', 'IQ:Kelar': 'كلار', 'IQ:Ash Sharqat': 'الشرقاط',
    'IQ:Sumayl': 'سميل',
    'JO:Aqaba': 'العقبة', 'KW:Sabah as Salim': 'صباح السالم',
    'LY:Al Ajaylat': 'العجيلات', 'LY:Al Jadid': 'الجديد', 'LY:Al Jumayl': 'الجميل',
    'MA:Tangier': 'طنجة', 'MA:Mohammedia': 'المحمدية', 'MA:El Jadida': 'الجديدة',
    'MA:Sale Al Jadida': 'سلا الجديدة', 'MA:Ait Melloul': 'أيت ملول', 'MA:Dar Bouazza': 'دار بوعزة',
    'MA:Settat': 'سطات', 'MA:Berrechid': 'برشيد',
    'OM:Seeb': 'السيب', 'OM:Saham': 'صحم', 'OM:Rustaq': 'الرستاق', 'OM:Sohar': 'صحار',
    'OM:As Suwayq': 'السويق',
    'PS:Ramallah': 'رام الله',
    'QA:Lusail': 'لوسيل', 'QA:Ar Rayyan': 'الريان',
    'SA:Al Hufuf': 'الهفوف', 'SA:Unaizah': 'عنيزة', 'SA:Az Zulfi': 'الزلفي',
    'SA:Sabt Alalayah': 'سبت العلاية', 'SA:Al Kharj': 'الخرج', 'SA:Hafar Al-Batin': 'حفر الباطن',
    'SA:Sabya': 'صبيا', 'SA:Yanbu': 'ينبع',
    'SD:Gereida': 'قريضة', 'SO:Ruqi': 'روقي', 'SO:Borama': 'بورما',
    'SY:Idlib': 'إدلب',
    'TN:Sidi Husayn': 'سيدي حسين', 'TN:Sakiet ed Daier': 'ساقية الدائر',
    'TN:El Mourouj': 'المروج', 'TN:Sakiet ez Zit': 'ساقية الزيت',
    'YE:Dhamar': 'ذمار',  # Wikidata's item for this GeoNames id is labelled Al Mahwit
    'EH:Laayoune': 'العيون',
    # Elsewhere: wrong, archaic or misspelt labels, and well-known cities left blank
    'ES:Madrid': 'مدريد', 'ES:Valencia': 'فالنسيا', 'ES:Barcelona': 'برشلونة', 'ES:Sevilla': 'إشبيلية',
    'ES:Malaga': 'مالقة', 'ES:Murcia': 'مرسية', 'ES:Bilbao': 'بلباو', 'ES:Valladolid': 'بلد الوليد',
    'ES:Palma': 'بالما', 'ES:Las Palmas de Gran Canaria': 'لاس بالماس',
    'VE:Valencia': 'فالنسيا', 'MX:Merida': 'ميريدا', 'MX:Puebla': 'بويبلا',
    'MX:Santiago de Queretaro': 'كيريتارو',
    'UZ:Urganch': 'أورغنتش', 'UZ:Nukus': 'نوكوس', 'UZ:Navoiy': 'نوائي', 'UZ:Jizzax': 'جيزاخ',
    'KZ:Almaty': 'ألماتي', 'KZ:Astana': 'أستانا', 'KZ:Karagandy': 'قراغندي', 'KZ:Rudnyy': 'رودني',
    'KZ:Kokshetau': 'كوكشيتاو', 'KZ:Ust-Kamenogorsk': 'أوست كامينوغورسك',
    'TJ:Bokhtar': 'بوختار', 'TJ:Khujand': 'خجند', 'TJ:Dushanbe': 'دوشنبه',
    'TR:Gaziantep': 'غازي عنتاب', 'TR:Sanliurfa': 'شانلي أورفا', 'TR:Kayseri': 'قيصري',
    'TR:Antalya': 'أنطاليا',
    'MK:Skopje': 'سكوبيه', 'SI:Ljubljana': 'ليوبليانا', 'KE:Mombasa': 'مومباسا', 'KE:Kisumu': 'كيسومو',
    'ZA:Emalahleni': 'إيمالاهليني',
    'PK:Sukkur': 'سكر', 'PK:Jhang Sadr': 'جهنغ', 'PK:Karachi': 'كراتشي', 'PK:Quetta': 'كويتا',
    'BD:Chattogram': 'شيتاغونغ', 'BD:Comilla': 'كوميلا', 'BD:Chandpur': 'تشاندبور',
    'BD:Brahmanbaria': 'برهمن بريه',
    'CM:Kousseri': 'كوسيري', 'CM:Douala': 'دوالا', 'CM:Bamenda': 'باميندا',
    'GN:Labe': 'لابي', 'GN:Kamsar': 'كامسار', 'ML:Gao': 'غاو', 'ML:Bamako': 'باماكو',
    'TD:N\'Djamena': 'إنجامينا',
    'NG:Benin City': 'مدينة بنين', 'NG:Ile-Ife': 'إيفي', 'NG:Sokoto': 'سوكوتو', 'NG:Katsina': 'كاتسينا',
    'CA:Quebec': 'كيبك', 'GB:Bristol': 'بريستول', 'GB:Preston': 'بريستون',
    'BE:Brussels': 'بروكسل', 'BE:Antwerp': 'أنتويرب', 'LU:Luxembourg': 'لوكسمبورغ',
    'AU:Perth': 'بيرث', 'AL:Durres': 'دوريس', 'AL:Vlore': 'فلورا', 'AL:Elbasan': 'إلباسان',
    'AF:Bagram': 'باغرام', 'AZ:Yevlakh': 'يفلاخ', 'AZ:Mingachevir': 'مينغتشفير', 'AZ:Baku': 'باكو',
    'BA:Tuzla': 'توزلا', 'MY:Petaling Jaya': 'بيتالينغ جايا', 'MY:Seremban': 'سرمبان',
    'MY:Malacca': 'ملقا',
    'ID:Tangerang': 'تانغيرانغ', 'ID:Palembang': 'باليمبانغ', 'ID:Bogor': 'بوغور',
    'ID:Padang': 'بادانغ', 'ID:Bandung': 'باندونغ', 'ID:Makassar': 'ماكاسار', 'ID:Depok': 'ديبوك',
    'CK:Avarua': 'أفاروا', 'FO:Torshavn': 'تورشافن',
    'XK:Pristina': 'بريشتينا', 'XK:Prizren': 'بريزرن', 'LK:Colombo': 'كولومبو',
    'NP:Kathmandu': 'كاتماندو', 'MG:Antananarivo': 'أنتاناناريفو',
    'SN:Mbour': 'مبور', 'SN:Rufisque': 'روفيسك', 'SN:Thies': 'تييس',
    'NE:Agadez': 'أغاديز', 'BF:Bobo-Dioulasso': 'بوبو ديولاسو', 'CI:Bouafle': 'بوافلي',
    'TZ:Zanzibar': 'زنجبار', 'RU:Rostov-on-Don': 'روستوف على الدون',
    'CN:Weifang': 'ويفانغ', 'CN:Wuzhong': 'ووتشونغ', 'CN:Weinan': 'وينان', 'CN:Jilin': 'جيلين',
    'CN:Cixi': 'تسيشي', 'CN:Chongqing': 'تشونغتشينغ', 'CN:Shenzhen': 'شنجن', 'CN:Tianjin': 'تيانجين',
    'AM:Yerevan': 'يريفان', 'CH:Bern': 'برن', 'CH:Zuerich': 'زيورخ',
    'DE:Koeln': 'كولونيا', 'DE:Stuttgart': 'شتوتغارت', 'DE:Essen': 'إسن', 'DE:Dortmund': 'دورتموند',
    'DE:Nuremberg': 'نورنبرغ', 'DE:Hannover': 'هانوفر', 'DE:Duisburg': 'دويسبورغ',
    'DE:Bochum': 'بوخوم', 'DE:Wuppertal': 'فوبرتال', 'DE:Bielefeld': 'بيليفيلد', 'DE:Bonn': 'بون',
    'DE:Muenster': 'مونستر',
    'IT:Naples': 'نابولي', 'IT:Turin': 'تورينو', 'IT:Palermo': 'باليرمو', 'IT:Genoa': 'جنوة',
    'IT:Bologna': 'بولونيا', 'IT:Florence': 'فلورنسا', 'IT:Bari': 'باري', 'IT:Catania': 'كاتانيا',
    'NL:Utrecht': 'أوترخت', 'BR:Sao Paulo': 'ساو باولو', 'BR:Rio de Janeiro': 'ريو دي جانيرو',
    'HK:Hong Kong': 'هونغ كونغ', 'SG:Singapore': 'سنغافورة', 'KG:Bishkek': 'بيشكك',
    'KP:Pyongyang': 'بيونغ يانغ', 'MC:Monaco': 'موناكو', 'MT:Valletta': 'فاليتا',
    'VA:Vatican City': 'مدينة الفاتيكان', 'CA:Halifax': 'هاليفاكس', 'KR:Incheon': 'إنتشون',
    'ET:Dire Dawa': 'دير داوا',
    'NR:Yaren': 'يارين', 'PH:Cebu City': 'سيبو', 'TR:Elazig': 'إلازيغ', 'TR:Usak': 'أوشاك',
    'TR:Kahramanmaras': 'قهرمان مرعش', 'TR:Alanya': 'ألانيا', 'TW:Taichung': 'تايتشونغ',
    'CN:Lianyungang': 'ليانيونغانغ',
})

COUNTRY_NAMES.update({
    'NL': ('Netherlands', 'هولندا'), 'OM': (None, 'عُمان'),
    'BQ': ('Caribbean Netherlands', None), 'MF': (None, 'سان مارتن'),
    'SH': (None, 'سانت هيلانة'), 'TF': (None, 'الأراضي الفرنسية الجنوبية'),
    'VG': (None, 'جزر العذراء البريطانية'), 'VI': (None, 'جزر العذراء الأمريكية'),
    'CZ': (None, 'التشيك'), 'ER': (None, 'إريتريا'), 'LT': (None, 'ليتوانيا'),
    'FM': (None, 'ميكرونيسيا'),
})


# ----------------------------------------------------------------------------
def load_cities():
    rows = []
    with open(os.path.join(DATA, 'cities15000.txt'), encoding='utf-8') as fh:
        for line in fh:
            f = line.rstrip('\n').split('\t')
            rows.append({
                'id': f[0], 'name': f[1], 'ascii': f[2],
                'lat': float(f[4]), 'lon': float(f[5]),
                'fcode': f[7], 'cc': f[8], 'adm1': f[10], 'pop': int(f[14] or 0),
            })
    return rows


def load_admin1():
    out = {}
    path = os.path.join(DATA, 'admin1CodesASCII.txt')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as fh:
            for line in fh:
                f = line.rstrip('\n').split('\t')
                out[f[0]] = f[2] or f[1]
    return out


def km(a, b):
    dx = (a['lon'] - b['lon']) * math.cos(math.radians((a['lat'] + b['lat']) / 2))
    return 111.2 * math.hypot(a['lat'] - b['lat'], dx)


_FOLD = {'\u2019': "'", '\u2018': "'", '\u02bb': "'", '\u02bc': "'", '`': "'", '\u0131': 'i',
         '\u0130': 'I', '\u00f8': 'o', '\u00d8': 'O', '\u0111': 'd', '\u0110': 'D',
         '\u0142': 'l', '\u0141': 'L', '\u00df': 'ss', '\u00e6': 'ae', '\u00c6': 'Ae',
         '\u0259': 'a', '\u018f': 'A', '\u2013': '-'}


def english_name(r):
    """Plain ASCII name: GeoNames `name` with the accents taken off when that
    works (Zurich, not GeoNames' asciiname Zuerich), otherwise `asciiname`."""
    name = ''.join(_FOLD.get(ch, ch) for ch in r['name'])
    name = ''.join(ch for ch in unicodedata.normalize('NFKD', name) if not unicodedata.combining(ch))
    if not name or any(ord(ch) > 126 for ch in name):
        name = r['ascii'].replace('`', "'") or r['name']
    return name.strip("' ")


def load_countries():
    out = {}
    with open(os.path.join(DATA, 'countryInfo.txt'), encoding='utf-8') as fh:
        for line in fh:
            if line.startswith('#') or not line.strip():
                continue
            f = line.rstrip('\n').split('\t')
            out[f[0]] = {'name': f[4], 'capital': f[5]}
    return out


def select(rows):
    """Returns (chosen rows, set of capital ids)."""
    by_cc = collections.defaultdict(list)
    for r in rows:
        if r['id'] in EXCLUDE:
            continue
        if r['fcode'] in SKIP_FEATURE_CODES and r['id'] not in FORCE_IDS:
            continue
        by_cc[r['cc']].append(r)
    chosen = {}
    capitals = set()
    for cc, lst in by_cc.items():
        lst.sort(key=lambda r: (-r['pop'], 0 if r['fcode'].startswith('PPLA') or r['fcode'] == 'PPLC' else 1, r['ascii']))
        # GeoNames sometimes has one town twice (a PPL and a PPLA2 row): keep the first.
        kept = []
        for r in lst:
            if any(k['ascii'] == r['ascii'] and km(k, r) < SAME_TOWN_KM for k in kept if k['pop'] >= OIC_MIN_POP):
                continue
            kept.append(r)
        lst = kept
        for r in lst:
            is_cap = r['fcode'] == 'PPLC' or CAPITAL_IDS.get(cc) == r['id']
            if is_cap:
                capitals.add(r['id'])
            if is_cap or r['pop'] >= MILLION or r['id'] in FORCE_IDS:
                chosen[r['id']] = r
        if cc in OIC_LIKE:
            for r in [r for r in lst if r['pop'] >= OIC_MIN_POP][:OIC_CAP]:
                chosen[r['id']] = r
        elif cc in COMMUNITY:
            for r in [r for r in lst if r['pop'] >= COMMUNITY_MIN_POP][:COMMUNITY_CAP]:
                chosen[r['id']] = r
    return list(chosen.values()), capitals


# ----------------------------------------------------------------------------
def sparql(query):
    data = urllib.parse.urlencode({'query': query, 'format': 'json'}).encode()
    req = urllib.request.Request(SPARQL, data=data, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'application/sparql-results+json',
    })
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode('utf-8'))['results']['bindings']
        except Exception as exc:  # noqa: BLE001 - retry any network hiccup
            if attempt == 4:
                raise
            sys.stderr.write('  wikidata: %s, retrying\n' % exc)
            time.sleep(5 * (attempt + 1))


def cached(name, make):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    value = make()
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(value, fh, ensure_ascii=False, indent=0, sort_keys=True)
    return value


def fetch_city_labels(ids):
    """geonameid -> {'q':, 'ar':, 'en':, 'links':} (best item per id). Cached per id."""
    def load():
        return {}
    cache = cached('cities.json', load)
    missing = sorted(i for i in ids if i not in cache)
    for start in range(0, len(missing), 150):
        batch = missing[start:start + 150]
        values = ' '.join('"%s"' % i for i in batch)
        rows = sparql('''
SELECT ?gn ?item ?ar ?en ?links WHERE {
  VALUES ?gn { %s }
  ?item wdt:P1566 ?gn .
  ?item wikibase:sitelinks ?links .
  OPTIONAL { ?item rdfs:label ?ar FILTER(LANG(?ar) = "ar") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
}''' % values)
        found = collections.defaultdict(list)
        for b in rows:
            found[b['gn']['value']].append({
                'q': b['item']['value'].rsplit('/', 1)[-1],
                'ar': b.get('ar', {}).get('value', ''),
                'en': b.get('en', {}).get('value', ''),
                'links': int(b['links']['value']),
            })
        for i in batch:
            cands = found.get(i, [])
            # Several items can carry one GeoNames id: prefer one with an Arabic
            # label, then the best known one.
            cands.sort(key=lambda c: (0 if c['ar'] else 1, -c['links'], c['q']))
            cache[i] = dict(cands[0], n=len(cands)) if cands else {'q': '', 'ar': '', 'en': '', 'links': 0, 'n': 0}
        sys.stderr.write('  wikidata cities: %d of %d\n' % (min(start + 150, len(missing)), len(missing)))
        with open(os.path.join(CACHE, 'cities.json'), 'w', encoding='utf-8') as fh:
            json.dump(cache, fh, ensure_ascii=False, indent=0, sort_keys=True)
        time.sleep(1)
    return cache


def enwiki_items(titles):
    """English Wikipedia article title (redirects followed) -> Wikidata id."""
    out = {}
    titles = sorted(titles)
    for start in range(0, len(titles), 50):
        batch = titles[start:start + 50]
        url = ENWIKI_API + '?' + urllib.parse.urlencode({
            'action': 'query', 'format': 'json', 'redirects': '1', 'prop': 'pageprops',
            'ppprop': 'wikibase_item|disambiguation', 'titles': '|'.join(batch)})
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            q = json.loads(resp.read().decode('utf-8')).get('query', {})
        hop = {}
        for key in ('normalized', 'redirects'):
            for item in q.get(key, []):
                hop[item['from']] = item['to']
        final = {}
        for page in q.get('pages', {}).values():
            props = page.get('pageprops', {})
            if 'wikibase_item' in props and 'disambiguation' not in props:
                final[page['title']] = props['wikibase_item']
        for t in batch:
            end = t
            for _ in range(4):
                end = hop.get(end, end)
            if end in final:
                out[t] = final[end]
        time.sleep(1)
    return out


def fetch_fallback_labels(wanted):
    """For towns whose GeoNames id Wikidata does not carry on the town's own
    item (it often sits on a bot-made duplicate, or on the municipality): take
    the item of the English Wikipedia article with the town's name, and accept
    it only if its coordinates are within FALLBACK_KM of the GeoNames row.
    wanted: geonameid -> (country, [names], lat, lon). Cached per id."""
    cache = cached('fallback.json', dict)
    missing = sorted(i for i in wanted if i not in cache)
    for start in range(0, len(missing), 100):
        batch = missing[start:start + 100]
        titles = set()
        for i in batch:
            titles.update(wanted[i][1])
        items = enwiki_items(titles)
        qids = sorted(set(items.values()))
        info = {}
        if qids:
            rows = sparql('''
SELECT ?item ?ar ?coord WHERE {
  VALUES ?item { %s }
  ?item wdt:P625 ?coord .
  ?item rdfs:label ?ar FILTER(LANG(?ar) = "ar")
}''' % ' '.join('wd:' + q for q in qids))
            for b in rows:
                lon, lat = b['coord']['value'].replace('Point(', '').rstrip(')').split()[:2]
                info.setdefault(b['item']['value'].rsplit('/', 1)[-1], []).append(
                    {'ar': b['ar']['value'], 'lat': float(lat), 'lon': float(lon)})
        for i in batch:
            cc, names, lat, lon = wanted[i]
            hit = {'q': '', 'ar': ''}
            for name in names:
                q = items.get(name)
                for c in info.get(q, []):
                    if not hit['q'] and km(c, {'lat': lat, 'lon': lon}) <= FALLBACK_KM:
                        hit = {'q': q, 'ar': c['ar']}
            cache[i] = hit
        sys.stderr.write('  wikidata by name: %d of %d\n' % (min(start + 100, len(missing)), len(missing)))
        with open(os.path.join(CACHE, 'fallback.json'), 'w', encoding='utf-8') as fh:
            json.dump(cache, fh, ensure_ascii=False, indent=0, sort_keys=True)
    return cache


def clean_arabic(label):
    """Wikidata label -> a bare Arabic town name, or '' when it is not one."""
    label = ''.join(ch for ch in label.strip() if not ('\u064b' <= ch <= '\u0652' or ch == '\u0670'))
    for prefix in ('\u0648\u0644\u0627\u064a\u0629 ', '\u0645\u062d\u0627\u0641\u0638\u0629 ',
                   '\u0628\u0644\u062f\u064a\u0629 ', '\u0645\u062f\u064a\u0631\u064a\u0629 '):
        # "wilayat X", "muhafazat X", "baladiyat X", "mudiriyat X": the district, not the town
        if label.startswith(prefix):
            label = label[len(prefix):]
    for sep in ('(', '\u060c', ','):  # "name (disambiguation)", "name، country"
        if sep in label:
            label = label.split(sep)[0].strip()
    return label if is_arabic(label) else ''


def fetch_country_labels():
    def make():
        rows = sparql('''
SELECT ?code ?item ?ar ?links WHERE {
  ?item wdt:P297 ?code .
  ?item wikibase:sitelinks ?links .
  OPTIONAL { ?item rdfs:label ?ar FILTER(LANG(?ar) = "ar") }
}''')
        best = {}
        for b in rows:
            code = b['code']['value']
            cand = (int(b['links']['value']), b.get('ar', {}).get('value', ''))
            if cand[1] and (code not in best or cand > best[code]):
                best[code] = cand
        return {k: v[1] for k, v in best.items()}
    return cached('countries.json', make)


# ----------------------------------------------------------------------------
def hand(table, r, default=None):
    """Hand tables are keyed by geonameid or by 'CC:asciiname'."""
    if r['id'] in table:
        return table[r['id']]
    return table.get(r['cc'] + ':' + r['ascii'], default)


def hand_name(r):
    return hand(NAME_EN, r)


def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def is_arabic(s):
    """True when s is Arabic script only (letters, marks, spaces, a few joiners)."""
    if not s:
        return False
    for ch in s:
        o = ord(ch)
        if 0x0600 <= o <= 0x06FF or 0x0750 <= o <= 0x077F or ch in ' -‌':
            continue
        return False
    return True


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    rows = load_cities()
    countries = load_countries()
    chosen, capitals = select(rows)
    labels = fetch_city_labels([r['id'] for r in chosen])
    wanted = {}
    for r in chosen:
        if r['id'] not in PINNED and not clean_arabic(labels.get(r['id'], {}).get('ar', '')):
            names = []
            for n in (hand_name(r), english_name(r), r['name'], r['ascii']):
                if n and n not in names:
                    names.append(n)
            wanted[r['id']] = (r['cc'], names, r['lat'], r['lon'])
    fallback = fetch_fallback_labels(wanted)
    country_ar = fetch_country_labels()

    entries = []  # (cc, capital?, pop, en, ar, lat, lon, id)
    for r in chosen:
        gid = r['id']
        en = hand_name(r) or english_name(r)
        ar = clean_arabic(labels.get(gid, {}).get('ar', '')) or clean_arabic(fallback.get(gid, {}).get('ar', ''))
        ar = hand(NAME_AR, r, ar)
        lat, lon = r['lat'], r['lon']
        if gid in PINNED:
            en, ar, lat, lon = PINNED[gid]
        entries.append((r['cc'], gid in capitals, r['pop'], en, ar, lat, lon, gid))
    for cc, en, ar, lat, lon, cap, pop in EXTRA:
        entries.append((cc, cap, pop, en, ar, lat, lon, ''))

    # Two different towns with one name in one country: add the region.
    admin1 = load_admin1()
    by_id = dict((r['id'], r) for r in chosen)
    count = collections.Counter((e[0], e[3]) for e in entries)
    for i, e in enumerate(entries):
        if count[(e[0], e[3])] > 1 and e[7] and hand_name(by_id[e[7]]) is None:
            region = admin1.get(e[0] + '.' + by_id[e[7]]['adm1'], '')
            if region:
                entries[i] = e[:3] + ('%s (%s)' % (e[3], region),) + e[4:]

    entries.sort(key=lambda e: (e[0], 0 if e[1] else 1, -e[2], e[3]))

    seen = set()
    for e in entries:
        key = (e[0], e[3])
        if key in seen:
            sys.stderr.write('WARNING duplicate name %s %s\n' % key)
        seen.add(key)

    used = sorted(set(e[0] for e in entries))
    lines = []
    lines.append('/* Noor — bundled cities. Data: GeoNames (CC BY 4.0, geonames.org); '
                 'Arabic names: Wikidata (CC0). Generated, see README. */')
    lines.append('window.NOOR_CITIES = {')
    lines.append('  // ISO 3166-1 alpha-2 -> [English name, Arabic name]')
    lines.append('  countries: {')
    for i, cc in enumerate(used):
        en = countries[cc]['name'].strip()
        ar = country_ar.get(cc, '')
        fix = COUNTRY_NAMES.get(cc)
        if fix:
            en = fix[0] or en
            ar = fix[1] if fix[1] is not None else ar
        lines.append('    %s: [%s, %s]%s' % (cc, js_str(en), js_str(ar), ',' if i < len(used) - 1 else ''))
    lines.append('  },')
    lines.append("  // [country code, English name, Arabic name ('' if unknown), latitude, longitude] "
                 '— within a country, largest first')
    lines.append('  cities: [')
    for i, e in enumerate(entries):
        lines.append('    [%s, %s, %s, %.4f, %.4f]%s' % (
            js_str(e[0]), js_str(e[3]), js_str(e[4]), e[5], e[6], ',' if i < len(entries) - 1 else ''))
    lines.append('  ]')
    lines.append('};')
    text = '\n'.join(lines) + '\n'
    with open(out_path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)

    # A review sheet next to the cache (never shipped).
    with open(os.path.join(DATA, 'review.tsv'), 'w', encoding='utf-8') as fh:
        for e in entries:
            lab = labels.get(e[7], {})
            src = 'hand' if (not e[7] or e[7] in PINNED or hand(NAME_AR, by_id[e[7]]) is not None) else ('id' if clean_arabic(lab.get('ar', '')) else ('name' if e[4] else ''))
            fh.write('\t'.join([e[0], 'CAP' if e[1] else '', str(e[2]), e[7], e[3], e[4], src,
                                lab.get('en', ''), lab.get('ar', '') if lab.get('ar', '') != e[4] else '',
                                lab.get('q', '') or fallback.get(e[7], {}).get('q', '')]) + '\n')

    with_ar = sum(1 for e in entries if e[4])
    arab_gaps = [(e[0], e[3], e[7]) for e in entries if e[0] in ARAB_LEAGUE and not e[4]]
    print('countries: %d' % len(used))
    print('cities: %d' % len(entries))
    print('cities with an Arabic name: %d' % with_ar)
    print('countries without an Arabic name: %s' % [cc for cc in used if not (COUNTRY_NAMES.get(cc, (None, None))[1] or country_ar.get(cc))])
    print('Arab League cities without an Arabic name: %d %s' % (len(arab_gaps), arab_gaps))
    print('bytes: %d -> %s' % (len(text.encode('utf-8')), out_path))


if __name__ == '__main__':
    main()
