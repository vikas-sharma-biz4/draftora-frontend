/**
 * i18n Configuration
 *
 * Configuration for next-intl internationalization.
 * Defines supported locales, default locale, and namespace configuration.
 */

export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};
