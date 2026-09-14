// Interface translations and the current language (Romanian by default).
(function () {
  const I18N = {
    ro: {
      'site.title': 'Matematică cu Laura Miron',
      'site.school': 'Liceul William Shakespeare, Timișoara',
      'a11y.skip': 'Sari la conținut',
      'nav.label': 'Meniu principal',
      'lang.label': 'Limba site-ului',
      'level.gimnaziu': 'Gimnaziu',
      'level.liceu': 'Liceu',
      'range.gimnaziu': 'clasele V–VIII',
      'range.liceu': 'clasele IX–XII',
      'home.title': 'Lecții de matematică pentru clasele V–XII',
      'home.lead': 'Explicații pas cu pas, exemple rezolvate și videoclipuri. Alege clasa ta.',
      'home.about.title': 'Despre lecții',
      'home.about.text': 'Lecțiile sunt pregătite de profesoara de matematică Laura Miron pentru elevii Liceului William Shakespeare din Timișoara. Le poți citi oricând, ca să recapitulezi acasă, în ritmul tău.',
      'count.zero': 'În curând',
      'count.one': '1 lecție',
      'count.few': '{n} lecții',
      'count.many': '{n} de lecții',
      'common.loading': 'Se încarcă…',
      'common.home': 'Acasă',
      'class.chooseGrade': 'Alege clasa',
      'class.empty': 'Lecțiile pentru această clasă apar în curând.',
      'class.notfound': 'Această clasă nu există. Alege o clasă de mai sus.',
      'type.text': 'Lecție scrisă',
      'type.video': 'Video',
      'type.textvideo': 'Lecție și video',
      'error.load': 'Lista de lecții nu s-a încărcat. Verifică conexiunea la internet și reîncarcă pagina.',
      'lesson.crumbs': 'Navigare',
      'lesson.notfound': 'Lecția nu este în listă. Întoarce-te la pagina principală.',
      'lesson.fallback': 'Această lecție nu are încă versiune în limba engleză. Mai jos este versiunea în română.',
      'lesson.video': 'Videoclipul lecției',
      'lesson.openYoutube': 'Deschide videoclipul pe YouTube',
      'footer.text': 'Lecții gratuite pentru elevi.',
    },
    en: {
      'site.title': 'Math with Laura Miron',
      'site.school': 'Liceul William Shakespeare, Timișoara',
      'a11y.skip': 'Skip to content',
      'nav.label': 'Main menu',
      'lang.label': 'Site language',
      'level.gimnaziu': 'Middle school',
      'level.liceu': 'High school',
      'range.gimnaziu': 'grades 5–8',
      'range.liceu': 'grades 9–12',
      'home.title': 'Math lessons for grades 5–12',
      'home.lead': 'Step-by-step explanations, solved examples and videos. Choose your grade.',
      'home.about.title': 'About the lessons',
      'home.about.text': 'The lessons are prepared by math teacher Laura Miron for the students of Liceul William Shakespeare in Timișoara. Read them any time to review at home, at your own pace.',
      'count.zero': 'Coming soon',
      'count.one': '1 lesson',
      'count.few': '{n} lessons',
      'count.many': '{n} lessons',
      'common.loading': 'Loading…',
      'common.home': 'Home',
      'class.chooseGrade': 'Choose a grade',
      'class.empty': 'Lessons for this grade are coming soon.',
      'class.notfound': 'This grade does not exist. Choose a grade above.',
      'type.text': 'Written lesson',
      'type.video': 'Video',
      'type.textvideo': 'Lesson and video',
      'error.load': 'The lesson list did not load. Check your internet connection and reload the page.',
      'lesson.crumbs': 'Breadcrumb',
      'lesson.notfound': 'This lesson is not in the list. Go back to the home page.',
      'lesson.fallback': 'This lesson is not translated into English yet. You can read the Romanian version below.',
      'lesson.video': 'Lesson video',
      'lesson.openYoutube': 'Open the video on YouTube',
      'footer.text': 'Free lessons for students.',
    },
  };

  const STORAGE_KEY = 'matematica.lang';
  let current = null;

  function getLang() {
    if (current) return current;
    let saved = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      saved = null;
    }
    current = saved === 'en' ? 'en' : 'ro';
    return current;
  }

  function setLang(lang) {
    current = lang === 'en' ? 'en' : 'ro';
    try {
      window.localStorage.setItem(STORAGE_KEY, current);
    } catch (e) {
      // Storage can be blocked (private mode); the choice then lasts for this page only.
    }
  }

  function t(key) {
    const dict = I18N[getLang()];
    return (dict && dict[key]) || I18N.ro[key] || key;
  }

  window.I18N = I18N;
  window.getLang = getLang;
  window.setLang = setLang;
  window.t = t;
})();
