// Shared QuickBooks API client configuration and token management
// Used by all /api/quickbooks/* serverless functions

const QuickBooks = require('node-quickbooks');
const { kv } = require('@vercel/kv');

const QBO_ENV = process.env.QUICKBOOKS_ENV || 'sandbox';
const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI;

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

// KV key helpers — scoped per business
function kvTokens(bizId) { return 'qb:' + bizId + ':tokens'; }
function kvState(bizId) { return 'qb:' + bizId + ':oauth_state'; }
function kvLastSync(bizId) { return 'qb:' + bizId + ':last_sync'; }
function kvIdMap(bizId) { return 'qb:' + bizId + ':id_map'; }

/**
 * Get stored tokens from KV
 */
async function getStoredTokens(bizId) {
  const raw = await kv.get(kvTokens(bizId));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/**
 * Store tokens in KV
 */
async function storeTokens(bizId, tokens) {
  await kv.set(kvTokens(bizId), JSON.stringify(tokens));
}

/**
 * Ensure access token is valid, refresh if expired
 * Returns { access_token, realm_id } or throws
 */
async function ensureValidToken(bizId) {
  const tokens = await getStoredTokens(bizId);
  if (!tokens) throw new Error('QuickBooks not connected');

  const now = Date.now();
  const expiresAt = tokens.expires_at || 0;

  // Refresh if token expires within 5 minutes
  if (now > expiresAt - 300000) {
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Token refresh failed: ${err.error || response.statusText}`);
    }

    const newTokens = await response.json();

    // CRITICAL: Always save the new refresh_token (rotates daily)
    const updated = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: now + (newTokens.expires_in * 1000),
      realm_id: tokens.realm_id,
      company_name: tokens.company_name,
    };
    await storeTokens(bizId, updated);

    return { access_token: updated.access_token, realm_id: updated.realm_id };
  }

  return { access_token: tokens.access_token, realm_id: tokens.realm_id };
}

/**
 * Get a configured QuickBooks API client with valid token
 */
async function getQBClient(bizId) {
  const { access_token, realm_id } = await ensureValidToken(bizId);
  const useSandbox = QBO_ENV === 'sandbox';

  const qbo = new QuickBooks(
    CLIENT_ID,
    CLIENT_SECRET,
    access_token,
    false,        // no token secret (OAuth 2)
    realm_id,
    useSandbox,
    false,        // debug
    null,         // minor version
    '2.0',        // OAuth version
    access_token  // refresh token (not used directly, we handle refresh ourselves)
  );

  return qbo;
}

/**
 * Promisify a QuickBooks callback-style method
 */
function qbPromise(qbo, method, ...args) {
  return new Promise((resolve, reject) => {
    qbo[method](...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Store an ID mapping (local ID → QBO ID)
 */
async function setIdMapping(bizId, entityType, localId, qboId) {
  await kv.hset(kvIdMap(bizId), `${entityType}:${localId}`, String(qboId));
}

/**
 * Get a QBO ID from a local ID
 */
async function getQboId(bizId, entityType, localId) {
  const id = await kv.hget(kvIdMap(bizId), `${entityType}:${localId}`);
  return id ? String(id) : null;
}

/**
 * Set last sync timestamp
 */
async function setLastSync(bizId, type) {
  await kv.hset(kvLastSync(bizId), type, new Date().toISOString());
}

/**
 * Get last sync timestamp
 */
async function getLastSync(bizId, type) {
  return await kv.hget(kvLastSync(bizId), type);
}

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  QBO_ENV,
  AUTH_URL,
  TOKEN_URL,
  REVOKE_URL,
  kvTokens,
  kvState,
  kvLastSync,
  kvIdMap,
  getStoredTokens,
  storeTokens,
  ensureValidToken,
  getQBClient,
  qbPromise,
  setIdMapping,
  getQboId,
  setLastSync,
  getLastSync,
};
