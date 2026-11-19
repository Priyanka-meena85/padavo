# Padavo (पड़ाव) — Production-Ready B2B SaaS
### *Har Padav Par Bharosa* — The Milestone & Production Tracking Engine for Global Exporters

---

## 🌟 The Origin & Vision
**Padavo** (derived from the Sanskrit & Hindi word *'पड़ाव'* meaning *Milestone*, *Checkpoint*, or *Staging Camp*) solves the single biggest source of friction between Indian manufacturers (handicrafts, block-print textiles, jewellery, furniture) and their overseas buyers (US, UK, Europe, Australia):

> **"Kya exporter photos upload karega aur foreign buyer link kholega?"**  
> *Padavo makes floor uploads as frictionless as WhatsApp, while giving the overseas buyer a branded, no-login tracking experience that builds trust and secures repeat orders.*

---

## ⚡ 1-Click Launch (Isolated Port 5500 Architecture)

Padavo uses **Node.js 24's native `node:sqlite` (with WAL mode) and `node:crypto`**. No `npm install` compilation errors, no external databases required for local dev, and blazing fast performance.

```bash
# 1. Start the Padavo SaaS Server
npm start
# or double-click start.bat on Windows
```

Open your browser at:
👉 **[http://localhost:5500](http://localhost:5500)**
* **Landing Page:** [http://localhost:5500/home.html](http://localhost:5500/home.html)
* **Exporter Dashboard:** [http://localhost:5500/index.html](http://localhost:5500/index.html)
* **Buyer Tracking Portal:** [http://localhost:5500/buyer-tracking-uk.html](http://localhost:5500/buyer-tracking-uk.html)
* **Health Check API:** [http://localhost:5500/health](http://localhost:5500/health)

### 🔑 Demo Exporter Credentials (Pre-loaded):
* **Email:** `demo@jaipurcrafts.com`
* **Password:** `Jaipur123!`
* **Pre-seeded Shipments:** Active orders for **Toast & Co. London (UK)**, **SOHO Studio New York (US)**, and **Nordic Living (Denmark)**!

---

## 📱 The Core Production Capabilities

1. **Buyer Public Tracking (`/buyer-tracking-uk.html`):**
   * Zero-login branded URL (`/track/rj-pouk8492`).
   * 1-Click 5-Language Switcher (English, German, French, Spanish, Arabic with native RTL).
   * Live Maritime Container Telemetry (Maersk / MSC Paloma with AIS GPS tracking and humidity sensors).
   * Exporter IEC verified badge, order summary (UK sizes, quantity, delivery countdown).
   * Milestone Payment Release Engine with cryptographic verification (`PDV-SIG-...`).
   * Electronic Foreign Inward Remittance Certificate (e-FIRC) generator for RBI / FEMA compliance.
   * Multi-Vendor Consolidated Foreign Buyer Hub.
   * ICC International Court of Arbitration Dispute Clause.

2. **Exporter Operations Portal (`/index.html`):**
   * Role-Based Access Control (RBAC): Owner, QC Manager (AQL 2.5), Floor Staff (Financial Blur Masking).
   * Shop Floor Hindi Voice Note AI Transcriber (translates factory dialect into technical export spec).
   * Two-Way Official Meta WhatsApp Cloud Bot Inbound Webhook Simulator.
   * 1-Click Tally ERP & Excel Batch Consignment Import Engine.
   * Direct Cloudflare R2 / AWS S3 Presigned URL Zero-Egress Storage.
   * Custom Domain White-Label CNAME DNS configuration card.
   * True Offline PWA Support with Service Worker shell caching.

3. **Production SaaS Landing Page (`/home.html`):**
   * Pan-India Industrial Clusters Showcase (Jaipur, Moradabad, Jodhpur, Agra, Bhadohi).
   * Live Milestone Payment Escrow & Cash Flow Calculator.
   * Interactive ROI & Trust Calculator.

---

## 🛡️ Production SaaS Architecture & Hardening

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PADAVO SAAS ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend (public/index.html, home.html, buyer-tracking-uk.html)        │
│  • Modern Industrial Heritage Luxury Responsive Design                  │
│  • Strict Port 5500 Binding (Dual-Stack IPv4/IPv6 Support)              │
│  • Milestone Approval & Wire Details Engine (Instant Invoice Generator) │
│  • Floor Staff WhatsApp Magic Link Simulator & Offline Auto-Sync Queue  │
│  • Certified Dispute Audit Certificate Generator (Print / PDF)          │
│  • Client-side Canvas Image Downscaler (<250KB per photo)               │
├─────────────────────────────────────────────────────────────────────────┤
│  REST API & Engine (server.js)                                          │
│  • Port 5500 Dedicated Binding with zero dependency footprint           │
│  • Real-Time Server-Sent Events (SSE) live feed bus                     │
│  • Health Check Monitoring (/health) for Docker, AWS, Render, Railway   │
│  • Sliding-Window Rate Limiting (120 reqs/min general, 20 reqs/min auth)│
│  • Full Audit Logs Trail (audit_logs table)                             │
│  • scrypt Password Hashing (16-byte random salt + constant-time check)  │
│  • The Owner Staging Gate (floor uploads remain draft until approved)   │
│  • Self-healing zero-downtime database schema auto-migrations           │
├─────────────────────────────────────────────────────────────────────────┤
│  Database (database.sqlite & PostgreSQL Supabase Schema)                │
│  • SQLite Write-Ahead Logging (WAL mode) for concurrent I/O             │
│  • Cloud ready: supabase_schema.sql with Row-Level Security (RLS)       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚢 Cloud Deployment (Docker, Render, Railway, AWS)

Padavo includes production deployment manifests ready for zero-configuration deploys:

### Deploy with Docker:
```bash
# Build the container
docker build -t padavo:latest .

# Run the container on Port 5500
docker run -p 5500:5500 -v $(pwd)/uploads:/app/uploads padavo:latest
```

### Health Check Endpoint:
```bash
curl http://localhost:5500/health
# Returns: { "status": "healthy", "success": true, "database": "connected", "port": 5500 }
```

---

## 🧪 Automated Senior QA Regression Suite

Run the full automated test suite verifying all 26 business flows, security rules, and API contracts:
```bash
node run-senior-qa-suite.js
```
Expected output:
```
Total Tests: 26 | Passed: 26 ✅ | Failed: 0 ❌
```
