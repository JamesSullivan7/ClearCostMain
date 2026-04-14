// ── Ecommerce Integration Service ─────────────────────
// Frontend service for connecting to Etsy and Shopify
// sales channels and syncing orders.

import { getAuthHeaders } from '../supabase.js';

const API_BASE = '/api/ecommerce';

async function ecommerceFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    console.warn('Session expired, reloading...');
    location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

// ── Etsy ───────────────────────────────────────────

/**
 * Redirect to Etsy OAuth flow.
 */
export function connectEtsy() {
  window.location.href = `${API_BASE}?action=etsy-connect`;
}

/**
 * Disconnect from Etsy.
 */
export async function disconnectEtsy() {
  return ecommerceFetch(`${API_BASE}?action=etsy-disconnect`, { method: 'POST' });
}

/**
 * Sync recent orders from Etsy.
 * @returns {{ orders: Array, synced: number, syncedAt: string }}
 */
export async function syncEtsyOrders() {
  return ecommerceFetch(`${API_BASE}?action=etsy-sync`, { method: 'POST' });
}

// ── Shopify ────────────────────────────────────────

/**
 * Connect to Shopify store.
 * @param {string} shopDomain - e.g. "my-store.myshopify.com"
 */
export async function connectShopify(shopDomain) {
  const result = await ecommerceFetch(`${API_BASE}?action=shopify-connect`, {
    method: 'POST',
    body: JSON.stringify({ shopDomain }),
  });

  // If real OAuth, redirect to Shopify auth page
  if (result.redirect) {
    window.location.href = result.redirect;
    return;
  }

  return result;
}

/**
 * Disconnect from Shopify.
 */
export async function disconnectShopify() {
  return ecommerceFetch(`${API_BASE}?action=shopify-disconnect`, { method: 'POST' });
}

/**
 * Sync recent orders from Shopify.
 * @returns {{ orders: Array, synced: number, syncedAt: string }}
 */
export async function syncShopifyOrders() {
  return ecommerceFetch(`${API_BASE}?action=shopify-sync`, { method: 'POST' });
}

// ── Simulate Webhook (Sandbox only) ───────────────

/**
 * Simulate an Etsy webhook order for demo/sandbox testing.
 */
export async function simulateEtsyWebhook() {
  return ecommerceFetch(`${API_BASE}?action=etsy-webhook`, {
    method: 'POST',
    body: JSON.stringify({
      shop_id: 'sandbox',
      receipt_id: 'SIM-' + Date.now(),
      event_type: 'shop.receipt',
      simulated: true,
    }),
  });
}

/**
 * Simulate a Shopify webhook order for demo/sandbox testing.
 */
export async function simulateShopifyWebhook() {
  return ecommerceFetch(`${API_BASE}?action=shopify-webhook`, {
    method: 'POST',
    body: JSON.stringify({
      id: Date.now(),
      order_number: Math.floor(2000 + Math.random() * 1000),
      customer: { first_name: 'Demo', last_name: 'Customer' },
      line_items: [{ title: 'Sample Product', quantity: 1, price: '29.99' }],
      subtotal_price: '29.99',
      total_price: '31.49',
      total_tax: '1.50',
      created_at: new Date().toISOString(),
      simulated: true,
    }),
  });
}

// ── Status ─────────────────────────────────────────

/**
 * Get connection status for all channels.
 * @returns {{ etsy: object, shopify: object, shipping: object }}
 */
export async function getChannelStatus() {
  return ecommerceFetch(`${API_BASE}?action=status`);
}
