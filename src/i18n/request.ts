/**
 * i18n Request Configuration
 *
 * Configuration for next-intl request handling in App Router.
 * Defines how messages are loaded and locale is determined from the request.
 */

import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './config';
import type { Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = (await requestLocale) as Locale;

  // Ensure that a valid locale is used
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
