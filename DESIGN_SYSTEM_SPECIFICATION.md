# TraceCraft — Senior Product Design Specification
## UI/UX System for Indian SME Exporters & Foreign Buyers

---

## 1. Executive Design Rationale

Designing for the Indian export manufacturing corridor requires bridging **two radically different mental models**:

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│       THE INDIAN FACTORY FLOOR       │       │          THE OVERSEAS BUYER          │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ • Device: ₹10k–₹15k Android phone    │       │ • Device: MacBook / iPhone 15 Pro    │
│ • User: Factory supervisor / masterji│       │ • User: Sourcing Director / Founder  │
│ • Setting: 42°C heat, noise, dust    │       │ • Setting: Design studio / office    │
│ • Network: Intermittent 3G / 4G      │       │ • Network: High-speed gigabit Wi-Fi  │
│ • Mindset: Overworked, "kaam jaldi"  │       │ • Mindset: Anxious, "is it on time?" │
│ • Behavioral Anchor: WhatsApp        │       │ • Behavioral Anchor: Shopify / FedEx │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

### Why Decisions Build Trust for the Foreign Buyer:
1. **Consolidated Narrative vs. WhatsApp Fragment Dumps:** Instead of 40 unlabelled photos landing in chat at 2:00 AM IST, the buyer receives a single, persistent web link with a chronological story of their goods being born.
2. **Visual Proof Anchored to QC Standards:** Photos aren't just pretty; they are contextualized with measurement tape overlays, approved Pantone TCX swatches, and batch weights.
3. **Radical Date Transparency with Context:** When delays happen in craft manufacturing (e.g. monsoon rains preventing natural dabu dye drying), the timeline doesn't hide it; it displays a dignified, clear adjustment note from the maker.
4. **Zero-Login Velocity:** Sourcing managers manage 20+ vendors across India, Vietnam, and Portugal. Forcing them to create a password guarantees they won't use the portal. An unguessable, signed public URL provides instant access in under 1 second.

### Why Decisions Reduce Cognitive Friction for the Exporter Staff:
1. **WhatsApp Familiarity:** The exporter side mimics WhatsApp ergonomics: 1-tap camera triggers, voice-note friendly captions, large 48px+ touch targets, and high contrast.
2. **Bilingual Microcopy (English + Hindi):** Clear dual-language cues (e.g. *"Add Photos / फोटो जोड़ें"*, *"Mark Stage Complete / पूरा हुआ"*) eliminate hesitation for shop-floor supervisors.
3. **No Multi-Level Dropdowns:** Selecting an order and a stage takes a single swipe; default stages are pre-populated based on the cluster (e.g., block print textile).
4. **Optimistic UI & Offline Resilience:** Photos are cached locally in IndexedDB and compressed client-side to <300KB before upload, ensuring zero dropped uploads in factory basements.

---

## 2. Design Tokens & Visual Language

### A. Color Palette (Exact Hex Codes)

The visual style is **"Modern Industrial Heritage"** — clean editorial white surfaces accented with natural craft pigments (Indigo, Madder, Raw Terracotta, and Unbleached Cotton).

| Token Name | Hex Code | Role & Usage |
| :--- | :--- | :--- |
| **Brand Terracotta (Primary)** | `#9B562A` | Primary CTA buttons, key active indicators, brand logo |
| **Brand Terracotta Dark** | `#7F4422` | Hover state for primary buttons |
| **Brand Terracotta Light** | `#FBF7F4` | Soft tint background for active elements and highlights |
| **Indigo Ink (Deep Neutral)** | `#0F172A` | Headings, primary dark containers, buyer card hero |
| **Chalk White (Surface 1)** | `#FFFFFF` | Main card surfaces, modal sheets, elevated cards |
| **Porcelain Slate (Surface 2)** | `#F8FAFC` | Page background, input fields, neutral containers |
| **Slate Border (Hairline)** | `#E2E8F0` | Crisp 1px structural dividing lines and card outlines |
| **Text Primary** | `#0F172A` | Highest contrast text (WCAG AAA compliant: 12.6:1) |
| **Text Secondary** | `#475569` | Body descriptions, order specs, secondary instructions |
| **Text Muted** | `#94A3B8` | Metadata, timestamps, helper text, inactive stage icons |
| **Status: In Progress** | `#D97706` | Amber badge (`#FFFBEB` bg, `#F59E0B` border) |
| **Status: QC Approved / Done** | `#059669` | Emerald badge (`#ECFDF5` bg, `#10B981` border) |
| **Status: Delayed / Flagged** | `#DC2626` | Rose badge (`#FEF2F2` bg, `#EF4444` border) |
| **Status: Dispatched** | `#2563EB` | Royal Blue badge (`#EFF6FF` bg, `#3B82F6` border) |

### B. Typography (Font Pairing & Scale)

* **Editorial Display (Craft Authenticity):** `Playfair Display` (Serif) — used exclusively for Exporter Branding Names, PO Titles, and Provenance Badges.
* **Functional Interface (Clarity & Readability):** `Plus Jakarta Sans` or `Inter` (Sans-Serif) — used for all labels, timeline steppers, tables, and buttons.
* **Technical Spec & Barcodes:** `JetBrains Mono` — used for PO numbers, timestamps, GPS tags, and measurement tolerances.

