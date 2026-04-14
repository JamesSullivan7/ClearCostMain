// ── Sales Channels UI ─────────────────────────────────
// Renders the Etsy/Shopify connection section on Settings page.

import { escHtml } from './modals.js';

/**
 * Render the Sales Channels section for Settings.
 * @param {object} status - From getChannelStatus() API call
 */
export function renderSalesChannelsSection(status = null) {
  const etsy = status?.etsy || { connected: false };
  const shopify = status?.shopify || { connected: false };

  let html = `
    <div class="settings-section ecommerce-section">
      <h3 style="margin:0 0 16px 0;display:flex;align-items:center;gap:8px;">
        <span style="font-size:1.2rem;">Sales Channels</span>
      </h3>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">
        Connect your Etsy and Shopify stores to automatically import orders.
      </p>

      <div class="ecommerce-channels">
        ${renderEtsyCard(etsy)}
        ${renderShopifyCard(shopify)}
      </div>
    </div>
  `;

  return html;
}

function renderEtsyCard(etsy) {
  const connected = etsy.connected;
  const sandboxBadge = etsy.sandbox ? ' <span class="channel-sandbox-badge">Sandbox</span>' : '';

  if (!connected) {
    return `
      <div class="channel-card">
        <div class="channel-header">
          <div class="channel-logo channel-logo-etsy">Etsy</div>
          <span class="channel-status-badge channel-disconnected">Not Connected</span>
        </div>
        <p class="channel-desc">Import orders from your Etsy shop automatically.</p>
        <button class="btn-primary" data-action="etsy-connect" style="width:100%;">Connect Etsy</button>
      </div>
    `;
  }

  return `
    <div class="channel-card channel-connected">
      <div class="channel-header">
        <div class="channel-logo channel-logo-etsy">Etsy</div>
        <span class="channel-status-badge channel-active">Connected${sandboxBadge}</span>
      </div>
      <div class="channel-shop-name">${escHtml(etsy.shop_name || 'Etsy Shop')}</div>
      ${etsy.connected_at ? `<div class="channel-meta">Connected ${new Date(etsy.connected_at).toLocaleDateString()}</div>` : ''}
      <div class="channel-actions">
        <button class="btn-secondary" data-action="etsy-sync" style="flex:1;">Sync Orders</button>
        <button class="btn-secondary" data-action="etsy-disconnect" style="color:var(--danger);border-color:var(--danger);">Disconnect</button>
      </div>
    </div>
  `;
}

function renderShopifyCard(shopify) {
  const connected = shopify.connected;
  const sandboxBadge = shopify.sandbox ? ' <span class="channel-sandbox-badge">Sandbox</span>' : '';

  if (!connected) {
    return `
      <div class="channel-card">
        <div class="channel-header">
          <div class="channel-logo channel-logo-shopify">Shopify</div>
          <span class="channel-status-badge channel-disconnected">Not Connected</span>
        </div>
        <p class="channel-desc">Import orders from your Shopify store.</p>
        <div class="channel-connect-form">
          <input type="text" id="shopify-domain-input" class="search-input" placeholder="my-store.myshopify.com" style="width:100%;border-radius:6px;margin-bottom:8px;" />
          <button class="btn-primary" data-action="shopify-connect" style="width:100%;">Connect Shopify</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="channel-card channel-connected">
      <div class="channel-header">
        <div class="channel-logo channel-logo-shopify">Shopify</div>
        <span class="channel-status-badge channel-active">Connected${sandboxBadge}</span>
      </div>
      <div class="channel-shop-name">${escHtml(shopify.shop_name || 'Shopify Store')}</div>
      ${shopify.shop_domain ? `<div class="channel-meta">${escHtml(shopify.shop_domain)}</div>` : ''}
      ${shopify.connected_at ? `<div class="channel-meta">Connected ${new Date(shopify.connected_at).toLocaleDateString()}</div>` : ''}
      <div class="channel-actions">
        <button class="btn-secondary" data-action="shopify-sync" style="flex:1;">Sync Orders</button>
        <button class="btn-secondary" data-action="shopify-disconnect" style="color:var(--danger);border-color:var(--danger);">Disconnect</button>
      </div>
    </div>
  `;
}
