const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://dazonukhprkavlxgqdrn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhem9udWtocHJrYXZseGdxZHJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMyOTIzNSwiZXhwIjoyMDkwOTA1MjM1fQ._E-a6oH6V8Bw-UwWcJyLP9_o27Jg8Cqd2qzGATwFrfI'
);

const BIZ_ID = 'dc5d1f7e-b76d-4f38-8555-424e55467f65';

(async () => {
  // Update business profile
  await supabase.from('businesses').update({
    name: 'Stone & Wick Test', type: 'candles', product_label: 'Candle',
    product_label_plural: 'Candles', subscription_tier: 'business',
    subscription_status: 'active',
    global_thresholds: { productLow: 10, materialLow: 50 },
  }).eq('id', BIZ_ID);
  console.log('Business updated');

  // Clear existing data
  for (const t of ['suppliers','materials','products','recipes','expenses','transactions','production_runs','history','waste','batches','locations','settings']) {
    await supabase.from(t).delete().eq('business_id', BIZ_ID);
  }
  console.log('Old data cleared');

  // Suppliers
  const { data: sups } = await supabase.from('suppliers').insert([
    { business_id: BIZ_ID, name: 'CandleScience', contact_name: 'Sarah Miller', email: 'orders@candlescience.com', phone: '(919) 555-0142', website: 'https://candlescience.com', address: 'Durham, NC', default_lead_time_days: 5, notes: 'Primary wax & fragrance supplier', rating: 5 },
    { business_id: BIZ_ID, name: 'Wooden Wick Co.', contact_name: 'Mike Chen', email: 'sales@woodenwick.com', phone: '(503) 555-0198', website: 'https://woodenwick.com', address: 'Portland, OR', default_lead_time_days: 7, notes: 'Premium wooden wicks', rating: 4 },
    { business_id: BIZ_ID, name: 'Fillmore Container', contact_name: 'Lisa Park', email: 'wholesale@fillmore.com', phone: '(215) 555-0167', website: 'https://fillmorecontainer.com', address: 'Philadelphia, PA', default_lead_time_days: 4, notes: 'Jars, tins, and packaging', rating: 5 },
    { business_id: BIZ_ID, name: 'Rustic Escentuals', contact_name: 'David Wright', email: 'info@rustic.com', phone: '(405) 555-0134', website: 'https://rusticescentuals.com', address: 'Oklahoma City, OK', default_lead_time_days: 6, notes: 'Specialty fragrances & dyes', rating: 4 },
  ]).select('id');
  const s = sups.map(x => x.id);
  console.log('Suppliers:', s.length);

  // Materials
  const { data: mats } = await supabase.from('materials').insert([
    { business_id: BIZ_ID, name: 'Soy Wax (464)', category: 'raw', unit: 'lbs', quantity: 180, low_threshold: 50, cost_per_unit: 2.85, supplier_id: s[0], reorder_point: 75, lead_time_days: 5, moq: 50, note: 'Golden Brands 464' },
    { business_id: BIZ_ID, name: 'Coconut Wax Blend', category: 'raw', unit: 'lbs', quantity: 45, low_threshold: 30, cost_per_unit: 4.20, supplier_id: s[0], reorder_point: 40, lead_time_days: 5, moq: 25, note: 'Premium coconut-soy blend' },
    { business_id: BIZ_ID, name: 'Wooden Wicks (Medium)', category: 'raw', unit: 'each', quantity: 320, low_threshold: 100, cost_per_unit: 0.55, supplier_id: s[1], reorder_point: 150, lead_time_days: 7, moq: 100 },
    { business_id: BIZ_ID, name: 'Cotton Wicks (CD-18)', category: 'raw', unit: 'each', quantity: 500, low_threshold: 200, cost_per_unit: 0.12, supplier_id: s[0], reorder_point: 250, lead_time_days: 5, moq: 100 },
    { business_id: BIZ_ID, name: 'Lavender Fields (FO)', category: 'fragrance', unit: 'oz', quantity: 64, low_threshold: 16, cost_per_unit: 1.85, supplier_id: s[3], reorder_point: 20 },
    { business_id: BIZ_ID, name: 'Vanilla Bourbon (FO)', category: 'fragrance', unit: 'oz', quantity: 48, low_threshold: 16, cost_per_unit: 2.10, supplier_id: s[3], reorder_point: 20 },
    { business_id: BIZ_ID, name: 'Cedarwood & Sage (FO)', category: 'fragrance', unit: 'oz', quantity: 32, low_threshold: 16, cost_per_unit: 2.35, supplier_id: s[3], reorder_point: 20 },
    { business_id: BIZ_ID, name: 'Sea Salt & Driftwood (FO)', category: 'fragrance', unit: 'oz', quantity: 12, low_threshold: 16, cost_per_unit: 2.50, supplier_id: s[3], reorder_point: 20, note: 'LOW STOCK' },
    { business_id: BIZ_ID, name: '9oz Amber Jars', category: 'packaging', unit: 'each', quantity: 144, low_threshold: 48, cost_per_unit: 1.65, supplier_id: s[2], reorder_point: 72 },
    { business_id: BIZ_ID, name: '4oz Travel Tins', category: 'packaging', unit: 'each', quantity: 200, low_threshold: 75, cost_per_unit: 0.85, supplier_id: s[2], reorder_point: 100 },
    { business_id: BIZ_ID, name: 'Warning Labels', category: 'label', unit: 'each', quantity: 800, low_threshold: 200, cost_per_unit: 0.04, supplier_id: s[2], reorder_point: 300 },
    { business_id: BIZ_ID, name: 'Brand Labels (Custom)', category: 'label', unit: 'each', quantity: 350, low_threshold: 100, cost_per_unit: 0.18, supplier_id: s[2], reorder_point: 150 },
  ]).select('id');
  const m = mats.map(x => x.id);
  console.log('Materials:', m.length);

  // Products
  const { data: prods } = await supabase.from('products').insert([
    { business_id: BIZ_ID, name: 'Lavender Dreams', quantity: 42, low_threshold: 15, note: 'Best seller - floral collection', sell_price: 28.00, sku: 'SW-LAV-9', tags: ['floral','bestseller'] },
    { business_id: BIZ_ID, name: 'Vanilla Bourbon', quantity: 35, low_threshold: 15, note: 'Warm & cozy collection', sell_price: 28.00, sku: 'SW-VAN-9' },
    { business_id: BIZ_ID, name: 'Cedarwood & Sage', quantity: 18, in_production: true, low_threshold: 12, note: 'Masculine line - growing demand', sell_price: 32.00, sku: 'SW-CED-9' },
    { business_id: BIZ_ID, name: 'Sea Salt & Driftwood', quantity: 8, needs_made: true, low_threshold: 10, note: 'Coastal collection - low stock!', sell_price: 32.00, sku: 'SW-SEA-9' },
    { business_id: BIZ_ID, name: 'Lavender Travel Tin', quantity: 85, low_threshold: 25, note: 'Farmers market hit', sell_price: 14.00, sku: 'SW-LAV-4' },
    { business_id: BIZ_ID, name: 'Vanilla Travel Tin', quantity: 62, low_threshold: 25, note: 'Online favorite', sell_price: 14.00, sku: 'SW-VAN-4' },
    { business_id: BIZ_ID, name: 'Holiday Spice (Limited)', quantity: 0, needs_made: true, low_threshold: 20, note: 'Seasonal - Q4 release', sell_price: 34.00, sku: 'SW-HOL-9', cost_override: 7.50 },
    { business_id: BIZ_ID, name: 'Gift Set (3-Pack)', quantity: 12, low_threshold: 8, note: '3 travel tins in gift box', sell_price: 38.00, sku: 'SW-GIFT-3', cost_override: 12.00 },
  ]).select('id');
  const p = prods.map(x => x.id);
  console.log('Products:', p.length);

  // Recipes
  await supabase.from('recipes').insert([
    { business_id: BIZ_ID, name: 'Lavender Dreams 9oz', product_id: p[0], yield_qty: 1, ingredients: [{materialId:m[0],quantity:0.5,unit:'lbs'},{materialId:m[2],quantity:1,unit:'each'},{materialId:m[4],quantity:1.5,unit:'oz'},{materialId:m[8],quantity:1,unit:'each'},{materialId:m[10],quantity:1,unit:'each'},{materialId:m[11],quantity:1,unit:'each'}] },
    { business_id: BIZ_ID, name: 'Vanilla Bourbon 9oz', product_id: p[1], yield_qty: 1, ingredients: [{materialId:m[0],quantity:0.5,unit:'lbs'},{materialId:m[2],quantity:1,unit:'each'},{materialId:m[5],quantity:1.5,unit:'oz'},{materialId:m[8],quantity:1,unit:'each'},{materialId:m[10],quantity:1,unit:'each'},{materialId:m[11],quantity:1,unit:'each'}] },
    { business_id: BIZ_ID, name: 'Cedarwood & Sage 9oz', product_id: p[2], yield_qty: 1, ingredients: [{materialId:m[1],quantity:0.5,unit:'lbs'},{materialId:m[2],quantity:1,unit:'each'},{materialId:m[6],quantity:1.5,unit:'oz'},{materialId:m[8],quantity:1,unit:'each'},{materialId:m[10],quantity:1,unit:'each'},{materialId:m[11],quantity:1,unit:'each'}] },
    { business_id: BIZ_ID, name: 'Sea Salt & Driftwood 9oz', product_id: p[3], yield_qty: 1, ingredients: [{materialId:m[1],quantity:0.5,unit:'lbs'},{materialId:m[2],quantity:1,unit:'each'},{materialId:m[7],quantity:1.5,unit:'oz'},{materialId:m[8],quantity:1,unit:'each'},{materialId:m[10],quantity:1,unit:'each'},{materialId:m[11],quantity:1,unit:'each'}] },
    { business_id: BIZ_ID, name: 'Lavender Travel 4oz', product_id: p[4], yield_qty: 1, ingredients: [{materialId:m[0],quantity:0.22,unit:'lbs'},{materialId:m[3],quantity:1,unit:'each'},{materialId:m[4],quantity:0.7,unit:'oz'},{materialId:m[9],quantity:1,unit:'each'},{materialId:m[10],quantity:1,unit:'each'},{materialId:m[11],quantity:1,unit:'each'}] },
    { business_id: BIZ_ID, name: 'Vanilla Travel 4oz', product_id: p[5], yield_qty: 1, ingredients: [{materialId:m[0],quantity:0.22,unit:'lbs'},{materialId:m[3],quantity:1,unit:'each'},{materialId:m[5],quantity:0.7,unit:'oz'},{materialId:m[9],quantity:1,unit:'each'},{materialId:m[10],quantity:1,unit:'each'},{materialId:m[11],quantity:1,unit:'each'}] },
  ]);
  console.log('Recipes: OK');

  // Expenses
  await supabase.from('expenses').insert([
    { business_id: BIZ_ID, name: 'Studio Rent', category: 'rent', amount: 1200, frequency: 'monthly', cost_type: 'fixed' },
    { business_id: BIZ_ID, name: 'Business Insurance', category: 'insurance', amount: 1800, frequency: 'yearly', cost_type: 'fixed' },
    { business_id: BIZ_ID, name: 'Utilities', category: 'utilities', amount: 185, frequency: 'monthly', cost_type: 'fixed' },
    { business_id: BIZ_ID, name: 'Shopify Subscription', category: 'subscription', amount: 39, frequency: 'monthly', cost_type: 'fixed' },
    { business_id: BIZ_ID, name: 'Instagram Ads', category: 'marketing', amount: 300, frequency: 'monthly', cost_type: 'fixed' },
    { business_id: BIZ_ID, name: 'Part-time Assistant', category: 'labor', amount: 600, frequency: 'monthly', cost_type: 'fixed' },
    { business_id: BIZ_ID, name: 'Shipping Cost', category: 'shipping', amount: 0, frequency: 'monthly', cost_type: 'variable', variable_basis: 'per-unit', variable_rate: 1.85 },
    { business_id: BIZ_ID, name: 'Etsy Fees', category: 'commission', amount: 0, frequency: 'monthly', cost_type: 'variable', variable_basis: 'percentage-of-revenue', variable_rate: 0.065 },
    { business_id: BIZ_ID, name: 'Payment Processing', category: 'commission', amount: 0, frequency: 'monthly', cost_type: 'variable', variable_basis: 'percentage-of-revenue', variable_rate: 0.029 },
    { business_id: BIZ_ID, name: 'Pouring Labor', category: 'labor', amount: 0, frequency: 'monthly', cost_type: 'variable', variable_basis: 'per-unit', variable_rate: 1.50 },
  ]);
  console.log('Expenses: OK');

  // Transactions
  await supabase.from('transactions').insert([
    { business_id: BIZ_ID, date: '2026-03-02', description: 'Etsy Order #4821 - Lavender Dreams', amount: 28.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-03', description: 'Etsy Order #4822 - Vanilla Bourbon x2', amount: 56.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-07', description: 'Farmers Market - Mixed (12 candles)', amount: 296.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-10', description: 'Shopify Order #1090 - Cedarwood x3', amount: 96.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-14', description: 'Wholesale - Local Boutique (24 units)', amount: 432.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-21', description: 'Farmers Market - Spring Pop-up', amount: 520.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-25', description: 'Shopify Orders (week batch)', amount: 186.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-04-01', description: 'Wholesale Reorder - The Gather Shop', amount: 360.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-01', description: 'CandleScience - Wax & Fragrance Order', amount: 385.00, type: 'expense', category: 'materials', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-08', description: 'Fillmore Container - Jars & Tins', amount: 210.00, type: 'expense', category: 'packaging', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-15', description: 'USPS Shipping (week)', amount: 42.50, type: 'expense', category: 'shipping', source: 'manual' },
    { business_id: BIZ_ID, date: '2026-03-20', description: 'Instagram Ads - March', amount: 300.00, type: 'expense', category: 'marketing', source: 'manual' },
  ]);
  console.log('Transactions: OK');

  // Production runs
  await supabase.from('production_runs').insert([
    { business_id: BIZ_ID, product_id: p[0], quantity: 24, note: 'March batch 1 - Lavender' },
    { business_id: BIZ_ID, product_id: p[1], quantity: 20, note: 'March batch 1 - Vanilla' },
    { business_id: BIZ_ID, product_id: p[4], quantity: 36, note: 'Travel tins - Lavender' },
    { business_id: BIZ_ID, product_id: p[5], quantity: 30, note: 'Travel tins - Vanilla' },
    { business_id: BIZ_ID, product_id: p[2], quantity: 12, note: 'Cedarwood premium batch' },
    { business_id: BIZ_ID, product_id: p[3], quantity: 8, note: 'Sea Salt - small batch' },
    { business_id: BIZ_ID, product_id: p[0], quantity: 18, note: 'March batch 2 - Lavender restock' },
    { business_id: BIZ_ID, product_id: p[1], quantity: 15, note: 'March batch 2 - Vanilla restock' },
    { business_id: BIZ_ID, product_id: p[2], quantity: 6, note: 'Cedarwood quick batch' },
    { business_id: BIZ_ID, product_id: p[4], quantity: 48, note: 'Travel tin big batch for market' },
  ]);
  console.log('Production runs: OK');

  console.log('\n=== DEMO BUSINESS COMPLETE ===');
  console.log('Email: James@oniven.com');
  console.log('Password: Test123');
  console.log('Tier: Business (full access)');
  console.log('Business: Stone & Wick Test');
})();
