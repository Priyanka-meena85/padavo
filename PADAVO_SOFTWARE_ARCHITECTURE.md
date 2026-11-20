# PADAVO (पड़ाव) — ENTERPRISE SOFTWARE ARCHITECTURE BLUEPRINT
**Subtitle:** Har Padav Par Bharosa — Production Milestone & Cross-Border Payment Protocol  
**Author:** Senior Principal Software Architect & Lead Systems Engineer  
**Version:** 2.0.0 (Production Release)  
**Classification:** Enterprise B2B SaaS Architecture Document  

---

## 1. Executive Summary & Architectural Vision

**Padavo** is a high-trust, milestone-gated production tracking and cross-border payment unlock engine built specifically for Indian export manufacturing clusters (Jaipur Textiles, Jodhpur Furniture, Moradabad Metalware, Surat Apparel, Agra Leather, Karur Home Furnishings).

### 1.1 The Core Industry Problem
Traditional Indian SME exporters suffer from a **45 to 90-day cash flow starvation loop**:
1. Foreign buyers require 30% to 50% payment holdback until final port inspection.
2. Production proof sharing currently happens over unstructured, unverified WhatsApp threads.
3. Foreign buyers dispute minor fabric shades, seam alignments, or packaging variations weeks later, using subjective claims to discount invoices or delay wires.
4. Traditional fintech escrow providers require strict RBI Payment Aggregator (PA-CB) licensing, taking 2% to 4% transaction fees and holding merchant funds for weeks.

### 1.2 The Padavo Solution Architecture
Padavo replaces opaque WhatsApp threads with a **Cryptographically Verified Milestone Protocol**:
- **30-Second Floor Uploads:** Supervisors capture timestamped, GPS-verified workshop photos with zero login friction.
- **The Owner Gate:** Exporter owners vet draft proofs before releasing them to foreign buyers.
- **Zero-Login Buyer Portal:** Foreign buyers receive an encrypted tokenized link to view 1080p proofs and sign off with a single click.
- **Cryptographic Wire Release:** Buyer approval generates an immutable SHA-256 digital signature that **instantly unlocks the exporter's verified international wire instructions (SWIFT / IBAN / BACS)** directly to their commercial bank account.
- **Zero Regulatory Escrow Custody:** Padavo **never touches merchant money**, eliminating RBI licensing overhead, money transfer holdbacks, and custodial liability while achieving same-day payment releases.

---

## 2. High-Level System Architecture (C4 Model)

