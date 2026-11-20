// Padavo SaaS Senior QA Automated Test Suite
// Verifies all core business workflows, API contracts, edge cases, and security boundaries on Port 5500

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5500';
let passCount = 0;
let failCount = 0;
const results = [];

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || options.path, BASE_URL);
    const reqOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (postData && typeof postData === 'object' && !reqOptions.headers['Content-Type']) {
      reqOptions.headers['Content-Type'] = 'application/json';
      postData = JSON.stringify(postData);
    }
    if (postData) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failCount++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

let embeddedServer = null;
async function ensureServerRunning() {
  const handler = require('./server.js');
  await new Promise((resolve, reject) => {
    const s = http.createServer(handler);
    s.on('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve();
      else reject(err);
    });
    s.listen(5500, () => {
      embeddedServer = s;
      resolve();
    });
  });
}

async function runTestSuite() {
  await ensureServerRunning();
  console.log('===============================================================');
  console.log('🧪 PADAVO SAAS — SENIOR QA AUTOMATION TEST RUNNER');
  console.log(`Target Host: ${BASE_URL} (Port 5500 Isolated)`);
  console.log('===============================================================\n');

  // Group 1: Infrastructure & Health
  console.log('📦 GROUP 1: INFRASTRUCTURE & SERVICE HEALTH');
  await test('Healthcheck API returns 200, healthy status, and connected database', async () => {
    const res = await request({ path: '/health' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true || res.body.status === 'healthy', 'Healthcheck status mismatch');
    assert(res.body.database === 'connected', 'Database must be connected');
    assert(res.body.port === 5500, 'Port must strictly report 5500');
  });

  await test('PWA Web Manifest is accessible and valid JSON with standalone display', async () => {
    const res = await request({ path: '/manifest.json' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.short_name === 'Padavo', 'PWA short_name mismatch');
    assert(res.body.display === 'standalone', 'PWA display must be standalone');
  });

  await test('PWA Service Worker script is served correctly with offline caching logic', async () => {
    const res = await request({ path: '/sw.js' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.raw.includes('padavo-saas'), 'Service worker cache identifier missing');
    assert(res.raw.includes('addEventListener'), 'Service worker listener missing');
  });

  // Group 2: Public Buyer Tracking & Decisions
  console.log('\n🚢 GROUP 2: PUBLIC BUYER TRACKING & VERIFIED SIGN-OFFS');
  await test('Public live tracking resolves via short slug (rj-pouk8492)', async () => {
    const res = await request({ path: '/api/public/track/rj-pouk8492' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'API returned failure');
    const po = res.body.order ? res.body.order.po_number : (res.body.data ? res.body.data.po_number : null);
    assert(po === 'PO-UK-8492', `Order PO mismatch: got ${po}`);
  });

  await test('Public live tracking resolves via full random entropy slug', async () => {
    const res = await request({ path: '/api/public/track/rj-pouk8492-9a4f82bc10de' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'API returned failure');
    const po = res.body.order ? res.body.order.po_number : (res.body.data ? res.body.data.po_number : null);
    assert(po === 'PO-UK-8492', `Order PO mismatch: got ${po}`);
  });

  await test('Public milestones API returns tranches for buyer review', async () => {
    const res = await request({ path: '/api/public/orders/rj-pouk8492/milestones' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.milestones && res.body.milestones.length >= 3, 'Expected at least 3 milestone tranches');
  });

  await test('Buyer Milestone Decision (Approve) generates cryptographic proof hash', async () => {
    const res = await request({
      path: '/api/public/orders/rj-pouk8492/milestones/1/decision',
      method: 'POST'
    }, {
      decision: 'approved',
      buyer_name: 'Toast & Co. QA London',
      notes: 'Fabric lab-dip and tensile strength approved for production release.'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'Decision failed');
    assert(res.body.decision_hash && res.body.decision_hash.startsWith('PDV-SIG-'), 'Missing cryptographic signature hash');
  });

  await test('Tamper-proof Dispute Certificate API generates SHA256 integrity audit', async () => {
    const res = await request({ path: '/api/public/orders/rj-pouk8492/dispute-certificate' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.certificate && res.body.certificate.sha256_integrity_hash, 'Missing SHA256 audit hash');
    assert(res.body.certificate.order.po_number === 'PO-UK-8492', 'PO mismatch in dispute certificate');
  });

  // Group 3: International Logistics & Financial Instruments
  console.log('\n🌐 GROUP 3: LOGISTICS TELEMETRY & RBI/FEMA INSTRUMENTS');
  await test('Live Ocean Freight Container Tracker returns vessel telemetry', async () => {
    const res = await request({ path: '/api/shipping/MSKU-948201-9' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.carrier.includes('Maersk'), 'Carrier mismatch');
    assert(res.body.vessel_name.includes('MSC Paloma'), 'Vessel name mismatch');
    assert(res.body.telemetry.ambient_temp, 'Ambient telemetry missing');
    assert(res.body.checkpoints.length >= 5, 'Expected full checkpoint route');
  });

  await test('e-FIRC generator creates RBI/FEMA compliant remittance certificate', async () => {
    const res = await request({ path: '/api/orders/1/firc' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.firc_number.startsWith('FIRC-IN-2026-'), 'Invalid FIRC number');
    assert(res.body.payment_details.fema_compliance_seal.includes('FEMA ACT 1999'), 'Missing FEMA seal');
    assert(res.body.payment_details.realized_inr_amount > 0, 'Realized INR amount must be positive');
  });

  await test('Multi-Vendor Foreign Buyer Hub returns consolidated supply chain', async () => {
    const res = await request({ path: '/api/public/buyer-hub' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.orders.length >= 3, 'Expected multi-vendor orders');
    assert(res.body.buyer.includes('Toast & Co'), 'Buyer name mismatch');
  });

  // Group 4: Shop Floor AI & WhatsApp Cloud Bot
  console.log('\n🤖 GROUP 4: FACTORY FLOOR AI & WHATSAPP CLOUD BOT');
  await test('Shop Floor Hindi Voice Note AI transcriber accurately parses factory dialect', async () => {
    const res = await request({
      path: '/api/voice-transcribe',
      method: 'POST'
    }, {
      hindi_audio_text: 'मास्टरजी ने ब्लॉक प्रिंट कलर मैचिंग चेक कर ली है, कोई डिफेक्ट नहीं मिला'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.ai_translated_english.includes('Block print'), 'AI translation failed');
    assert(res.body.confidence_score > 0.9, 'Confidence score must be > 0.9');
  });

  await test('Inbound WhatsApp Cloud Bot Webhook ingests photo and auto-assigns stage', async () => {
    const res = await request({
      path: '/api/webhooks/whatsapp',
      method: 'POST'
    }, {
      from: '+919829012345',
      text: '#PO-UK-8492 Block print lot approved on staging table',
      media_url: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'WhatsApp webhook failed');
    assert(res.body.data.po_number === 'PO-UK-8492', 'Webhook routed to wrong PO');
  });

  await test('Meta WhatsApp Webhook subscription challenge verification works', async () => {
    const res = await request({ path: '/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test_token_8891&hub.verify_token=padavo_meta_webhook_secret_2026' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.raw === 'test_token_8891', 'Challenge verification mismatch');
  });

  await test('Outbound WhatsApp milestone alert dispatches via Meta Cloud API engine', async () => {
    const res = await request({
      path: '/api/orders/1/send-whatsapp-alert',
      method: 'POST'
    }, {
      recipient_phone: '+919829012345'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'WhatsApp alert failed');
    assert(res.body.status === 'SENT_TO_WHATSAPP_NETWORK', 'WhatsApp status mismatch');
  });

  await test('Multi-lingual Voice AI transcribes Tiruppur Tamil cluster dialect', async () => {
    const res = await request({
      path: '/api/voice-transcribe',
      method: 'POST'
    }, {
      language_code: 'ta-IN',
      hindi_audio_text: 'நூல் தரம் மற்றும் தையல் சரிபார்க்கப்பட்டது'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'Tamil transcription failed');
    assert(res.body.dialect_detected.includes('Tiruppur'), 'Cluster dialect mismatch');
  });

  await test('Live interbank FX rate engine returns GBP/USD/EUR/AED real-time rates', async () => {
    const res = await request({ path: '/api/fx-rates' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.rates.GBP.spot_rate > 100, 'GBP rate out of range');
    assert(res.body.rates.USD.spot_rate > 80, 'USD rate out of range');
  });

  await test('Guaranteed 60-day FX forward lock quotes precise settlement forward rate', async () => {
    const res = await request({
      path: '/api/fx-rates/lock',
      method: 'POST'
    }, {
      amount: 25000,
      currency: 'GBP',
      tenure_days: 60
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'FX lock quote failed');
    assert(res.body.forward_cover.lock_reference.startsWith('FWD-'), 'Lock reference missing');
  });

  await test('ICEGATE Indian Customs LEO verification validates Nhava Sheva (INNSA1) Shipping Bill', async () => {
    const res = await request({
      path: '/api/orders/1/icegate-verify',
      method: 'POST'
    }, {
      shipping_bill_no: '7482910',
      port_code: 'INNSA1'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'ICEGATE verification failed');
    assert(res.body.icegate_verification.customs_port.includes('Nhava Sheva'), 'Port name mismatch');
    assert(res.body.icegate_verification.leo_status === 'LET_EXPORT_ORDER_GRANTED', 'LEO status mismatch');
  });

  // Group 5: Enterprise Multi-Tenant & Scalability
  console.log('\n☁️ GROUP 5: ENTERPRISE CLOUD STORAGE & TALLY ERP INTEGRATION');
  await test('Cloudflare R2 Direct Upload presigned URL generator returns coordinates', async () => {
    const res = await request({
      path: '/api/storage/presigned-url',
      method: 'POST'
    }, {
      filename: 'sample-qc-inspection.jpg',
      file_type: 'image/jpeg'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.upload_url.includes('padavo'), 'Upload URL invalid');
    assert(res.body.direct_headers['Cache-Control'].includes('immutable'), 'Missing CDN caching header');
  });

  await test('Tally/Excel 1-Click Consignment Import batch inserts orders with stages & milestones', async () => {
    const sampleTally = [
      {
        po_number: `PO-QA-${Date.now().toString().slice(-4)}`,
        buyer_name: 'Marks & Spencer Lifestyle',
        buyer_country: 'United Kingdom',
        product_name: 'Organic Cotton Block Printed Kurtis',
        quantity: '600 Pcs',
        target_delivery_date: '2026-12-15',
        cluster_type: 'jaipur'
      }
    ];

    const res = await request({
      path: '/api/orders/bulk-import',
      method: 'POST'
    }, { orders: sampleTally });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.count === 1, 'Expected 1 imported order');
    assert(res.body.imported_orders[0].public_tracking_slug.length > 5, 'Tracking slug not generated');
  });

  // Group 6: Security, Auth & Boundary Edge Cases
  console.log('\n🔒 GROUP 6: SECURITY, AUTHENTICATION & EDGE CASE REGRESSION');
  let authToken = '';
  const testEmail = `qa-tester-${Date.now()}@jaipurexports.com`;

  await test('Exporter Registration & Session generation', async () => {
    const res = await request({
      path: '/api/auth/register',
      method: 'POST'
    }, {
      email: testEmail,
      password: 'StrongPassword123!',
      company_name: 'Heritage Textiles Ltd',
      city_cluster: 'Jaipur (Textiles)'
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.token, 'Session token missing');
    authToken = res.body.token;
  });

  await test('Authenticated /api/auth/me accepts valid session token', async () => {
    const res = await request({
      path: '/api/auth/me',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.exporter.email === testEmail, 'Email mismatch in session');
  });

  await test('Security Guard: Protected API without Bearer token returns 401 Unauthorized', async () => {
    const res = await request({ path: '/api/subscription/usage' });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Bug Fix Verification: Unmatched public route returns 404 Not Found (NOT 401)', async () => {
    const res = await request({ path: '/api/public/non-existent-route-9988' });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    assert(res.body.message.includes('not found'), 'Expected not found message');
  });

  await test('Negative Test: Non-existent order tracking slug returns 404 Not Found', async () => {
    const res = await request({ path: '/api/public/track/definitely-not-a-valid-slug-xyz' });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
  });

  await test('Negative Test: Invalid decision value rejected with 400 Bad Request', async () => {
    const res = await request({
      path: '/api/public/orders/rj-pouk8492/milestones/1/decision',
      method: 'POST'
    }, {
      decision: 'invalid_status_action'
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  });

  // Group 7: HTML & Static File Delivery
  console.log('\n📄 GROUP 7: PRODUCTION HTML INTERFACES');
  await test('Landing page /home.html delivers full SaaS marketing content', async () => {
    const res = await request({ path: '/home.html' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.raw.includes('Padavo'), 'Title brand missing');
    assert(res.raw.includes('Jaipur'), 'Jaipur cluster missing');
    assert(res.raw.includes('Moradabad'), 'Moradabad cluster missing');
  });

  await test('Exporter Dashboard /index.html delivers Role-Based Controls & Modals', async () => {
    const res = await request({ path: '/index.html' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.raw.includes('recordVoiceNote'), 'Voice note function missing');
    assert(res.raw.includes('modal-tally-import'), 'Bulk import modal missing');
    assert(res.raw.includes('user-role-select'), 'Role switcher select missing');
  });

  await test('Buyer Tracking /buyer-tracking-uk.html delivers Multi-Lang & Telemetry', async () => {
    const res = await request({ path: '/buyer-tracking-uk.html' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.raw.includes('changeLanguage'), 'Language switcher missing');
    assert(res.raw.includes('MSC Paloma'), 'Live container vessel missing');
    assert(res.raw.includes('Arbitration'), 'Arbitration clause missing');
  });

  // Group 8: Zero Port 3000/3001 Hardcoding Audit
  console.log('\n🛡️ GROUP 8: STRICT USER RULE AUDIT (ZERO PORT 3000/3001)');
  await test('Zero traces of port 3000 or 3001 in all workspace HTML and JS files', async () => {
    const filesToAudit = [
      'server.js',
      'public/home.html',
      'public/index.html',
      'public/buyer-tracking-uk.html',
      'public/manifest.json',
      'public/sw.js',
      '.env.example'
    ];

    for (const f of filesToAudit) {
      const fullPath = path.join(__dirname, f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const match3000 = content.match(/3000/);
        const match3001 = content.match(/3001/);
        assert(!match3000, `Found forbidden port 3000 in ${f}`);
        assert(!match3001, `Found forbidden port 3001 in ${f}`);
      }
    }
  });

  // Group 9: Enterprise PDF, Tally XML & Fintech Escrow
  console.log('\n💎 GROUP 9: ENTERPRISE PDF, TALLY XML & FINTECH ESCROW ENGINES');
  await test('Server-side Dispute Audit PDF generator delivers valid PDF binary (%PDF-1.4)', async () => {
    const res = await request({ path: '/api/public/orders/rj-pouk8492/dispute-pdf' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.headers['content-type'] === 'application/pdf', 'Content-Type must be application/pdf');
    assert(res.raw.startsWith('%PDF-1.4'), 'PDF binary signature missing');
  });

  await test('Server-side e-FIRC Statutory PDF generator delivers valid FEMA certificate', async () => {
    const res = await request({ path: '/api/orders/1/firc-pdf' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.headers['content-type'] === 'application/pdf', 'Content-Type must be application/pdf');
    assert(res.raw.startsWith('%PDF-1.4'), 'PDF binary signature missing');
  });

  await test('Tally Prime XML Export generates valid voucher envelope', async () => {
    const res = await request({ path: '/api/tally/export-xml' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.raw.includes('<ENVELOPE>'), 'Tally ENVELOPE tag missing');
    assert(res.raw.includes('<TALLYMESSAGE'), 'Tally TALLYMESSAGE tag missing');
    assert(res.raw.includes('Sales Order'), 'Tally Sales Order type missing');
  });

  await test('Tally Prime XML Import parses XML and batch creates orders', async () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales Order" ACTION="Create">
            <VOUCHERNUMBER>PO-TALLY-XML-9988</VOUCHERNUMBER>
            <PARTYNAME>John Lewis Living London</PARTYNAME>
            <COUNTRYOFDESTINATION>United Kingdom</COUNTRYOFDESTINATION>
            <STOCKITEMNAME>Handcrafted Brass Bowls</STOCKITEMNAME>
            <ACTUALQTY>350 Sets</ACTUALQTY>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const res = await request({
      path: '/api/tally/import-xml',
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' }
    }, sampleXml);

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.count === 1, 'Expected 1 imported order');
  });

  await test('Fintech Escrow API returns Tazapay / Wise custody lock status', async () => {
    const res = await request({ path: '/api/orders/1/escrow-status' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.escrow.escrow_partner.includes('Tazapay'), 'Escrow partner mismatch');
    assert(res.body.escrow.locked_in_escrow > 0, 'Locked escrow amount must be positive');
  });

  await test('1-Click Working Capital Invoice Factoring pre-approves export credit advance', async () => {
    const res = await request({
      path: '/api/orders/1/invoice-factoring',
      method: 'POST'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.status === 'PRE_APPROVED_INSTANT', 'Loan status must be pre-approved');
    assert(res.body.loan_decision.eligible_credit_limit.includes('INR'), 'Missing credit limit');
  });

  // Group 10: Next-Gen Enterprise SaaS & Multi-Moat Engines
  console.log('\n🌟 GROUP 10: NEXT-GEN ENTERPRISE SAAS & MULTI-MOAT ENGINES');
  await test('Computer Vision AI Defect Detection evaluates AQL 2.5 pass probability', async () => {
    const res = await request({
      path: '/api/qc/vision-inspect',
      method: 'POST'
    }, {
      image_url: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d',
      cluster: 'jaipur_textiles',
      stage: 'AQL 2.5 Quality Inspection'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.aql_2_5_verdict === 'PASSED_AQL_2_5', 'Vision QC verdict mismatch');
    assert(res.body.pass_probability > 0.9, 'Pass probability must be > 0.9');
    assert(res.body.color_delta_e < 1.2, 'Color Delta E out of spec');
  });

  await test('Chunked Resumable Upload initializes, receives parts, and assembles final asset', async () => {
    // 1. Init
    const initRes = await request({
      path: '/api/upload/chunk-init',
      method: 'POST'
    }, {
      filename: 'factory-offline-proof.jpg',
      total_size: 1024,
      total_chunks: 2
    });
    assert(initRes.statusCode === 200, `Init failed with ${initRes.statusCode}`);
    const uploadId = initRes.body.upload_id;
    assert(uploadId && uploadId.startsWith('chk-'), 'Invalid upload id');

    // 2. Part 0
    const part0 = await request({
      path: '/api/upload/chunk',
      method: 'POST'
    }, {
      upload_id: uploadId,
      chunk_index: 0,
      chunk_data_base64: Buffer.from('CHUNK_0_BYTES_PAYLOAD_').toString('base64')
    });
    assert(part0.statusCode === 200, 'Part 0 failed');

    // 3. Part 1
    const part1 = await request({
      path: '/api/upload/chunk',
      method: 'POST'
    }, {
      upload_id: uploadId,
      chunk_index: 1,
      chunk_data_base64: Buffer.from('CHUNK_1_BYTES_PAYLOAD_').toString('base64')
    });
    assert(part1.statusCode === 200, 'Part 1 failed');
    assert(part1.body.is_complete === true, 'Upload not flagged complete');

    // 4. Assemble
    const compRes = await request({
      path: '/api/upload/chunk-complete',
      method: 'POST'
    }, { upload_id: uploadId });
    assert(compRes.statusCode === 200, 'Assemble failed');
    assert(compRes.body.resumable_status === 'ASSEMBLED_SUCCESSFULLY', 'Status mismatch');
  });

  await test('Two-Way Interactive WhatsApp Bot dispatches decision buttons to overseas buyer', async () => {
    const res = await request({
      path: '/api/orders/1/whatsapp-interactive-prompt',
      method: 'POST'
    }, {
      phone: '+447911123456'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.interactive_payload.type === 'button', 'Expected button interactive payload');
    assert(res.body.interactive_payload.action.buttons.length >= 3, 'Expected at least 3 action buttons');
  });

  await test('Factor-As-You-Produce calculates stage-linked advance, IES subsidy, and take-rate', async () => {
    const res = await request({ path: '/api/factoring/order/1/eligibility' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.eligible_credit_advance_inr > 0, 'Eligible advance must be positive');
    assert(res.body.padavo_platform_take_rate === '0.75%', 'Padavo take rate must be 0.75%');
    assert(res.body.net_effective_exporter_rate === '5.50% p.a.', 'Effective rate mismatch');
  });

  await test('Factor-As-You-Produce disburses tranche with instant RTGS UTR reference', async () => {
    const res = await request({
      path: '/api/factoring/order/1/disburse',
      method: 'POST'
    }, {
      amount_inr: 750000,
      bank_details: { ifsc: 'HDFC0001829', account_number: '502000849201' }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.status === 'DISBURSED_VIA_DIRECT_RTGS', 'Status mismatch');
    assert(res.body.padavo_fee_deducted_inr > 0, 'Take rate fee must be deducted');
  });

  await test('TradeTrust Digital e-BL generates UNCITRAL MLETR compliant cryptographic title', async () => {
    const res = await request({ path: '/api/orders/1/ebl' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.legal_framework.includes('MLETR'), 'Legal framework mismatch');
    assert(res.body.title_hash.length === 64, 'Invalid title hash');
  });

  await test('TradeTrust Digital e-BL endorses and transfers title to buyer upon settlement', async () => {
    const res = await request({
      path: '/api/orders/1/ebl/endorse',
      method: 'POST'
    }, {
      ebl_number: 'EBL-MLETR-2026-8492',
      new_holder: 'Marks & Spencer London HQ',
      bank_wire_ref: 'TT-BARC-8492019'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.status === 'CARGO_TITLE_TRANSFERRED_TO_BUYER', 'Title transfer status mismatch');
  });

  await test('Third-Party Auditor Portal serves pending inspections and accepts accredited sign-off', async () => {
    const listRes = await request({ path: '/api/auditor/inspections' });
    assert(listRes.statusCode === 200, `Expected 200, got ${listRes.statusCode}`);
    assert(listRes.body.pending_inspections.length >= 1, 'Expected pending inspections');

    const signRes = await request({
      path: '/api/auditor/inspections/1/sign-off',
      method: 'POST'
    }, {
      auditor_details: { agency_id: 'SGS_INDIA', auditor_name: 'Suresh Menon, Lead Auditor' }
    });
    assert(signRes.statusCode === 200, `Sign-off failed with ${signRes.statusCode}`);
    assert(signRes.body.certificate_number.startsWith('CERT-SGS-'), 'Certificate number format mismatch');
    assert(signRes.body.aql_sampling_result.disposition === 'PASSED_FOR_EXPORT', 'Disposition mismatch');
  });

  await test('Background Job Queue reports metrics and zero-lag concurrency state', async () => {
    const res = await request({ path: '/api/system/queue-metrics' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.job_queue, 'Missing job queue telemetry');
  });

  console.log('\n===============================================================');
  console.log(`📊 TEST EXECUTION COMPLETE:`);
  console.log(`   Total Tests: ${passCount + failCount}`);
  console.log(`   Passed:      ${passCount} ✅`);
  console.log(`   Failed:      ${failCount} ❌`);
  console.log('===============================================================\n');

  if (embeddedServer) {
    embeddedServer.close();
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
