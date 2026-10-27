import { ca } from './i18n/ca';
import { en, type Messages } from './i18n/en';
import { es } from './i18n/es';
import { eu } from './i18n/eu';

/** Supported locales, with each one's name in its own language for the picker. */
export const LOCALES = { en: 'English', es: 'Español', ca: 'Català', eu: 'Euskara' } as const;
export type Locale = keyof typeof LOCALES;

const MESSAGES: Record<Locale, Messages> = { en, es, ca, eu };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && Object.hasOwn(LOCALES, v);
}

/** The first of the browser's preferred languages we have text for; English otherwise. */
export function browserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

class I18n {
  locale = $state<Locale>('en');
}

export const i18n = new I18n();

/** UI text in the current locale. Reading it in a template, $derived or $effect tracks locale changes. */
export const t: Messages = new Proxy({} as Messages, {
  get: (_, key) => MESSAGES[i18n.locale][key as keyof Messages],
});
