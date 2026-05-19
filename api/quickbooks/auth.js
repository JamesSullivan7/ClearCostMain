// Consolidated QuickBooks Auth API — single serverless function
// Routes by ?action= query parameter:
//   GET  ?action=connect    — Initiate OAuth flow (redirects to Intuit)
//   GET  ?action=callback   — OAuth callback (receives code from Intuit)
//   POST ?action=disconnect — Revoke tokens and clean up
//   GET  ?action=status     — Check connection status

const crypto = require('crypto');
const { kv } = require('@vercel/kv');
const { authenticate } = require('../_lib/auth');
const {
  CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, AUTH_URL, TOKEN_URL, REVOKE_URL,
  kvState, kvTokens, kvLastSync, kvIdMap,
  storeTokens, getStoredTokens, getQBClient, qbPromise, getLastSync,
} = require('../_lib/quickbooks-client');

const SITE_URL = (process.env.SITE_URL || '').trim();

function setCors(res) {
  if (SITE_URL) {
    res.setHeader('Access-Control-Allow-Origin', SITE_URL);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

module.exports = async (req, res) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }

  setCors(res);
  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'connect':
      return handleConnect(req, res);
    case 'callback':
      return handleCallback(req, res);
    case 'disconnect':
      return handleDisconnect(req, res);
    case 'status':
      return handleStatus(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};

// ── connect ────────────────────────────────────────────

async function handleConnect(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { businessId } = await authenticate(req);

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    await kv.set(kvState(businessId), state, { ex: 600 }); // 10-minute TTL

    // Store the bizId keyed by state so callback can retrieve it
    await kv.set(`qb:state:${state}:bizId`, businessId, { ex: 600 });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    });

    const authUrl = `${AUTH_URL}?${params.toString()}`;
    res.redirect(302, authUrl);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Connect error:', error.message);
    res.status(500).json({ error: 'Failed to initiate QuickBooks connection' });
  }
}

// ── callback ───────────────────────────────────────────

async function handleCallback(req, res) {
  const { code, state, realmId } = req.query;

  if (!code || !state || !realmId) {
    return res.redirect('/#settings?qbo=error&msg=missing_params');
  }

  try {
    // Retrieve the businessId stashed during connect
    const businessId = await kv.get(`qb:state:${state}:bizId`);
    if (!businessId) {
      return res.redirect('/#settings?qbo=error&msg=state_mismatch');
    }

    // Verify CSRF state
    const storedState = await kv.get(kvState(businessId));
    if (state !== storedState) {
      return res.redirect('/#settings?qbo=error&msg=state_mismatch');
    }

    // Clean up state keys
    await kv.del(kvState(businessId));
    await kv.del(`qb:state:${state}:bizId`);

    // Exchange auth code for tokens
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.redirect('/#settings?qbo=error&msg=token_exchange_failed');
    }

    const tokens = await tokenRes.json();

    // Store tokens
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
      realm_id: realmId,
      company_name: '', // will be fetched below
    };

    // Try to get company name
    try {
      await storeTokens(businessId, tokenData);
      const qbo = await getQBClient(businessId);
      const companyInfo = await qbPromise(qbo, 'getCompanyInfo', realmId);
      tokenData.company_name = companyInfo.CompanyName || 'QuickBooks Company';
      await storeTokens(businessId, tokenData);
    } catch (e) {
      // Non-critical, company name can be empty
      console.warn('Failed to fetch company name:', e.message);
      await storeTokens(businessId, tokenData);
    }

    // Redirect back to app settings
    res.redirect('/#settings?qbo=connected');
  } catch (error) {
    console.error('Callback error:', error.message);
    res.redirect('/#settings?qbo=error&msg=callback_failed');
  }
}

// ── disconnect ─────────────────────────────────────────

async function handleDisconnect(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { businessId } = await authenticate(req);
    const tokens = await getStoredTokens(businessId);

    // Revoke token with Intuit
    if (tokens?.refresh_token) {
      try {
        const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        await fetch(REVOKE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${basicAuth}`,
          },
          body: JSON.stringify({ token: tokens.refresh_token }),
        });
      } catch (e) {
        console.warn('Token revocation warning:', e.message);
      }
    }

    // Clean up KV
    await kv.del(kvTokens(businessId));
    await kv.del(kvLastSync(businessId));
    await kv.del(kvIdMap(businessId));

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Disconnect error:', error.message);
    return res.status(500).json({ error: 'Failed to disconnect' });
  }
}

// ── status ─────────────────────────────────────────────

async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { businessId } = await authenticate(req);
    const tokens = await getStoredTokens(businessId);

    if (!tokens) {
      return res.status(200).json({
        connected: false,
        company_name: null,
        realm_id: null,
        last_sync: null,
      });
    }

    const lastSyncProducts = await getLastSync(businessId, 'products');
    const lastSyncSuppliers = await getLastSync(businessId, 'suppliers');
    const lastSyncExpenses = await getLastSync(businessId, 'expenses');

    return res.status(200).json({
      connected: true,
      company_name: tokens.company_name || 'QuickBooks Company',
      realm_id: tokens.realm_id,
      token_valid: Date.now() < (tokens.expires_at || 0),
      last_sync: {
        products: lastSyncProducts,
        suppliers: lastSyncSuppliers,
        expenses: lastSyncExpenses,
      },
    });
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Status error:', error.message);
    return res.status(500).json({ error: 'Failed to check status' });
  }
}
