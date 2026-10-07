// Canonical Persian number parsing (shared by client, server fallback parser,
// and the Gemini system instruction). Pure: no DOM, no network.
// All amounts returned as INTEGER Toman.

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const WORD_NUMBERS: Record<string, number> = {
  // 0-10
  'صفر': 0,
  'یک': 1, 'يک': 1, 'یه': 1, 'یدونه': 1, 'یدونه‌ای': 1,
  'دو': 2, 'سه': 3, 'چهار': 4, 'چار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6,
  'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  // 11-19
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15,
  'پونزده': 15, 'شانزده': 16, 'شونزده': 16, 'هفده': 17, 'هیجده': 18, 'هیژده': 18,
  'نوزده': 19,
  // tens
  'بیست': 20, 'سی': 30, 'چهل': 40, 'چل': 40, 'پنجاه': 50, 'شصت': 60,
  'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  // hundreds
  'صد': 100, 'یکصد': 100, 'دویست': 200, 'دوصد': 200, 'سیصد': 300,
  'چهارصد': 400, 'پانصد': 500, 'پونصد': 500, 'ششصد': 600, 'هفتصد': 700,
  'هشتصد': 800, 'نهصد': 900,
};

/** Normalize Persian/Arabic digits and letters to a canonical ASCII form. */
export function normalizePersianText(input: string): string {
  let s = input;
  s = s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  // Arabic letter variants -> Persian
  s = s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه');
  // Thousands separators inside numbers (۱۲٬۵۰۰ / 1,200,000)
  s = s.replace(/(\d)[٬،,](?=\d)/g, '$1');
  return s.toLowerCase();
}

/** Parse a compound word-number like "دویست و پنجاه" -> 250. Returns null if no words known. */
export function parseWordNumber(token: string): number | null {
  const parts = token.split(/[\s\u200c]+و[\s\u200c]+|[\s\u200c]+/).filter(Boolean);
  let total = 0;
  let matched = 0;
  for (const p of parts) {
    if (p === 'و') continue; // lone conjunction inside ZWNJ-joined compounds
    const v = WORD_NUMBERS[p];
    if (v === undefined) return null;
    total += v;
    matched++;
  }
  return matched > 0 ? total : null;
}

export interface ExtractedAmount {
  /** Value in integer Toman. */
  value: number;
  /** Start index of the match in the normalized text. */
  index: number;
}

const UNIT_MULTIPLIERS: Record<string, number> = {
  'میلیارد': 1_000_000_000,
  'میلیون': 1_000_000,
  'ملیون': 1_000_000,
  'هزار': 1_000,
};

/**
 * Extract ALL money-marked amounts from text, in order of appearance.
 * A candidate needs a money marker (\u062a\u0648\u0645\u0646/\u062a\u0648\u0645\u0627\u0646 or \u0647\u0632\u0627\u0631/\u0645\u06cc\u0644\u06cc\u0648\u0646/\u0645\u06cc\u0644\u06cc\u0627\u0631\u062f) so that
 * quantities like "3 \u0641\u06cc\u0644\u062a\u0631" are never mistaken for money.
 */
