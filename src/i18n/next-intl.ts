/**
 * Next-intl configuration for Next.js App Router
 *
 * This file configures next-intl to work with the App Router.
 * It should be imported in next.config.js.
 */

const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js config
};

module.exports = withNextIntl(nextConfig);
