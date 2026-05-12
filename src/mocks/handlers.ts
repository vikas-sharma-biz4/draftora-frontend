/**
 * MSW (Mock Service Worker) request handlers
 *
 * Install MSW to activate: npm install --save-dev msw
 * Then initialise the service worker: npx msw init public/
 *
 * Usage in tests:
 *   import { server } from '@/mocks/server';
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * Add handlers below when ready:
 *   import { http, HttpResponse } from 'msw';
 *   export const handlers = [
 *     http.get('/api/clients', () => HttpResponse.json({ success: true, data: [] })),
 *   ];
 */

export const handlers: unknown[] = [];
