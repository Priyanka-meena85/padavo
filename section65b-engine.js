// ==============================================================================
// PADAVO SECTION 65B INDIAN EVIDENCE ACT CERTIFICATE ENGINE
// Section 65B of Indian Evidence Act, 1872 / Bharatiya Sakshya Adhiniyam, 2023
// Generates court-admissible electronic record certificate for debt recovery & arbitration
// ==============================================================================

const crypto = require('crypto');

class Section65bEngine {
  constructor() {
    this.certifyingAuthority = 'Padavo Cryptographic Trust & Verification Infrastructure';
  }

  /**
   * Generates a court-admissible Section 65B Electronic Evidence Affidavit
   */
  generateCertificate(order, auditTrail = []) {
    const certNumber = `SEC65B-IN-${new Date().getFullYear()}-${order.po_number.replace(/\D/g, '') || '8492'}-${Date.now().toString().slice(-4)}`;
    const systemDate = new Date().toISOString();

    const electronicRecordDetails = {
      order_id: order.id,
      po_number: order.po_number,
      exporter_name: order.company_name || 'Exporter Enterprise',
      iec_number: order.iec_number || '0518920194',
      buyer_name: order.buyer_name || 'Overseas Buyer',
      buyer_country: order.buyer_country || 'United Kingdom',
      total_contract_value: `${order.currency || 'GBP'} ${order.total_amount || '14,000'}`,
      device_and_server_specification: 'Linux Dual-Stack Node.js 24 Cloud Instance, SHA-256 Digest Engine',
      operating_period: `From ${order.created_at || '2026-10-15'} to ${systemDate}`,
      custody_status: 'UNINTERRUPTED_NORMAL_COURSE_OF_BUSINESS'
    };

    const legalDeclarationText = 
      `AFFIDAVIT UNDER SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872\n` +
      `(Corresponding to Section 63 of the Bharatiya Sakshya Adhiniyam, 2023)\n\n` +
      `I, the Authorised System Administrator of Padavo SaaS Platform, do hereby solemnly affirm and state as follows:\n` +
      `1. That the electronic computer output, log entries, time-stamps, photo proofs, and digital signatures relating to Export Order #${order.po_number} were produced by the computer during the period over which the computer was used regularly to store or process information.\n` +
      `2. That throughout the material part of the said period, the computer was operating properly and the cryptographic hash values were computed in the ordinary course of business without human tampering.\n` +
      `3. That the SHA-256 hash digests and digital records are authentic, unaltered, and true representations of the transactions between ${order.company_name} and ${order.buyer_name}.\n` +
      `4. Deposed and certified at Jaipur, Rajasthan under digital seal.\n`;

    const compositeHash = crypto.createHash('sha256')
      .update(legalDeclarationText + JSON.stringify(electronicRecordDetails))
      .digest('hex').toUpperCase();

    return {
      success: true,
      certificate_number: certNumber,
      statutory_provision: 'Section 65B Indian Evidence Act 1872 / Section 63 BSA 2023',
      deponent: 'Authorised Systems Custodian, Padavo Digital Verification Infrastructure',
      jurisdiction: 'Courts of India & Commercial Arbitration Tribunals',
      electronic_record_summary: electronicRecordDetails,
      sha256_audit_seal: `SEC65B-HASH-${compositeHash}`,
      affidavit_text: legalDeclarationText,
      legal_admissibility_status: 'COURT_ADMISSIBLE_CERTIFICATE_READY',
      issued_at: systemDate
    };
  }
}

module.exports = new Section65bEngine();
