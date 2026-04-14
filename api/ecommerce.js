// Consolidated Ecommerce API — single serverless function
// Routes by ?action= query parameter:
//   GET  ?action=etsy-connect      — Redirect to Etsy OAuth
//   GET  ?action=etsy-callback     — Handle Etsy OAuth callback
//   POST ?action=etsy-sync         — Sync recent orders from Etsy
//   POST ?action=etsy-disconnect   — Revoke Etsy connection
//   POST ?action=shopify-connect   — Initiate Shopify OAuth
//   GET  ?action=shopify-callback  — Handle Shopify OAuth callback
//   POST ?action=shopify-sync      — Sync recent orders from Shopify
//   POST ?action=shopify-disconnect — Revoke Shopify connection
//   POST ?action=shipping-rates    — Get shipping rates
//   POST ?action=shipping-label    — Create shipping label
//   GET  ?action=status            — Channel connection status

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const action = req.query.action || req.body?.action;

  switch (action) {
    // ── Etsy ──
    case 'etsy-connect':
      return handleEtsyConnect(req, res);
    case 'etsy-callback':
      return handleEtsyCallback(req, res);
    case 'etsy-sync':
      return handleEtsySync(req, res);
    case 'etsy-disconnect':
      return handleEtsyDisconnect(req, res);

    // ── Shopify ──
    case 'shopify-connect':
      return handleShopifyConnect(req, res);
    case 'shopify-callback':
      return handleShopifyCallback(req, res);
    case 'shopify-sync':
      return handleShopifySync(req, res);
    case 'shopify-disconnect':
      return handleShopifyDisconnect(req, res);

    // ── Shipping ──
    case 'shipping-rates':
      return handleShippingRates(req, res);
    case 'shipping-label':
      return handleShippingLabel(req, res);

    // ── Status ──
    case 'status':
      return handleStatus(req, res);

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};

// ── Helper: get business ID from request ───────────────

function getBusinessId(req) {
  // In production, extract from auth token via authenticate()
  // For MVP, use a header or default
  return req.headers['x-business-id'] || 'default';
}

// ── KV key helpers ─────────────────────────────────────

function etsyTokenKey(bizId) { return `ecommerce:${bizId}:etsy:token`; }
function etsyMetaKey(bizId) { return `ecommerce:${bizId}:etsy:meta`; }
function shopifyTokenKey(bizId) { return `ecommerce:${bizId}:shopify:token`; }
function shopifyMetaKey(bizId) { return `ecommerce:${bizId}:shopify:meta`; }

// ══════════════════════════════════════════════════════
// ── ETSY HANDLERS ────────────────────────────────────
// ══════════════════════════════════════════════════════

async function handleEtsyConnect(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ETSY_API_KEY;
  const redirectUri = process.env.ETSY_REDIRECT_URI || `${req.headers.origin || 'https://localhost'}/api/ecommerce?action=etsy-callback`;

  if (!apiKey) {
    // Sandbox mode — simulate OAuth redirect
    const bizId = getBusinessId(req);
    await kv.set(etsyTokenKey(bizId), JSON.stringify({
      access_token: 'sandbox_etsy_token',
      refresh_token: 'sandbox_etsy_refresh',
      expires_at: Date.now() + 3600000,
      sandbox: true,
    }));
    await kv.set(etsyMetaKey(bizId), JSON.stringify({
      shop_name: 'My Etsy Shop (Sandbox)',
      connected_at: new Date().toISOString(),
    }));
    // Redirect back to settings
    return res.writeHead(302, { Location: '/#settings?etsy=connected' }).end();
  }

  // Real Etsy OAuth — redirect to Etsy authorization
  const state = Buffer.from(JSON.stringify({ bizId: getBusinessId(req), ts: Date.now() })).toString('base64url');
  const scope = 'transactions_r shops_r';
  const authUrl = `https://www.etsy.com/oauth/connect?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge_method=S256`;

  return res.writeHead(302, { Location: authUrl }).end();
}

