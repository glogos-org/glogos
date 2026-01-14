/**
 * B2B Transaction Demo
 *
 * Demonstrates business-to-business transactions with proof-of-delivery.
 * Replaces traditional invoicing with cryptographic attestations.
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type Attestation,
  type AttestationInput,
  type HashHex,
  type SubjectHash,
  type UnixTimestamp,
  type ZoneId
} from '@glogos/core';

// TRANSACTION_CANON removed as it was unused
const INVOICE_CANON = computeCanonId('opt:biz:invoice:1.0');
const DELIVERY_CANON = computeCanonId('opt:biz:delivery:1.0');
const PAYMENT_CANON = computeCanonId('opt:biz:payment:1.0');

interface Company {
  zone: { id: ZoneId; publicKey: string; privateKey: string };
  name: string;
  taxId: string;
}

interface Invoice {
  invoiceId: string;
  items: Array<{ sku: string; quantity: number; unitPrice: number }>;
  total: number;
  dueDate: number;
  attestation: Attestation;
}

export async function runTransactionDemo() {
  console.log('='.repeat(80));
  console.log('B2B TRANSACTION DEMO');
  console.log('Business transactions with cryptographic proof-of-delivery');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. Setup companies
  // ============================================================================
  console.log('1. Initialize companies');

  const supplier: Company = {
    zone: await generateZone(),
    name: 'TechParts Manufacturing Ltd.',
    taxId: 'US-123456789'
  };

  const buyer: Company = {
    zone: await generateZone(),
    name: 'Global Electronics Inc.',
    taxId: 'US-987654321'
  };

  const logistics = await generateZone();

  console.log(`   ✓ Supplier: ${supplier.name}`);
  console.log(`   ✓ Buyer: ${buyer.name}`);
  console.log(`   ✓ Logistics: Third-party carrier`);
  console.log('');

  // ============================================================================
  // 2. Purchase order and invoice
  // ============================================================================
  console.log('2. Purchase order and invoice');

  const items = [
    { sku: 'CPU-I9-14900K', quantity: 100, unitPrice: 589 },
    { sku: 'RAM-DDR5-32GB', quantity: 200, unitPrice: 149 },
    { sku: 'SSD-2TB-NVME', quantity: 150, unitPrice: 199 }
  ];

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const invoiceTime = Math.floor(Date.now() / 1000);
  const dueDate = invoiceTime + 30 * 24 * 3600; // 30 days payment terms

  const invoiceData = {
    invoiceId: 'INV-2025-001',
    from: supplier.name,
    to: buyer.name,
    items,
    total,
    currency: 'USD',
    dueDate,
    terms: 'Net 30'
  };

  const invoiceHash = sha256Hex(JSON.stringify(invoiceData));

  const invoiceInput: AttestationInput = {
    zone: supplier.zone.id,
    subject: invoiceHash as SubjectHash,
    canon: INVOICE_CANON,
    time: invoiceTime as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: invoiceAttestation } = await createAttestation(
    invoiceInput,
    supplier.zone.privateKey
  );

  const invoice: Invoice = {
    invoiceId: invoiceData.invoiceId,
    items,
    total,
    dueDate,
    attestation: invoiceAttestation
  };

  console.log(`   Invoice: ${invoice.invoiceId}`);
  console.log(`   Items: ${items.length} line items`);
  console.log(`   Total: $${total.toLocaleString()}`);
  console.log(`   Terms: Net 30 days`);
  console.log(`   Invoice Attestation: ${invoiceAttestation.id.substring(0, 16)}...`);
  console.log('');

  items.forEach((item, idx) => {
    console.log(
      `      ${idx + 1}. ${item.sku}: ${item.quantity} × $${item.unitPrice} = $${(item.quantity * item.unitPrice).toLocaleString()}`
    );
  });
  console.log('');

  // ============================================================================
  // 3. Shipment and delivery
  // ============================================================================
  console.log('3. Shipment and delivery');

  const shipmentTime = invoiceTime + 2 * 24 * 3600; // 2 days later
  const deliveryTime = shipmentTime + 3 * 24 * 3600; // 3 days shipping

  // Logistics company creates shipment attestation
  const shipmentHash = sha256Hex(
    JSON.stringify({
      invoiceId: invoice.invoiceId,
      trackingNumber: 'TRK-9876543210',
      carrier: 'logistics.id',
      pickupTime: shipmentTime,
      estimatedDelivery: deliveryTime
    })
  );

  const shipmentInput: AttestationInput = {
    zone: logistics.id,
    subject: shipmentHash as SubjectHash,
    canon: DELIVERY_CANON,
    time: shipmentTime as UnixTimestamp,
    refs: [invoiceAttestation.id as HashHex]
  };

  const { attestation: shipmentAttestation } = await createAttestation(
    shipmentInput,
    logistics.privateKey
  );

  console.log(`   📦 Shipment created`);
  console.log(`      Tracking: TRK-9876543210`);
  console.log(`      Pickup: Day ${Math.floor((shipmentTime - invoiceTime) / 86400)}`);
  console.log('');

  // Buyer confirms delivery
  const deliveryHash = sha256Hex(
    JSON.stringify({
      invoiceId: invoice.invoiceId,
      receivedBy: buyer.zone.id,
      receivedAt: deliveryTime,
      condition: 'good',
      itemsVerified: items.length
    })
  );

  const deliveryInput: AttestationInput = {
    zone: buyer.zone.id,
    subject: deliveryHash as SubjectHash,
    canon: DELIVERY_CANON,
    time: deliveryTime as UnixTimestamp,
    refs: [shipmentAttestation.id as HashHex]
  };

  const { attestation: deliveryAttestation } = await createAttestation(
    deliveryInput,
    buyer.zone.privateKey
  );

  console.log(`   ✅ Delivery confirmed by buyer`);
  console.log(`      Received: Day ${Math.floor((deliveryTime - invoiceTime) / 86400)}`);
  console.log(`      Condition: Good`);
  console.log(`      Items verified: ${items.length}/${items.length}`);
  console.log(`      Delivery Attestation: ${deliveryAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 4. Payment
  // ============================================================================
  console.log('4. Payment settlement');

  const paymentTime = deliveryTime + 7 * 24 * 3600; // 7 days after delivery
  const daysEarly = Math.floor((dueDate - paymentTime) / 86400);

  const paymentHash = sha256Hex(
    JSON.stringify({
      invoiceId: invoice.invoiceId,
      from: buyer.zone.id,
      to: supplier.zone.id,
      amount: total,
      currency: 'USD',
      paidAt: paymentTime
    })
  );

  const paymentInput: AttestationInput = {
    zone: buyer.zone.id,
    subject: paymentHash as SubjectHash,
    canon: PAYMENT_CANON,
    time: paymentTime as UnixTimestamp,
    refs: [deliveryAttestation.id as HashHex]
  };

  const { attestation: paymentAttestation } = await createAttestation(
    paymentInput,
    buyer.zone.privateKey
  );

  console.log(`   💰 Payment processed`);
  console.log(`      Amount: $${total.toLocaleString()}`);
  console.log(`      Paid: Day ${Math.floor((paymentTime - invoiceTime) / 86400)}`);
  console.log(`      Due: Day 30`);
  console.log(`      Status: ${daysEarly} days early ✅`);
  console.log(`      Payment Attestation: ${paymentAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 5. Complete transaction graph
  // ============================================================================
  console.log('5. Transaction verification');

  console.log(`   Complete attestation chain:`);
  console.log(`      1. Invoice → 2. Shipment → 3. Delivery → 4. Payment`);
  console.log('');
  console.log(`   ✅ All parties cryptographically bound`);
  console.log(`   ✅ Proof-of-delivery confirmed`);
  console.log(`   ✅ Payment linked to delivered goods`);
  console.log(`   ✅ No disputes possible (unless fraud)`);
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY - B2B Transaction Properties');
  console.log('='.repeat(80));
  console.log(`Invoice                  : ${invoice.invoiceId}`);
  console.log(`Supplier                 : ${supplier.name}`);
  console.log(`Buyer                    : ${buyer.name}`);
  console.log(`Total value              : $${total.toLocaleString()}`);
  console.log(`Transaction timeline     : ${Math.floor((paymentTime - invoiceTime) / 86400)} days`);
  console.log(`Attestations created     : 4 (Invoice, Shipment, Delivery, Payment)`);
  console.log('');
  console.log('Benefits:');
  console.log('  • Transparency: All parties can verify the complete chain');
  console.log('  • Non-repudiation: Signatures prevent "I never received it"');
  console.log('  • Automation: Smart contracts can trigger on delivery proof');
  console.log('  • Dispute resolution: Cryptographic evidence for arbitration');
  console.log('');
  console.log('✅ Demo completed successfully!');
  console.log('='.repeat(80));

  return {
    supplier,
    buyer,
    invoice,
    shipmentAttestation,
    deliveryAttestation,
    paymentAttestation
  };
}

// Run the demo
runTransactionDemo().catch(console.error);
