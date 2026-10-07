const BASE_URL = 'https://api.katameros.app';
const LANGUAGE_ID = 3;

export interface KatamerosVerse {
  id: number;
  bibleId: number;
  bookId: number;
  chapter: number;
  number: number;
  text: string;
}

export interface KatamerosPassage {
  bookId: number;
  bookTranslation: string;
  chapter: number;
  ref: string;
  verses: KatamerosVerse[];
}

export interface KatamerosReading {
  id: number;
  title: string | null;
  introduction: string | null;
  conclusion: string | null;
  passages: KatamerosPassage[] | null;
  html?: string | null;
}

export interface KatamerosSubSection {
  id: number;
  title: string;
  introduction: string | null;
  readings: KatamerosReading[];
}

export interface KatamerosSection {
  id: number;
  title: string;
  introduction?: string;
  subSections: KatamerosSubSection[];
  readings?: KatamerosReading[];
}

export interface KatamerosResponse {
  title: string | null;
  periodInfo: string | null;
  bible: any;
  bibles: any[];
  sections: KatamerosSection[];
  copticDate: string;
}

export interface ProcessedReading {
  title: string;
  passage: string;
  text: string;
}

export interface SynaxariumItem {
  title: string;
  html: string;
}

export interface DailyReadingsResult {
  date: string;
  copticDate: string;
  bibleVerse: string;
  gospelOfTheDay: string;
  synaxarium: SynaxariumItem[];
  readings: ProcessedReading[];
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function getTodayDateString(): string {
  const d = new Date();
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function getVerseText(passages: KatamerosPassage[] | null): string {
  if (!passages || !passages[0]?.verses) return '';
  return passages[0].verses.map(v => v.text).join(' ');
}

function getPassageRef(passages: KatamerosPassage[] | null): string {
  if (!passages || !passages[0]) return '';
  const p = passages[0];
  return p.ref ? `${p.bookTranslation || ''} ${p.ref}`.trim() : '';
}

function getReadings(section: KatamerosSection | undefined): ProcessedReading[] {
  const result: ProcessedReading[] = [];
  if (!section?.subSections) return result;
  for (const sub of section.subSections) {
    if (sub.title === 'السنكسار') continue;
    if (!sub.readings) continue;
    for (const r of sub.readings) {
      if (r.title || r.passages) {
        result.push({
          title: r.title || sub.title || section.title,
          passage: getPassageRef(r.passages),
          text: getVerseText(r.passages),
        });
      }
    }
  }
  return result;
}

export async function fetchDailyReadings(
  dateString?: string
): Promise<DailyReadingsResult> {
  const date = dateString || getTodayDateString();
  const url = `${BASE_URL}/readings/gregorian/${date}?languageId=${LANGUAGE_ID}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`فشل جلب القراءات: ${res.status} ${res.statusText}`);
  }

  const data: KatamerosResponse = await res.json();
  const sections = data.sections || [];
  const copticDate = data.copticDate || '';

  function findSection(title: string) {
    return sections.find(s => s.title === title);
  }

  const vespersSection = findSection('العشية');
  const matinsSection = findSection('باكر');
  const liturgySection = findSection('قداس');
  const liturgyPsalmGospel = sections.find(s => s.id === 1 && !s.title);

  const matinsReadings = getReadings(matinsSection);
  const liturgyReadings = getReadings(liturgySection);
  const allReadings = [...matinsReadings, ...liturgyReadings];

  const synaxarium: SynaxariumItem[] = [];
  for (const section of sections) {
    const synaxSub = section.subSections?.find(s => s.title === 'السنكسار');
    if (synaxSub?.readings) {
      for (const r of synaxSub.readings) {
        synaxarium.push({ title: r.title || '', html: r.html || '' });
      }
    }
  }

  let bibleVerse = '';
  let gospelOfTheDay = '';
  if (matinsSection?.subSections) {
    for (const sub of matinsSection.subSections) {
      for (const r of sub.readings || []) {
        if (r.passages && r.passages.length > 0) {
          bibleVerse = getVerseText(r.passages);
          gospelOfTheDay = getPassageRef(r.passages);
          break;
        }
      }
      if (bibleVerse) break;
    }
  }

  if (!bibleVerse && liturgyPsalmGospel?.subSections) {
    for (const sub of liturgyPsalmGospel.subSections) {
      for (const r of sub.readings || []) {
        if (r.passages && r.passages.length > 0) {
          bibleVerse = getVerseText(r.passages);
          gospelOfTheDay = getPassageRef(r.passages);
          break;
        }
      }
      if (bibleVerse) break;
    }
  }

  return {
    date,
    copticDate,
    bibleVerse,
    gospelOfTheDay,
    synaxarium,
    readings: allReadings,
  };
}
