# Padavo (पड़ाव) — Production-Ready B2B SaaS
### *Har Padav Par Bharosa* — The Milestone & Production Tracking Engine for Global Exporters

---

## 🌟 The Origin & Vision
**Padavo** (derived from the Sanskrit & Hindi word *'पड़ाव'* meaning *Milestone*, *Checkpoint*, or *Staging Camp*) solves the single biggest source of friction between Indian manufacturers (handicrafts, block-print textiles, jewellery, furniture) and their overseas buyers (US, UK, Europe, Australia):

> **"Kya exporter photos upload karega aur foreign buyer link kholega?"**  
> *Padavo makes floor uploads as frictionless as WhatsApp, while giving the overseas buyer a branded, no-login tracking experience that builds trust and secures repeat orders.*

---

## ⚡ 1-Click Launch (Zero Dependency Architecture)

Padavo uses **Node.js 24's native `node:sqlite` (with WAL mode) and `node:crypto`**. No `npm install` compilation errors, no external databases required for local dev, and blazing fast performance.

```bash
# 1. Start the Padavo SaaS Server
npm start
# or double-click start.bat on Windows
```

Open your browser at:
👉 **[http://localhost:3001](http://localhost:3001)**

### 🔑 Demo Exporter Credentials (Pre-loaded):
* **Email:** `demo@jaipurcrafts.com`
* **Password:** `Jaipur123!`
* **Pre-seeded Shipments:** Active orders for **Toast & Co. London (UK)**, **SOHO Studio New York (US)**, and **Nordic Living (Denmark)**!

---

## 📱 The 5 Core Designed Screens

1. **Screen 1: Buyer Public Tracking (`/buyer-tracking-uk.html`):**
   * Zero-login branded URL (`/track/rj-pouk8492-9a4f`).
   * Exporter IEC verified badge, order summary (UK sizes, quantity, delivery countdown).
   * Segmented progress bar (50% complete) and 6-stage vertical timeline.
   * High-definition photo gallery with full-screen lightbox, GPS & timestamp verification badges.
   * Direct WhatsApp connect button and downloadable Marketing Media Kit for UK retail teams.

2. **Screen 2: Exporter Login (Mobile-First Phone OTP):**
   * Mobile phone input with `+91` flag prefix.
   * 6-digit auto-advancing OTP boxes with WhatsApp resend fallback.
   * 1-Click Instant Demo login shortcut for fast onboarding.

3. **Screen 3: Orders Dashboard:**
   * Mobile-first order cards with status badges: `In Progress` (Amber), `Delayed` (Rose with weather reason), `Dispatched` (Blue).
   * Filter pills (*All*, *In Progress*, *Delayed*, *Dispatched*).
   * Bilingual hints in Hindi & English (*"चालू आर्डर"*, *"फोटो डालें"*).
   * Floating Action Button (FAB) for 1-tap new order creation.

4. **Screen 4: New Order Form Wizard (Under 60 Seconds):**
   * 5 Pre-calibrated Manufacturing Cluster Presets:
     * 🌸 **Jaipur** (Hand-block textiles, Dabu, garments)
     * 🪵 **Jodhpur** (Solid sheesham/mango wood furniture)
     * 🪔 **Moradabad** (Brassware & metalware)
     * 👞 **Agra** (Leather footwear & bags)
     * 🧶 **Bhadohi** (Hand-tufted wool carpets)
   * Auto-populates production stages instantly.

5. **Screen 5: Order Detail & 30-Second Photo Upload:**
   * Active stage hero card with glowing pulse indicator.
   * Giant 64px camera CTA (*"फोटो खींचें या गैलरी से चुनें"*).
   * Client-side image compression (downscales 5MB photos to ~240KB in 300ms before sending).
   * Bilingual note field with voice-to-text mic input.
   * QC verification checkbox (touch target 48px).
   * *"Mark Stage Complete & Notify Buyer"* + 1-tap *"Share on WhatsApp"*.

---

## 🏆 The #1 Killer SaaS Feature: Milestone Approval + Payment Link

Exporters don't just care about "tracking" — **they care about getting paid on time without advance payment disputes**. Padavo bridges trust by linking payment tranches directly to verified production milestones:

1. **Buyer Milestone Sign-Off:**
   Overseas buyers review timestamped artisan workshop photos on their zero-login tracking link and click **"✓ Approve Milestone (मंज़ूर करें)"** or **"⚠️ Request Modification (बदलाव चाहिए)"**.
2. **Cryptographic Proof & SHA-256 Hash:**
   Every approval is sealed with an unalterable timestamp and SHA-256 digital signature stored directly in the SQLite audit ledger.
3. **Instant Wire Instructions & Invoice Download:**
   Approving a milestone instantly unlocks the exporter's verified international wire details (Bank, SWIFT/BIC, IBAN, Proforma Invoice) — **without taking regulatory escrow custody** (zero RBI/licensing barriers).
4. **1-Click Certified Dispute Evidence Certificate (PDF):**
   Full audit packet compiled in 1 click for banks, freight forwarders, and insurance claims.

---

## 🛡️ Production SaaS Architecture & Hardening

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PADAVO SAAS ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend (public/index.html & buyer-tracking-uk.html)                      │
│  • Modern Industrial Heritage Luxury Light Theme (default) + Dark Mode      │
│  • Dual-Stack Engine: Responsive on both Port 3001 & 3000 (IPv4 + IPv6)     │
│  • Milestone Approval & Wire Details Engine (Instant Invoice Generator)     │
│  • Floor Staff WhatsApp Magic Link Simulator & Offline Auto-Sync Queue      │
│  • Certified Dispute Audit Certificate Generator (Print / PDF)              │
│  • Client-side Canvas Image Downscaler (<250KB per photo)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  REST API & Engine (server.js)                                              │
│  • Dual-Port Binding (Auto-serves localhost:3001 and localhost:3000)        │
│  • Dual-Stack IPv4/IPv6 Support (Prevents Windows ERR_CONNECTION_REFUSED)   │
│  • Health Check Monitoring (/health) for Docker, AWS, Render, Railway       │
│  • Sliding-Window Rate Limiting (120 reqs/min general, 20 reqs/min auth)     │
│  • Full Audit Logs Trail (audit_logs table)                                 │
│  • scrypt Password Hashing (16-byte random salt + constant-time comparison) │
│  • The Owner Staging Gate (floor uploads remain draft until owner approves) │
│  • Magic Upload Links (factory floor workers snap photos with zero login)   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Database (database.sqlite)                                                 │
│  • SQLite Write-Ahead Logging (WAL mode) for concurrent multi-tenant I/O   │
│  • Tables: exporters, sessions, orders, order_stages, stage_photos,         │
│            order_milestones, buyer_feedback, audit_logs                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚢 Cloud Deployment (Docker, Render, Railway, AWS)

Padavo includes production deployment manifests ready for zero-configuration deploys:

### Deploy with Docker:
```bash
# Build the container
docker build -t padavo:latest .

# Run the container
docker run -p 3001:3001 -v $(pwd)/uploads:/app/uploads padavo:latest
```

### Health Check Endpoint:
```bash
curl http://localhost:3001/health
# Returns: { "status": "healthy", "app": "Padavo SaaS Engine", "database": "connected", "uptime": "..." }
```

---

## 💰 SaaS Pricing & Monetization Model

* **Free Trial:** 3 active orders 100% Free (zero commitment).
* **Pay-As-You-Go:** ₹199 per order (scales with export volume; feels like a courier charge).
* **Export House Growth Plan:** ₹2,499/month for up to 25 concurrent orders with custom branded domain (`track.yourbrand.com`).
#   p a d a v o  
 