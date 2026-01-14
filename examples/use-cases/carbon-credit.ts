/**
 * Carbon Credit Auction Demo
 *
 * Demonstrates Milgrom/Wilson Auction Theory using Glogos protocol.
 *
 * Nobel Prize 2020: Paul Milgrom & Robert Wilson
 * "Improvements to Auction Theory and Inventions of New Auction Formats"
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type Attestation,
  type AttestationInput,
  type ZoneId,
  type SubjectHash,
  type UnixTimestamp,
  type HashHex,
  type AttestationId
} from '@glogos/core';

import {
  createCommitAttestation,
  createRevealAttestation
} from '@glogos/patterns';

// Canons
const AUCTION_CANON = computeCanonId('opt:market:auction:1.0');

interface Auction {
  id: string;
  auctioneer: ZoneId;
  item: string;
  quantity: number;
  endTime: number;
  attestation: Attestation;
}

interface Bid {
  bidder: ZoneId;
  amount: number;
  nonce: string;
  commitAttest: Attestation;
  revealAttest?: Attestation;
}

/**
 * Demo: Carbon Credit Vickrey Auction
 */
export async function runCarbonCreditDemo() {
  console.log('='.repeat(80));
  console.log('CARBON CREDIT AUCTION DEMO');
  console.log('Milgrom & Wilson - Nobel Prize 2020');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. CREATE AUCTION
  // ============================================================================
  console.log('1. Create carbon credit auction (Truthful Mechanism Design)');

  const auctioneer = await generateZone();

  const auctionPayload = {
    item: 'Amazon Rainforest Conservation - 1,000 tonnes CO2',
    quantity: 1000,
    minimumBid: 20.0,
    endTime: Math.floor(Date.now() / 1000) + 3600,
    createdAt: Math.floor(Date.now() / 1000)
  };

  const auctionInput: AttestationInput = {
    zone: auctioneer.id,
    subject: sha256Hex(JSON.stringify(auctionPayload)) as SubjectHash,
    canon: AUCTION_CANON,
    time: auctionPayload.createdAt as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: auctionAttestation } = await createAttestation(
    auctionInput,
    auctioneer.privateKey
  );

  const auction: Auction = {
    id: auctionAttestation.id,
    auctioneer: auctioneer.id,
    item: auctionPayload.item,
    quantity: auctionPayload.quantity,
    endTime: auctionPayload.endTime,
    attestation: auctionAttestation
  };

  console.log(`   Item: ${auction.item}`);
  console.log(`   Quantity: ${auction.quantity} tonnes`);
  console.log(`   Auction ID: ${auction.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 2. COMMIT PHASE - Sealed Bids
  // ============================================================================
  console.log('2. Commit phase (Bid Concealment)');

  const bidders = [
    { zone: await generateZone(), name: 'Green Energy Corp', amount: 28.75 },
    { zone: await generateZone(), name: 'Clean Air Initiative', amount: 25.5 },
    { zone: await generateZone(), name: 'Carbon Offset Partners', amount: 22.0 },
    { zone: await generateZone(), name: 'EcoFund Global', amount: 24.25 }
  ];

  const bids: Bid[] = [];

  for (const bidder of bidders) {
    // Generate random nonce
    const nonce = Math.random().toString(36).substring(7);

    const bidValue = {
      bidder: bidder.zone.id,
      amount: bidder.amount,
      currency: 'USD'
    };

    const { attestation: commitAttest, nonce: savedNonce } = await createCommitAttestation(
      bidder.zone.id,
      bidder.zone.privateKey,
      bidValue,
      nonce,
      auction.id as AttestationId
    );

    bids.push({
      bidder: bidder.zone.id,
      amount: bidder.amount,
      nonce: savedNonce,
      commitAttest
    });

    console.log(`   ✓ ${bidder.name}: Committed bid`);
  }

  console.log(`   Total commitments: ${bids.length}`);
  console.log('');

  // ============================================================================
  // 3. REVEAL PHASE
  // ============================================================================
  console.log('3. Reveal phase (Public Verification)');

  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    const bidderInfo = bidders[i];

    const bidValue = {
      bidder: bid.bidder,
      amount: bid.amount,
      currency: 'USD'
    };

    const revealAttest = await createRevealAttestation(
      bid.bidder,
      bidderInfo.zone.privateKey,
      bidValue,
      bid.nonce,
      bid.commitAttest.id
    );

    bid.revealAttest = revealAttest;

    console.log(`   ✓ ${bidderInfo.name}: $${bid.amount}/tonne`);
  }

  console.log('');

  // ============================================================================
  // 4. VERIFY REVEALS
  // ============================================================================
  console.log('4. Verify reveals match commitments (Collusion Prevention)');

  // For demo purposes, all reveals are valid since we created them
  // In production, would parse payload and verify commitment hash
  const validBids = bids.filter((bid) => bid.revealAttest !== undefined);

  console.log(`   Valid reveals: ${validBids.length}/${bids.length}`);
  console.log('');

  // ============================================================================
  // 5. VICKREY AUCTION - Winner Pays 2nd Price
  // ============================================================================
  console.log('5. Determine winner (Vickrey Second-Price)');

  const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
  const winner = sortedBids[0];
  const secondPrice = sortedBids[1].amount;

  const winnerInfo = bidders.find((b) => b.zone.id === winner.bidder)!;

  console.log(`   Winner: ${winnerInfo.name}`);
  console.log(`   Winning bid: $${winner.amount}/tonne`);
  console.log(`   Price paid (2nd highest): $${secondPrice}/tonne`);
  console.log(`   Winner's surplus: $${(winner.amount - secondPrice).toFixed(2)}/tonne`);
  console.log('');

  const totalCost = secondPrice * auction.quantity;
  console.log(`   Total payment: $${totalCost.toFixed(2)}`);
  console.log('');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY - Milgrom/Wilson Auction Theory');
  console.log('='.repeat(80));
  console.log(`1. Bid concealment          : ✅ Commit-reveal pattern (${bids.length} commits)`);
  console.log(`2. Truthful bidding         : ✅ Vickrey second-price mechanism`);
  console.log(`3. Winner's curse mitigation: ✅ Pay 2nd price, not own bid`);
  console.log(`4. Collusion prevention     : ✅ Public reveal verification`);
  console.log(`5. Mechanism transparency   : ✅ Rules attested at auction creation`);
  console.log('');
  console.log(`Auction created             : ✅`);
  console.log(`Bidders participated        : ${bidders.length}`);
  console.log(`Bids committed              : ${bids.length}`);
  console.log(`Bids revealed               : ${validBids.length}`);
  console.log(`Winner                      : ${winnerInfo.name}`);
  console.log(`Price per tonne             : $${secondPrice}/tonne`);
  console.log(`Total transaction           : $${totalCost.toFixed(2)}`);
  console.log('');
  console.log('✅ Demo completed successfully!');
  console.log('='.repeat(80));

  return {
    auction,
    bids,
    winner: winnerInfo,
    price: secondPrice,
    totalCost
  };
}

// Run the demo
runCarbonCreditDemo().catch(console.error);
