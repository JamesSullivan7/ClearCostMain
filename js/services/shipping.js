// ── Shipping Integration Service ──────────────────────
// Frontend service for getting shipping rates and
// creating shipping labels via EasyPost.

import { getAuthHeaders } from '../supabase.js';

const API_BASE = '/api/ecommerce';

async function shippingFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Get shipping rates for a parcel.
 * @param {object} fromAddress - { name, street1, city, state, zip, country }
 * @param {object} toAddress   - { name, street1, city, state, zip, country }
 * @param {number} weight      - Weight in ounces
 * @param {object} [dimensions] - { length, width, height } in inches
 * @returns {{ rates: Array, shipment_id?: string, mock?: boolean }}
 */
export async function getShippingRates(fromAddress, toAddress, weight, dimensions) {
  return shippingFetch(`${API_BASE}?action=shipping-rates`, {
    method: 'POST',
    body: JSON.stringify({
      from_address: fromAddress,
      to_address: toAddress,
      parcel_weight: weight,
      parcel_dimensions: dimensions,
    }),
  });
}

/**
 * Purchase a shipping label.
 * @param {string} rateId      - Selected rate ID
 * @param {string} shipmentId  - Shipment ID from rates response
 * @param {object} fromAddress - Sender address
 * @param {object} toAddress   - Recipient address
 * @returns {{ label_url: string, tracking_number: string, carrier: string, service: string }}
 */
export async function createShippingLabel(rateId, shipmentId, fromAddress, toAddress) {
  return shippingFetch(`${API_BASE}?action=shipping-label`, {
    method: 'POST',
    body: JSON.stringify({
      rate_id: rateId,
      shipment_id: shipmentId,
      from_address: fromAddress,
      to_address: toAddress,
    }),
  });
}
