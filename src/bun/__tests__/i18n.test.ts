import { describe, test, expect } from 'bun:test';
import enUS from '../../mainview/locales/en-US.json';
import enGB from '../../mainview/locales/en-GB.json';
import enCA from '../../mainview/locales/en-CA.json';
import enAU from '../../mainview/locales/en-AU.json';
import zhTW from '../../mainview/locales/zh-TW.json';

const locales = { 'en-US': enUS, 'en-GB': enGB, 'en-CA': enCA, 'en-AU': enAU, 'zh-TW': zhTW };

function findTransTags(obj: Record<string, any>, prefix = ''): string[] {
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
