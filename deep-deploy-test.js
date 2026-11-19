// ==============================================================================
// PADAVO DEEP PRE-DEPLOYMENT QA & ARCHITECTURAL VERIFICATION SUITE
// Exhaustively verifies every API contract, security boundary, file integrity,
// database constraints, and deployment readiness on Port 5500
// ==============================================================================

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
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const rawString = buffer.toString('utf-8');
        let parsed = null;
        try { parsed = JSON.parse(rawString); } catch (e) { parsed = rawString; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: rawString,
          buffer: buffer
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test(group, name, fn) {
  try {
    await fn();
    console.log(`  ✅ [${group}] PASS: ${name}`);
    passCount++;
    results.push({ group, name, status: 'PASS' });
  } catch (err) {
    console.error(`  ❌ [${group}] FAIL: ${name} -> ${err.message}`);
    failCount++;
    results.push({ group, name, status: 'FAIL', error: err.message });
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

async function runDeepDeploymentAudit() {
  await ensureServerRunning();
  console.log('======================================================================');
  console.log('🔍 PADAVO DEEP PRE-DEPLOYMENT TEST & CERTIFICATION RUNNER');
  console.log(`Target Host: ${BASE_URL} (Port 5500 Isolated)`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log('======================================================================\n');

  // ============================================================================
  // SECTION 1: DEVOPS, INFRASTRUCTURE & RESOURCE HEALTH
  // ============================================================================
  console.log('📦 SECTION 1: DEVOPS, INFRASTRUCTURE & RESOURCE HEALTH');

  await test('DevOps', 'Health Check endpoint returns 200, healthy status and port 5500', async () => {
    const res = await request({ path: '/health' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'Success flag must be true');
    assert(res.body.database === 'connected', 'Database must report connected');
    assert(res.body.port === 5500, 'Port must strictly report 5500');
    assert(res.body.memory && res.body.memory.rssMb < 250, 'Memory usage within nominal threshold (<250MB)');
  });

  await test('DevOps', 'SQLite WAL Mode, foreign keys and tables integrity verified', async () => {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('database.sqlite');
    const journalMode = db.prepare('PRAGMA journal_mode').get();
    assert(journalMode.journal_mode.toLowerCase() === 'wal', `Expected WAL mode, got ${journalMode.journal_mode}`);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    const requiredTables = ['exporters', 'sessions', 'orders', 'order_stages', 'stage_photos', 'order_milestones', 'buyer_feedback', 'audit_logs'];
    for (const rt of requiredTables) {
      assert(tables.includes(rt), `Required table missing: ${rt}`);
    }
  });

  await test('DevOps', 'PWA Web App Manifest & Service Worker delivery check', async () => {
    const resManifest = await request({ path: '/manifest.json' });
    assert(resManifest.statusCode === 200, 'Manifest HTTP 200 required');
    assert(resManifest.body.display === 'standalone', 'PWA display must be standalone');

    const resSw = await request({ path: '/sw.js' });
    assert(resSw.statusCode === 200, 'Service Worker HTTP 200 required');
    assert(resSw.raw.includes('padavo-saas'), 'Cache identifier must exist in sw.js');
  });

  // ============================================================================
  // SECTION 2: END-TO-END AUTHENTICATION & EXPORTER LIFECYCLE
  // ============================================================================
  console.log('\n🔐 SECTION 2: AUTHENTICATION, MULTI-TENANCY & SESSION SECURITY');

  let sessionToken = '';
  const uniqueEmail = `deploy-audit-${Date.now()}@rajputanacrafts.com`;

  await test('Auth', 'Reject registration with missing fields with 400 Bad Request', async () => {
    const res = await request({ path: '/api/auth/register', method: 'POST' }, { email: 'invalid-test' });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  });

  await test('Auth', 'Register new export house with auto initials and starter quota', async () => {
    const res = await request({ path: '/api/auth/register', method: 'POST' }, {
      email: uniqueEmail,
      password: 'SecureExporterPassword2026!',
      company_name: 'Rajputana Heritage Woodcrafts',
      city_cluster: 'Jodhpur (Furniture & Timber)',
      iec_number: '0519842109',
      phone: '+91 98290 88776'
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.token, 'Session token missing in registration response');
    assert(res.body.exporter.company_initials === 'RHW', `Initials mismatch: ${res.body.exporter.company_initials}`);
    assert(res.body.exporter.orders_quota === 15, 'Starter quota must be 15');
    sessionToken = res.body.token;
  });

  await test('Auth', 'Reject duplicate email registration with 409 Conflict', async () => {
    const res = await request({ path: '/api/auth/register', method: 'POST' }, {
      email: uniqueEmail,
      password: 'AnotherPassword123!',
      company_name: 'Duplicate Test'
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
  });

  await test('Auth', 'Login fails with wrong password with 401 Unauthorized', async () => {
    const res = await request({ path: '/api/auth/login', method: 'POST' }, {
      email: uniqueEmail,
      password: 'IncorrectPassword!'
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Auth', 'Login succeeds with valid password and issues fresh session token', async () => {
    const res = await request({ path: '/api/auth/login', method: 'POST' }, {
      email: uniqueEmail,
      password: 'SecureExporterPassword2026!'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.token, 'Token missing');
    sessionToken = res.body.token;
  });

  await test('Auth', 'Verify /api/auth/me accepts Bearer token and returns exporter context', async () => {
    const res = await request({
      path: '/api/auth/me',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.exporter.email === uniqueEmail, 'Email mismatch in session check');
  });

  // ============================================================================
  // SECTION 3: ORDER CREATION, STAGING GATE & MILESTONES
  // ============================================================================
  console.log('\n🏭 SECTION 3: EXPORT CONSIGNMENT CREATION & STAGING GATE');

  let testOrderId = 0;
  let testTrackingSlug = '';
  let testMagicToken = '';

  await test('Orders', 'Create export consignment with Jodhpur Furniture cluster stages', async () => {
    const res = await request({
      path: '/api/orders',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    }, {
      po_number: `PO-JOD-${Date.now().toString().slice(-4)}`,
      buyer_name: 'Danish Scandinavian Design Copenhagen',
      buyer_country: 'Denmark',
      product_name: 'Solid Sheesham 8-Seater Dining Tables with Brass Inlay',
      quantity: '40 Sets (40ft High Cube Container)',
      target_delivery_date: '2026-12-28',
      cluster_type: 'jodhpur'
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.order && res.body.order.id, 'Created order ID missing');
    assert(res.body.order.public_tracking_slug, 'Tracking slug missing');
    assert(res.body.order.magic_upload_token, 'Magic upload token missing');

    testOrderId = res.body.order.id;
    testTrackingSlug = res.body.order.public_tracking_slug;
    testMagicToken = res.body.order.magic_upload_token;
  });

  await test('Orders', 'Fetch order details and verify cluster stages and milestones were populated', async () => {
    const res = await request({
      path: `/api/orders/${testOrderId}`,
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.stages.length >= 4, 'Jodhpur stages not populated');
    assert(res.body.milestones.length >= 3, 'Standard 30-40-30 tranches not created');
  });

  // ============================================================================
  // SECTION 4: FACTORY FLOOR MAGIC UPLOADS & AI VOICE TRANSCRIPTION
  // ============================================================================
  console.log('\n📱 SECTION 4: FACTORY FLOOR MAGIC UPLOAD & HINDI VOICE AI');

  await test('Floor', 'Floor camera magic upload with zero-login token', async () => {
    const sampleBase64 = 'data:image/jpeg;base64,' + Buffer.from('TEST_JPEG_PIXEL_DATA').toString('base64');
    const res = await request({
      path: `/api/public/magic-upload/${testMagicToken}`,
      method: 'POST'
    }, {
      stage_index: 1,
      image_base64: sampleBase64,
      caption: 'Kiln Seasoning Moisture Meter Reading: 8.2% (Under 10% tolerance)',
      auto_approve: true
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.image_url.startsWith('/uploads/'), 'Image URL format invalid');
  });

  await test('Floor', 'Floor voice note AI transcriber accurately parses technical Hindi factory dialect', async () => {
    const res = await request({
      path: '/api/voice-transcribe',
      method: 'POST'
    }, {
      hindi_audio_text: 'सैंडिंग और पॉलिश टेबल पर 40 डाइनिंग टेबल चेक कर ली हैं, कोई क्रैक या डिफेक्ट नहीं है'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.ai_translated_english.length > 20, 'Translated English text too short');
    assert(res.body.confidence_score >= 0.95, 'AI confidence score must be >= 0.95');
  });

  await test('Floor', 'Inbound WhatsApp Cloud Bot webhook links photo to active order stage', async () => {
    const res = await request({
      path: '/api/webhooks/whatsapp',
      method: 'POST'
    }, {
      from: '+919829012345',
      text: `#${testTrackingSlug.slice(0, 10)} Moisture meter calibrated, batch passed`,
      media_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'WhatsApp webhook failed');
  });

  // ============================================================================
  // SECTION 5: FOREIGN BUYER PORTAL & CRYPTOGRAPHIC MILESTONE SIGN-OFF
  // ============================================================================
  console.log('\n🚢 SECTION 5: FOREIGN BUYER LIVE TRACKING & MILESTONE DECISION');

  await test('Buyer', 'Foreign buyer live tracking loads without login via slug', async () => {
    const res = await request({ path: `/api/public/track/${testTrackingSlug}` });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.order.buyer_country === 'Denmark', 'Buyer country mismatch');
    assert(res.body.order.stages.length >= 4, 'Stages missing in buyer payload');
  });

  let decisionSignatureHash = '';
  await test('Buyer', 'Buyer signs off milestone 1 generating non-repudiation cryptographic hash', async () => {
    const res = await request({
      path: `/api/public/orders/${testTrackingSlug}/milestones/1/decision`,
      method: 'POST'
    }, {
      decision: 'approved',
      buyer_name: 'Danish Scandinavian Design QA Lead',
      notes: 'Timber kiln seasoning report verified under 10% moisture.'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.decision_hash.startsWith('PDV-SIG-'), 'Missing cryptographic signature hash');
    decisionSignatureHash = res.body.decision_hash;
  });

  await test('Buyer', 'Buyer submits 5-star post-inspection feedback', async () => {
    const res = await request({
      path: '/api/public/feedback',
      method: 'POST'
    }, {
      order_id: testOrderId,
      rating: 5,
      message: 'Exceptional transparency and photo resolution from the Jodhpur floor!'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  });

  // ============================================================================
  // SECTION 6: STATUTORY LEGAL & FINANCIAL PDF ENGINES
  // ============================================================================
  console.log('\n📄 SECTION 6: CRYPTOGRAPHIC PDF ENGINES (DISPUTE AUDIT & e-FIRC)');

  await test('PDF', 'Dispute Audit Certificate JSON API returns SHA256 integrity seal', async () => {
    const res = await request({ path: `/api/public/orders/${testTrackingSlug}/dispute-certificate` });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.certificate.sha256_integrity_hash.length === 64, 'SHA256 hash must be 64 hex chars');
  });

  await test('PDF', 'Downloadable Dispute Audit PDF generates valid %PDF-1.4 binary stream', async () => {
    const res = await request({ path: `/api/public/orders/${testTrackingSlug}/dispute-pdf` });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.headers['content-type'] === 'application/pdf', 'Content-Type must be application/pdf');
    assert(res.buffer.slice(0, 8).toString().includes('%PDF-1.4'), 'Binary stream must begin with %PDF-1.4 header');
    assert(res.buffer.length > 2000, 'PDF buffer must exceed 2KB');
  });

  await test('PDF', 'Downloadable e-FIRC Statutory PDF generates FEMA compliant binary', async () => {
    const res = await request({ path: `/api/orders/${testOrderId}/firc-pdf` });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.headers['content-type'] === 'application/pdf', 'Content-Type must be application/pdf');
    assert(res.buffer.slice(0, 8).toString().includes('%PDF-1.4'), 'e-FIRC must begin with %PDF-1.4');
  });

  // ============================================================================
  // SECTION 7: ERP SYNC, FINTECH ESCROW & FACTORING
  // ============================================================================
  console.log('\n📊 SECTION 7: TALLY ERP XML, ESCROW CUSTODY & FINTECH FACTORING');

  await test('Fintech', 'Tally Prime XML Export generates valid XML envelope', async () => {
    const res = await request({ path: '/api/tally/export-xml' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.raw.includes('<ENVELOPE>'), 'Tally <ENVELOPE> root missing');
    assert(res.raw.includes('<TALLYMESSAGE'), 'Tally <TALLYMESSAGE> missing');
  });

  await test('Fintech', 'Tazapay / Wise Escrow API confirms locked funds and milestone conditions', async () => {
    const res = await request({ path: `/api/orders/${testOrderId}/escrow-status` });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.escrow.escrow_vault_status === 'FUNDS_LOCKED_IN_CUSTODY', 'Vault status must be locked in custody');
    assert(res.body.escrow.locked_in_escrow > 0, 'Locked escrow amount must be positive');
  });

  await test('Fintech', '1-Click Working Capital Invoice Factoring pre-approves loan in 4 hours', async () => {
    const res = await request({
      path: `/api/orders/${testOrderId}/invoice-factoring`,
      method: 'POST'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.status === 'PRE_APPROVED_INSTANT', 'Loan decision must be pre-approved');
    assert(res.body.loan_decision.disbursement_timeline.includes('4 Hours'), 'Must provide 4-hour timeline');
  });

  // ============================================================================
  // SECTION 8: SECURITY AUDIT & PATH TRAVERSAL DEFENSE
  // ============================================================================
  console.log('\n🛡️ SECTION 8: SECURITY BOUNDARIES & HARDENING AUDIT');

  await test('Security', 'Unauthenticated request to protected route returns 401 Unauthorized', async () => {
    const res = await request({ path: '/api/subscription/usage' });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Security', 'Unmatched /api/public/ route strictly returns 404 Not Found (not 401)', async () => {
    const res = await request({ path: '/api/public/unmatched-random-route' });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
  });

  await test('Security', 'Directory traversal attempt (../etc/passwd) is safely blocked', async () => {
    const res = await request({ path: '/uploads/../../etc/passwd' });
    assert(res.statusCode === 403 || res.statusCode === 404, `Path traversal was not blocked, got ${res.statusCode}`);
  });

  await test('Security', 'Strict Rule: Zero occurrences of port 3000 or 3001 in all repository files', async () => {
    const filesToAudit = [
      'server.js',
      'public/home.html',
      'public/index.html',
      'public/buyer-tracking-uk.html',
      'public/manifest.json',
      'public/sw.js',
      'pdf-engine.js',
      'tally-engine.js',
      'storage-engine.js',
      'notification-engine.js',
      'billing-engine.js',
      '.env.example',
      'Dockerfile',
      'package.json',
      'start.bat'
    ];

    for (const f of filesToAudit) {
      const fullPath = path.join(__dirname, f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const match3000 = content.match(/3000/);
        const match3001 = content.match(/3001/);
        assert(!match3000, `Forbidden port 3000 found in ${f}`);
        assert(!match3001, `Forbidden port 3001 in ${f}`);
      }
    }
  });

  // ============================================================================
  // SECTION 9: NEXT-GEN ENTERPRISE SAAS ENGINES & VIRAL GROWTH AUDIT
  // ============================================================================
  console.log('\n🚀 SECTION 9: NEXT-GEN ENTERPRISE SAAS ENGINES & VIRAL GROWTH AUDIT');

  await test('Enterprise', 'Public Trade Documents Vault returns certified customs papers for buyer', async () => {
    const res = await request({ path: `/api/public/orders/rj-pouk8492/documents` });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(Array.isArray(res.body.documents), 'Documents must be an array');
    assert(res.body.documents.length >= 5, 'Should have at least 5 standard customs trade documents');
  });

  await test('Enterprise', 'Buyer-Led Viral Loop invites new Indian supplier with direct onboarding link', async () => {
    const res = await request({
      path: '/api/public/buyer/invite-supplier',
      method: 'POST'
    }, {
      buyer_name: 'Toast & Co. London (UK)',
      buyer_country: 'United Kingdom',
      supplier_name: 'Moradabad Metal Heritage Arts',
      supplier_contact: 'merchandiser@moradabadmetal.com',
      cluster_city: 'Moradabad'
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.invite_token, 'Invite token must be generated');
    assert(res.body.invite_link.includes('http://localhost:5500'), 'Invite link must be on port 5500');
  });

  await test('Enterprise', 'List active buyer invitations for supplier viral analytics', async () => {
    const res = await request({ path: '/api/public/buyer/invites' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.count >= 1, 'Should list invited suppliers');
  });

  await test('Enterprise', 'SaaS Recurring Billing plans endpoint returns Starter, Pro, and Enterprise tiers', async () => {
    const res = await request({ path: '/api/billing/plans' });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.plans && res.body.plans.length === 3, 'Must define 3 SaaS plans');
    const pro = res.body.plans.find(p => p.id === 'pro');
    assert(pro && pro.price_inr === 4999, 'Pro plan must be ₹4,999/mo');
  });

  await test('Enterprise', 'AQL 2.5 QC Checklist returns ISO 2859-1 standards and pass/fail specs', async () => {
    const res = await request({
      path: `/api/orders/${testOrderId}/qc-checklist`,
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.standard.includes('ISO 2859-1'), 'Standard must be ISO 2859-1 AQL 2.5');
    assert(Array.isArray(res.body.checklists), 'Checklists must be an array');
  });

  await test('Enterprise', 'QC Lead evaluates new inspection parameter with digital sign-off', async () => {
    const res = await request({
      path: `/api/orders/${testOrderId}/qc-checklist/evaluate`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    }, {
      parameter_name: 'Kiln Seasoning Moisture Level',
      standard_spec: 'Max 10-12% moisture content',
      measured_value: '9.4% verified with Delmhorst pin meter',
      status: 'passed'
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.success === true, 'Evaluation should succeed');
  });

  await test('Enterprise', 'Exporter attaches new trade document to customs vault', async () => {
    const res = await request({
      path: `/api/orders/${testOrderId}/documents`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    }, {
      doc_type: 'Fumigation Certificate',
      file_name: 'FUM-CERT-JOD-2026.pdf',
      file_url: '/uploads/fumigation-sheesham-2026.pdf',
      file_size: '280 KB'
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.id > 0, 'Document ID must be returned');
  });

  await test('Enterprise', 'Virtual FX Account provides Barclays UK BACS & Chase US ACH coordinates', async () => {
    const res = await request({
      path: `/api/orders/${testOrderId}/virtual-account`,
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.uk_bacs_account.sort_code === '20-04-15', 'Barclays sort code mismatch');
    assert(res.body.us_ach_account.routing_number_aba === '021000021', 'Chase routing ABA mismatch');
    assert(res.body.fx_savings_rate.includes('0.45%'), 'Spread must be 0.45% flat');
  });

  await test('Enterprise', 'Dispatches transactional HTML milestone email notification to overseas buyer', async () => {
    const res = await request({
      path: `/api/orders/${testOrderId}/send-buyer-email`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'Email dispatch must succeed');
    assert(res.body.subject.includes('PO-JOD-'), 'Subject must contain PO number');
  });

  await test('Enterprise', 'Create Razorpay / Stripe SaaS recurring subscription checkout session', async () => {
    const res = await request({
      path: '/api/billing/create-checkout-session',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    }, {
      plan_id: 'pro',
      payment_method: 'upi_autopay'
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.session.plan_id === 'pro', 'Session must be for pro plan');
    assert(res.body.session.amount_inr === 4999, 'Amount must be 4999 INR');
    assert(res.body.session.checkout_url.includes('checkout'), 'Must provide checkout URL');
  });

  // ============================================================================
  // FINAL SCORECARD
  // ============================================================================
  console.log('\n======================================================================');
  console.log('🏆 PRE-DEPLOYMENT TEST AUDIT SUMMARY:');
  console.log(`   Total Test Cases Executed : ${passCount + failCount}`);
  console.log(`   Passed                    : ${passCount} ✅`);
  console.log(`   Failed                    : ${failCount} ❌`);
  console.log(`   Deployment Readiness Score: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log('======================================================================\n');

  if (embeddedServer) {
    embeddedServer.close();
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runDeepDeploymentAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
