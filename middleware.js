// Vercel Edge Middleware — rate limiting for API routes
// Limits each IP to 60 requests per minute on /api/* endpoints

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.start > WINDOW_MS) store.delete(key);
  }
}

export default function middleware(request) {
  const url = new URL(request.url);

  // Only rate-limit API routes
  if (!url.pathname.startsWith('/api/')) return;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const now = Date.now();
  const key = `${ip}`;

  // Periodic cleanup
  if (store.size > 10000) cleanup();

  let entry = store.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { count: 0, start: now };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((entry.start + WINDOW_MS - now) / 1000)),
        },
      }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
