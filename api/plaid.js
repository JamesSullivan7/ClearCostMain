// Consolidated Plaid API — single serverless function
// Routes by ?action= query parameter:
//   POST ?action=link-token  — Create Plaid Link token
//   POST ?action=exchange    — Exchange public token for access token
//   POST ?action=sync        — Sync transactions for an item
//   GET  ?action=accounts    — List linked bank accounts
//   POST ?action=remove      — Unlink a bank account

const { plaidClient } = require('./_lib/plaid-client');
const { Products, CountryCode } = require('plaid');
const { kv } = require('@vercel/kv');
const { authenticate } = require('./_lib/auth');

module.exports = async (req, res) => {
  const SITE_URL = process.env.SITE_URL || 'https://clearcostinventory.com';
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let userId, businessId;
  try {
    const auth = await authenticate(req);
    userId = auth.userId;
    businessId = auth.businessId;
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'link-token':
      return handleLinkToken(req, res, businessId);
    case 'exchange':
      return handleExchange(req, res, businessId);
    case 'sync':
      return handleSync(req, res, businessId);
    case 'accounts':
      return handleAccounts(req, res, businessId);
    case 'remove':
      return handleRemove(req, res, businessId);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};

// ── link-token ─────────────────────────────────────────

async function handleLinkToken(req, res, businessId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: businessId },
      client_name: 'ClearCost',
      products: [Products.Transactions],
      language: 'en',
      country_codes: [CountryCode.Us],
    });

    return res.status(200).json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error) {
    console.error('Link token error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to create link token',
      detail: error.response?.data?.error_message || error.message,
    });
  }
}

// ── exchange ───────────────────────────────────────────

async function handleExchange(req, res, businessId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { public_token } = req.body;
  if (!public_token) {
    return res.status(400).json({ error: 'Missing public_token' });
  }

  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = response.data;

    // Store access token in KV (never expose to client)
    await kv.set(`plaid:${businessId}:access_token:${item_id}`, access_token);

    // Track this item in the linked items set
    await kv.sadd(`plaid:${businessId}:linked_items`, item_id);

    // Get institution info for display
    const itemResponse = await plaidClient.itemGet({ access_token });
    const institutionId = itemResponse.data.item.institution_id;

    let institutionName = 'Unknown Bank';
    if (institutionId) {
      try {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: ['US'],
        });
        institutionName = instResponse.data.institution.name;
      } catch (e) {
        // Non-critical, continue with unknown
      }
    }

    // Store institution info
    await kv.set(`plaid:${businessId}:institution:${item_id}`, JSON.stringify({
      institution_id: institutionId,
      institution_name: institutionName,
      linked_at: new Date().toISOString(),
    }));

    return res.status(200).json({
      item_id,
      institution_id: institutionId,
      institution_name: institutionName,
    });
  } catch (error) {
    console.error('Exchange error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to exchange token',
      detail: error.response?.data?.error_message || error.message,
    });
  }
}

// ── sync ───────────────────────────────────────────────

// Map Plaid category to app category
function mapCategory(plaidCategory) {
  if (!plaidCategory) return 'other';
  const primary = plaidCategory.primary || '';
  const map = {
    'FOOD_AND_DRINK': 'materials',
    'RENT_AND_UTILITIES': 'utilities',
    'INSURANCE': 'insurance',
    'TRANSPORTATION': 'shipping',
    'GENERAL_MERCHANDISE': 'packaging',
    'GENERAL_SERVICES': 'subscription',
    'INCOME': 'sale',
    'TRANSFER_IN': 'sale',
    'LOAN_PAYMENTS': 'other',
    'ENTERTAINMENT': 'marketing',
    'PERSONAL_CARE': 'other',
    'GOVERNMENT_AND_NON_PROFIT': 'other',
    'HOME_IMPROVEMENT': 'equipment',
    'MEDICAL': 'insurance',
    'TRAVEL': 'shipping',
    'BANK_FEES': 'other',
  };
  return map[primary] || 'other';
}

// Map a Plaid transaction to our app's transaction schema
function mapTransaction(plaidTxn) {
  const isIncome = plaidTxn.amount < 0; // Plaid: negative = income
  const category = mapCategory(plaidTxn.personal_finance_category);

  return {
    date: plaidTxn.date,
    description: plaidTxn.merchant_name || plaidTxn.name || 'Unknown',
    amount: Math.abs(plaidTxn.amount),
    type: isIncome ? 'income' : 'expense',
    category: isIncome ? 'sale' : category,
    source: 'plaid',
    externalId: plaidTxn.transaction_id,
    metadata: {
      account_id: plaidTxn.account_id,
      pending: plaidTxn.pending || false,
      merchant_name: plaidTxn.merchant_name,
      payment_channel: plaidTxn.payment_channel,
      plaid_category: plaidTxn.personal_finance_category,
      original_name: plaidTxn.name,
    },
  };
}

