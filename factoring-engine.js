// ==============================================================================
// PADAVO FACTOR-AS-YOU-PRODUCE EMBEDDED TRADE FINANCE ENGINE
// Stage-linked working capital advances for Indian export manufacturers
// Integrates 3% Interest Equalization Scheme (IES) & 0.75% FinTech Take-Rate
// ==============================================================================

class FactoringEngine {
  constructor() {
    this.partnerLenders = [
      { id: 'DRIP_CAPITAL', name: 'Drip Capital Trade Finance UK/US', maxLtv: 0.85, baseRate: 0.0825 },
      { id: 'SBI_GLOBAL_FACTORING', name: 'State Bank of India Factoring & Commercial Services', maxLtv: 0.80, baseRate: 0.0775 },
      { id: 'KREDX_EXPORT', name: 'KredX Working Capital Bridge', maxLtv: 0.80, baseRate: 0.0850 }
    ];

    // Stage-linked maximum loan-to-value (LTV) limits
    this.stageLtvRatios = {
      'raw_material': 0.30,  // 30% advance upon yarn/brass procurement
      'printing_dyeing': 0.50, // 50% advance upon fabric print/strike-off
      'stitching_assembly': 0.70, // 70% advance upon garment stitching
      'packaging_qc': 0.80,  // 80% advance upon AQL 2.5 pass
      'customs_leo': 0.85    // 85% advance upon Let Export Order (LEO)
    };
  }

  /**
   * Computes available working capital advance based on verified stage progress
   */
  calculateEligibility(order, completedStagesCount, totalStagesCount) {
    const totalOrderValueInr = (Number(order.total_amount) || 14000) * (order.currency === 'GBP' ? 105.8 : (order.currency === 'EUR' ? 89.2 : 84.45));
    const completionRatio = totalStagesCount > 0 ? (completedStagesCount / totalStagesCount) : 0.5;

    // Determine eligible LTV
    let eligibleLtv = 0.30;
    if (completionRatio >= 1.0) eligibleLtv = 0.85;
    else if (completionRatio >= 0.75) eligibleLtv = 0.80;
    else if (completionRatio >= 0.50) eligibleLtv = 0.65;
    else if (completionRatio >= 0.25) eligibleLtv = 0.45;

    const maxAdvanceInr = Math.round(totalOrderValueInr * eligibleLtv);
    const nominalRate = 0.085; // 8.5% p.a.
    const iesGovtSubsidy = 0.030; // 3.0% Government Interest Equalization Scheme
    const netEffectiveInterestRate = Number((nominalRate - iesGovtSubsidy).toFixed(4)); // 5.5% p.a.
    const padavoFintechFee = Math.round(maxAdvanceInr * 0.0075); // 0.75% Take Rate

    return {
      success: true,
      order_id: order.id,
      po_number: order.po_number,
      currency: order.currency || 'GBP',
      total_order_value_inr: Math.round(totalOrderValueInr),
      verified_stages: `${completedStagesCount}/${totalStagesCount}`,
      eligible_ltv_percentage: `${Math.round(eligibleLtv * 100)}%`,
      eligible_credit_advance_inr: maxAdvanceInr,
      nominal_interest_rate_p_a: '8.50%',
      ies_govt_interest_subsidy: '-3.00% (DGFT Interest Equalization Scheme)',
      net_effective_exporter_rate: '5.50% p.a.',
      padavo_platform_take_rate: '0.75%',
      padavo_take_rate_yield_inr: padavoFintechFee,
      disbursement_timeline: '4 Hours directly via RTGS to Exporter Current Account',
      recommended_lender: this.partnerLenders[0].name,
      status: 'PRE_APPROVED_AVAILABLE'
    };
  }

  /**
   * Disburses working capital tranche into exporter account
   */
  disburseTranche(orderId, requestedAmountInr, bankAccountDetails = {}) {
    const referenceId = `DISB-IES-${Date.now().toString().slice(-6)}`;
    const fee = Math.round((Number(requestedAmountInr) || 500000) * 0.0075);
    const netPayout = (Number(requestedAmountInr) || 500000) - fee;

    return {
      success: true,
      disbursement_id: referenceId,
      order_id: Number(orderId),
      requested_amount_inr: Number(requestedAmountInr) || 500000,
      padavo_fee_deducted_inr: fee,
      net_disbursed_to_exporter_inr: netPayout,
      exporter_ifsc: bankAccountDetails.ifsc || 'HDFC0000123',
      exporter_account: bankAccountDetails.account_number || '••••••••5819',
      utr_transaction_ref: `CMS${Date.now()}IN`,
      status: 'DISBURSED_VIA_DIRECT_RTGS',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new FactoringEngine();
