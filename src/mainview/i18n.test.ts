import { describe, expect, test } from 'bun:test';

import enAU from './locales/en-AU.json';
import enCA from './locales/en-CA.json';
import enGB from './locales/en-GB.json';
import enUS from './locales/en-US.json';
import zhTW from './locales/zh-TW.json';

const locales = { 'en-US': enUS, 'en-GB': enGB, 'en-CA': enCA, 'en-AU': enAU, 'zh-TW': zhTW };

type LocaleValue = string | { [key: string]: LocaleValue };
type Locale = { [key: string]: LocaleValue };

function findTransTags(obj: Locale, prefix = ''): string[] {
  const bad: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' && /<[0-9]+>/.test(value)) {
      bad.push(`${fullKey}: "${value}"`);
    } else if (typeof value === 'object' && value !== null) {
      bad.push(...findTransTags(value, fullKey));
    }
  }
  return bad;
}

describe('i18n locale strings', () => {
  for (const [lang, strings] of Object.entries(locales)) {
    test(`${lang} must not contain raw <N> Trans tags`, () => {
      const bad = findTransTags(strings);
      expect(bad).toEqual([]);
    });
  }
});