async function handleEtsyCallback(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.query;

  if (!code || !state) {
    return res.writeHead(302, { Location: '/#settings?etsy=error&msg=missing_code' }).end();
  }

  try {
    const apiKey = process.env.ETSY_API_KEY;
    const redirectUri = process.env.ETSY_REDIRECT_URI || `${req.headers.origin || 'https://localhost'}/api/ecommerce?action=etsy-callback`;
    let stateData;
    try { stateData = JSON.parse(Buffer.from(state, 'base64url').toString()); } catch { stateData = {}; }
    const bizId = stateData.bizId || 'default';

    // Exchange code for token
    const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: apiKey,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error('Token exchange failed');
    }

    const tokenData = await tokenRes.json();

    await kv.set(etsyTokenKey(bizId), JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
    }));

    // Fetch shop info
    const shopRes = await fetch('https://openapi.etsy.com/v3/application/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'x-api-key': apiKey },
    });
    const shopData = shopRes.ok ? await shopRes.json() : {};

    await kv.set(etsyMetaKey(bizId), JSON.stringify({
      shop_name: shopData.shop_name || 'Etsy Shop',
      user_id: shopData.user_id,
      connected_at: new Date().toISOString(),
    }));

    return res.writeHead(302, { Location: '/#settings?etsy=connected' }).end();
  } catch (err) {
    console.error('Etsy callback error:', err);
    return res.writeHead(302, { Location: '/#settings?etsy=error' }).end();
  }
}

async function handleEtsySync(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bizId = getBusinessId(req);
  const tokenRaw = await kv.get(etsyTokenKey(bizId));

  if (!tokenRaw) {
    return res.status(400).json({ error: 'Etsy not connected' });
  }

  const token = typeof tokenRaw === 'string' ? JSON.parse(tokenRaw) : tokenRaw;

  if (token.sandbox) {
    // Return mock orders for sandbox mode
    const mockOrders = [
      {
        orderNumber: 'ETSY-100001',
        customerId: null,
        customerName: 'Jane Smith',
        status: 'confirmed',
        lineItems: [
          { productName: 'Lavender Soy Candle', quantity: 2, unitPrice: 24.99 },
          { productName: 'Vanilla Bean Candle', quantity: 1, unitPrice: 19.99 },
        ],
        subtotal: 69.97,
        shippingCost: 5.99,
        total: 75.96,
        source: 'etsy',
        externalId: '100001',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        shippingAddress: '123 Main St, Portland, OR 97201',
      },
      {
        orderNumber: 'ETSY-100002',
        customerId: null,
        customerName: 'John Doe',
        status: 'confirmed',
        lineItems: [
          { productName: 'Cedar & Sage Candle', quantity: 3, unitPrice: 22.99 },
        ],
        subtotal: 68.97,
        shippingCost: 4.50,
        total: 73.47,
        source: 'etsy',
        externalId: '100002',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        shippingAddress: '456 Oak Ave, Seattle, WA 98101',
      },
    ];

    return res.status(200).json({
      orders: mockOrders,
      synced: mockOrders.length,
      sandbox: true,
      syncedAt: new Date().toISOString(),
    });
  }

  // Real Etsy sync
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const receiptsRes = await fetch('https://openapi.etsy.com/v3/application/shops/me/receipts?limit=25&sort_on=created&sort_order=desc', {
      headers: { Authorization: `Bearer ${token.access_token}`, 'x-api-key': apiKey },
    });

    if (!receiptsRes.ok) {
      throw new Error(`Etsy API error: ${receiptsRes.status}`);
    }

    const data = await receiptsRes.json();
    const orders = (data.results || []).map(mapEtsyOrder);

    return res.status(200).json({
      orders,
      synced: orders.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Etsy sync error:', err);
    return res.status(500).json({ error: 'Failed to sync Etsy orders' });
  }
}

async function handleEtsyDisconnect(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bizId = getBusinessId(req);

  try {
    await kv.del(etsyTokenKey(bizId));
    await kv.del(etsyMetaKey(bizId));
    return res.status(200).json({ disconnected: true });
  } catch (err) {
    console.error('Etsy disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect Etsy' });
  }
}

// ── Etsy Order Mapping ─────────────────────────────────