export function extractTomanAmounts(text: string): ExtractedAmount[] {
  const normalized = normalizePersianText(text);
  // Word-number alternative, longest-first (so "\u062f\u0648\u0627\u0632\u062f\u0647" wins over "\u062f\u0648").
  const wordAlts = Object.keys(WORD_NUMBERS)
    .sort((a, b) => b.length - a.length)
    .join('|');
  // Capture group 1 = the raw number token (digits or greedy word compound).
  // Unit words (\u0647\u0632\u0627\u0631/\u0645\u06cc\u0644\u06cc\u0648\u0646/...) are NOT word-numbers, so a
  // multi-unit compound ("\u06cc\u06a9 \u0645\u06cc\u0644\u06cc\u0648\u0646 \u0648 \u062f\u0648\u06cc\u0633\u062a \u0647\u0632\u0627\u0631")
  // yields two matches combined by the merge step below.
  const wordSeq = '(?:' + wordAlts + ')(?:[\\s\\u200c]+\u0648[\\s\\u200c]+(?:' + wordAlts + ')|[\\s\\u200c]+(?:' + wordAlts + '))*';
  const numToken = '(\\d+(?:\\.\\d+)?|' + wordSeq + ')';
  const re = new RegExp(
    '(?:' + numToken + ')?\\s*(\u0648\\s*\u0646\u06cc\u0645|\u0646\u06cc\u0645)?\\s*(\u0645\u06cc\u0644\u06cc\u0627\u0631\u062f|\u0645\u06cc\u0644\u06cc\u0648\u0646|\u0645\u0644\u06cc\u0648\u0646|\u0647\u0632\u0627\u0631)?\\s*(\u062a\u0648\u0645\u0627\u0646\u06cc?|\u062a\u0648\u0645\u0646)?',
    'g',
  );
  const found: Array<{ value: number; index: number; end: number; unit?: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    if (m[0] === '') {
      // Avoid infinite loop on empty match (exec does not advance lastIndex).
      re.lastIndex++;
      continue;
    }
    if (m[0].trim() === '') {
      // Whitespace-only match: exec already advanced lastIndex; just skip it.
      continue;
    }
    const rawNum: string | undefined = m[1];
    const half: string | undefined = m[2];
    const unit: string | undefined = m[3];
    const toman: string | undefined = m[4];

    // Require at least one money marker (unit or \u062a\u0648\u0645\u0646) or a \u0646\u06cc\u0645-amount.
    if (!unit && !toman && !half) continue;

    let base: number | null = null;
    if (rawNum !== undefined && rawNum !== '') {
      if (/^\d/.test(rawNum)) {
        base = parseFloat(rawNum);
      } else {
        base = parseWordNumber(rawNum);
      }
    } else if (half) {
      base = 0; // bare "\u0646\u06cc\u0645 \u0645\u06cc\u0644\u06cc\u0648\u0646" = 0.5 million (0 + 0.5 below)
    }
    if (base === null || Number.isNaN(base)) continue;

    if (half) base += 0.5;

    let value: number;
    if (unit) {
      value = Math.round(base * UNIT_MULTIPLIERS[unit]);
    } else if (toman) {
      // Casual speech: bare small numbers with \u062a\u0648\u0645\u0646 (value < 1000,
      // no explicit unit) imply x1000: "580 \u062a\u0648\u0645\u0646" = 580_000.
      value = base < 1000 ? Math.round(base * 1000) : Math.round(base);
    } else {
      continue;
    }
    found.push({ value, index: m.index, end: m.index + m[0].length, unit });
  }

  // Merge multi-unit compounds: "<million> \u0648 <thousand>" (joined ONLY by \u0648,
  // e.g. "\u06cc\u06a9 \u0645\u06cc\u0644\u06cc\u0648\u0646 \u0648 \u062f\u0648\u06cc\u0633\u062a \u0647\u0632\u0627\u0631" = 1_200_000).
  // A longer gap ("\u0634\u062f \u06a9\u0647 ... \u0645\u0648\u0646\u062f") means separate amounts (total vs debt).
  const out: ExtractedAmount[] = [];
  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const nxt = found[i + 1];
    if (
      nxt &&
      (cur.unit === '\u0645\u06cc\u0644\u06cc\u0648\u0646' || cur.unit === '\u0645\u0644\u06cc\u0648\u0646' || cur.unit === '\u0645\u06cc\u0644\u06cc\u0627\u0631\u062f') &&
      nxt.unit === '\u0647\u0632\u0627\u0631' &&
      /^\s*\u0648\s*$/.test(normalized.slice(cur.end, nxt.index))
    ) {
      out.push({ value: cur.value + nxt.value, index: cur.index });
      i++; // consume the thousand part
    } else {
      out.push({ value: cur.value, index: cur.index });
    }
  }
  return out;
}

/** First money amount in text (usually the invoice total), or 0 if none found. */
export function parsePersianAmount(text: string): number {
  const all = extractTomanAmounts(text);
  return all.length > 0 ? all[0].value : 0;
}
