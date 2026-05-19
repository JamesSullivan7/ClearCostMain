// Low-Stock Notification API
// Routes by ?action=: check-low-stock, send-alerts, get-settings, update-settings
//
// Uses service client for cross-table queries (products + materials + business profile)

const { authenticate, getServiceClient } = require('./_lib/auth');

module.exports = async (req, res) => {
  // CORS headers
  const SITE_URL = (process.env.SITE_URL || '').trim() || 'https://clearcostinventory.com';
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { userId, businessId } = await authenticate(req);
    const action = req.query.action;
    const service = getServiceClient();

    switch (action) {

      // ── CHECK LOW STOCK (GET) ──
      case 'check-low-stock': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

        const lowStockData = await getLowStockItems(service, businessId);
        return res.status(200).json(lowStockData);
      }

      // ── SEND ALERTS (POST) ──
      case 'send-alerts': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

        // Check alert frequency / spam prevention
        const canSend = await canSendAlert(service, businessId);
        if (!canSend.allowed) {
          return res.status(200).json({ sent: false, reason: canSend.reason });
        }

        // Get low-stock items
        const lowStockData = await getLowStockItems(service, businessId);
        if (!lowStockData.hasLowStock) {
          return res.status(200).json({ sent: false, reason: 'no low stock' });
        }

        // If no Resend API key, return data without sending
        if (!(process.env.RESEND_API_KEY || '').trim()) {
          return res.status(200).json({
            sent: false,
            reason: 'RESEND_API_KEY not configured',
            ...lowStockData,
          });
        }

        // Get business owner's email
        const { data: biz } = await service
          .from('businesses')
          .select('name, auth_user_id')
          .eq('id', businessId)
          .single();

        if (!biz) {
          return res.status(400).json({ error: 'Business not found' });
        }

        const { data: { user: ownerUser }, error: userErr } = await service.auth.admin.getUserById(biz.auth_user_id);
        if (userErr || !ownerUser?.email) {
          return res.status(400).json({ error: 'Could not determine business owner email' });
        }

        // Build and send email
        const itemCount = lowStockData.products.length + lowStockData.materials.length;
        const htmlBody = buildAlertEmail(biz.name, lowStockData);

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(process.env.RESEND_API_KEY || '').trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: (process.env.RESEND_FROM_EMAIL || '').trim() || 'ClearCost <notifications@resend.dev>',
            to: [ownerUser.email],
            subject: 'ClearCost: Low Stock Alert',
            html: htmlBody,
          }),
        });

        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          console.error('Resend API error:', errBody);
          return res.status(500).json({ error: 'Failed to send email', details: errBody });
        }

        // Record that we sent an alert
        await upsertSetting(service, businessId, 'last_alert_sent', new Date().toISOString());

        return res.status(200).json({ sent: true, itemCount });
      }

      // ── GET SETTINGS (GET) ──
      case 'get-settings': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

        const settings = await getNotificationSettings(service, businessId);
        return res.status(200).json(settings);
      }

      // ── UPDATE SETTINGS (POST) ──
      case 'update-settings': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

        const { emailAlerts, alertFrequency } = req.body || {};

        if (emailAlerts !== undefined) {
          await upsertSetting(service, businessId, 'email_alerts', String(emailAlerts));
        }
        if (alertFrequency !== undefined) {
          const validFreqs = ['daily', 'weekly', 'manual'];
          if (!validFreqs.includes(alertFrequency)) {
            return res.status(400).json({ error: 'alertFrequency must be daily, weekly, or manual' });
          }
          await upsertSetting(service, businessId, 'alert_frequency', alertFrequency);
        }

        const settings = await getNotificationSettings(service, businessId);
        return res.status(200).json(settings);
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Notifications API error:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

// ── Helpers ──

/**
 * Query products and materials where quantity <= their low_threshold
 * Falls back to global_thresholds from the business profile if per-item threshold isn't set
 */
