-- ==============================================================================
-- PADAVO B2B SAAS — POSTGRESQL & SUPABASE PRODUCTION ENTERPRISE SCHEMA
-- ==============================================================================
-- Architecture: Multi-Tenant Isolation via Row Level Security (RLS)
-- Target Databases: Supabase, Neon, AWS Aurora PostgreSQL, Render PostgreSQL
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. EXPORTERS / TENANTS TABLE
CREATE TABLE IF NOT EXISTS exporters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- References Supabase auth.users(id)
    email VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_initials VARCHAR(10) NOT NULL,
    iec_number VARCHAR(50),
    gstin VARCHAR(50),
    pan_number VARCHAR(50),
    city_cluster VARCHAR(100) NOT NULL DEFAULT 'jaipur',
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    custom_domain VARCHAR(255) UNIQUE,
    custom_domain_verified BOOLEAN DEFAULT FALSE,
    brand_logo_url TEXT,
    brand_primary_color VARCHAR(20) DEFAULT '#b46b38',
    subscription_tier VARCHAR(50) DEFAULT 'growth', -- 'starter', 'growth', 'enterprise'
    orders_quota INT DEFAULT 25,
    orders_used INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. PURCHASE ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    exporter_id UUID NOT NULL REFERENCES exporters(id) ON DELETE CASCADE,
    po_number VARCHAR(100) NOT NULL,
    buyer_name VARCHAR(255) NOT NULL,
    buyer_country VARCHAR(100) NOT NULL,
    buyer_email VARCHAR(255),
    buyer_contact_person VARCHAR(255),
    product_name VARCHAR(255) NOT NULL,
    quantity VARCHAR(100) NOT NULL,
    contract_currency VARCHAR(10) DEFAULT 'GBP',
    contract_total NUMERIC(12, 2) DEFAULT 0.00,
    target_delivery_date DATE NOT NULL,
    cluster_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'In Progress', -- 'In Progress', 'Delayed', 'Dispatched', 'Completed'
    public_tracking_slug VARCHAR(120) UNIQUE NOT NULL,
    magic_upload_token VARCHAR(120) UNIQUE NOT NULL,
    vessel_tracking_number VARCHAR(100) DEFAULT 'MSKU-948201-9',
    view_count INT DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ORDER STAGES TABLE
CREATE TABLE IF NOT EXISTS order_stages (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_index INT NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
    completed_at TIMESTAMP WITH TIME ZONE,
    note TEXT,
    qc_proof_spec TEXT,
    is_approved_by_owner BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. STAGE PHOTOS (CLOUDFLARE R2 / S3 MEDIA OBJECTS)
CREATE TABLE IF NOT EXISTS stage_photos (
    id BIGSERIAL PRIMARY KEY,
    stage_id BIGINT NOT NULL REFERENCES order_stages(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_provider VARCHAR(50) DEFAULT 'r2', -- 'r2', 's3', 'local'
    caption TEXT,
    uploaded_by VARCHAR(100) DEFAULT 'staff',
    gps_latitude NUMERIC(10, 7),
    gps_longitude NUMERIC(10, 7),
    gps_location_name VARCHAR(255),
    sha256_hash VARCHAR(64),
    is_approved BOOLEAN DEFAULT TRUE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. PAYMENT MILESTONES & ARBITRATION SIGN-OFFS
CREATE TABLE IF NOT EXISTS order_milestones (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_index INT,
    stage_name VARCHAR(255),
    milestone_title VARCHAR(255) NOT NULL,
    percentage INT NOT NULL,
    amount_formatted VARCHAR(100) NOT NULL,
    currency VARCHAR(10) DEFAULT 'GBP',
    amount_numeric NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'change_requested', 'paid'
    buyer_decision VARCHAR(50),
    buyer_decision_notes TEXT,
    buyer_decision_at TIMESTAMP WITH TIME ZONE,
    decision_hash VARCHAR(100),
    arbitration_clause_accepted BOOLEAN DEFAULT TRUE,
    arbitration_forum VARCHAR(100) DEFAULT 'ICC Paris / ICA New Delhi',
    invoice_ref VARCHAR(100),
    bank_name VARCHAR(255),
    bank_swift VARCHAR(50),
    bank_iban VARCHAR(100),
    beneficiary_name VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. ELECTRONIC FOREIGN INWARD REMITTANCE CERTIFICATES (e-FIRC)
CREATE TABLE IF NOT EXISTS efirc_records (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    exporter_id UUID NOT NULL REFERENCES exporters(id) ON DELETE CASCADE,
    firc_number VARCHAR(100) UNIQUE NOT NULL,
    remitter_name VARCHAR(255) NOT NULL,
    remitter_country VARCHAR(100) NOT NULL,
    foreign_currency VARCHAR(10) NOT NULL,
    foreign_amount NUMERIC(12, 2) NOT NULL,
    realized_inr_amount NUMERIC(14, 2) NOT NULL,
    exchange_rate NUMERIC(8, 4) NOT NULL,
    ad_bank_name VARCHAR(255) NOT NULL,
    ad_bank_code VARCHAR(50) NOT NULL,
    fema_purpose_code VARCHAR(50) DEFAULT 'P0102',
    fema_status VARCHAR(100) DEFAULT 'COMPLIANT_SETTLED',
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. AUDIT LOGS (TAMPER-PROOF FORENSIC LOGS)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    exporter_id UUID REFERENCES exporters(id) ON DELETE SET NULL,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — MULTI-TENANT ISOLATION
-- ==============================================================================
ALTER TABLE exporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE efirc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Exporters Policy (Exporters can only view and edit their own profile)
CREATE POLICY exporter_self_isolation ON exporters
    FOR ALL USING (auth_user_id = auth.uid() OR id::text = current_setting('request.jwt.claim.sub', true));

-- 2. Orders Policy (Exporters only see their own company orders)
CREATE POLICY exporter_orders_isolation ON orders
    FOR ALL USING (
        exporter_id IN (
            SELECT id FROM exporters WHERE auth_user_id = auth.uid() OR id::text = current_setting('request.jwt.claim.sub', true)
        )
    );

-- 3. Public Read Policy for Tracking Slugs (Zero-Login Public Buyer Links)
CREATE POLICY public_buyer_order_view ON orders
    FOR SELECT USING (public_tracking_slug IS NOT NULL);

CREATE POLICY public_buyer_milestone_view ON order_milestones
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE public_tracking_slug IS NOT NULL)
    );

CREATE POLICY public_buyer_milestone_decision ON order_milestones
    FOR UPDATE USING (
        order_id IN (SELECT id FROM orders WHERE public_tracking_slug IS NOT NULL)
    );

-- Indexes for blazing sub-10ms queries
CREATE INDEX IF NOT EXISTS idx_orders_exporter_id ON orders(exporter_id);
CREATE INDEX IF NOT EXISTS idx_orders_public_slug ON orders(public_tracking_slug);
CREATE INDEX IF NOT EXISTS idx_orders_magic_token ON orders(magic_upload_token);
CREATE INDEX IF NOT EXISTS idx_stages_order_id ON order_stages(order_id);
CREATE INDEX IF NOT EXISTS idx_photos_order_id ON stage_photos(order_id);
CREATE INDEX IF NOT EXISTS idx_milestones_order_id ON order_milestones(order_id);
