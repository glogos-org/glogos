/**
 * Financial Federation Demo
 *
 * Demonstrates the formation of "Center Zones" (Federations) that govern
 * multiple financial zones (simulating BTC/Solana networks) within Glogos.
 *
 * Concept:
 * 1. Federation Zone: The "Central Bank" or "Network Alliance".
 * 2. Member Zones: Independent issuers (e.g., G-Bitcoin, G-Solana).
 * 3. Trust Chain: Issuance -> Member Charter -> Federation.
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
  type UnixTimestamp
} from '@glogos/core';

// Canons
const FEDERATION_CANON = computeCanonId('opt:governance:federation:1.0');
const FINANCE_CANON = computeCanonId('opt:finance:triple-entry:1.0');

interface CharterPayload {
  action: 'charter';
  member: string; // The Zone ID being chartered
  networkName: string; // e.g., "G-Bitcoin Network"
  ticker: string; // e.g., "BTC"
}

interface FinancePayload {
  asset: string;
  amount: number;
  from_zone: string;
  to_zone: string;
  type: 'issue' | 'transfer';
}

export async function runFederationDemo() {
  console.log('='.repeat(80));
  console.log('FINANCIAL FEDERATION DEMO (Center Zones)');
  console.log('Building "G-Bitcoin" and "G-Solana" on Glogos Layer 0');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. SETUP ZONES
  // ============================================================================
  console.log('1. Establishing Zones');

  // The "Center Zone" (e.g., World Crypto Alliance)
  const federation = await generateZone();
  console.log(`   🏛️  Federation Zone: ${federation.id.substring(0, 16)}...`);

  // The "Member Zones" (Independent Networks)
  const btcZone = await generateZone();
  console.log(`   🟠 G-Bitcoin Zone:  ${btcZone.id.substring(0, 16)}...`);

  const solZone = await generateZone();
  console.log(`   🟣 G-Solana Zone:   ${solZone.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 2. FEDERATION CHARTERS (Governance Layer)
  // ============================================================================
  console.log('2. Federation issues Charters (Governance)');

  // Charter for G-Bitcoin
  const btcCharterInput: AttestationInput = {
    zone: federation.id,
    subject: sha256Hex(
      JSON.stringify({
        action: 'charter',
        member: btcZone.id,
        networkName: 'G-Bitcoin Network',
        ticker: 'BTC'
      } as CharterPayload)
    ) as SubjectHash,
    canon: FEDERATION_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex] // Rooted in GLR
  };
  const { attestation: btcCharter } = await createAttestation(
    btcCharterInput,
    federation.privateKey
  );
  console.log(`   📜 Chartered G-Bitcoin (Ref: ${btcCharter.id.substring(0, 8)}...)`);

  // Charter for G-Solana
  const solCharterInput: AttestationInput = {
    zone: federation.id,
    subject: sha256Hex(
      JSON.stringify({
        action: 'charter',
        member: solZone.id,
        networkName: 'G-Solana Network',
        ticker: 'SOL'
      } as CharterPayload)
    ) as SubjectHash,
    canon: FEDERATION_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: solCharter } = await createAttestation(
    solCharterInput,
    federation.privateKey
  );
  console.log(`   📜 Chartered G-Solana  (Ref: ${solCharter.id.substring(0, 8)}...)`);
  console.log('');

  // ============================================================================
  // 3. ASSET ISSUANCE (Finance Layer)
  // ============================================================================
  console.log('3. Member Zones issue assets (referencing their Charters)');

  // G-Bitcoin issues BTC
  // Note: It references 'btcCharter.id' to prove authority!
  const issueBTCInput: AttestationInput = {
    zone: btcZone.id,
    subject: sha256Hex(
      JSON.stringify({
        asset: `NATIVE:BTC:${btcZone.id}`,
        amount: 21000000,
        from_zone: btcZone.id,
        to_zone: btcZone.id, // Mint to self/treasury
        type: 'issue'
      } as FinancePayload)
    ) as SubjectHash,
    canon: FINANCE_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [btcCharter.id as HashHex] // <--- PROOF OF AUTHORITY
  };
  const { attestation: btcIssuance } = await createAttestation(issueBTCInput, btcZone.privateKey);
  console.log(`   💰 Issued 21M BTC. Provenance: Issuance -> Charter -> Federation`);

  // G-Solana issues SOL
  const issueSOLInput: AttestationInput = {
    zone: solZone.id,
    subject: sha256Hex(
      JSON.stringify({
        asset: `NATIVE:SOL:${solZone.id}`,
        amount: 1000000000,
        from_zone: solZone.id,
        to_zone: solZone.id,
        type: 'issue'
      } as FinancePayload)
    ) as SubjectHash,
    canon: FINANCE_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [solCharter.id as HashHex] // <--- PROOF OF AUTHORITY
  };
  const { attestation: solIssuance } = await createAttestation(issueSOLInput, solZone.privateKey);
  console.log(`   💰 Issued 1B SOL.  Provenance: Issuance -> Charter -> Federation`);
  console.log('');

  // ============================================================================
  // 4. CLIENT VALIDATION (The "Center Zone" Effect)
  // ============================================================================
  console.log('4. Client validates Asset Trust Chain');

  const networkHistory = [btcCharter, solCharter, btcIssuance, solIssuance];

  function isTrustedAsset(assetIssuance: Attestation, trustedFederationId: string): boolean {
    // 1. Find ANY ref that points to a valid charter signed by the Federation
    const charter = networkHistory.find(
      (a) =>
        assetIssuance.refs.includes(a.id) &&
        a.zone === trustedFederationId &&
        a.canon === FEDERATION_CANON
    );

    return !!charter;
  }

  const isBTCValid = isTrustedAsset(btcIssuance, federation.id);
  console.log(`   🔍 Is BTC issuance authorized by Federation? ${isBTCValid ? '✅ YES' : '❌ NO'}`);

  const isSOLValid = isTrustedAsset(solIssuance, federation.id);
  console.log(`   🔍 Is SOL issuance authorized by Federation? ${isSOLValid ? '✅ YES' : '❌ NO'}`);

  console.log('');
  console.log('✅ Federation Demo completed!');
}

runFederationDemo().catch(console.error);
