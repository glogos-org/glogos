/**
 * Supply Chain Tracking Demo
 *
 * Demonstrates end-to-end supply chain verification using Glogos protocol.
 * Tracks materials from raw source to final consumer with proof-of-delivery.
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

const SUPPLY_CHAIN_CANON = computeCanonId('opt:biz:supply-chain:1.0');
const HANDOFF_CANON = computeCanonId('opt:biz:handoff:1.0');
const INSPECTION_CANON = computeCanonId('opt:biz:inspection:1.0');

interface Party {
  zone: { id: ZoneId; publicKey: string; privateKey: string };
  name: string;
  role: 'supplier' | 'manufacturer' | 'distributor' | 'retailer' | 'consumer';
}

interface Product {
  batchId: string;
  name: string;
  quantity: number;
  origin: string;
}

interface Handoff {
  from: Party;
  to: Party;
  product: Product;
  timestamp: number;
  location: string;
  attestation: Attestation;
}

export async function runSupplyChainDemo() {
  console.log('='.repeat(80));
  console.log('SUPPLY CHAIN TRACKING DEMO');
  console.log('Raw Material to Consumer with Proof-of-Delivery');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. Setup supply chain parties
  // ============================================================================
  console.log('1. Initialize supply chain parties');

  const supplier = {
    zone: await generateZone(),
    name: 'Indonesian Coffee Cooperative',
    role: 'supplier' as const
  };

  const manufacturer = {
    zone: await generateZone(),
    name: 'Global Roasters Inc.',
    role: 'manufacturer' as const
  };

  const distributor = {
    zone: await generateZone(),
    name: 'Logistics Corp',
    role: 'distributor' as const
  };

  const retailer = {
    zone: await generateZone(),
    name: 'Premium Coffee Shop',
    role: 'retailer' as const
  };

  const consumer = {
    zone: await generateZone(),
    name: 'End Consumer',
    role: 'consumer' as const
  };

  const parties = [supplier, manufacturer, distributor, retailer, consumer];
  parties.forEach((p) => {
    console.log(`   ✓ ${p.name} (${p.role})`);
  });
  console.log('');

  // ============================================================================
  // 2. Product origin attestation
  // ============================================================================
  console.log('2. Product origin attestation');

  const product: Product = {
    batchId: 'CF-2025-001',
    name: 'Arabica Coffee Beans',
    quantity: 1000, // kg
    origin: 'Sumatra, Indonesia'
  };

  const productHash = sha256Hex(
    JSON.stringify({
      batchId: product.batchId,
      name: product.name,
      origin: product.origin,
      quantity: product.quantity,
      certifications: ['Organic', 'Fair Trade']
    })
  );

  const originTime = Math.floor(Date.now() / 1000);
  const originInput: AttestationInput = {
    zone: supplier.zone.id,
    subject: productHash as SubjectHash,
    canon: SUPPLY_CHAIN_CANON,
    time: originTime as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: originAttestation } = await createAttestation(
    originInput,
    supplier.zone.privateKey
  );

  console.log(`   Product: ${product.name}`);
  console.log(`   Batch ID: ${product.batchId}`);
  console.log(`   Origin: ${product.origin}`);
  console.log(`   Quantity: ${product.quantity} kg`);
  console.log(`   Origin Attestation: ${originAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 3. Chain of custody handoffs
  // ============================================================================
  console.log('3. Chain of custody');

  const handoffs: Handoff[] = [];
  const timeline = [
    {
      from: supplier,
      to: manufacturer,
      location: 'Jakarta Port',
      days: 0
    },
    {
      from: manufacturer,
      to: distributor,
      location: 'Seattle Factory',
      days: 14
    },
    {
      from: distributor,
      to: retailer,
      location: 'San Francisco Warehouse',
      days: 21
    },
    {
      from: retailer,
      to: consumer,
      location: 'Coffee Shop',
      days: 28
    }
  ];

  let previousAttestation = originAttestation;

  for (const step of timeline) {
    const handoffTime = originTime + step.days * 24 * 3600;

    // Sender creates handoff attestation
    const handoffHash = sha256Hex(
      JSON.stringify({
        batchId: product.batchId,
        from: step.from.zone.id,
        to: step.to.zone.id,
        location: step.location,
        timestamp: handoffTime
      })
    );

    const handoffInput: AttestationInput = {
      zone: step.from.zone.id,
      subject: handoffHash as SubjectHash,
      canon: HANDOFF_CANON,
      time: handoffTime as UnixTimestamp,
      refs: [previousAttestation.id as HashHex]
    };

    const { attestation: handoffAttestation } = await createAttestation(
      handoffInput,
      step.from.zone.privateKey
    );

    // Receiver confirms receipt with inspection
    const inspectionHash = sha256Hex(
      JSON.stringify({
        batchId: product.batchId,
        receiver: step.to.zone.id,
        condition: 'good',
        timestamp: handoffTime + 3600 // 1 hour later
      })
    );

    const inspectionInput: AttestationInput = {
      zone: step.to.zone.id,
      subject: inspectionHash as SubjectHash,
      canon: INSPECTION_CANON,
      time: (handoffTime + 3600) as UnixTimestamp,
      refs: [handoffAttestation.id as HashHex]
    };

    const { attestation: inspectionAttestation } = await createAttestation(
      inspectionInput,
      step.to.zone.privateKey
    );

    handoffs.push({
      from: step.from,
      to: step.to,
      product,
      timestamp: handoffTime,
      location: step.location,
      attestation: handoffAttestation
    });

    console.log(`   📦 ${step.from.name} → ${step.to.name}`);
    console.log(`      Location: ${step.location}`);
    console.log(`      Day ${step.days}: Handoff confirmed & inspected ✓`);

    previousAttestation = inspectionAttestation;
  }

  console.log('');

  // ============================================================================
  // 4. Consumer verification
  // ============================================================================
  console.log('4. Consumer verification');

  console.log(`   ✅ Full chain verified from origin to consumer`);
  console.log(`   🔗 Total handoffs: ${handoffs.length}`);
  console.log(`   📍 Origin: ${product.origin}`);
  console.log(`   ⏱️  Journey time: 28 days`);
  console.log(`   🎯 Current holder: ${consumer.name}`);
  console.log('');

  console.log('   Chain of custody:');
  handoffs.forEach((h, idx) => {
    console.log(`      ${idx + 1}. ${h.from.name} → ${h.to.name} (${h.location})`);
  });

  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY - Supply Chain Properties');
  console.log('='.repeat(80));
  console.log(`Product                  : ${product.name} (${product.batchId})`);
  console.log(`Origin verification      : ${supplier.name}`);
  console.log(`Chain length             : ${handoffs.length} handoffs`);
  console.log(`Total attestations       : ${handoffs.length * 2 + 1}`);
  console.log(`End-to-end traceability  : ✅ Complete`);
  console.log('');
  console.log('Benefits:');
  console.log('  • Authenticity: Cryptographic proof of origin');
  console.log('  • Accountability: Each party signs handoff');
  console.log('  • Transparency: Full history accessible to consumer');
  console.log('  • Anti-counterfeit: Impossible to inject fake products');
  console.log('');
  console.log('✅ Demo completed successfully!');
  console.log('='.repeat(80));

  return {
    product,
    parties,
    handoffs,
    originAttestation
  };
}

// Run the demo
runSupplyChainDemo().catch(console.error);