```
Type Scale:
• Display 1:   28px / 36px line-height (Playfair Display, Bold) — Buyer Header
• Title 1:     20px / 28px line-height (Plus Jakarta Sans, Bold) — Card Titles
• Title 2:     16px / 24px line-height (Plus Jakarta Sans, SemiBold) — Stage Headings
• Body 1:      14px / 20px line-height (Plus Jakarta Sans, Regular) — Stage Notes
• Caption:     12px / 16px line-height (Plus Jakarta Sans, Medium) — Specs & Inputs
• Micro / Code:10px / 14px line-height (JetBrains Mono, Medium) — Watermarks & Badges
```

### C. Spacing Scale & Touch Targets
* **Base Unit:** 4px
* **Scale:** 4px (`0.5`), 8px (`1`), 12px (`1.5`), 16px (`2`), 20px (`2.5`), 24px (`3`), 32px (`4`), 48px (`6`).
* **Touch Target Rule:** Every interactive element on mobile (buttons, radio pills, photo thumbs) has a **minimum touch target of 48px x 48px** to accommodate worker thumbs on the factory floor.

### D. Border Radius & Shadows
* **Badges & Tags:** `6px` (`rounded-md`)
* **Inputs & Standard Buttons:** `10px` (`rounded-xl`)
* **Cards & Containers:** `16px` (`rounded-2xl`)
* **Modal Sheets:** `24px` top corners (`rounded-t-3xl`) on mobile
* **Shadow Rules:**
  * `shadow-xs`: `0 1px 2px 0 rgba(15, 23, 42, 0.05)` (Input fields & list cards)
  * `shadow-sm`: `0 2px 4px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)` (Main cards)
  * `shadow-xl`: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)` (Modals & Lightboxes)

---

## 3. Component Specification & State Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPONENT STATE MATRIX                             │
├─────────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Component       │ Default      │ Active / Tap │ Disabled     │ Error        │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Primary Button  │ #9B562A bg   │ #7F4422 bg   │ #E2E8F0 bg   │ Shake anim + │
│ (Min 48px h)    │ White text   │ Scale 0.98   │ #94A3B8 text │ Rose outline │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ "Add Photos"    │ #ECFDF5 bg   │ #D1FAE5 bg   │ Opacity 40%  │ File size    │
│ Camera CTA      │ Emerald text │ Green ring   │              │ warning toast│
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Stage Card      │ #FFFFFF bg   │ Amber border │ #F8FAFC bg   │ Red variance │
│                 │ Slate border │ + subtle glow│ 50% opacity  │ alert bar    │
└─────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### Upload States (Factory Floor Edge Cases):
1. **Empty State:** Clean dashed border with camera icon and bilingual prompt: *"Tap to click or select photo / फोटो खींचने के लिए टैप करें"*.
2. **Uploading State:** Thumbnail preview blurred with circular progress spinner, percentage readout (`"Uploading 64%..."`), and a 1-tap *"Cancel"* text button.
3. **Success State:** Crisp green border flash with checkmark badge and timestamp: *"Uploaded • 11:42 AM"*.
4. **Error / Retry State:** Red border with clear retry button: *"Upload failed (Weak internet). [Tap to Retry / दोबारा भेजें]"*.
5. **Offline Mode:** Banner pinned to top: *"You are offline. 2 photos saved locally and will auto-upload when network returns."*

---

## 4. Screen-by-Screen Layout Description

### Screen 1: Foreign Buyer Public Tracking Page (No Login)
* **Mobile Layout (390px viewport):**
  * **Sticky Top Micro-Bar:** Exporter logo thumbnail, PO number, and quick WhatsApp connect button.
  * **Brand Hero Card:** Dark navy contrast header (`#0F172A`) showcasing Exporter Company Name, Verified IEC registration badge, Buyer PO #, Order Quantity, and Target Delivery Date.
  * **Overall Progress Stepper:** Animated segmented progress bar (e.g. 3 of 6 stages complete = 50%), with dynamic ETA status: *"On Schedule — Estimated Ex-Factory Dec 08"*.
  * **Vertical Milestone Timeline:**
    * Nodes connected by a continuous 2px tracking thread.
    * Completed stages: Green check circle, completion date, short note, 2–3 photo thumbnails with high-res tap zoom.
    * Current stage: Amber pulsing ring, *"Currently in Progress"* badge, latest floor photo with spec tag.
    * Future stages: Muted grey nodes with estimated start dates.
  * **Trust & Dispute Section:** Direct 1-tap WhatsApp message pre-filled with *"Hi [Exporter], inquiring about PO-8941 stage 3..."*.
  * **Artisan Media Pack:** Download button providing a clean ZIP for the buyer's retail marketing team.
* **Desktop Layout (1280px+ viewport):**
  * Two-column split layout: Left sticky column (380px) contains Order Summary, Exporter Credentials, Specification Sheets, and WhatsApp CTA. Right scrollable column (800px) contains the high-definition Vertical Photo Timeline and QC Inspection Reports.

