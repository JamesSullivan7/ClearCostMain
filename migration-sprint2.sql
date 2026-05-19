-- ═══════════════════════════════════════════════════════════
-- Sprint 2 Migration: Customers + Sales Orders
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── Customers Table ───────────────────────────────────
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  company TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  total_spent NUMERIC(12,2) DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_name ON customers(business_id, name);

-- Customers RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_s ON customers FOR SELECT USING (business_id = get_business_id());
CREATE POLICY customers_i ON customers FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY customers_u ON customers FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY customers_d ON customers FOR DELETE USING (business_id = get_business_id());

-- ── Sales Orders Table ────────────────────────────────
CREATE TABLE sales_orders (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_id BIGINT,
  status TEXT DEFAULT 'draft',
  line_items JSONB DEFAULT '[]',
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  shipping_address TEXT DEFAULT '',
  tracking_number TEXT DEFAULT '',
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sales_orders_business ON sales_orders(business_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(business_id, status);
CREATE INDEX idx_sales_orders_customer ON sales_orders(business_id, customer_id);

-- Sales Orders RLS
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_s ON sales_orders FOR SELECT USING (business_id = get_business_id());
CREATE POLICY sales_i ON sales_orders FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY sales_u ON sales_orders FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY sales_d ON sales_orders FOR DELETE USING (business_id = get_business_id());

-- ── Add customer_id to transactions table ─────────────
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id BIGINT;