async function getLowStockItems(service, businessId) {
  // Get business global thresholds
  const { data: biz } = await service
    .from('businesses')
    .select('global_thresholds')
    .eq('id', businessId)
    .single();

  const globalThresholds = biz?.global_thresholds || {};
  const defaultProductThreshold = globalThresholds.products ?? 5;
  const defaultMaterialThreshold = globalThresholds.materials ?? 5;

  // Get all products for this business
  const { data: products, error: pErr } = await service
    .from('products')
    .select('id, name, quantity, low_threshold, unit')
    .eq('business_id', businessId);

  if (pErr) throw pErr;

  // Get all materials for this business
  const { data: materials, error: mErr } = await service
    .from('materials')
    .select('id, name, quantity, low_threshold, unit')
    .eq('business_id', businessId);

  if (mErr) throw mErr;

  // Filter to low-stock items
  const lowProducts = (products || []).filter(p => {
    const threshold = p.low_threshold ?? defaultProductThreshold;
    return p.quantity <= threshold;
  }).map(p => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    threshold: p.low_threshold ?? defaultProductThreshold,
    unit: p.unit || 'units',
  }));

  const lowMaterials = (materials || []).filter(m => {
    const threshold = m.low_threshold ?? defaultMaterialThreshold;
    return m.quantity <= threshold;
  }).map(m => ({
    id: m.id,
    name: m.name,
    quantity: m.quantity,
    threshold: m.low_threshold ?? defaultMaterialThreshold,
    unit: m.unit || 'units',
  }));

  return {
    products: lowProducts,
    materials: lowMaterials,
    hasLowStock: lowProducts.length > 0 || lowMaterials.length > 0,
  };
}

/**
 * Check if enough time has passed since the last alert based on frequency setting
 */
async function canSendAlert(service, businessId) {
  const settings = await getNotificationSettings(service, businessId);

  if (!settings.emailAlerts) {
    return { allowed: false, reason: 'email alerts disabled' };
  }

  if (settings.alertFrequency === 'manual') {
    // Manual mode always allows sending (user explicitly clicked send)
    return { allowed: true };
  }

  if (!settings.lastAlertSent) {
    return { allowed: true };
  }

  const lastSent = new Date(settings.lastAlertSent);
  const now = new Date();
  const hoursSinceLastAlert = (now - lastSent) / (1000 * 60 * 60);

  if (settings.alertFrequency === 'daily' && hoursSinceLastAlert < 24) {
    return { allowed: false, reason: 'daily alert already sent' };
  }

  if (settings.alertFrequency === 'weekly' && hoursSinceLastAlert < 168) {
    return { allowed: false, reason: 'weekly alert already sent' };
  }

  return { allowed: true };
}

/**
 * Get notification settings from the settings table
 */
async function getNotificationSettings(service, businessId) {
  const { data: rows } = await service
    .from('settings')
    .select('key, value')
    .eq('business_id', businessId)
    .in('key', ['email_alerts', 'alert_frequency', 'last_alert_sent']);

  const map = {};
  (rows || []).forEach(r => { map[r.key] = r.value; });

  return {
    emailAlerts: map.email_alerts !== 'false',  // default true
    alertFrequency: map.alert_frequency || 'daily',
    lastAlertSent: map.last_alert_sent || null,
  };
}

/**
 * Upsert a single setting key/value for a business
 */
async function upsertSetting(service, businessId, key, value) {
  const { error } = await service
    .from('settings')
    .upsert(
      { business_id: businessId, key, value },
      { onConflict: 'business_id,key' }
    );

  if (error) throw error;
}

/**
 * Build HTML email body listing low-stock items
 */
function buildAlertEmail(businessName, lowStockData) {
  const { products, materials } = lowStockData;

  const renderTable = (items, label) => {
    if (items.length === 0) return '';
    const rows = items.map(item => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center; color: ${item.quantity === 0 ? '#dc2626' : '#f59e0b'}; font-weight: 600;">
          ${item.quantity} ${item.unit}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.threshold} ${item.unit}
        </td>
      </tr>
    `).join('');

    return `
      <h2 style="margin: 24px 0 12px; font-size: 16px; color: #374151;">${label} (${items.length})</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Name</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 13px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Current Qty</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 13px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Threshold</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Low Stock Alert</h1>
          <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
            ${businessName ? businessName + ' — ' : ''}${products.length + materials.length} item${products.length + materials.length !== 1 ? 's' : ''} below threshold
          </p>
          ${renderTable(products, 'Products')}
          ${renderTable(materials, 'Materials')}
          <p style="margin: 24px 0 0; font-size: 13px; color: #9ca3af;">
            This alert was sent by ClearCost. You can manage notification settings in your dashboard.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
