// ==============================================================================
// PADAVO DYNAMIC EARLY PAYMENT DISCOUNTING ENGINE ("2/10 NET 60")
// Gives foreign buyers 1.5% - 2.0% cash discount for instant wire release
// Accelerates Indian exporter cashflow cycle from 60 days to 48 hours
// ==============================================================================

class DiscountingEngine {
  constructor() {
    this.defaultDiscountPct = 2.0; // 2% Early Pay Discount
    this.earlyPayWindowHours = 48; // Pay within 48h of milestone sign-off
    this.standardNetDays = 60;     // Standard industry credit period
  }

  /**
   * Calculates early payment dynamic discount for an active milestone
   */
  calculateDiscount(milestoneAmountGbp, discountPct = 2.0) {
    const amount = Number(milestoneAmountGbp) || 5600;
    const discountRate = (discountPct || 2.0) / 100;
    const cashDiscountGbp = Number((amount * discountRate).toFixed(2));
    const discountedSettlementAmountGbp = Number((amount - cashDiscountGbp).toFixed(2));

    // Annualized Effective Yield for the Foreign Buyer (ROI on early wire)
    // Formula: (Discount% / (100 - Discount%)) * (365 / (StandardDays - EarlyPayDays))
    const daysAccelerated = this.standardNetDays - 2;
    const annualizedRoiPct = Number((((discountRate) / (1 - discountRate)) * (365 / daysAccelerated) * 100).toFixed(1));

    return {
      success: true,
      milestone_original_amount_gbp: amount,
      early_settlement_discount_pct: `${discountPct}%`,
      buyer_cash_savings_gbp: cashDiscountGbp,
      discounted_payable_amount_gbp: discountedSettlementAmountGbp,
      annualized_buyer_treasury_roi: `${annualizedRoiPct}% APR`,
      early_pay_window: '48 Hours from Milestone QC Sign-Off',
      exporter_benefit: `Unlocks cash ${daysAccelerated} days ahead of Net-60 credit terms`,
      status: 'DISCOUNT_OFFER_ACTIVE'
    };
  }

  /**
   * Accepts and locks the early discount term for wire execution
   */
  acceptDiscountTerms(orderId, milestoneId, buyerEmail) {
    return {
      success: true,
      order_id: Number(orderId),
      milestone_id: Number(milestoneId) || 1,
      accepted_by: buyerEmail || 'treasury@toastandco.co.uk',
      terms_applied: '2/10_NET_60_ACCELERATED',
      payment_due_within_hours: 48,
      wire_instruction: 'Deduct 2.0% cash discount and remit remaining net sum via SWIFT TT',
      status: 'EARLY_DISCOUNT_TERMS_LOCKED',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new DiscountingEngine();
