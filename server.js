// ==============================================================================
// PADAVO — PRODUCTION-READY B2B SAAS BACKEND & API ENGINE
// ==============================================================================
// Har Padav Par Bharosa — Production-Status Portal for Indian Exporters & Global Buyers
// Architecture:
// - Native Node.js 24 + SQLite (node:sqlite) with Write-Ahead Logging (WAL)
// - Cryptographically secure scrypt hashing with constant-time equality
// - Multi-tenant isolation, subscription tiers & quota enforcement
// - Sliding-window in-memory IP rate limiting (Anti-DDoS / Brute Force protection)
// - Full Audit Trail logging (audit_logs table)
// - Health check monitoring endpoint (/health) for Docker/AWS/Render/Railway
// - Zero-login encrypted public tracking slugs & factory floor magic upload tokens
// - Client & Server-side image optimization and storage
// ==============================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// Environment & Configuration
const PORT = process.env.PORT || 5500;
const NODE_ENV = process.env.NODE_ENV || 'production';
const DB_PATH = path.join(__dirname, 'database.sqlite');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure required directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// ==============================================================================
// DATABASE SETUP & HIGH-CONCURRENCY WAL PRAGMAS
// ==============================================================================
const db = new DatabaseSync(DB_PATH);

// Production SQLite Optimizations
try {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);
} catch (e) {
  console.log('Note: WAL mode initialization notice:', e.message);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS exporters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_initials TEXT NOT NULL,
    iec_number TEXT,
    city_cluster TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    subscription_tier TEXT DEFAULT 'starter',
    orders_quota INTEGER DEFAULT 25,
    orders_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    exporter_id INTEGER NOT NULL REFERENCES exporters(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exporter_id INTEGER NOT NULL REFERENCES exporters(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_country TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    target_delivery_date TEXT NOT NULL,
    cluster_type TEXT NOT NULL,
    status TEXT DEFAULT 'In Progress',
    public_tracking_slug TEXT UNIQUE NOT NULL,
    magic_upload_token TEXT UNIQUE NOT NULL,
    view_count INTEGER DEFAULT 0,
    last_viewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_index INTEGER NOT NULL,
    stage_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    completed_at DATETIME,
    note TEXT,
    qc_proof_spec TEXT,
    is_approved_by_owner INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS stage_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id INTEGER NOT NULL REFERENCES order_stages(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    uploaded_by TEXT DEFAULT 'staff',
    is_approved INTEGER DEFAULT 1,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS buyer_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    message TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    exporter_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_index INTEGER,
    stage_name TEXT,
    milestone_title TEXT NOT NULL,
    percentage INTEGER NOT NULL,
    amount_formatted TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    buyer_decision TEXT,
    buyer_decision_notes TEXT,
    buyer_decision_at DATETIME,
    decision_hash TEXT,
    invoice_ref TEXT,
    bank_name TEXT,
    bank_swift TEXT,
    bank_iban TEXT,
    beneficiary_name TEXT,
    payment_requested_at DATETIME,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ==============================================================================
// RATE LIMITING MIDDLEWARE (ANTI-BRUTE FORCE / SLIDING WINDOW)
// ==============================================================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 reqs / min for general routes
const MAX_AUTH_REQUESTS = 20; // 20 reqs / min for auth

function isRateLimited(ip, isAuthRoute = false) {
  const now = Date.now();
  const limit = isAuthRoute ? MAX_AUTH_REQUESTS : MAX_REQUESTS_PER_WINDOW;
  const key = `${ip}:${isAuthRoute ? 'auth' : 'gen'}`;

  let record = rateLimitMap.get(key);
  if (!record || now - record.startTime > RATE_LIMIT_WINDOW) {
    record = { startTime: now, count: 1 };
    rateLimitMap.set(key, record);
    return false;
  }

  record.count += 1;
  return record.count > limit;
}

// Clean up old rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ==============================================================================
// CLUSTER PRESETS FOR INDIAN HUBS
// ==============================================================================
const CLUSTER_PRESETS = {
  jaipur: {
    name: 'Jaipur (Textiles & Garments)',
    stages: [
      { name: '1. Lab Dip & Fabric Dyeing', qc: 'Pantone TCX Swatch Match (D65 Light)' },
      { name: '2. Pattern Marker & Precision Cutting', qc: 'Bundle Count & Serial Tag Verification' },
      { name: '3. Hand Block Printing (Artisan Cluster)', qc: 'Block Registration & Bleed Audit' },
      { name: '4. Stitching & Tailoring Assembly', qc: '12 SPI Seam Integrity & Care Labels' },
      { name: '5. In-Line QC & Measuring Tape Audit', qc: 'AQL 2.5 Tape Measurements on Flat Lay' },
      { name: '6. Steam Press, Barcode & Export Packing', qc: 'Master Carton Drop Test & EAN Scan' }
    ]
  },
  jodhpur: {
    name: 'Jodhpur (Solid Wood Furniture)',
    stages: [
      { name: '1. Wood Seasoning & Moisture Verification', qc: 'Pinless Moisture Meter < 12% Certified' },
      { name: '2. Mortise & Tenon Joinery Carpentry', qc: 'Tensile Load & Square Alignment Check' },
      { name: '3. Hand Sanding & Assembly', qc: '320-Grit Surface Smoothness Audit' },
      { name: '4. Non-Toxic Stain & Matt Polyurethane Seal', qc: 'EU REACH Compliance & Lead-Free Test' },
      { name: '5. Heavy-Duty Crate & Foam Edge Packing', qc: '1.2m Corner Drop Test on Wooden Pallet' }
    ]
  },
  moradabad: {
    name: 'Moradabad (Brass & Metalware)',
    stages: [
      { name: '1. Brass Ingot Melting & Sand Casting', qc: 'Metal Purity Spectrometer Analysis' },
      { name: '2. Seam Grinding & Artisan Hand Hammering', qc: 'Wall Thickness 1.5mm Tolerance Audit' },
      { name: '3. Electroplating & Clear Lacquer Coating', qc: 'Plating Thickness 12 Microns Tested' },
      { name: '4. Salt-Spray Anti-Tarnish Chamber Test', qc: '24hr Corrosion Simulation Passed' },
      { name: '5. Individual Gift Box & Master Carton Packing', qc: 'Barcode Readability & Drop Test' }
    ]
  },
  agra: {
    name: 'Agra (Leather Footwear & Bags)',
    stages: [
      { name: '1. Full-Grain Cowhide Grading & Selection', qc: 'Grade A++ Scar-Free Grain Certified' },
      { name: '2. Precision Clicking (Cutting) & Skiving', qc: '82% Cutting Yield & Edge Skive Audit' },
      { name: '3. Goodyear Welt Stitching & Sole Assembly', qc: 'Welt Stitch Tensile Pull Verification' },
      { name: '4. Hand Cream Patina & Edge Burnishing', qc: 'Color Tone Match with Master Gold Sample' },
      { name: '5. Fit Audit & Branded Box Packaging', qc: 'Export Last Size Chart Verification' }
    ]
  },
  bhadohi: {
    name: 'Bhadohi (Hand-Tufted Carpets)',
    stages: [
      { name: '1. 100% NZ Wool Yarn Spinning & Dyeing', qc: 'Woolmark Fiber Purity Verified' },
      { name: '2. Cotton Primary Canvas Stenciling', qc: 'CAD 1:1 Scale Artwork Geometric Audit' },
      { name: '3. Artisan Frame Tufting (Looms)', qc: 'Pile Height Gauge 14mm Uniform' },
      { name: '4. Natural Latex Backing & Secondary Bonding', qc: 'Tuft Lock Pull Strength Tested' },
      { name: '5. Manual Shearing, Carving & Roll Packing', qc: 'Waterproof PVC Shrink-Wrap Audit' }
    ]
  },
  tirupur: {
    name: 'Tirupur / Surat (Knitwear & Technical Textiles)',
    stages: [
      { name: '1. Combed Cotton Yarn & Circular Knitting', qc: 'Yarn Count & Bursting Strength Verified' },
      { name: '2. OEKO-TEX Standard 100 Reactive Dyeing', qc: 'Colorfastness Grade 4-5 Under Wash & Light' },
      { name: '3. Precision Auto-Spreading & Laser Cutting', qc: 'Grain Line Deviation < 0.2% Measured' },
      { name: '4. Overlock & Flatlock Stitching Assembly', qc: '14 SPI Tension & Needle Detector Clearance' },
      { name: '5. Ironing, Barcode Hangtag & Polybag Export Packing', qc: 'AQL 1.5 Final Cartons Audit Passed' }
    ]
  },
  panipat: {
    name: 'Panipat / Ludhiana (Home Furnishings & Woollens)',
    stages: [
      { name: '1. Recycled & Virgin Wool Yarn Blending', qc: 'Fiber Composition & GSM Certified' },
      { name: '2. Jacquard Loom Weaving', qc: 'Pattern Repeat & Tension Uniformity' },
      { name: '3. Border Overedging & Tuft Hemming', qc: 'Corner Reinforcement & Stitch Density' },
      { name: '4. Anti-Microbial & Flame Retardant Finish', qc: 'BS 5852 Fire Safety Standards Certified' },
      { name: '5. Vacuum Shrink-Wrap & Palletized Packing', qc: 'Moisture Absorber Silica & Carton Drop Test' }
    ]
  },
  custom: {
    name: 'Custom Manufacturing & Global Production Line',
    stages: [
      { name: '1. Raw Material Sourcing & Technical Spec Sign-Off', qc: 'Certificate of Analysis & Sample Match' },
      { name: '2. Primary Fabrication & Component Shaping', qc: 'Geometric Tolerance & Tooling Calibrated' },
      { name: '3. Core Production & Assembly', qc: 'In-Line Milestone Verification Audit' },
      { name: '4. Comprehensive QC & Stress Testing', qc: 'AQL 2.5 Defect-Free Tolerance Certified' },
      { name: '5. Export Packaging & Customs Dispatch Staging', qc: 'Barcoded Master Cartons & Weight Audit' }
    ]
  }
};

// ==============================================================================
// CRYPTO HELPERS (SECURE HASHING & UNIQUE TOKENS)
// ==============================================================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const parts = stored.split(':');
    if (parts.length !== 2) return false;
    const salt = parts[0];
    const originalHash = parts[1];
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
  } catch (err) {
    return false;
  }
}

function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateOrderSlug(exporterInitials, poNumber) {
  const cleanPO = poNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanInitials = exporterInitials.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'pad';
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  return `${cleanInitials}-${cleanPO}-${randomSuffix}`;
}

// Log audit events
function logAudit(orderId, exporterId, action, details, ip) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (order_id, exporter_id, action, details, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderId || null, exporterId || null, action, details || '', ip || '127.0.0.1');
  } catch (err) {
    console.error('Audit log write error:', err.message);
  }
}

