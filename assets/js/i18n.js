// Interface translations and the current language (Romanian by default).
(function () {
  const I18N = {
    ro: {
      'site.title': 'Matematică cu Laura Miron',
      'site.school': 'Liceul William Shakespeare, Timișoara',
      'a11y.skip': 'Sari la conținut',
      'nav.label': 'Meniu principal',
      'nav.grades': 'Clase',
      'nav.gradesLabel': 'Alege clasa',
      'lang.label': 'Limba site-ului',
      'theme.dark': 'Temă închisă',
      'level.gimnaziu': 'Gimnaziu',
      'level.liceu': 'Liceu',
      'range.gimnaziu': 'clasele V–VIII',
      'range.liceu': 'clasele IX–XII',
      'home.title': 'Materiale de matematică pentru clasele V–XII',
      'home.lead': 'Teorie, fișe de lucru, teste și jocuri. Alege clasa ta sau caută un material.',
      'home.new': 'Noutăți',
      'home.newEmpty': 'Primele materiale apar în curând.',
      'home.about.title': 'Despre materiale',
      'home.about.text': 'Materialele sunt pregătite de profesoara de matematică Laura Miron, de la Liceul William Shakespeare din Timișoara. Le poți folosi oricând, ca să recapitulezi acasă, în ritmul tău.',
      'count.zero': 'În curând',
      'count.one': '1 material',
      'count.few': '{n} materiale',
      'count.many': '{n} de materiale',
      'common.loading': 'Se încarcă…',
      'common.home': 'Acasă',
      'common.new': 'Nou',
      'common.updated': 'actualizat {date}',
      'class.empty': 'Materialele pentru această clasă apar în curând.',
      'class.notfound': 'Această clasă nu există. Alege o clasă din meniu.',
      'class.filter': 'Arată materialele de tipul',
      'class.all': 'Toate',
      'class.more': 'Mai mult',
      'class.less': 'Mai puțin',
      'class.year': 'Anul școlar {year}',
      'group.lectii': 'Lecții și teorie',
      'group.fise': 'Fișe',
      'group.teste': 'Teste',
      'group.jocuri': 'Jocuri și quiz-uri',
      'kind.lectie': 'Lecție',
      'kind.teorie': 'Teorie',
      'kind.fisa-lucru': 'Fișă de lucru',
      'kind.fisa-recapitulativa': 'Fișă recapitulativă',
      'kind.test': 'Test',
      'kind.joc': 'Joc',
      'kind.quiz': 'Quiz',
      'material.crumbs': 'Navigare',
      'material.published': 'Publicat {date}',
      'material.pdf': 'Deschide PDF',
      'material.pdfNote': 'PDF-ul este în limba română.',
      'material.related': 'Din aceeași temă',
      'material.allGrade': 'Toate materialele pentru {grade}',
      'material.notfound': 'Materialul nu este în listă. Întoarce-te la pagina principală.',
      'material.fallback': 'Acest material nu are încă versiune în limba engleză. Mai jos este versiunea în română.',
      'material.pdfOnly': 'Materialul este disponibil doar ca PDF.',
      'material.video': 'Videoclipul lecției',
      'material.openYoutube': 'Deschide videoclipul pe YouTube',
      'material.readRomanian': 'Citește versiunea în română',
      'seo.home.title': 'Materiale de matematică pentru clasele V–XII | Laura Miron',
      'seo.home.description': 'Materiale gratuite de matematică pentru clasele V–XII: teorie, fișe de lucru, teste și jocuri, de prof. Laura Miron.',
      'seo.grade.title': 'Matematică {gradeNum} ({grade}): materiale gratuite | Laura Miron',
      'seo.grade.description': 'Materiale de matematică pentru {gradeNum}: teorie, fișe de lucru, teste și jocuri, de prof. Laura Miron.',
      'seo.grade.intro': 'Teorie, fișe de lucru, teste și jocuri pentru {grade}, grupate pe teme și ani școlari. Pagina adună materialele pentru {gradeNum}.',
      'search.label': 'Caută materiale',
      'search.placeholder': 'Caută: modul, fișă, test…',
      'search.open': 'Caută',
      'search.submit': 'Caută',
      'search.all': 'Vezi toate rezultatele ({n})',
      'search.title': 'Caută materiale',
      'search.grade': 'Clasa',
      'search.allGrades': 'Toate clasele',
      'search.count.one': '1 rezultat',
      'search.count.few': '{n} rezultate',
      'search.count.many': '{n} de rezultate',
      'search.none': 'Niciun material nu se potrivește. Încearcă mai puține cuvinte sau verifică scrierea.',
      'search.empty': 'Scrie un cuvânt, de exemplu „modul” sau „fișă”.',
      'error.load': 'Lista de materiale nu s-a încărcat. Verifică conexiunea la internet și reîncarcă pagina.',
      'footer.text': 'Materiale gratuite pentru elevi.',
    },
    en: {
      'site.title': 'Math with Laura Miron',
      'site.school': 'Liceul William Shakespeare, Timișoara',
      'a11y.skip': 'Skip to content',
      'nav.label': 'Main menu',
      'nav.grades': 'Grades',
      'nav.gradesLabel': 'Choose a grade',
      'lang.label': 'Site language',
      'theme.dark': 'Dark theme',
      'level.gimnaziu': 'Middle school',
      'level.liceu': 'High school',
      'range.gimnaziu': 'grades 5–8',
      'range.liceu': 'grades 9–12',
      'home.title': 'Math materials for grades 5–12',
      'home.lead': 'Theory, worksheets, tests and games. Choose your grade or search for a material.',
      'home.new': 'What’s new',
      'home.newEmpty': 'The first materials are coming soon.',
      'home.about.title': 'About the materials',
      'home.about.text': 'The materials are prepared by math teacher Laura Miron, from Liceul William Shakespeare in Timișoara. Use them any time to review at home, at your own pace.',
      'count.zero': 'Coming soon',
      'count.one': '1 material',
      'count.few': '{n} materials',
      'count.many': '{n} materials',
      'common.loading': 'Loading…',
      'common.home': 'Home',
      'common.new': 'New',
      'common.updated': 'updated {date}',
      'class.empty': 'Materials for this grade are coming soon.',
      'class.notfound': 'This grade does not exist. Choose a grade from the menu.',
      'class.filter': 'Show materials of type',
      'class.all': 'All',
      'class.more': 'More',
      'class.less': 'Less',
      'class.year': 'School year {year}',
      'group.lectii': 'Lessons and theory',
      'group.fise': 'Worksheets',
      'group.teste': 'Tests',
      'group.jocuri': 'Games and quizzes',
      'kind.lectie': 'Lesson',
      'kind.teorie': 'Theory',
      'kind.fisa-lucru': 'Worksheet',
      'kind.fisa-recapitulativa': 'Review worksheet',
      'kind.test': 'Test',
      'kind.joc': 'Game',
      'kind.quiz': 'Quiz',
      'material.crumbs': 'Breadcrumb',
      'material.published': 'Published {date}',
      'material.pdf': 'Open PDF',
      'material.pdfNote': 'The PDF is in Romanian.',
      'material.related': 'From the same topic',
      'material.allGrade': 'All materials for {grade}',
      'material.notfound': 'This material is not in the list. Go back to the home page.',
      'material.fallback': 'This material is not translated into English yet. You can read the Romanian version below.',
      'material.pdfOnly': 'This material is only available as a PDF.',
      'material.video': 'Lesson video',
      'material.openYoutube': 'Open the video on YouTube',
      'material.readRomanian': 'Read the Romanian version',
      'seo.home.title': 'Math materials for grades 5–12 | Laura Miron',
      'seo.home.description': 'Free math materials for grades 5–12: theory, worksheets, tests and games, by teacher Laura Miron.',
      'seo.grade.title': 'Math materials for {grade} | Laura Miron',
      'seo.grade.description': 'All math materials for {grade}: theory, worksheets, tests and games, by teacher Laura Miron.',
      'seo.grade.intro': 'Theory, worksheets, tests and games for {grade}, grouped by topic and school year.',
      'search.label': 'Search materials',
      'search.placeholder': 'Search: absolute value, worksheet…',
      'search.open': 'Search',
      'search.submit': 'Search',
      'search.all': 'See all results ({n})',
      'search.title': 'Search materials',
      'search.grade': 'Grade',
      'search.allGrades': 'All grades',
      'search.count.one': '1 result',
      'search.count.few': '{n} results',
      'search.count.many': '{n} results',
      'search.none': 'No material matches. Try fewer words or check the spelling.',
      'search.empty': 'Type a word, for example “fractions” or “worksheet”.',
      'error.load': 'The list of materials did not load. Check your internet connection and reload the page.',
      'footer.text': 'Free materials for students.',
    },
  };

  const STORAGE_KEY = 'matematica.lang';
  let current = null;

  // The page language comes from <html lang>: Romanian and English live on
  // separate URLs, so Google sees each language. localStorage is only a fallback.
  function getLang() {
    if (typeof document !== 'undefined') {
      const htmlLang = document.documentElement && document.documentElement.lang;
      if (htmlLang === 'en' || htmlLang === 'ro') return htmlLang;
    }
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
