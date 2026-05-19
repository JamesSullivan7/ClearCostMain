-- ClearCost: Add daily_snapshots table + ship_from_address column
-- Run this in the Supabase SQL Editor after the base schema (setup-db.sql)

-- ── Daily Snapshots ──────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_snapshots (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, date)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_business ON daily_snapshots(business_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(business_id, date DESC);

ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_select ON daily_snapshots FOR SELECT USING (business_id = get_business_id());
CREATE POLICY snapshots_insert ON daily_snapshots FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY snapshots_update ON daily_snapshots FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY snapshots_delete ON daily_snapshots FOR DELETE USING (business_id = get_business_id());

-- ── Add ship_from_address to businesses ──────────────

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ship_from_address JSONB DEFAULT '{}';

-- ── Add customers table if not already present ───────

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  company TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  total_spent NUMERIC(12,2) DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_select ON customers FOR SELECT USING (business_id = get_business_id());
CREATE POLICY customers_insert ON customers FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY customers_update ON customers FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY customers_delete ON customers FOR DELETE USING (business_id = get_business_id());

-- ── Add sales_orders table if not already present ────

CREATE TABLE IF NOT EXISTS sales_orders (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_id BIGINT,
  status TEXT DEFAULT 'draft',
  line_items JSONB DEFAULT '[]',
  subtotal NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  shipping_address TEXT DEFAULT '',
  shipping_carrier TEXT DEFAULT '',
  tracking_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales_orders(business_id, status);

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_select ON sales_orders FOR SELECT USING (business_id = get_business_id());
CREATE POLICY sales_insert ON sales_orders FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY sales_update ON sales_orders FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY sales_delete ON sales_orders FOR DELETE USING (business_id = get_business_id());