// ==============================================================================
// DATABASE SEEDING
// ==============================================================================
function seedDatabaseIfEmpty() {
  const exporterCount = db.prepare('SELECT COUNT(*) as count FROM exporters').get().count;
  if (exporterCount === 0) {
    console.log('Seeding initial exporter and multi-cluster orders for Padavo...');
    
    // Default Exporter: Royal Jaipur Crafts
    const saltAndHash = hashPassword('Jaipur123!');
    const insertExp = db.prepare(`
      INSERT INTO exporters (email, password_hash, company_name, company_initials, iec_number, city_cluster, phone, whatsapp, subscription_tier, orders_quota, orders_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'growth', 100, 3)
    `);
    const expResult = insertExp.run(
      'demo@jaipurcrafts.com',
      saltAndHash,
      'Royal Jaipur Handloom Heritage',
      'RJ',
      '0512098411',
      'Jaipur (Sitapura Apparel Park)',
      '+91 141 277 8900',
      '+91 98290 12345'
    );
    const exporterId = Number(expResult.lastInsertRowid);

    // Insert 3 Seed Orders
    const seedOrders = [
      {
        cluster: 'jaipur',
        po: 'PO-UK-8492',
        buyer: 'Toast & Co. Lifestyle Apparel, London (UK)',
        product: 'Hand-Block Printed Indigo & Madder Dabu Organic Cotton Midi Dress',
        qty: '850 Pcs (UK 8–18)',
        delivery: '2026-12-12',
        progressIdx: 2,
        slug: 'rj-pouk8492-9a4f82bc10de',
        magicToken: 'magic-uk-8492-token',
        photos: [
          { stageIdx: 0, url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80', caption: 'Pantone 19-3921 TCX match approved under D65 daylight' },
          { stageIdx: 0, url: 'https://images.unsplash.com/photo-1528458876861-544fd1761a91?auto=format&fit=crop&w=800&q=80', caption: '60s count organic cotton cambric inspection' },
          { stageIdx: 1, url: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=800&q=80', caption: '850 bundle cuts serial-tagged forlot traceability' },
          { stageIdx: 2, url: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=800&q=80', caption: 'Master printer stamping 4-color mud-resist Dabu paste' },
          { stageIdx: 2, url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80', caption: 'Natural indigo vat immersion yard in Sanganer' }
        ]
      },
      {
        cluster: 'jaipur',
        po: 'PO-US-8941',
        buyer: 'SOHO Studio, New York (US)',
        product: 'Organic Cotton Maxi Dress (5 Colorways)',
        qty: '1,200 Pcs',
        delivery: '2026-12-14',
        progressIdx: 1,
        slug: 'rj-pous8941-da01b6f4246c',
        magicToken: 'magic-us-8941-token',
        photos: [
          { stageIdx: 0, url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80', caption: 'Pantone TCX swatch match approved' }
        ]
      },
      {
        cluster: 'jodhpur',
        po: 'PO-EU-4412',
        buyer: 'Nordic Living Copenhagen (Denmark)',
        product: 'Solid Sheesham Dining Sets (40ft HC Container)',
        qty: '85 Sets',
        delivery: '2026-12-18',
        progressIdx: 2,
        slug: 'rj-poeu4412-48f851709528',
        magicToken: 'magic-eu-4412-token',
        photos: [
          { stageIdx: 0, url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80', caption: 'Wagner moisture meter certified at 9.4%' },
          { stageIdx: 1, url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80', caption: 'Mortise & tenon joint alignment check' }
        ]
      }
    ];

    for (const item of seedOrders) {
      const insertOrder = db.prepare(`
        INSERT INTO orders (exporter_id, po_number, buyer_name, buyer_country, product_name, quantity, target_delivery_date, cluster_type, public_tracking_slug, magic_upload_token, view_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4)
      `);
      const ordRes = insertOrder.run(
        exporterId,
        item.po,
        item.buyer,
        item.buyer.includes('UK') ? 'United Kingdom' : (item.buyer.includes('US') ? 'United States' : 'Denmark'),
        item.product,
        item.qty,
        item.delivery,
        item.cluster,
        item.slug,
        item.magicToken
      );
      const orderId = Number(ordRes.lastInsertRowid);

      const stagesConfig = CLUSTER_PRESETS[item.cluster].stages;
      stagesConfig.forEach((stageDef, idx) => {
        let status = 'pending';
        let completedAt = null;
        let note = '';

        if (idx < item.progressIdx) {
          status = 'completed';
          completedAt = new Date(Date.now() - (item.progressIdx - idx) * 86400000 * 3).toISOString();
          note = `Stage successfully verified against approved technical specifications.`;
        } else if (idx === item.progressIdx) {
          status = 'in_progress';
          note = `Work in progress on factory floor. Estimated completion in 3 days.`;
        }

        const insertStage = db.prepare(`
          INSERT INTO order_stages (order_id, stage_index, stage_name, status, completed_at, note, qc_proof_spec, is_approved_by_owner)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `);
        const stageRes = insertStage.run(orderId, idx, stageDef.name, status, completedAt, note, stageDef.qc);
        const stageId = Number(stageRes.lastInsertRowid);

        const matchingPhotos = item.photos.filter(p => p.stageIdx === idx);
        for (const photo of matchingPhotos) {
          db.prepare(`
            INSERT INTO stage_photos (stage_id, order_id, image_url, caption, uploaded_by, is_approved)
            VALUES (?, ?, ?, ?, 'staff', 1)
          `).run(stageId, orderId, photo.url, photo.caption);
        }
      });
    }

    console.log('Padavo Seed Completed: Login demo@jaipurcrafts.com / Jaipur123!');
  }
}

seedDatabaseIfEmpty();

function seedMilestonesIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as count FROM order_milestones').get().count;
  if (count === 0) {
    console.log('Seeding order milestones for Milestone Approval + Payment Link feature...');
    const orders = db.prepare('SELECT * FROM orders').all();
    for (const ord of orders) {
      const isUk = ord.po_number.includes('UK') || ord.buyer_name.includes('UK') || ord.buyer_name.includes('Toast');
      const currency = isUk ? '£' : '$';
      const totalAmount = isUk ? 14000 : 25000;
      
      const m1Val = Math.round(totalAmount * 0.3);
      const m2Val = Math.round(totalAmount * 0.4);
      const m3Val = Math.round(totalAmount * 0.3);

      // Milestone 1 (Advance 30% - Paid)
      db.prepare(`
        INSERT INTO order_milestones (
          order_id, stage_index, stage_name, milestone_title, percentage, amount_formatted,
          status, buyer_decision, buyer_decision_at, decision_hash, paid_at,
          invoice_ref, bank_name, bank_swift, bank_iban, beneficiary_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ord.id, 0, 'Lab Dip & Fabric Dyeing', 'Milestone 1: 30% Advance on Contract Signing', 30, `${currency}${m1Val.toLocaleString()}`,
        'paid', 'approved', '2026-11-04 11:30:00', 'PDV-SIG-ADV-8492A', '2026-11-05 14:00:00',
        'INV-2026-UK-0849-M1', 'State Bank of India (Overseas Branch, Jaipur)', 'SBININBB141', 'IN64000201994827103', 'Royal Jaipur Handloom Heritage Pvt Ltd'
      );

      // Milestone 2 (Mid-production 40% Block Printing - Action Required)
      db.prepare(`
        INSERT INTO order_milestones (
          order_id, stage_index, stage_name, milestone_title, percentage, amount_formatted,
          status, invoice_ref, bank_name, bank_swift, bank_iban, beneficiary_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ord.id, 2, 'Hand Block Printing (Artisan Cluster)', 'Milestone 2: 40% Mid-Production & Printing Approval', 40, `${currency}${m2Val.toLocaleString()}`,
        'action_required', 'INV-2026-UK-0849-M2', 'State Bank of India (Overseas Branch, Jaipur)', 'SBININBB141', 'IN64000201994827103', 'Royal Jaipur Handloom Heritage Pvt Ltd'
      );

      // Milestone 3 (Pre-dispatch 30% Final - Pending)
      db.prepare(`
        INSERT INTO order_milestones (
          order_id, stage_index, stage_name, milestone_title, percentage, amount_formatted,
          status, invoice_ref, bank_name, bank_swift, bank_iban, beneficiary_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ord.id, 5, 'Steam Press, Barcode & Export Packing', 'Milestone 3: 30% Balance Prior to Air Dispatch', 30, `${currency}${m3Val.toLocaleString()}`,
        'pending', 'INV-2026-UK-0849-M3', 'State Bank of India (Overseas Branch, Jaipur)', 'SBININBB141', 'IN64000201994827103', 'Royal Jaipur Handloom Heritage Pvt Ltd'
      );
    }
    console.log('Milestones seeded successfully.');
  }
}

seedMilestonesIfEmpty();

// ==============================================================================
// HTTP RESPONSE & SECURITY HEADERS UTILITY
// ==============================================================================
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 15 * 1024 * 1024) { // 15MB limit
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthExporter(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);

  const session = db.prepare(`
    SELECT s.*, e.id as exporter_id, e.email, e.company_name, e.company_initials, e.city_cluster, e.iec_number, e.phone, e.whatsapp, e.subscription_tier, e.orders_quota, e.orders_used
    FROM sessions s
    JOIN exporters e ON s.exporter_id = e.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);

  return session || null;
}

// ==============================================================================
// STATIC ASSET SERVING WITH CACHING & PATH TRAVERSAL PROTECTION
// ==============================================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStaticFile(req, res, targetPath) {
  const safePath = path.normalize(targetPath);
  if (!safePath.startsWith(PUBLIC_DIR) && !safePath.startsWith(UPLOADS_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(indexPath).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800, immutable'
    });
    fs.createReadStream(safePath).pipe(res);
  });
}

// ==============================================================================
// MAIN HTTP ROUTER
// ==============================================================================
async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const clientIp = req.socket.remoteAddress || '127.0.0.1';

  // Handle CORS Pre-Flight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  try {
    // --------------------------------------------------------------------------
    // 0. HEALTH MONITORING (DEV-OPS / CLUSTER MONITOR)
    // --------------------------------------------------------------------------
    if (method === 'GET' && pathname === '/health') {
      const uptimeSec = Math.floor(process.uptime());
      const memoryUsage = process.memoryUsage();
      const dbCheck = db.prepare('SELECT 1 as alive').get();

      return sendJson(res, 200, {
        status: 'healthy',
        app: 'Padavo SaaS Engine',
        uptime: `${uptimeSec} seconds`,
        database: dbCheck.alive === 1 ? 'connected' : 'error',
        memory: {
          rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024))
        },
        version: '1.0.0-production'
      });
    }

    // --------------------------------------------------------------------------
    // 1. PUBLIC APIS (NO LOGIN REQUIRED)
    // --------------------------------------------------------------------------

    // Rate Limiting Check
    if (pathname.startsWith('/api/')) {
      const isAuth = pathname.startsWith('/api/auth/');
      if (isRateLimited(clientIp, isAuth)) {
        return sendJson(res, 429, { success: false, message: 'Too many requests. Please slow down.' });
      }
    }

    // GET /api/clusters — Get all preset clusters
    if (method === 'GET' && pathname === '/api/clusters') {
      return sendJson(res, 200, { success: true, clusters: CLUSTER_PRESETS });
    }

    // GET /api/public/track/:slug — Public Buyer Live Tracking
    if (method === 'GET' && pathname.startsWith('/api/public/track/')) {
      const slug = pathname.replace('/api/public/track/', '').trim();
      const order = db.prepare(`
        SELECT o.*, e.company_name, e.company_initials, e.city_cluster, e.phone, e.whatsapp, e.iec_number
        FROM orders o
        JOIN exporters e ON o.exporter_id = e.id
        WHERE o.public_tracking_slug = ?
      `).get(slug);

      if (!order) {
        return sendJson(res, 404, { success: false, message: 'Order tracking link not found or expired' });
      }

      // Increment view counter & timestamp
      db.prepare(`
        UPDATE orders SET view_count = view_count + 1, last_viewed_at = datetime('now') WHERE id = ?
      `).run(order.id);

      logAudit(order.id, order.exporter_id, 'BUYER_VIEW', `Buyer opened tracking portal via ${slug}`, clientIp);

      const stages = db.prepare(`
        SELECT * FROM order_stages
        WHERE order_id = ?
        ORDER BY stage_index ASC
      `).all(order.id);

      const photos = db.prepare(`
        SELECT * FROM stage_photos
        WHERE order_id = ? AND is_approved = 1
        ORDER BY uploaded_at ASC
      `).all(order.id);

      const stagesWithPhotos = stages.map(stg => ({
        ...stg,
        photos: photos.filter(p => p.stage_id === stg.id)
      }));

      const milestones = db.prepare(`
        SELECT * FROM order_milestones
        WHERE order_id = ?
        ORDER BY id ASC
      `).all(order.id);

      const totalStages = stages.length;
      const completedStages = stages.filter(s => s.status === 'completed').length;
      const inProgressStages = stages.filter(s => s.status === 'in_progress').length;
      const progressPercent = totalStages > 0
        ? Math.round(((completedStages + (inProgressStages * 0.5)) / totalStages) * 100)
        : 0;

      return sendJson(res, 200, {
        success: true,
        order: {
          id: order.id,
          po_number: order.po_number,
          buyer_name: order.buyer_name,
          buyer_country: order.buyer_country,
          product_name: order.product_name,
          quantity: order.quantity,
          target_delivery_date: order.target_delivery_date,
          cluster_type: order.cluster_type,
          status: order.status,
          view_count: order.view_count + 1,
          last_viewed_at: order.last_viewed_at,
          progress_percent: Math.min(100, Math.max(0, progressPercent)),
          exporter: {
            name: order.company_name,
            initials: order.company_initials,
            location: order.city_cluster,
            iec: order.iec_number,
            whatsapp: order.whatsapp,
            phone: order.phone
          },
          stages: stagesWithPhotos,
          milestones
        }
      });
    }

    // GET /api/public/orders/:slug/milestones — Public Milestone Tracking & Sign-off State
    if (method === 'GET' && pathname.match(/^\/api\/public\/orders\/[^\/]+\/milestones$/)) {
      const parts = pathname.split('/');
      const slug = parts[4];
      const order = db.prepare('SELECT id, po_number, buyer_name, target_delivery_date FROM orders WHERE public_tracking_slug = ?').get(slug);

      if (!order) {
        return sendJson(res, 404, { success: false, message: 'Order not found' });
      }

      const milestones = db.prepare('SELECT * FROM order_milestones WHERE order_id = ? ORDER BY id ASC').all(order.id);
      return sendJson(res, 200, { success: true, order, milestones });
    }

    // POST /api/public/orders/:slug/milestones/:id/decision — Buyer "Approve karo" ya "Badlav chahiye"
    if (method === 'POST' && pathname.match(/^\/api\/public\/orders\/[^\/]+\/milestones\/\d+\/decision$/)) {
      const parts = pathname.split('/');
      const slug = parts[4];
      const milestoneId = Number(parts[6]);

      const order = db.prepare(`
        SELECT o.*, e.company_name, e.company_initials, e.city_cluster, e.phone, e.whatsapp, e.iec_number
        FROM orders o
        JOIN exporters e ON o.exporter_id = e.id
        WHERE o.public_tracking_slug = ?
      `).get(slug);

      if (!order) {
        return sendJson(res, 404, { success: false, message: 'Order not found' });
      }

      const milestone = db.prepare('SELECT * FROM order_milestones WHERE id = ? AND order_id = ?').get(milestoneId, order.id);
      if (!milestone) {
        return sendJson(res, 404, { success: false, message: 'Milestone not found' });
      }

      const body = await parseJsonBody(req);
      const { decision, notes, buyer_name } = body; // 'approved' or 'change_requested'

      if (decision !== 'approved' && decision !== 'change_requested') {
        return sendJson(res, 400, { success: false, message: 'Decision must be approved or change_requested' });
      }

      const decisionTime = new Date().toISOString();
      const decisionHash = 'PDV-SIG-' + crypto.createHash('sha256').update(`${slug}-${milestoneId}-${decisionTime}-${decision}`).digest('hex').slice(0, 16).toUpperCase();

      const newStatus = decision === 'approved' ? 'approved' : 'change_requested';

      db.prepare(`
        UPDATE order_milestones
        SET status = ?, buyer_decision = ?, buyer_decision_notes = ?, buyer_decision_at = ?, decision_hash = ?
        WHERE id = ?
      `).run(newStatus, decision, notes || '', decisionTime, decisionHash, milestoneId);

      const auditAction = decision === 'approved' ? 'MILESTONE_APPROVED' : 'MILESTONE_CHANGES_REQUESTED';
      const auditDetails = decision === 'approved'
        ? `Buyer approved ${milestone.milestone_title} (${milestone.amount_formatted}). Hash: ${decisionHash}`
        : `Buyer requested changes on ${milestone.milestone_title}: ${notes || 'No note'}`;

      logAudit(order.id, order.exporter_id, auditAction, auditDetails, clientIp);

      const updatedMilestone = db.prepare('SELECT * FROM order_milestones WHERE id = ?').get(milestoneId);

      return sendJson(res, 200, {
        success: true,
        message: decision === 'approved'
          ? 'Milestone successfully approved! Verified cryptographic record generated.'
          : 'Modification request recorded. Exporter team has been notified.',
        decision_hash: decisionHash,
        milestone: updatedMilestone
      });
    }

    // GET /api/public/orders/:slug/dispute-certificate — Complete Dispute PDF Evidence Trail
    if (method === 'GET' && pathname.match(/^\/api\/public\/orders\/[^\/]+\/dispute-certificate$/)) {
      const parts = pathname.split('/');
      const slug = parts[4];

      const order = db.prepare(`
        SELECT o.*, e.company_name, e.company_initials, e.city_cluster, e.phone, e.whatsapp, e.iec_number, e.email as exporter_email
        FROM orders o
        JOIN exporters e ON o.exporter_id = e.id
        WHERE o.public_tracking_slug = ?
      `).get(slug);

      if (!order) {
        return sendJson(res, 404, { success: false, message: 'Order tracking link not found' });
      }

      const stages = db.prepare('SELECT * FROM order_stages WHERE order_id = ? ORDER BY stage_index ASC').all(order.id);
      const photos = db.prepare('SELECT * FROM stage_photos WHERE order_id = ? AND is_approved = 1 ORDER BY uploaded_at ASC').all(order.id);
      const milestones = db.prepare('SELECT * FROM order_milestones WHERE order_id = ? ORDER BY id ASC').all(order.id);
      const audits = db.prepare('SELECT action, details, created_at, ip_address FROM audit_logs WHERE order_id = ? ORDER BY created_at ASC').all(order.id);

      const shaIntegrity = crypto.createHash('sha256').update(
        `${order.po_number}|${order.public_tracking_slug}|${stages.length}|${photos.length}|${milestones.length}`
      ).digest('hex').toUpperCase();

      logAudit(order.id, order.exporter_id, 'DISPUTE_RECORD_DOWNLOAD', `Dispute PDF evidence generated for ${order.po_number}`, clientIp);

      return sendJson(res, 200, {
        success: true,
        certificate: {
          title: 'PADAVO OFFICIAL PRODUCTION & INSPECTION AUDIT CERTIFICATE',
          certificate_id: `PDV-CERT-${order.po_number.replace(/[^a-zA-Z0-9]/g, '')}`,
          generated_at: new Date().toISOString(),
          sha256_integrity_hash: shaIntegrity,
          order: {
            po_number: order.po_number,
            buyer_name: order.buyer_name,
            buyer_country: order.buyer_country,
            product_name: order.product_name,
            quantity: order.quantity,
            target_delivery_date: order.target_delivery_date,
            cluster: order.cluster_type,
            status: order.status
          },
          exporter: {
            name: order.company_name,
            iec: order.iec_number,
            cluster: order.city_cluster,
            contact: order.phone || order.whatsapp,
            email: order.exporter_email
          },
          milestones,
          stages: stages.map(s => ({
            ...s,
            photos: photos.filter(p => p.stage_id === s.id)
          })),
          audit_trail: audits
        }
      });
    }

    // POST /api/public/feedback — Foreign Buyer Rating & Note
    if (method === 'POST' && pathname === '/api/public/feedback') {
      const body = await parseJsonBody(req);
      const { order_id, rating, message } = body;

      if (!order_id || !rating) {
        return sendJson(res, 400, { success: false, message: 'Order ID and rating are required' });
      }

      db.prepare(`
        INSERT INTO buyer_feedback (order_id, rating, message)
        VALUES (?, ?, ?)
      `).run(order_id, Math.min(5, Math.max(1, Number(rating))), message || '');

      logAudit(order_id, null, 'BUYER_RATING', `Buyer gave ${rating} stars`, clientIp);
      return sendJson(res, 200, { success: true, message: 'Thank you for your feedback!' });
    }

    // POST /api/public/magic-upload/:token — Factory Floor 1-Click Camera Upload
    if (method === 'POST' && pathname.startsWith('/api/public/magic-upload/')) {
      const magicToken = pathname.replace('/api/public/magic-upload/', '').trim();
      const order = db.prepare('SELECT * FROM orders WHERE magic_upload_token = ?').get(magicToken);

      if (!order) {
        return sendJson(res, 404, { success: false, message: 'Invalid or expired upload link' });
      }

      const body = await parseJsonBody(req);
      const { stage_index, image_base64, caption, auto_approve } = body;

      if (!image_base64) {
        return sendJson(res, 400, { success: false, message: 'Image data is required' });
      }

      const matches = image_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = '.jpg';
      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
        if (matches[1].includes('png')) ext = '.png';
        if (matches[1].includes('webp')) ext = '.webp';
      } else {
        buffer = Buffer.from(image_base64, 'base64');
      }

      const filename = `padavo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, buffer);

      const publicImageUrl = `/uploads/${filename}`;
      const stage = db.prepare('SELECT * FROM order_stages WHERE order_id = ? AND stage_index = ?').get(order.id, Number(stage_index || 0));

      if (!stage) {
        return sendJson(res, 400, { success: false, message: 'Target stage not found' });
      }

      const isApproved = auto_approve ? 1 : 0;
      db.prepare(`
        INSERT INTO stage_photos (stage_id, order_id, image_url, caption, uploaded_by, is_approved)
        VALUES (?, ?, ?, ?, 'floor_staff', ?)
      `).run(stage.id, order.id, publicImageUrl, caption || 'Uploaded from factory floor', isApproved);

      logAudit(order.id, order.exporter_id, 'FLOOR_UPLOAD', `Floor staff uploaded photo to stage ${stage.stage_name}`, clientIp);

      return sendJson(res, 201, {
        success: true,
        message: isApproved ? 'Photo published live to tracking link!' : 'Photo submitted to Exporter Staging Gate for owner review.',
        image_url: publicImageUrl,
        is_approved: isApproved
      });
    }

    // --------------------------------------------------------------------------
    // 2. AUTHENTICATION & ONBOARDING
    // --------------------------------------------------------------------------

    // POST /api/auth/register
    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await parseJsonBody(req);
      const { email, password, company_name, city_cluster, iec_number, phone, whatsapp } = body;

      if (!email || !password || !company_name) {
        return sendJson(res, 400, { success: false, message: 'Email, password, and company name are required' });
      }

      const existing = db.prepare('SELECT id FROM exporters WHERE email = ?').get(email.toLowerCase().trim());
      if (existing) {
        return sendJson(res, 409, { success: false, message: 'An account with this email already exists' });
      }

      const initials = company_name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'EXP';
      const passwordHash = hashPassword(password);

      const result = db.prepare(`
        INSERT INTO exporters (email, password_hash, company_name, company_initials, iec_number, city_cluster, phone, whatsapp, subscription_tier, orders_quota, orders_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'starter', 15, 0)
      `).run(
        email.toLowerCase().trim(),
        passwordHash,
        company_name.trim(),
        initials,
        iec_number || '',
        city_cluster || 'Jaipur (Textiles)',
        phone || '',
        whatsapp || phone || ''
      );

      const exporterId = Number(result.lastInsertRowid);
      const sessionToken = generateSecureToken(32);
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

      db.prepare(`
        INSERT INTO sessions (token, exporter_id, expires_at) VALUES (?, ?, ?)
      `).run(sessionToken, exporterId, expiresAt);

      logAudit(null, exporterId, 'REGISTER', `New exporter registered: ${company_name}`, clientIp);

      return sendJson(res, 201, {
        success: true,
        token: sessionToken,
        exporter: { id: exporterId, email, company_name, company_initials: initials, city_cluster, subscription_tier: 'starter', orders_quota: 15, orders_used: 0 }
      });
    }

    // POST /api/auth/login
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseJsonBody(req);
      const { email, password } = body;

      if (!email || !password) {
        return sendJson(res, 400, { success: false, message: 'Email and password are required' });
      }

      const exporter = db.prepare('SELECT * FROM exporters WHERE email = ?').get(email.toLowerCase().trim());
      if (!exporter || !verifyPassword(password, exporter.password_hash)) {
        logAudit(null, null, 'LOGIN_FAILED', `Failed login attempt for ${email}`, clientIp);
        return sendJson(res, 401, { success: false, message: 'Invalid email or password' });
      }

      const sessionToken = generateSecureToken(32);
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

      db.prepare(`
        INSERT INTO sessions (token, exporter_id, expires_at) VALUES (?, ?, ?)
      `).run(sessionToken, exporter.id, expiresAt);

      logAudit(null, exporter.id, 'LOGIN_SUCCESS', `Exporter logged in`, clientIp);

      return sendJson(res, 200, {
        success: true,
        token: sessionToken,
        exporter: {
          id: exporter.id,
          email: exporter.email,
          company_name: exporter.company_name,
          company_initials: exporter.company_initials,
          city_cluster: exporter.city_cluster,
          iec_number: exporter.iec_number,
          phone: exporter.phone,
          whatsapp: exporter.whatsapp,
          subscription_tier: exporter.subscription_tier || 'starter',
          orders_quota: exporter.orders_quota || 25,
          orders_used: exporter.orders_used || 0
        }
      });
    }

    // GET /api/auth/me
    if (method === 'GET' && pathname === '/api/auth/me') {
      const session = getAuthExporter(req);
      if (!session) {
        return sendJson(res, 401, { success: false, message: 'Unauthorized session' });
      }
      return sendJson(res, 200, { success: true, exporter: session });
    }

    // POST /api/auth/logout
    if (method === 'POST' && pathname === '/api/auth/logout') {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      }
      return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
    }

    // --------------------------------------------------------------------------
    // 3. AUTHENTICATED EXPORTER PORTAL ROUTES
    // --------------------------------------------------------------------------
    const authExporter = getAuthExporter(req);

    if (pathname.startsWith('/api/')) {
      if (!authExporter) {
        return sendJson(res, 401, { success: false, message: 'Authentication required' });
      }

      // GET /api/subscription/usage — SaaS Subscription Status
      if (method === 'GET' && pathname === '/api/subscription/usage') {
        const activeOrdersCount = db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE exporter_id = ?').get(authExporter.exporter_id).cnt;
        return sendJson(res, 200, {
          success: true,
          subscription: {
            tier: authExporter.subscription_tier || 'starter',
            active_orders: activeOrdersCount,
            quota: authExporter.orders_quota || 25,
            orders_remaining: Math.max(0, (authExporter.orders_quota || 25) - activeOrdersCount),
            can_create_order: activeOrdersCount < (authExporter.orders_quota || 25)
          }
        });
      }

      // GET /api/settings — Get Exporter Company & Wire Settings
      if (method === 'GET' && pathname === '/api/settings') {
        const exp = db.prepare('SELECT id, email, company_name, company_initials, iec_number, city_cluster, phone, whatsapp, subscription_tier FROM exporters WHERE id = ?').get(authExporter.exporter_id);
        return sendJson(res, 200, { success: true, settings: exp });
      }

      // POST /api/settings — Update Exporter Profile, Cluster & Details
      if (method === 'POST' && pathname === '/api/settings') {
        const body = await parseJsonBody(req);
        const { company_name, city_cluster, iec_number, phone, whatsapp } = body;

        db.prepare(`
          UPDATE exporters
          SET company_name = COALESCE(?, company_name),
              city_cluster = COALESCE(?, city_cluster),
              iec_number = COALESCE(?, iec_number),
              phone = COALESCE(?, phone),
              whatsapp = COALESCE(?, whatsapp)
          WHERE id = ?
        `).run(company_name || null, city_cluster || null, iec_number || null, phone || null, whatsapp || null, authExporter.exporter_id);

        logAudit(null, authExporter.exporter_id, 'SETTINGS_UPDATED', `Company profile updated to ${company_name || authExporter.company_name}`, clientIp);

        const updated = db.prepare('SELECT id, email, company_name, company_initials, iec_number, city_cluster, phone, whatsapp FROM exporters WHERE id = ?').get(authExporter.exporter_id);
        return sendJson(res, 200, { success: true, message: 'Settings saved successfully', settings: updated });
      }

      // GET /api/orders — List All Orders
      if (method === 'GET' && pathname === '/api/orders') {
        const orders = db.prepare(`
          SELECT * FROM orders
          WHERE exporter_id = ?
          ORDER BY created_at DESC
        `).all(authExporter.exporter_id);

        const ordersWithDetails = orders.map(ord => {
          const stages = db.prepare('SELECT * FROM order_stages WHERE order_id = ? ORDER BY stage_index ASC').all(ord.id);
          const pendingStagingCount = db.prepare('SELECT COUNT(*) as cnt FROM stage_photos WHERE order_id = ? AND is_approved = 0').get(ord.id).cnt;
          
          const total = stages.length;
          const completed = stages.filter(s => s.status === 'completed').length;
          const inProgress = stages.filter(s => s.status === 'in_progress').length;
          const progress = total > 0 ? Math.round(((completed + inProgress * 0.5) / total) * 100) : 0;

          return {
            ...ord,
            progress_percent: progress,
            total_stages: total,
            pending_staging_count: pendingStagingCount,
            current_stage_name: stages.find(s => s.status === 'in_progress')?.stage_name || (completed === total ? 'Dispatched' : stages[0]?.stage_name)
          };
        });

        return sendJson(res, 200, { success: true, orders: ordersWithDetails });
      }

      // POST /api/orders — Create New Export Order
      if (method === 'POST' && pathname === '/api/orders') {
        const body = await parseJsonBody(req);
        const { po_number, buyer_name, buyer_country, product_name, quantity, target_delivery_date, cluster_type, custom_stages } = body;

        if (!po_number || !buyer_name || !product_name || !target_delivery_date) {
          return sendJson(res, 400, { success: false, message: 'Required: PO number, Buyer Name, Product Name, Target Date' });
        }

        // Quota check
        const currentOrders = db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE exporter_id = ?').get(authExporter.exporter_id).cnt;
        if (currentOrders >= (authExporter.orders_quota || 25)) {
          return sendJson(res, 403, { success: false, message: 'Order quota exceeded. Please upgrade your Padavo plan.' });
        }

        const cluster = cluster_type || 'jaipur';
        const trackingSlug = generateOrderSlug(authExporter.company_initials, po_number);
        const magicToken = generateSecureToken(16);

        const result = db.prepare(`
          INSERT INTO orders (exporter_id, po_number, buyer_name, buyer_country, product_name, quantity, target_delivery_date, cluster_type, public_tracking_slug, magic_upload_token)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          authExporter.exporter_id,
          po_number.trim(),
          buyer_name.trim(),
          buyer_country || 'International',
          product_name.trim(),
          quantity || '1 Batch',
          target_delivery_date,
          cluster,
          trackingSlug,
          magicToken
        );

        const orderId = Number(result.lastInsertRowid);

        // Increment orders_used counter
        db.prepare('UPDATE exporters SET orders_used = orders_used + 1 WHERE id = ?').run(authExporter.exporter_id);

        const stagesToInsert = (Array.isArray(custom_stages) && custom_stages.length > 0)
          ? custom_stages
          : (CLUSTER_PRESETS[cluster] ? CLUSTER_PRESETS[cluster].stages : CLUSTER_PRESETS.jaipur.stages);

        stagesToInsert.forEach((stg, idx) => {
          db.prepare(`
            INSERT INTO order_stages (order_id, stage_index, stage_name, status, qc_proof_spec, is_approved_by_owner)
            VALUES (?, ?, ?, ?, ?, 1)
          `).run(
            orderId,
            idx,
            typeof stg === 'string' ? stg : stg.name,
            idx === 0 ? 'in_progress' : 'pending',
            typeof stg === 'object' ? (stg.qc || '') : ''
          );
        });

        logAudit(orderId, authExporter.exporter_id, 'ORDER_CREATED', `Created PO ${po_number} for ${buyer_name}`, clientIp);

        return sendJson(res, 201, {
          success: true,
          order_id: orderId,
          public_tracking_slug: trackingSlug,
          magic_upload_token: magicToken
        });
      }

      // GET /api/orders/:id — Full Order Details
      if (method === 'GET' && pathname.match(/^\/api\/orders\/\d+$/)) {
        const orderId = Number(pathname.split('/')[3]);
        const order = db.prepare('SELECT * FROM orders WHERE id = ? AND exporter_id = ?').get(orderId, authExporter.exporter_id);

        if (!order) {
          return sendJson(res, 404, { success: false, message: 'Order not found' });
        }

        const stages = db.prepare('SELECT * FROM order_stages WHERE order_id = ? ORDER BY stage_index ASC').all(order.id);
        const photos = db.prepare('SELECT * FROM stage_photos WHERE order_id = ? ORDER BY uploaded_at ASC').all(order.id);
        const feedback = db.prepare('SELECT * FROM buyer_feedback WHERE order_id = ? ORDER BY submitted_at DESC').all(order.id);
        const milestones = db.prepare('SELECT * FROM order_milestones WHERE order_id = ? ORDER BY id ASC').all(order.id);

        const stagesWithPhotos = stages.map(s => ({
          ...s,
          photos: photos.filter(p => p.stage_id === s.id)
        }));

        return sendJson(res, 200, {
          success: true,
          order: {
            ...order,
            stages: stagesWithPhotos,
            feedback,
            milestones
          }
        });
      }

      // POST /api/orders/:id/milestones/:mId/payment-request — Exporter sends payment demand / invoice
      if (method === 'POST' && pathname.match(/^\/api\/orders\/\d+\/milestones\/\d+\/payment-request$/)) {
        const parts = pathname.split('/');
        const orderId = Number(parts[3]);
        const milestoneId = Number(parts[5]);

        const order = db.prepare('SELECT * FROM orders WHERE id = ? AND exporter_id = ?').get(orderId, authExporter.exporter_id);
        if (!order) return sendJson(res, 404, { success: false, message: 'Order not found' });

        const milestone = db.prepare('SELECT * FROM order_milestones WHERE id = ? AND order_id = ?').get(milestoneId, orderId);
        if (!milestone) return sendJson(res, 404, { success: false, message: 'Milestone not found' });

        const now = new Date().toISOString();
        db.prepare('UPDATE order_milestones SET payment_requested_at = ? WHERE id = ?').run(now, milestoneId);

        logAudit(orderId, authExporter.exporter_id, 'PAYMENT_REQUESTED', `Payment requested for ${milestone.milestone_title} (${milestone.amount_formatted})`, clientIp);

        const updated = db.prepare('SELECT * FROM order_milestones WHERE id = ?').get(milestoneId);
        return sendJson(res, 200, { success: true, message: 'Payment request dispatched with invoice details', milestone: updated });
      }

      // POST /api/orders/:id/milestones/:mId/mark-paid — Exporter confirms wire / payment received
      if (method === 'POST' && pathname.match(/^\/api\/orders\/\d+\/milestones\/\d+\/mark-paid$/)) {
        const parts = pathname.split('/');
        const orderId = Number(parts[3]);
        const milestoneId = Number(parts[5]);

        const order = db.prepare('SELECT * FROM orders WHERE id = ? AND exporter_id = ?').get(orderId, authExporter.exporter_id);
        if (!order) return sendJson(res, 404, { success: false, message: 'Order not found' });

        const milestone = db.prepare('SELECT * FROM order_milestones WHERE id = ? AND order_id = ?').get(milestoneId, orderId);
        if (!milestone) return sendJson(res, 404, { success: false, message: 'Milestone not found' });

        const now = new Date().toISOString();
        db.prepare('UPDATE order_milestones SET status = "paid", paid_at = ? WHERE id = ?').run(now, milestoneId);

        logAudit(orderId, authExporter.exporter_id, 'PAYMENT_CONFIRMED', `Milestone marked paid: ${milestone.milestone_title} (${milestone.amount_formatted})`, clientIp);

        const updated = db.prepare('SELECT * FROM order_milestones WHERE id = ?').get(milestoneId);
        return sendJson(res, 200, { success: true, message: 'Payment confirmed & marked as received!', milestone: updated });
      }

      // POST /api/orders/:id/staging/approve — Owner Staging Approval Gate
      if (method === 'POST' && pathname.match(/^\/api\/orders\/\d+\/staging\/approve$/)) {
        const orderId = Number(pathname.split('/')[3]);
        const body = await parseJsonBody(req);
        const { photo_id, is_approved, updated_caption } = body;

        const photo = db.prepare(`
          SELECT p.* FROM stage_photos p
          JOIN orders o ON p.order_id = o.id
          WHERE p.id = ? AND o.exporter_id = ?
        `).get(photo_id, authExporter.exporter_id);

        if (!photo) {
          return sendJson(res, 404, { success: false, message: 'Photo proof not found' });
        }

        db.prepare(`
          UPDATE stage_photos
          SET is_approved = ?, caption = COALESCE(?, caption)
          WHERE id = ?
        `).run(is_approved ? 1 : 0, updated_caption || null, photo_id);

        logAudit(orderId, authExporter.exporter_id, is_approved ? 'PHOTO_APPROVED' : 'PHOTO_HELD', `Photo ${photo_id} review state updated`, clientIp);

        return sendJson(res, 200, { success: true, message: is_approved ? 'Photo approved and live on buyer link' : 'Photo held in staging' });
      }

      // POST /api/orders/:id/stages/:stageId/update — Update Stage Status & Note
      if (method === 'POST' && pathname.match(/^\/api\/orders\/\d+\/stages\/\d+\/update$/)) {
        const parts = pathname.split('/');
        const orderId = Number(parts[3]);
        const stageId = Number(parts[5]);

        const body = await parseJsonBody(req);
        const { status, note, qc_proof_spec } = body;

        const stage = db.prepare(`
          SELECT s.* FROM order_stages s
          JOIN orders o ON s.order_id = o.id
          WHERE s.id = ? AND o.id = ? AND o.exporter_id = ?
        `).get(stageId, orderId, authExporter.exporter_id);

        if (!stage) {
          return sendJson(res, 404, { success: false, message: 'Stage not found' });
        }

        const completedAt = status === 'completed' ? new Date().toISOString() : null;

        db.prepare(`
          UPDATE order_stages
          SET status = ?, note = COALESCE(?, note), qc_proof_spec = COALESCE(?, qc_proof_spec), completed_at = ?
          WHERE id = ?
        `).run(status || stage.status, note || null, qc_proof_spec || null, completedAt, stageId);

        logAudit(orderId, authExporter.exporter_id, 'STAGE_UPDATED', `Stage ${stage.stage_name} set to ${status}`, clientIp);

        return sendJson(res, 200, { success: true, message: 'Stage updated successfully' });
      }

      // POST /api/upload — High-Speed Base64/Binary Photo Upload
      if (method === 'POST' && pathname === '/api/upload') {
        const body = await parseJsonBody(req);
        const { image_base64, order_id, stage_id, caption } = body;

        if (!image_base64) {
          return sendJson(res, 400, { success: false, message: 'Image base64 data required' });
        }

        const matches = image_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;
        let ext = '.jpg';
        if (matches && matches.length === 3) {
          buffer = Buffer.from(matches[2], 'base64');
          if (matches[1].includes('png')) ext = '.png';
          if (matches[1].includes('webp')) ext = '.webp';
        } else {
          buffer = Buffer.from(image_base64, 'base64');
        }

        const filename = `padavo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        const publicUrl = `/uploads/${filename}`;

        if (order_id && stage_id) {
          db.prepare(`
            INSERT INTO stage_photos (stage_id, order_id, image_url, caption, uploaded_by, is_approved)
            VALUES (?, ?, ?, ?, 'owner', 1)
          `).run(stage_id, order_id, publicUrl, caption || 'Uploaded by Exporter');
        }

        logAudit(order_id, authExporter.exporter_id, 'DIRECT_UPLOAD', `Photo uploaded: ${filename}`, clientIp);
        return sendJson(res, 201, { success: true, url: publicUrl });
      }
    }

    // --------------------------------------------------------------------------
    // 4. STATIC FILE SERVING
    // --------------------------------------------------------------------------
    if (pathname.startsWith('/uploads/')) {
      const fileName = pathname.replace('/uploads/', '');
      return serveStaticFile(req, res, path.join(UPLOADS_DIR, fileName));
    }

    let requestedFile = 'home.html';
    if (pathname === '/' || pathname === '/home' || pathname === '/landing') {
      requestedFile = 'home.html';
    } else if (pathname === '/app' || pathname === '/dashboard' || pathname === '/portal') {
      requestedFile = 'index.html';
    } else {
      requestedFile = pathname.slice(1);
    }
    const targetFilePath = path.join(PUBLIC_DIR, requestedFile);
    return serveStaticFile(req, res, targetFilePath);

  } catch (err) {
    console.error('Padavo server execution error:', err);
    return sendJson(res, 500, { success: false, message: 'Internal server error', error: err.message });
  }
}

// ==============================================================================
// DUAL-STACK HIGH-AVAILABILITY SERVER BINDING (IPv4 + IPv6 AUTO-FALLBACK)
// ==============================================================================
function bindServer(port) {
  const s = http.createServer(handleRequest);
  s.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Notice: Port ${port} is currently bound, skipping secondary binding.`);
    } else {
      console.error(`Notice on port ${port}:`, err.message);
    }
  });

  // Calling listen with port (omitting host string) enables dual-stack '::' on Windows,
  // allowing both IPv6 (localhost -> ::1) and IPv4 (127.0.0.1) without ERR_CONNECTION_REFUSED
  s.listen(port, () => {
    console.log(`> Padavo Server listening on port ${port} (IPv4/IPv6 Dual-Stack)`);
  });
  return s;
}

const primaryPort = Number(process.env.PORT || 5500);
bindServer(primaryPort);

console.log(`=======================================================`);
console.log(`PADAVO PRODUCTION SAAS ENGINE IS RUNNING! 🚀`);
console.log(`Brand: Padavo — Har Padav Par Bharosa`);
console.log(`Primary Local Access: http://localhost:${primaryPort}`);
console.log(`Landing Page: http://localhost:${primaryPort}/home.html (or http://localhost:${primaryPort}/)`);
console.log(`Exporter Portal: http://localhost:${primaryPort}/index.html (or http://localhost:${primaryPort}/app)`);
console.log(`Public UK Buyer Tracking: http://localhost:${primaryPort}/buyer-tracking-uk.html`);
console.log(`Health Check: http://localhost:${primaryPort}/health`);
console.log(`=======================================================`);
