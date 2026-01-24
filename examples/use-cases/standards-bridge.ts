/**
 * 🤝 INVITATION TO COLLABORATE
 * Standards Bridge Demo: Glogos as a Substrate for W3C VCs and DIDs
 * 
 * Demonstrates the "Ancestral Substrate" philosophy:
 * - The W3C Verifiable Credential is the "Semantic Soul" (Content). [Ref: https://www.w3.org/TR/vc-data-model/]
 * - did:cel is the "Signature" (Identity). [Ref: https://github.com/w3c-ccg/did-cel-spec]
 * - Glogos is the "Substrate" (Thermodynamic Witness, Log Integrity).
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type AttestationInput,
  type SubjectHash,
  type UnixTimestamp,
  type HashHex
} from '@glogos/core';

// Canons for the Bridge
const W3C_VC_CANON = computeCanonId('opt:w3c:vc:1.0');
const W3C_DID_CANON = computeCanonId('opt:w3c:did:1.0');

export async function runStandardsBridgeDemo() {
  console.log('='.repeat(80));
  console.log('STANDARDS BRIDGE DEMO: Verifiable Pedigree (Causal Chain)');
  console.log('Demonstrating Reputation via Ancestral Substrate & Pedigree Graph');
  console.log('='.repeat(80));

  // 1. Setup Identities (The Ancestors)
  const alice = await generateZone(); // Researcher
  const bob = await generateZone();   // Reviewer
  const journal = await generateZone(); // natureDAO

  console.log('1. Actors Established');
  console.log(`   👩‍🔬 Alice (Researcher): ${alice.id.substring(0, 16)}...`);
  console.log(`   🧐 Bob (Reviewer):     ${bob.id.substring(0, 16)}...`);
  console.log(`   🏛️  Journal (natureDAO): ${journal.id.substring(0, 16)}...`);

  // 1.5. Anchoring DIDs (Identity Substrate)
  console.log('\n1.5. Anchoring Identities to Glogos Substrate');
  
  const anchorIdentity = async (zone: any, label: string) => {
    const didDoc = { "@context": "https://www.w3.org/ns/did/v1", "id": `did:cel:${zone.id}` };
    const input: AttestationInput = {
      zone: zone.id,
      subject: sha256Hex(JSON.stringify(didDoc)) as SubjectHash,
      canon: W3C_DID_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [GLR as HashHex]
    };
    const { attestation } = await createAttestation(input, zone.privateKey);
    console.log(`   ✅ ${label} Anchored: ${attestation.id.substring(0, 16)}...`);
    return attestation;
  };

  const aliceDid = await anchorIdentity(alice, "Alice DID");
  const bobDid = await anchorIdentity(bob, "Bob DID");
  const journalDid = await anchorIdentity(journal, "Journal DID");

  // 2. STAGE A: Alice publishes a Paper (W3C VC)
  console.log('\n2. STAGE A: Alice publishes Paper V1 (Permissionless)');
  const paperVC = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "ResearchPaper"],
    "issuer": `did:cel:${alice.id}`,
    "credentialSubject": { "id": `did:cel:${alice.id}`, "title": "Glogos: Causal Integrity" }
  };
  
  const paperInput: AttestationInput = {
    zone: alice.id,
    subject: sha256Hex(JSON.stringify(paperVC)) as SubjectHash,
    canon: W3C_VC_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [aliceDid.id as HashHex] // Causal link to Alice's identity
  };
  const { attestation: paperAtt } = await createAttestation(paperInput, alice.privateKey);
  console.log(`   📄 Paper Hash: ${paperAtt.id.substring(0, 16)}...`);

  // 3. STAGE B: Bob publishes a Peer Review (W3C VC)
  console.log('\n3. STAGE B: Bob issues Peer Review (Referencing Paper)');
  const reviewVC = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "PeerReview"],
    "issuer": `did:cel:${bob.id}`,
    "credentialSubject": { 
      "id": `did:cel:${alice.id}`, 
      "paperId": paperAtt.id,
      "rating": 5,
      "comment": "Brilliant use of DAGs for trust."
    }
  };

  const reviewInput: AttestationInput = {
    zone: bob.id,
    subject: sha256Hex(JSON.stringify(reviewVC)) as SubjectHash,
    canon: W3C_VC_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    // [PEDIGREE]: Refers to the Paper AND the Reviewer's DID
    refs: [paperAtt.id as HashHex, bobDid.id as HashHex] 
  };
  const { attestation: reviewAtt } = await createAttestation(reviewInput, bob.privateKey);
  console.log(`   🧐 Review Hash: ${reviewAtt.id.substring(0, 16)}... (Refers to Paper)`);

  // 4. STAGE C: Journal issues Final Certification
  console.log('\n4. STAGE C: Journal issues Final Certification (Merging the Graph)');
  const certInput: AttestationInput = {
    zone: journal.id,
    subject: sha256Hex("ACCEPTED_BY_NATURE") as SubjectHash, // Symbolic
    canon: W3C_VC_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    // [THE REPUTATION BOND]: Merges all actors and actions in one causal event
    refs: [paperAtt.id as HashHex, reviewAtt.id as HashHex, journalDid.id as HashHex]
  };
  const { attestation: certAtt } = await createAttestation(certInput, journal.privateKey);
  console.log(`   🏆 Certification: ${certAtt.id.substring(0, 16)}...`);

  // 5. Conclusion
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY: Verifiable Pedigree Result');
  console.log('='.repeat(80));
  console.log('  THE CAUSAL LOG (Explicit refs Linkage):');
  console.log('');
  console.log(`  [Alice DID]       id: ${aliceDid.id.substring(0, 8)}...  refs: [GLR]`);
  console.log(`  [Bob DID]         id: ${bobDid.id.substring(0, 8)}...  refs: [GLR]`);
  console.log(`  [natureDAO DID]   id: ${journalDid.id.substring(0, 8)}...  refs: [GLR]`);
  console.log('       │');
  console.log(`       └─> [Paper]         id: ${paperAtt.id.substring(0, 8)}...  refs: [${aliceDid.id.substring(0, 8)}...]`);
  console.log('             │');
  console.log(`             └─> [Review]        id: ${reviewAtt.id.substring(0, 8)}...  refs: [${paperAtt.id.substring(0, 8)}..., ${bobDid.id.substring(0, 8)}...]`);
  console.log('                   │');
  console.log(`                   └─> 🏆 [CERT]   id: ${certAtt.id.substring(0, 8)}...  refs: [${paperAtt.id.substring(0, 8)}..., ${reviewAtt.id.substring(0, 8)}..., ${journalDid.id.substring(0, 8)}...]`);
  console.log('');
  console.log('  REPUTATION INSIGHTS (Directly for Steven Rowat):');
  console.log('  ────────────────────────────────────────────────');
  console.log(`  📊 Alice: Builds "Author Reputation" because Paper (${paperAtt.id.substring(0, 8)}) is now parent to a 🏆 CERT.`);
  console.log(`  📊 Bob:   Builds "Reviewer Reputation" because his Review (${reviewAtt.id.substring(0, 8)}) is explicitly required for the 🏆 CERT.`);
  console.log(`  📊 Journal: Stakes its Reputation (${journalDid.id.substring(0, 8)}) by signing the final bond.`);
  console.log('');
  console.log('  Summary of the "Bloodline":');
  console.log(`  The Certification (${certAtt.id.substring(0, 8)}) is a PHYSICAL descendant of:`);
  console.log(`  - The Paper (${paperAtt.id.substring(0, 8)})`);
  console.log(`  - The Review (${reviewAtt.id.substring(0, 8)})`);
  console.log(`  - The Journal Identity (${journalDid.id.substring(0, 8)})`);
  console.log('\n  Verification: A client exploring this graph can traverse from the');
  console.log('  Certification -> Review -> Paper -> DIDs. No database needed.');
  console.log('='.repeat(80));
  console.log('✅ Verifiable Pedigree Demo completed!');
}

runStandardsBridgeDemo().catch(console.error);
