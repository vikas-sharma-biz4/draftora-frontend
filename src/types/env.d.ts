/// <reference types="next" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_DEFAULT_AI_MODEL?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}