```mermaid
flowchart TB
    subgraph Users ["Actors & External Parties"]
        Floor["Factory Floor Staff<br/>(Artisans / Supervisors)"]
        Exporter["Indian Exporter<br/>(Owner / Export Manager)"]
        Buyer["Foreign Overseas Buyer<br/>(UK, US, EU, GCC Importer)"]
        Bank["Commercial AD Bank<br/>(SBI, HDFC, Barclays, Chase)"]
        Customs["Customs Broker & Forwarder<br/>(ICEGATE / DGFT)"]
    end

    subgraph ClientLayer ["1. Client & Presentation Layer (PWA)"]
        PWA["Offline-First PWA App Shell<br/>(Vanilla JS + Tailwind CSS)"]
        SW["Service Worker v1.4<br/>(Smart Cache + Background Revalidation)"]
        CanvasDownscaler["Client-Side Canvas Downscaler<br/>(<250KB JPEG WebP Compressor)"]
    end

    subgraph EdgeLayer ["2. Edge & Ingress Security Layer"]
        Gateway["Dual-Stack Node Gateway<br/>(Port 5500 / Vercel Serverless)"]
        CSP["OWASP Top 10 Headers<br/>(CSP, Anti-Sniff, FrameGuard)"]
        RateLimiter["Sliding-Window IP Rate Limiter<br/>(Anti-DDoS / Brute-Force Lockout)"]
    end

    subgraph CoreServices ["3. Core Domain & Business Logic Services"]
        AuthSvc["Auth & Multi-Tenancy Engine<br/>(scrypt Hashing + Bearer Sessions)"]
        OrderSvc["Production Pipeline State Machine<br/>(6-Stage Cluster Workflows)"]
        FloorSvc["Floor Magic Upload & Voice AI<br/>(Hindi Dialect Audio Transcriber)"]
        BuyerSvc["Buyer Tracking & Sign-Off Engine<br/>(Zero-Login Tokenized Slugs)"]
        QcSvc["AQL 2.5 Inspection Engine<br/>(ISO 2859-1 Standards Verification)"]
    end

    subgraph EnterpriseEngines ["4. Enterprise Fintech & Statutory Engines"]
        CryptoAudit["SHA-256 Tamper-Proof Audit Ledger<br/>(Non-Repudiation Certificate)"]
        PDFGen["Server-Side PDF Engine<br/>(Dispute Audit & e-FIRC Generator)"]
        TallySync["Tally Prime Bi-Directional XML Engine<br/>(Voucher & Inventory Sync)"]
        VirtualFX["Multi-Currency FX Wire Gateway<br/>(Barclays BACS / Chase ACH / SWIFT)"]
        Factoring["Fintech Invoice Factoring Bridge<br/>(80% Working Capital Pre-Approval)"]
    end

    subgraph PersistenceLayer ["5. Persistence & File Storage Layer"]
        SQLite["SQLite Embedded Database<br/>(WAL Mode + Foreign Keys + Auto-Migrations)"]
        InMemory["In-Memory SQLite Fallback<br/>(Serverless Ephemeral Mode)"]
        StorageEngine["Dual Storage Driver<br/>(Local FS / Cloudflare R2 / AWS S3)"]
    end

    Floor -->|WhatsApp / Magic Link Photo| CanvasDownscaler
    CanvasDownscaler --> SW --> PWA
    Exporter -->|Portal Management & Owner Gate| PWA
    Buyer -->|Zero-Login Milestone Review| PWA

    PWA -->|REST HTTPS / SSE Streams| Gateway
    Gateway --> CSP --> RateLimiter

    RateLimiter --> AuthSvc
    RateLimiter --> OrderSvc
    RateLimiter --> FloorSvc
    RateLimiter --> BuyerSvc
    RateLimiter --> QcSvc

    OrderSvc --> CryptoAudit
    BuyerSvc --> CryptoAudit
    CryptoAudit --> PDFGen
    OrderSvc --> TallySync
    BuyerSvc --> VirtualFX
    OrderSvc --> Factoring

    AuthSvc --> SQLite
    OrderSvc --> SQLite
    CryptoAudit --> SQLite
    SQLite -.->|Ephemeral Fallback| InMemory
    FloorSvc --> StorageEngine

    PDFGen -.->|Certified Evidence| Customs
    VirtualFX -.->|Direct Wire Release| Bank
```

---

## 3. Production Pipeline State Machine & Data Flow

### 3.1 Milestone Sign-Off & Wire Release Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Floor as Factory Floor Staff
    actor Exporter as Exporter Owner
    actor Buyer as Foreign Buyer (UK)
    participant API as Padavo Core API
    participant DB as SQLite Audit Ledger
    participant PDF as PDF & Crypto Engine
    actor Bank as Overseas Bank (UK BACS)

    Floor->>API: 1. Snap photo & speak Hindi note via Magic Link
    API->>API: 2. Transcribe voice note, compress photo (<200KB)
    API->>DB: 3. Store photo with 'draft' status (Owner Gate)
    
    Exporter->>API: 4. Owner reviews & clicks "Approve for Buyer"
    API->>DB: 5. Promote photo to 'approved', trigger SSE broadcast
    API-->>Buyer: 6. Email / WhatsApp notification with encrypted tracking slug
    
    Buyer->>API: 7. Open zero-login tracking portal (rj-pouk8492)
    Buyer->>API: 8. Click "✓ Approve Milestone 2 (Release Wire)"
    
    API->>API: 9. Compute SHA-256 Non-Repudiation Hash
    API->>DB: 10. Seal audit log with IP, user-agent, timestamp & hash
    API->>PDF: 11. Generate certified Dispute Evidence & Proforma Invoice PDF
    API-->>Buyer: 12. Display verified Bank Wire coordinates (SWIFT/IBAN/BACS)
    
    Buyer->>Bank: 13. Release direct bank wire (£11,200) to Exporter
    Bank-->>Exporter: 14. Direct funds received in commercial export current account