function mapEtsyOrder(etsyOrder) {
  return {
    orderNumber: 'ETSY-' + etsyOrder.receipt_id,
    customerId: null,
    customerName: etsyOrder.name || 'Etsy Customer',
    status: 'confirmed',
    lineItems: (etsyOrder.transactions || []).map(t => ({
      productName: t.title,
      quantity: t.quantity,
      unitPrice: t.price?.amount ? t.price.amount / (t.price.divisor || 100) : 0,
    })),
    subtotal: etsyOrder.subtotal?.amount ? etsyOrder.subtotal.amount / (etsyOrder.subtotal.divisor || 100) : 0,
    shippingCost: etsyOrder.shipping_cost?.amount ? etsyOrder.shipping_cost.amount / (etsyOrder.shipping_cost.divisor || 100) : 0,
    total: etsyOrder.grandtotal?.amount ? etsyOrder.grandtotal.amount / (etsyOrder.grandtotal.divisor || 100) : 0,
    source: 'etsy',
    externalId: String(etsyOrder.receipt_id),
    createdAt: etsyOrder.create_timestamp ? new Date(etsyOrder.create_timestamp * 1000).toISOString() : new Date().toISOString(),
    shippingAddress: [etsyOrder.first_line, etsyOrder.city, etsyOrder.state, etsyOrder.zip].filter(Boolean).join(', '),
  };
}

// ══════════════════════════════════════════════════════
// ── SHOPIFY HANDLERS ─────────────────────────────────
// ══════════════════════════════════════════════════════

async function handleShopifyConnect(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shopDomain = req.body?.shopDomain;
  const apiKey = process.env.SHOPIFY_API_KEY;
  const bizId = getBusinessId(req);

  if (!apiKey) {
    // Sandbox mode — simulate connection
    const domain = shopDomain || 'my-shop.myshopify.com';
    await kv.set(shopifyTokenKey(bizId), JSON.stringify({
      access_token: 'sandbox_shopify_token',
      shop_domain: domain,
      sandbox: true,
    }));
    await kv.set(shopifyMetaKey(bizId), JSON.stringify({
      shop_name: domain.replace('.myshopify.com', ''),
      shop_domain: domain,
      connected_at: new Date().toISOString(),
    }));

    return res.status(200).json({ connected: true, sandbox: true, shop: domain });
  }

  // Real Shopify OAuth — build redirect URL
  if (!shopDomain) {
    return res.status(400).json({ error: 'shopDomain is required' });
  }

  const redirectUri = `${req.headers.origin || 'https://localhost'}/api/ecommerce?action=shopify-callback`;
  const scopes = 'read_orders,read_products';
  const state = Buffer.from(JSON.stringify({ bizId, ts: Date.now() })).toString('base64url');
  const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return res.status(200).json({ redirect: authUrl });
}

async function handleShopifyCallback(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, shop, state } = req.query;

  if (!code || !shop) {
    return res.writeHead(302, { Location: '/#settings?shopify=error&msg=missing_code' }).end();
  }

  try {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    let stateData;
    try { stateData = JSON.parse(Buffer.from(state, 'base64url').toString()); } catch { stateData = {}; }
    const bizId = stateData.bizId || 'default';

    // Exchange code for permanent token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error('Shopify token exchange failed');
    }

    const tokenData = await tokenRes.json();

    await kv.set(shopifyTokenKey(bizId), JSON.stringify({
      access_token: tokenData.access_token,
      shop_domain: shop,
    }));

    // Fetch shop info
    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': tokenData.access_token },
    });
    const shopInfo = shopRes.ok ? (await shopRes.json()).shop : {};

    await kv.set(shopifyMetaKey(bizId), JSON.stringify({
      shop_name: shopInfo.name || shop.replace('.myshopify.com', ''),
      shop_domain: shop,
      connected_at: new Date().toISOString(),
    }));

    return res.writeHead(302, { Location: '/#settings?shopify=connected' }).end();
  } catch (err) {
    console.error('Shopify callback error:', err);
    return res.writeHead(302, { Location: '/#settings?shopify=error' }).end();
  }
}