async function handleSync(req, res, businessId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { item_id } = req.body;
  if (!item_id) {
    return res.status(400).json({ error: 'Missing item_id' });
  }

  try {
    // Get access token from KV
    const access_token = await kv.get(`plaid:${businessId}:access_token:${item_id}`);
    if (!access_token) {
      return res.status(404).json({ error: 'Item not found. Please re-link your account.' });
    }

    // Get last cursor (null for first sync)
    let cursor = await kv.get(`plaid:${businessId}:cursor:${item_id}`) || undefined;

    const allAdded = [];
    const allModified = [];
    const allRemoved = [];
    let hasMore = true;

    // Paginate through all updates
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token,
        cursor,
      });

      const data = response.data;

      // Map transactions to our schema
      allAdded.push(...data.added.map(mapTransaction));
      allModified.push(...data.modified.map(mapTransaction));
      allRemoved.push(...data.removed.map(r => r.transaction_id));

      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    // Save new cursor for next sync
    if (cursor) {
      await kv.set(`plaid:${businessId}:cursor:${item_id}`, cursor);
    }

    // Save last sync timestamp
    await kv.set(`plaid:${businessId}:last_sync:${item_id}`, new Date().toISOString());

    return res.status(200).json({
      added: allAdded,
      modified: allModified,
      removed: allRemoved,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to sync transactions',
      detail: error.response?.data?.error_message || error.message,
    });
  }
}

// ── accounts ───────────────────────────────────────────

async function handleAccounts(req, res, businessId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all linked item IDs
    const itemIds = await kv.smembers(`plaid:${businessId}:linked_items`);
    if (!itemIds || itemIds.length === 0) {
      return res.status(200).json({ accounts: [] });
    }

    const allAccounts = [];

    for (const itemId of itemIds) {
      const accessToken = await kv.get(`plaid:${businessId}:access_token:${itemId}`);
      if (!accessToken) continue;

      // Get institution info from cache
      const instInfoRaw = await kv.get(`plaid:${businessId}:institution:${itemId}`);
      const instInfo = typeof instInfoRaw === 'string' ? JSON.parse(instInfoRaw) : instInfoRaw || {};

      // Get last sync time
      const lastSync = await kv.get(`plaid:${businessId}:last_sync:${itemId}`);

      try {
        // Get accounts from Plaid
        const response = await plaidClient.accountsGet({ access_token: accessToken });
        const accounts = response.data.accounts.map(acct => ({
          account_id: acct.account_id,
          item_id: itemId,
          name: acct.name,
          official_name: acct.official_name,
          type: acct.type,
          subtype: acct.subtype,
          mask: acct.mask,
          balance: acct.balances?.current,
          currency: acct.balances?.iso_currency_code || 'USD',
          institution_name: instInfo.institution_name || 'Unknown',
          institution_id: instInfo.institution_id,
          linked_at: instInfo.linked_at,
          last_sync: lastSync,
        }));
        allAccounts.push(...accounts);
      } catch (err) {
        // If item is invalid, still include it with error state
        allAccounts.push({
          item_id: itemId,
          name: instInfo.institution_name || 'Unknown Account',
          type: 'unknown',
          error: err.response?.data?.error_code || 'ITEM_ERROR',
          institution_name: instInfo.institution_name || 'Unknown',
          linked_at: instInfo.linked_at,
          last_sync: lastSync,
        });
      }
    }

    return res.status(200).json({ accounts: allAccounts });
  } catch (error) {
    console.error('Accounts error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch accounts',
      detail: error.message,
    });
  }
}

// ── remove ─────────────────────────────────────────────

async function handleRemove(req, res, businessId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { item_id } = req.body;
  if (!item_id) {
    return res.status(400).json({ error: 'Missing item_id' });
  }

  try {
    // Get access token
    const accessToken = await kv.get(`plaid:${businessId}:access_token:${item_id}`);

    // Remove from Plaid (if we have a valid token)
    if (accessToken) {
      try {
        await plaidClient.itemRemove({ access_token: accessToken });
      } catch (e) {
        // Item may already be removed on Plaid's side, continue cleanup
        console.warn('Plaid item remove warning:', e.response?.data?.error_message || e.message);
      }
    }

    // Clean up all KV entries for this item
    await kv.del(`plaid:${businessId}:access_token:${item_id}`);
    await kv.del(`plaid:${businessId}:cursor:${item_id}`);
    await kv.del(`plaid:${businessId}:institution:${item_id}`);
    await kv.del(`plaid:${businessId}:last_sync:${item_id}`);
    await kv.srem(`plaid:${businessId}:linked_items`, item_id);

    return res.status(200).json({ success: true, item_id });
  } catch (error) {
    console.error('Remove error:', error.message);
    return res.status(500).json({
      error: 'Failed to remove account',
      detail: error.message,
    });
  }
}