### Screen 2: Exporter Login (Mobile-First Phone OTP)
* **Layout:** Centered card with clean heritage logo.
* **Input 1:** Phone number field pre-filled with `+91` flag icon and large numerical keypad trigger (`type="tel"`).
* **CTA:** *"Send OTP on WhatsApp / SMS"*.
* **Input 2 (OTP Step):** 6 individual large numerical digit boxes (48px wide each) with automatic focus traversal and auto-paste support.
* **Fallback:** *"Didn't receive code? Resend via WhatsApp in 24s"*. (Critical for Indian factory managers who check WhatsApp faster than SMS).

### Screen 3: Exporter Orders Dashboard
* **Header:** Greeting with Exporter Name and Cluster Tag (*"Royal Jaipur Crafts • Sitapura"*), quick search bar.
* **Filter Tabs:** Scrollable horizontal pills: *"All (8)"*, *"In Production (5)"*, *"Delayed (1)"*, *"Ready to Ship (2)"*.
* **Order Cards:**
  * Top row: PO Number in bold mono font, Buyer country flag + Name, and Status Badge (`In Progress` / `Delayed`).
  * Middle row: Product thumbnail (48x48px), Item description, Batch quantity.
  * Bottom row: Current stage with mini progress bar, target date, and a prominent green WhatsApp share icon.
* **Floating Action Button (FAB):** Bottom-right pinned 56px rounded button with `+ New Order / नया आर्डर`.

### Screen 4: New Order Form (Under 60 Seconds)
* **Philosophy:** No 20-field ERP forms. Just the 4 essentials.
* **Field 1:** Buyer Name & Country.
* **Field 2:** PO Reference & Product Description.
* **Field 3:** Batch Quantity & Delivery Date.
* **Field 4 (The Magic Dropdown):** *"Industry Cluster"* (Jaipur Textiles / Jodhpur Furniture / Moradabad Brass / Agra Leather / Custom). Selecting a cluster automatically generates the 5–6 calibrated stages without manual typing.
* **Submit CTA:** *"Generate Tracking Link & Start Production"*.

### Screen 5: Order Detail & Stage Update Page (The Heart of the System)
* **Order Status Pill Bar:** Shows active stage and delay toggle.
* **Current Stage Card (Hero Element):**
  * Large Title: *"Stage 3: Hand Block Printing (हाथ की छपाई)"*.
  * **The Giant "Add Photos" CTA (64px height):** High-contrast dashed green box with camera icon: *"Take Photo or Pick from Gallery / फोटो खींचें"*.
  * **Caption Note Field:** Simple text area with speech-to-text mic icon.
  * **QC Spec Toggle:** Checkbox: *"Measurements verified with tape / नाप चेक हो गया"*.
  * **Primary Action:** *"Mark Stage Complete & Notify Buyer / पूरा हुआ"*.
  * **Secondary Action:** *"Share Live Link on WhatsApp / लिंक भेजें"*.

---

## 5. The 30-Second Shop-Floor Upload Flow

```
[00:00] Merchandiser taps WhatsApp notification or opens app directly on phone
   │
[00:05] Taps active order card ("PO-8941 SOHO Studio") from dashboard
   │
[00:10] Taps the giant green "Add Photos / फोटो खींचें" camera button
   │
[00:15] Native camera opens ➔ Snaps 2 clear photos of block-print table & measuring tape
   │
[00:20] Photos compress client-side (4MB ➔ 240KB in 400ms); instant local preview appears
   │
[00:25] Taps "Mark Stage Complete / पूरा हुआ"
   │
[00:30] Webhook updates live buyer tracking link; Exporter owner receives WhatsApp confirmation
```

---

## 6. Real UK Buyer Dummy Data (Specification for Prototype)

* **Exporter:** Royal Jaipur Crafts & Handloom Heritage (Sitapura Industrial Area, Jaipur, Rajasthan). IEC: `0512098411`.
* **Foreign Buyer:** Toast & Co. Lifestyle Apparel, London (United Kingdom).
* **Buyer PO:** `PO-UK-8492`.
* **Product:** Hand-Block Printed Indigo & Madder Dabu Organic Cotton Midi Dress.
* **Batch Quantity:** 850 Units (UK Sizes 8 to 18).
* **Delivery Ex-Factory:** Dec 12, 2026 (Status: On Schedule, 60% Complete).
* **Stages:**
  1. *Fabric Sourcing & Lab Dip* (Completed Nov 04 — Pantone 19-3921 TCX Indigo Match Approved)
  2. *Pattern Grading & Cutting* (Completed Nov 11 — 850 unit bundle tally verified)
  3. *Hand Block Printing (Artisan Cluster)* (Current Active Stage — 4-color mud-resist Dabu in Sanganer)
  4. *Stitching & Seam Tailoring* (Scheduled: Nov 25)
  5. *In-Line QC & Measuring Tape Audit* (Scheduled: Dec 02 — AQL 2.5 spec checklist)
  6. *Steam Pressing, Barcode Scan & Packing* (Scheduled: Dec 08 — 7-ply export cartons)