async function handleShopifySync(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bizId = getBusinessId(req);
  const tokenRaw = await kv.get(shopifyTokenKey(bizId));

  if (!tokenRaw) {
    return res.status(400).json({ error: 'Shopify not connected' });
  }

  const token = typeof tokenRaw === 'string' ? JSON.parse(tokenRaw) : tokenRaw;

  if (token.sandbox) {
    // Return mock orders for sandbox mode
    const mockOrders = [
      {
        orderNumber: 'SHOP-1001',
        customerId: null,
        customerName: 'Alice Johnson',
        status: 'confirmed',
        lineItems: [
          { productName: 'Rose Petal Candle', quantity: 1, unitPrice: 28.99 },
          { productName: 'Ocean Breeze Candle', quantity: 2, unitPrice: 21.99 },
        ],
        subtotal: 72.97,
        shippingCost: 6.99,
        tax: 5.84,
        total: 85.80,
        source: 'shopify',
        externalId: '5001',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
        shippingAddress: '789 Elm St, Austin, TX 73301',
      },
      {
        orderNumber: 'SHOP-1002',
        customerId: null,
        customerName: 'Bob Williams',
        status: 'confirmed',
        lineItems: [
          { productName: 'Cinnamon Spice Candle Set', quantity: 1, unitPrice: 49.99 },
        ],
        subtotal: 49.99,
        shippingCost: 0,
        tax: 4.00,
        total: 53.99,
        source: 'shopify',
        externalId: '5002',
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        shippingAddress: '321 Pine Rd, Denver, CO 80201',
      },
    ];

    return res.status(200).json({
      orders: mockOrders,
      synced: mockOrders.length,
      sandbox: true,
      syncedAt: new Date().toISOString(),
    });
  }

  // Real Shopify sync
  try {
    const ordersRes = await fetch(`https://${token.shop_domain}/admin/api/2024-01/orders.json?status=any&limit=50`, {
      headers: { 'X-Shopify-Access-Token': token.access_token },
    });

    if (!ordersRes.ok) {
      throw new Error(`Shopify API error: ${ordersRes.status}`);
    }

    const data = await ordersRes.json();
    const orders = (data.orders || []).map(mapShopifyOrder);

    return res.status(200).json({
      orders,
      synced: orders.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Shopify sync error:', err);
    return res.status(500).json({ error: 'Failed to sync Shopify orders' });
  }
}

async function handleShopifyDisconnect(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bizId = getBusinessId(req);

  try {
    await kv.del(shopifyTokenKey(bizId));
    await kv.del(shopifyMetaKey(bizId));
    return res.status(200).json({ disconnected: true });
  } catch (err) {
    console.error('Shopify disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect Shopify' });
  }
}

// ── Shopify Order Mapping ──────────────────────────────

function mapShopifyOrder(order) {
  return {
    orderNumber: 'SHOP-' + order.order_number,
    customerId: null,
    customerName: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 'Shopify Customer',
    status: 'confirmed',
    lineItems: (order.line_items || []).map(li => ({
      productName: li.title,
      quantity: li.quantity,
      unitPrice: parseFloat(li.price) || 0,
    })),
    subtotal: parseFloat(order.subtotal_price) || 0,
    shippingCost: order.shipping_lines?.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) || 0,
    tax: parseFloat(order.total_tax) || 0,
    total: parseFloat(order.total_price) || 0,
    source: 'shopify',
    externalId: String(order.id),
    createdAt: order.created_at || new Date().toISOString(),
    shippingAddress: order.shipping_address
      ? [order.shipping_address.address1, order.shipping_address.city, order.shipping_address.province, order.shipping_address.zip].filter(Boolean).join(', ')
      : '',
  };
}

// ══════════════════════════════════════════════════════
// ── SHIPPING HANDLERS ────────────────────────────────
// ══════════════════════════════════════════════════════

