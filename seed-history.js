const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://dazonukhprkavlxgqdrn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhem9udWtocHJrYXZseGdxZHJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMyOTIzNSwiZXhwIjoyMDkwOTA1MjM1fQ._E-a6oH6V8Bw-UwWcJyLP9_o27Jg8Cqd2qzGATwFrfI'
);
const B = 'dc5d1f7e-b76d-4f38-8555-424e55467f65';

(async () => {
  const { data: prods } = await supabase.from('products').select('id, name').eq('business_id', B);
  const { data: mats } = await supabase.from('materials').select('id, name').eq('business_id', B);
  const { data: sups } = await supabase.from('suppliers').select('id, name').eq('business_id', B);
  const p = {}; prods.forEach(x => p[x.name] = x.id);
  const m = {}; mats.forEach(x => m[x.name] = x.id);
  const s = {}; sups.forEach(x => s[x.name] = x.id);

  // PURCHASE ORDERS
  const { error: e1 } = await supabase.from('purchase_orders').insert([
    { business_id: B, po_number: 'PO-2025-001', supplier_id: s['CandleScience'], status: 'received', line_items: [{materialId:m['Soy Wax (464)'],quantity:100,unitCost:2.85,receivedQty:100},{materialId:m['Lavender Fields (FO)'],quantity:32,unitCost:1.85,receivedQty:32}], total_cost: 344.20, notes: 'Initial wax + fragrance', sent_at: '2025-08-10T10:00:00Z', expected_delivery: '2025-08-17T10:00:00Z', received_at: '2025-08-16T10:00:00Z', created_at: '2025-08-08T10:00:00Z' },
    { business_id: B, po_number: 'PO-2025-002', supplier_id: s['Fillmore Container'], status: 'received', line_items: [{materialId:m['9oz Amber Jars'],quantity:96,unitCost:1.65,receivedQty:96},{materialId:m['4oz Travel Tins'],quantity:100,unitCost:0.85,receivedQty:100}], total_cost: 243.40, notes: 'Packaging restock', sent_at: '2025-09-01T10:00:00Z', received_at: '2025-09-05T10:00:00Z', created_at: '2025-08-30T10:00:00Z' },
    { business_id: B, po_number: 'PO-2025-003', supplier_id: s['Wooden Wick Co.'], status: 'received', line_items: [{materialId:m['Wooden Wicks (Medium)'],quantity:200,unitCost:0.55,receivedQty:200}], total_cost: 110.00, notes: 'Wick restock - Q4 prep', sent_at: '2025-10-15T10:00:00Z', received_at: '2025-10-22T10:00:00Z', created_at: '2025-10-14T10:00:00Z' },
    { business_id: B, po_number: 'PO-2025-004', supplier_id: s['CandleScience'], status: 'received', line_items: [{materialId:m['Soy Wax (464)'],quantity:150,unitCost:2.85,receivedQty:150},{materialId:m['Coconut Wax Blend'],quantity:50,unitCost:4.20,receivedQty:50}], total_cost: 637.50, notes: 'Holiday season wax order', sent_at: '2025-11-01T10:00:00Z', received_at: '2025-11-07T10:00:00Z', created_at: '2025-10-30T10:00:00Z' },
    { business_id: B, po_number: 'PO-2026-001', supplier_id: s['Rustic Escentuals'], status: 'received', line_items: [{materialId:m['Cedarwood & Sage (FO)'],quantity:32,unitCost:2.35,receivedQty:32},{materialId:m['Sea Salt & Driftwood (FO)'],quantity:32,unitCost:2.50,receivedQty:32}], total_cost: 155.20, notes: 'New scent line restock', sent_at: '2026-01-10T10:00:00Z', received_at: '2026-01-16T10:00:00Z', created_at: '2026-01-09T10:00:00Z' },
    { business_id: B, po_number: 'PO-2026-002', supplier_id: s['Fillmore Container'], status: 'received', line_items: [{materialId:m['9oz Amber Jars'],quantity:144,unitCost:1.65,receivedQty:144},{materialId:m['Brand Labels (Custom)'],quantity:500,unitCost:0.18,receivedQty:500}], total_cost: 327.60, notes: 'Spring inventory build', sent_at: '2026-02-15T10:00:00Z', received_at: '2026-02-19T10:00:00Z', created_at: '2026-02-14T10:00:00Z' },
    { business_id: B, po_number: 'PO-2026-003', supplier_id: s['CandleScience'], status: 'received', line_items: [{materialId:m['Soy Wax (464)'],quantity:100,unitCost:2.85,receivedQty:100},{materialId:m['Lavender Fields (FO)'],quantity:32,unitCost:1.85,receivedQty:32}], total_cost: 344.20, notes: 'March restock', sent_at: '2026-03-01T10:00:00Z', received_at: '2026-03-06T10:00:00Z', created_at: '2026-02-28T10:00:00Z' },
    { business_id: B, po_number: 'PO-2026-004', supplier_id: s['Rustic Escentuals'], status: 'sent', line_items: [{materialId:m['Sea Salt & Driftwood (FO)'],quantity:32,unitCost:2.50,receivedQty:0}], total_cost: 80.00, notes: 'Urgent - Sea Salt low stock', sent_at: '2026-04-02T10:00:00Z', expected_delivery: '2026-04-09T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
    { business_id: B, po_number: 'PO-2026-005', supplier_id: s['Wooden Wick Co.'], status: 'draft', line_items: [{materialId:m['Wooden Wicks (Medium)'],quantity:200,unitCost:0.55,receivedQty:0}], total_cost: 110.00, notes: 'Q2 wick order - pending approval', created_at: '2026-04-03T10:00:00Z' },
  ]);
  console.log('Purchase Orders:', e1 ? e1.message : '9 OK');

  // WASTE
  const { error: e2 } = await supabase.from('waste').insert([
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], quantity: 3, reason: 'damaged', note: 'Cracked jars during shipping', cost_impact: 18.50, created_at: '2025-09-15T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['Soy Wax (464)'], quantity: 5, reason: 'lost', note: 'Spill during pour session', cost_impact: 14.25, created_at: '2025-10-02T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], quantity: 2, reason: 'defective', note: 'Wet spots - bad cure', cost_impact: 13.00, created_at: '2025-11-20T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['Wooden Wicks (Medium)'], quantity: 15, reason: 'defective', note: 'Batch with poor burn quality', cost_impact: 8.25, created_at: '2025-12-05T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Cedarwood & Sage'], quantity: 1, reason: 'damaged', note: 'Dropped at farmers market', cost_impact: 8.50, created_at: '2026-01-18T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['Lavender Fields (FO)'], quantity: 4, reason: 'expired', note: 'Past 12-month shelf life', cost_impact: 7.40, created_at: '2026-01-30T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Travel Tin'], quantity: 5, reason: 'damaged', note: 'Dented tins from shipping crush', cost_impact: 15.00, created_at: '2026-02-12T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], quantity: 1, reason: 'defective', note: 'Tunneling - wick too small', cost_impact: 6.50, created_at: '2026-03-05T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['9oz Amber Jars'], quantity: 6, reason: 'damaged', note: 'Chipped rims in shipment', cost_impact: 9.90, created_at: '2026-03-18T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Sea Salt & Driftwood'], quantity: 2, reason: 'defective', note: 'Weak scent throw - reformulating', cost_impact: 14.00, created_at: '2026-03-28T10:00:00Z' },
  ]);
  console.log('Waste:', e2 ? e2.message : '10 OK');

  // HISTORY
  const { error: e3 } = await supabase.from('history').insert([
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], item_name: 'Lavender Dreams', change_type: 'restock', quantity_change: 50, new_quantity: 50, note: 'Initial batch', created_at: '2025-08-20T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], item_name: 'Vanilla Bourbon', change_type: 'restock', quantity_change: 40, new_quantity: 40, note: 'Initial batch', created_at: '2025-08-22T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['Soy Wax (464)'], item_name: 'Soy Wax (464)', change_type: 'restock', quantity_change: 100, new_quantity: 100, note: 'PO-2025-001 received', created_at: '2025-08-16T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], item_name: 'Lavender Dreams', change_type: 'sold', quantity_change: -12, new_quantity: 38, note: 'September Etsy orders', created_at: '2025-09-08T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], item_name: 'Vanilla Bourbon', change_type: 'sold', quantity_change: -8, new_quantity: 32, note: 'Shopify orders', created_at: '2025-09-12T10:00:00Z' },
    { business_id: B, item_type: 'production', item_name: 'Production Run', change_type: 'produced', quantity_change: 30, new_quantity: 30, note: 'Lavender + Vanilla batch', created_at: '2025-09-20T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['9oz Amber Jars'], item_name: '9oz Amber Jars', change_type: 'restock', quantity_change: 96, new_quantity: 96, note: 'PO-2025-002 received', created_at: '2025-09-05T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], item_name: 'Lavender Dreams', change_type: 'sold', quantity_change: -18, new_quantity: 50, note: 'October market + online', created_at: '2025-10-15T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Travel Tin'], item_name: 'Lavender Travel Tin', change_type: 'restock', quantity_change: 60, new_quantity: 60, note: 'First travel tin batch', created_at: '2025-10-20T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Travel Tin'], item_name: 'Vanilla Travel Tin', change_type: 'restock', quantity_change: 50, new_quantity: 50, note: 'First travel tin batch', created_at: '2025-10-20T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Cedarwood & Sage'], item_name: 'Cedarwood & Sage', change_type: 'restock', quantity_change: 24, new_quantity: 24, note: 'New scent launch', created_at: '2025-11-05T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], item_name: 'Lavender Dreams', change_type: 'sold', quantity_change: -22, new_quantity: 28, note: 'Holiday rush - November', created_at: '2025-11-25T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], item_name: 'Vanilla Bourbon', change_type: 'sold', quantity_change: -15, new_quantity: 17, note: 'Holiday rush', created_at: '2025-11-28T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['Soy Wax (464)'], item_name: 'Soy Wax (464)', change_type: 'restock', quantity_change: 150, new_quantity: 200, note: 'PO-2025-004 holiday order', created_at: '2025-11-07T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Gift Set (3-Pack)'], item_name: 'Gift Set (3-Pack)', change_type: 'restock', quantity_change: 30, new_quantity: 30, note: 'Holiday gift set assembly', created_at: '2025-12-01T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Gift Set (3-Pack)'], item_name: 'Gift Set (3-Pack)', change_type: 'sold', quantity_change: -18, new_quantity: 12, note: 'Holiday gift sales', created_at: '2025-12-20T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Travel Tin'], item_name: 'Lavender Travel Tin', change_type: 'sold', quantity_change: -25, new_quantity: 35, note: 'Holiday market sales', created_at: '2025-12-22T10:00:00Z' },
    { business_id: B, item_type: 'production', item_name: 'Production Run', change_type: 'produced', quantity_change: 48, new_quantity: 265, note: 'January restock - all scents', created_at: '2026-01-08T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Sea Salt & Driftwood'], item_name: 'Sea Salt & Driftwood', change_type: 'restock', quantity_change: 16, new_quantity: 16, note: 'Coastal scent launch', created_at: '2026-01-15T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], item_name: 'Lavender Dreams', change_type: 'sold', quantity_change: -15, new_quantity: 45, note: 'Valentines promo', created_at: '2026-02-14T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], item_name: 'Vanilla Bourbon', change_type: 'sold', quantity_change: -12, new_quantity: 38, note: 'Valentines promo', created_at: '2026-02-14T10:00:00Z' },
    { business_id: B, item_type: 'production', item_name: 'Production Run', change_type: 'produced', quantity_change: 60, new_quantity: 325, note: 'Feb production - spring prep', created_at: '2026-02-25T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], item_name: 'Lavender Dreams', change_type: 'produced', quantity_change: 24, new_quantity: 66, note: 'March batch 1', created_at: '2026-03-02T08:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], item_name: 'Vanilla Bourbon', change_type: 'produced', quantity_change: 20, new_quantity: 55, note: 'March batch 1', created_at: '2026-03-02T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Cedarwood & Sage'], item_name: 'Cedarwood & Sage', change_type: 'sold', quantity_change: -6, new_quantity: 18, note: 'March - growing demand', created_at: '2026-03-20T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Sea Salt & Driftwood'], item_name: 'Sea Salt & Driftwood', change_type: 'sold', quantity_change: -8, new_quantity: 8, note: 'Selling fast - need restock', created_at: '2026-03-25T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Dreams'], item_name: 'Lavender Dreams', change_type: 'sold', quantity_change: -24, new_quantity: 42, note: 'March - record month', created_at: '2026-03-30T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Vanilla Bourbon'], item_name: 'Vanilla Bourbon', change_type: 'sold', quantity_change: -20, new_quantity: 35, note: 'March sales', created_at: '2026-03-30T10:00:00Z' },
    { business_id: B, item_type: 'material', item_id: m['Soy Wax (464)'], item_name: 'Soy Wax (464)', change_type: 'restock', quantity_change: 100, new_quantity: 180, note: 'PO-2026-003 received', created_at: '2026-03-06T10:00:00Z' },
    { business_id: B, item_type: 'product', item_id: p['Lavender Travel Tin'], item_name: 'Lavender Travel Tin', change_type: 'produced', quantity_change: 48, new_quantity: 85, note: 'Spring market prep', created_at: '2026-04-01T08:00:00Z' },
    { business_id: B, item_type: 'waste', item_name: 'Lavender Dreams', change_type: 'wasted', quantity_change: -3, new_quantity: 0, note: 'Cracked jars in shipping', created_at: '2025-09-15T10:00:00Z' },
    { business_id: B, item_type: 'waste', item_name: 'Vanilla Bourbon', change_type: 'wasted', quantity_change: -2, new_quantity: 0, note: 'Wet spots - bad cure', created_at: '2025-11-20T10:00:00Z' },
  ]);
  console.log('History:', e3 ? e3.message : '32 OK');

  // MORE TRANSACTIONS (older months)
  const { error: e4 } = await supabase.from('transactions').insert([
    { business_id: B, date: '2025-09-15', description: 'Etsy September sales batch', amount: 420.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: B, date: '2025-10-12', description: 'Farmers Market - Fall Festival', amount: 680.00, type: 'income', category: 'sale', source: 'manual', note: 'Best market day yet' },
    { business_id: B, date: '2025-10-28', description: 'Shopify October orders', amount: 352.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: B, date: '2025-11-15', description: 'Etsy + Shopify November', amount: 890.00, type: 'income', category: 'sale', source: 'manual', note: 'Holiday pre-orders' },
    { business_id: B, date: '2025-11-29', description: 'Black Friday Weekend Sales', amount: 1240.00, type: 'income', category: 'sale', source: 'manual', note: 'Record weekend' },
    { business_id: B, date: '2025-12-10', description: 'Holiday Gift Set Sales', amount: 760.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: B, date: '2025-12-20', description: 'Last-minute holiday orders', amount: 540.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: B, date: '2026-01-15', description: 'January online orders', amount: 310.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: B, date: '2026-02-14', description: 'Valentines Day promo', amount: 620.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: B, date: '2026-02-28', description: 'February remaining orders', amount: 445.00, type: 'income', category: 'sale', source: 'manual' },
    { business_id: B, date: '2025-09-10', description: 'CandleScience - Fragrance restock', amount: 156.00, type: 'expense', category: 'materials', source: 'manual' },
    { business_id: B, date: '2025-10-05', description: 'Farmers Market booth fee', amount: 150.00, type: 'expense', category: 'marketing', source: 'manual' },
    { business_id: B, date: '2025-11-01', description: 'Holiday packaging supplies', amount: 285.00, type: 'expense', category: 'packaging', source: 'manual' },
    { business_id: B, date: '2025-11-15', description: 'Black Friday ad spend', amount: 450.00, type: 'expense', category: 'marketing', source: 'manual' },
    { business_id: B, date: '2025-12-01', description: 'Gift box & ribbon supplies', amount: 125.00, type: 'expense', category: 'packaging', source: 'manual' },
    { business_id: B, date: '2026-01-05', description: 'Q1 fragrance order', amount: 340.00, type: 'expense', category: 'materials', source: 'manual' },
    { business_id: B, date: '2026-02-01', description: 'Valentine promo materials', amount: 95.00, type: 'expense', category: 'marketing', source: 'manual' },
    { business_id: B, date: '2026-02-15', description: 'Fillmore - Spring jars order', amount: 327.60, type: 'expense', category: 'packaging', source: 'manual' },
  ]);
  console.log('Extra Transactions:', e4 ? e4.message : '18 OK');

  console.log('\n=== DEMO HISTORY COMPLETE ===');
  console.log('9 Purchase Orders (7 received, 1 sent, 1 draft)');
  console.log('10 Waste entries (damaged, defective, expired, lost)');
  console.log('32 History entries (Aug 2025 - Apr 2026)');
  console.log('18 Additional transactions (Sep 2025 - Feb 2026)');
})();
