// ==============================================================================
// PADAVO TALLY PRIME ERP XML ENGINE (ZERO-DEPENDENCY)
// Supports Tally Prime 9 / Release 4.0+ XML Vouchers & Sales Order Sync
// ==============================================================================

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates official Tally Prime XML Voucher Envelope from Padavo Orders
 */
function exportOrdersToTallyXml(orders = []) {
  const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  let vouchersXml = '';
  for (const o of orders) {
    const poNum = escapeXml(o.po_number || `PO-${Date.now().toString().slice(-4)}`);
    const buyer = escapeXml(o.buyer_name || 'Overseas Buyer');
    const country = escapeXml(o.buyer_country || 'United Kingdom');
    const product = escapeXml(o.product_name || 'Handcrafted Export Goods');
    const qty = escapeXml(o.quantity || '500 Pcs');
    const cluster = escapeXml(o.cluster_type || 'jaipur');

    vouchersXml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales Order" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${currentDate}</DATE>
            <VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${poNum}</VOUCHERNUMBER>
            <REFERENCE>${poNum}</REFERENCE>
            <PARTYNAME>${buyer}</PARTYNAME>
            <PARTYLEDGERNAME>${buyer}</PARTYLEDGERNAME>
            <BASICBUYERNAME>${buyer}</BASICBUYERNAME>
            <COUNTRYOFDESTINATION>${country}</COUNTRYOFDESTINATION>
            <PLACEOFSUPPLY>Foreign Country (Zero-Rated Export)</PLACEOFSUPPLY>
            <ISINVOICE>Yes</ISINVOICE>
            <NARRATION>Padavo B2B Export Tracking Linked • Tracking Slug: ${escapeXml(o.public_tracking_slug || 'rj-pouk8492')} • Cluster: ${cluster.toUpperCase()}</NARRATION>
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${product}</STOCKITEMNAME>
              <ACTUALQTY>${qty}</ACTUALQTY>
              <BILLEDQTY>${qty}</BILLEDQTY>
              <RATE>16.50 GBP/Pcs</RATE>
              <AMOUNT>-8250.00</AMOUNT>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Padavo Export House India</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${vouchersXml.trim()}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Parses raw Tally XML string into array of Padavo Orders
 */
function parseTallyXmlToOrders(xmlString) {
  const orders = [];
  if (!xmlString) return orders;

  const voucherRegex = /<VOUCHER\b[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
  let match;

  while ((match = voucherRegex.exec(xmlString)) !== null) {
    const voucherBlock = match[1];

    const getTag = (tag) => {
      const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = r.exec(voucherBlock);
      return m ? m[1].trim() : '';
    };

    const poNumber = getTag('VOUCHERNUMBER') || getTag('REFERENCE') || `PO-TALLY-${Date.now().toString().slice(-4)}`;
    const buyerName = getTag('PARTYNAME') || getTag('PARTYLEDGERNAME') || getTag('BASICBUYERNAME') || 'Tally Imported Buyer';
    const buyerCountry = getTag('COUNTRYOFDESTINATION') || 'United Kingdom';
    const productName = getTag('STOCKITEMNAME') || 'Export Finished Consignment';
    const quantity = getTag('ACTUALQTY') || getTag('BILLEDQTY') || '500 Pcs';

    orders.push({
      po_number: poNumber,
      buyer_name: buyerName,
      buyer_country: buyerCountry,
      product_name: productName,
      quantity: quantity,
      cluster_type: 'jaipur',
      target_delivery_date: new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10)
    });
  }

  return orders;
}

module.exports = {
  exportOrdersToTallyXml,
  parseTallyXmlToOrders
};