async function handleShippingRates(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { from_address, to_address, parcel_weight, parcel_dimensions } = req.body || {};

  if (!process.env.EASYPOST_API_KEY) {
    // Mock shipping rates for sandbox/demo mode
    return res.status(200).json({
      rates: [
        { id: 'mock_usps_priority', carrier: 'USPS', service: 'Priority Mail', rate: '8.50', delivery_days: 3, est_delivery: futureDate(3) },
        { id: 'mock_usps_first', carrier: 'USPS', service: 'First Class', rate: '4.50', delivery_days: 5, est_delivery: futureDate(5) },
        { id: 'mock_ups_ground', carrier: 'UPS', service: 'Ground', rate: '12.00', delivery_days: 5, est_delivery: futureDate(5) },
        { id: 'mock_ups_3day', carrier: 'UPS', service: '3-Day Select', rate: '18.75', delivery_days: 3, est_delivery: futureDate(3) },
        { id: 'mock_fedex_home', carrier: 'FedEx', service: 'Home Delivery', rate: '11.25', delivery_days: 4, est_delivery: futureDate(4) },
      ],
      mock: true,
    });
  }

  // Real EasyPost integration
  try {
    const easypostKey = process.env.EASYPOST_API_KEY;
    const shipmentRes = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${easypostKey}`,
      },
      body: JSON.stringify({
        shipment: {
          from_address: from_address,
          to_address: to_address,
          parcel: {
            weight: parcel_weight || 16,
            ...(parcel_dimensions || {}),
          },
        },
      }),
    });

    if (!shipmentRes.ok) {
      throw new Error(`EasyPost error: ${shipmentRes.status}`);
    }

    const shipment = await shipmentRes.json();
    const rates = (shipment.rates || []).map(r => ({
      id: r.id,
      carrier: r.carrier,
      service: r.service,
      rate: r.rate,
      delivery_days: r.delivery_days,
      est_delivery: r.delivery_date,
    })).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));

    return res.status(200).json({ rates, shipment_id: shipment.id });
  } catch (err) {
    console.error('Shipping rates error:', err);
    return res.status(500).json({ error: 'Failed to get shipping rates' });
  }
}

async function handleShippingLabel(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { rate_id, shipment_id, from_address, to_address } = req.body || {};

  if (!process.env.EASYPOST_API_KEY) {
    // Mock label creation for sandbox/demo
    const mockTracking = 'MOCK' + Date.now().toString(36).toUpperCase();
    return res.status(200).json({
      label_url: '#',
      tracking_number: mockTracking,
      carrier: 'USPS',
      service: 'Priority Mail',
      rate: '8.50',
      est_delivery: futureDate(3),
      mock: true,
    });
  }

  // Real EasyPost label purchase
  try {
    const easypostKey = process.env.EASYPOST_API_KEY;
    const buyRes = await fetch(`https://api.easypost.com/v2/shipments/${shipment_id}/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${easypostKey}`,
      },
      body: JSON.stringify({ rate: { id: rate_id } }),
    });

    if (!buyRes.ok) {
      throw new Error(`EasyPost buy error: ${buyRes.status}`);
    }

    const result = await buyRes.json();
    return res.status(200).json({
      label_url: result.postage_label?.label_url || '',
      tracking_number: result.tracking_code || '',
      carrier: result.selected_rate?.carrier || '',
      service: result.selected_rate?.service || '',
      rate: result.selected_rate?.rate || '',
      est_delivery: result.selected_rate?.delivery_date || '',
    });
  } catch (err) {
    console.error('Shipping label error:', err);
    return res.status(500).json({ error: 'Failed to create shipping label' });
  }
}

// ══════════════════════════════════════════════════════
// ── STATUS ───────────────────────────────────────────
// ══════════════════════════════════════════════════════

async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bizId = getBusinessId(req);

  let etsy = { connected: false };
  let shopify = { connected: false };

  try {
    const etsyToken = await kv.get(etsyTokenKey(bizId));
    if (etsyToken) {
      const meta = await kv.get(etsyMetaKey(bizId));
      const metaData = meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : {};
      const tokenData = typeof etsyToken === 'string' ? JSON.parse(etsyToken) : etsyToken;
      etsy = {
        connected: true,
        shop_name: metaData.shop_name || 'Etsy Shop',
        connected_at: metaData.connected_at,
        sandbox: !!tokenData.sandbox,
      };
    }
  } catch (e) {
    console.warn('Failed to check Etsy status:', e.message);
  }

  try {
    const shopifyToken = await kv.get(shopifyTokenKey(bizId));
    if (shopifyToken) {
      const meta = await kv.get(shopifyMetaKey(bizId));
      const metaData = meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : {};
      const tokenData = typeof shopifyToken === 'string' ? JSON.parse(shopifyToken) : shopifyToken;
      shopify = {
        connected: true,
        shop_name: metaData.shop_name || 'Shopify Store',
        shop_domain: metaData.shop_domain,
        connected_at: metaData.connected_at,
        sandbox: !!tokenData.sandbox,
      };
    }
  } catch (e) {
    console.warn('Failed to check Shopify status:', e.message);
  }

  return res.status(200).json({
    etsy,
    shopify,
    shipping: {
      provider: process.env.EASYPOST_API_KEY ? 'easypost' : 'mock',
      configured: !!process.env.EASYPOST_API_KEY,
    },
  });
}

// ── Utility ────────────────────────────────────────────

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
