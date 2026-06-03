// Fail fast at build time if required env vars are missing.
// Prevents a silent runtime failure where every API call goes to "undefined".
const REQUIRED_ENV_VARS = ["NEXT_PUBLIC_API_URL"];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(
      `[FATAL] Missing required environment variable: ${key}. ` +
        "Add it to your .env file before building."
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules", "**/.git", "**/.next"],
      };
    }

    // Disable webpack cache to prevent module resolution errors
    config.cache = false;

    return config;
  },
};

export default nextConfig;
