-- ═══════════════════════════════════════════════════════════
-- Sprint 4 Migration: Team Members
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── Team Members Table ────────────────────────────────
CREATE TABLE team_members (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_team_business ON team_members(business_id);
CREATE INDEX idx_team_email ON team_members(email);
CREATE INDEX idx_team_user ON team_members(user_id);

-- Team Members RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_s ON team_members FOR SELECT USING (business_id = get_business_id());
CREATE POLICY team_i ON team_members FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY team_u ON team_members FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY team_d ON team_members FOR DELETE USING (business_id = get_business_id());

-- ── Update RLS to allow team members access ───────────
-- Override get_business_id() to also check team_members table
CREATE OR REPLACE FUNCTION get_business_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT id FROM businesses WHERE auth_user_id = auth.uid()),
    (SELECT business_id FROM team_members WHERE user_id = auth.uid() AND status = 'accepted' LIMIT 1)
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
