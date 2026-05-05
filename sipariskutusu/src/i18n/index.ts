import { tr } from './tr';
import { en } from './en';
import type { Translations } from './tr';

export type SupportedLocale = 'tr' | 'en';

function detectLocale(): SupportedLocale {
  // The current UI is Turkish-first. Returning Turkish here prevents mixed
  // English tab labels while the rest of the app copy is still Turkish.
  return 'tr';
}

const TRANSLATIONS: Record<SupportedLocale, Translations> = { tr, en };

/** Current locale detected at app startup */
export const locale: SupportedLocale = detectLocale();

/** Translations object for the current device locale */
export const t: Translations = TRANSLATIONS[locale];

/** Override locale at runtime (takes effect on next component render cycle) */
let _overrideLocale: SupportedLocale | null = null;

export function setLocale(newLocale: SupportedLocale): void {
  _overrideLocale = newLocale;
}

/** Get translations for the effective locale (override or detected) */
export function getT(): Translations {
  return TRANSLATIONS[_overrideLocale ?? locale];
}

export { tr, en };
export type { Translations };
