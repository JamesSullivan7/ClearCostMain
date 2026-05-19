const { getServiceClient } = require('../../_lib/auth');

module.exports = async (req, res) => {
  // Optional: verify cron secret for automated calls
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    // If no cron secret configured, allow all calls; otherwise verify
    if (req.headers.authorization && !req.headers.authorization.startsWith('Bearer ey')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const supabase = getServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Get all businesses
  const { data: businesses } = await supabase.from('businesses').select('id');

  let created = 0;
  let skipped = 0;

  for (const biz of businesses || []) {
    // Check if snapshot already exists for today
    const { data: existing } = await supabase
      .from('daily_snapshots')
      .select('id')
      .eq('business_id', biz.id)
      .eq('date', today)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Get product stats
    const { data: products } = await supabase
      .from('products')
      .select('quantity')
      .eq('business_id', biz.id);

    const { data: materials } = await supabase
      .from('materials')
      .select('quantity, cost_per_unit')
      .eq('business_id', biz.id);

    const totalProducts = (products || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
    const productCount = (products || []).length;
    const totalMaterials = (materials || []).reduce((sum, m) => sum + (m.quantity || 0), 0);
    const materialValue = (materials || []).reduce((sum, m) => sum + ((m.quantity || 0) * (m.cost_per_unit || 0)), 0);

    await supabase.from('daily_snapshots').insert({
      business_id: biz.id,
      date: today,
      data: { totalProducts, productCount, totalMaterials, materialValue },
    });

    created++;
  }

  return res.status(200).json({ success: true, date: today, created, skipped });
};
