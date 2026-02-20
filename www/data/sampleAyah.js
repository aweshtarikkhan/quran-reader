const sampleAyat = [
  {
    surah: "Al-Fatihah",
    ayah: 1,
    arabic: "بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ",
    english: "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
    urdu: "اللہ کے نام سے شروع جو نہایت مہربان، رحم فرمانے والا ہے۔"
  },
  {
    surah: "Al-Fatihah",
    ayah: 2,
    arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    english: "All praise is due to Allah, Lord of the worlds.",
    urdu: "سب تعریف اللہ ہی کے لیے ہے جو تمام جہانوں کا پالنے والا ہے۔"
  },
  {
    surah: "Al-Fatihah",
    ayah: 3,
    arabic: "الرَّحْمَـٰنِ الرَّحِيمِ",
    english: "The Entirely Merciful, the Especially Merciful.",
    urdu: "نہایت مہربان، رحم فرمانے والا۔"
  },
  {
    surah: "Al-Fatihah",
    ayah: 4,
    arabic: "مَالِكِ يَوْمِ الدِّينِ",
    english: "Sovereign of the Day of Recompense.",
    urdu: "بدلے کے دن کا مالک۔"
  },
  {
    surah: "Al-Fatihah",
    ayah: 5,
    arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    english: "It is You we worship and You we ask for help.",
    urdu: "ہم تیری ہی عبادت کرتے ہیں اور تجھ ہی سے مدد چاہتے ہیں۔"
  }
];

function makeMockMushafPages(totalPages = 604) {
  const pages = [];
  for (let p = 1; p <= totalPages; p += 1) {
    const lines = [];
    for (let i = 1; i <= 15; i += 1) {
      lines.push(`Page ${p}, line ${i} - Arabic text placeholder for 15-line Mushaf.`);
    }
    pages.push({ page: p, lines });
  }
  return pages;
}

const mushafPages = makeMockMushafPages(604);