```

---

## 4. Database Schema & Entity-Relationship Model (ERD)

Padavo uses an ACID-compliant **SQLite engine in Write-Ahead Logging (WAL) mode** with foreign key constraints enabled.

```mermaid
erDiagram
    EXPORTERS ||--o{ ORDERS : owns
    EXPORTERS ||--o{ SESSIONS : authenticates
    EXPORTERS ||--o{ AUDIT_LOGS : logs
    ORDERS ||--o{ ORDER_STAGES : divides_into
    ORDERS ||--o{ ORDER_MILESTONES : unlocks_funds
    ORDERS ||--o{ STAGE_PHOTOS : documents
    ORDERS ||--o{ BUYER_FEEDBACK : receives
    ORDERS ||--o{ TRADE_DOCUMENTS : vaults
    ORDERS ||--o{ QC_CHECKLISTS : inspects
    ORDER_STAGES ||--o{ STAGE_PHOTOS : attaches

    EXPORTERS {
        int id PK
        string email UK
        string password_hash
        string company_name
        string company_initials
        string city_cluster
        string iec_number
        string phone
        string whatsapp
        string subscription_tier
        int orders_quota
        int orders_used
        datetime created_at
    }

    ORDERS {
        int id PK
        int exporter_id FK
        string po_number
        string buyer_name
        string buyer_email
        string buyer_country
        string product_name
        int quantity
        string currency
        real total_amount
        string target_delivery_date
        string public_tracking_slug UK
        string status
        string current_stage
        datetime created_at
    }

    ORDER_STAGES {
        int id PK
        int order_id FK
        int stage_number
        string stage_name
        string status
        string note
        string qc_proof_spec
        datetime completed_at
    }

    ORDER_MILESTONES {
        int id PK
        int order_id FK
        int milestone_number
        string milestone_title
        real percentage
        real amount
        string currency
        string status
        string decision_proof_hash
        datetime approved_at
    }

    STAGE_PHOTOS {
        int id PK
        int stage_id FK
        int order_id FK
        string image_url
        string caption
        string uploaded_by
        int is_approved
        datetime created_at
    }

    AUDIT_LOGS {
        int id PK
        int order_id FK
        int exporter_id FK
        string action
        string details
        string ip_address
        string tamper_proof_hash
        datetime created_at
    }
```

---

## 5. Security & Cryptographic Non-Repudiation Architecture

Padavo implements an **Enterprise OWASP Level 2 Hardened Security Profile**:

### 5.1 Password Hashing & Key Derivation
- Passwords are encrypted using native `node:crypto.scrypt` with a **16-byte cryptographically secure random salt** (`crypto.randomBytes(16)`), 64-byte key length, and constant-time equality check (`crypto.timingSafeEqual`) to eliminate timing-side-channel attacks.

### 5.2 Immutable Tamper-Proof Audit Ledger
Every milestone approval, quality inspection, and trade document upload computes a deterministic SHA-256 signature:
$$\text{Signature} = \text{HMAC-SHA256}(\text{OrderID} \parallel \text{MilestoneID} \parallel \text{Decision} \parallel \text{Timestamp} \parallel \text{ClientIP}, \text{SecretKey})$$
This digital signature is embedded into the downloadable **Dispute Evidence Certificate (PDF)**, creating a legally admissible audit trail under the **UNCITRAL Model Law on Electronic Commerce** and **ICC Paris Uniform Rules for Digital Trade (URDT)**.

### 5.3 Hardened HTTP Response Headers
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://images.unsplash.com; connect-src 'self' ws: wss:; media-src 'self' data: blob:; object-src 'none'; frame-ancestors 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(self), microphone=(self), geolocation=()
```

### 5.4 Sliding-Window Anti-Brute-Force Rate Limiter
- **Public & Floor Endpoints:** Max 120 requests/minute per IP.
- **Authentication Endpoints:** Max 10 attempts/5 minutes per IP. Exceeding triggers a 15-minute temporary lockout to prevent credential stuffing.

---

## 6. Regulatory & RBI Zero-Custody Architecture

> [!IMPORTANT]
> **Why Padavo Requires No RBI / PA-CB Custodial License:**
> Under Reserve Bank of India (RBI) master directions on cross-border payments, platforms that hold foreign currency or pool export receipts require a Payment Aggregator - Cross Border (PA-CB) license, net-worth capitalization of ₹15–25 Crore, and strict regulatory reporting.

### How Padavo Solves This Elegantly:
1. **Zero-Custody Verification:** Padavo acts purely as a **Verification & Information Protocol**, never touching funds.
2. **Direct Bank Wire Settlement:** When a foreign buyer approves a milestone, Padavo presents verified statutory bank coordinates (SWIFT / BIC / IBAN / BACS). The foreign buyer initiates an ordinary bank-to-bank international wire directly to the exporter's authorized dealer (AD) bank.
3. **Statutory e-FIRC Generator:** Once funds land at the AD bank, Padavo generates the pre-filled Foreign Inward Remittance Certificate (e-FIRC) requisition matching the verified milestone invoice, allowing rapid customs EDPMS reconciliation with zero banking friction.

---

## 7. Deployment & DevOps Topology

```mermaid
graph LR
    subgraph Environments ["Deployment Targets"]
        Dev["Local Development<br/>Node.js 24 Dual-Stack<br/>(Port 5500)"]
        Docker["Containerized Production<br/>(Docker / AWS ECS / Render)<br/>Persistent Volume for SQLite"]
        Vercel["Serverless Edge<br/>(@vercel/node Adapter)<br/>Ephemeral /tmp Fallback"]
    end

    subgraph CI_CD ["Automated CI/CD Pipeline"]
        QA["Senior QA Suite<br/>(32 Automated Integration Tests)"]
        DeepDeploy["Deep Deploy Verifier<br/>(37 Comprehensive Pre-Flight Tests)"]
        SecurityAudit["Security Penetration Suite<br/>(16 OWASP Checks)"]
    end

    QA --> DeepDeploy --> SecurityAudit
    SecurityAudit --> Dev
    SecurityAudit --> Docker
    SecurityAudit --> Vercel
```

### 7.1 Port Isolation Constraint
- All server bindings, API fetches, service workers, and client scripts strictly target **Port 5500** (`http://localhost:5500`). Zero legacy references to ports 3000/3001 exist in the workspace.

### 7.2 Zero-Downtime Database Auto-Migrations
On server boot, `server.js` checks table columns and automatically executes declarative schema migrations (adding missing columns like `tamper_proof_hash`, `qc_proof_spec`, `subscription_tier`) without requiring external migration binaries or manual database intervention.

---

## 8. Summary Checklist of Enterprise Engines

| Subsystem | File & Engine | Key Architectural Responsibility |
| :--- | :--- | :--- |
| **PWA Frontend** | `public/index.html` & `home.html` | High-DPI UI, pure CSS icons in footer, safe Tailwind & Lucide polyfills |
| **Service Worker** | `public/sw.js` | v1.4 cache-first asset delivery, cross-origin passthrough (zero CSP collisions) |
| **Core API Gateway** | `server.js` | Dual-stack HTTP server (Port 5500), rate limiter, OWASP headers, static streamer |
| **Database Engine** | `node:sqlite` (SQLite WAL) | Multi-tenant relational persistence, ACID compliance, in-memory serverless fallback |
| **Dispute PDF Engine**| `pdf-engine.js` | Pure-binary PDF 1.4 compiler, SHA-256 cryptographic seal, e-FIRC generator |
| **Tally Prime Sync** | `tally-engine.js` | Bi-directional XML accounting vouchers, batch consignment ingestion |
| **Cloud Storage** | `storage-engine.js` | Local filesystem & Cloudflare R2 / AWS S3 presigned upload coordinator |
| **Notification Engine**| `notification-engine.js`| Responsive HTML milestone alerts, WhatsApp Webhook processor |
| **Billing Engine** | `billing-engine.js` | Stripe / Razorpay multi-tier subscription quotas (Starter, Pro, Enterprise) |
