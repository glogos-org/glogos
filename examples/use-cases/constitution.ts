/**
 * Digital Constitution Demo
 *
 * Demonstrates the "Political Economy" aspect of Glogos:
 * Establishing a Digital Nation with a Constitution, Bill of Rights, and Amendments.
 *
 * Concept:
 * - Code is not Law; Attestation is Law.
 * - Governance is explicit, verifiable, and evolutionary.
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

const CONSTITUTION_CANON = computeCanonId('opt:biz:governance:1.0');
const AMENDMENT_CANON = computeCanonId('opt:gov:amendment:1.0');
const RIGHTS_CANON = computeCanonId('opt:gov:rights:1.0');
const VOTE_CANON = computeCanonId('opt:gov:vote:1.0');

export async function runConstitutionDemo() {
  console.log('='.repeat(80));
  console.log('DIGITAL CONSTITUTION DEMO (POLITICAL ECONOMY)');
  console.log('Building a Nation on Layer 0');
  console.log('='.repeat(80));
  console.log('');

  // 1. The Founding Fathers (Genesis of the Nation)
  const founder = await generateZone();
  console.log('1. Founding the Digital Nation');
  console.log(`   Founder Zone: ${founder.id.substring(0, 16)}...`);

  // 2. Ratifying the Constitution
  console.log('\n2. Ratifying the Constitution');
  const constitutionPayload = {
    title: 'Constitution of the Glogos Republic',
    preamble: 'We the Nodes, in Order to form a more perfect Graph...',
    articles: [
      { id: 1, title: 'Legislative Power', content: 'Vested in the Consensus of Zones.' },
      { id: 2, title: 'Executive Power', content: 'Vested in the Code Execution.' },
      { id: 3, title: 'Judicial Power', content: 'Vested in the Client Validation.' }
    ]
  };

  const constInput: AttestationInput = {
    zone: founder.id,
    subject: sha256Hex(JSON.stringify(constitutionPayload)) as SubjectHash,
    canon: CONSTITUTION_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex] // Rooted in the beginning of time
  };

  const { attestation: constitution } = await createAttestation(constInput, founder.privateKey);
  console.log(`   📜 Constitution Ratified: ${constitution.id.substring(0, 16)}...`);
  console.log(`      "${constitutionPayload.preamble}"`);

  // 3. Bill of Rights (Immutable Principles)
  console.log('\n3. Declaring Bill of Rights');
  const rightsPayload = {
    rights: [
      'Freedom of Fork',
      'Freedom of Attestation',
      'Right to Privacy (Zero Knowledge)',
      'Protection against Double-Spending'
    ]
  };

  const rightsInput: AttestationInput = {
    zone: founder.id,
    subject: sha256Hex(JSON.stringify(rightsPayload)) as SubjectHash,
    canon: RIGHTS_CANON,
    time: (Math.floor(Date.now() / 1000) + 10) as unknown as UnixTimestamp,
    refs: [constitution.id as HashHex] // Part of the Constitution
  };

  const { attestation: billOfRights } = await createAttestation(rightsInput, founder.privateKey);
  console.log(`   ⚖️  Bill of Rights Declared: ${billOfRights.id.substring(0, 16)}...`);
  rightsPayload.rights.forEach((r) => console.log(`      - ${r}`));

  // 4. Constitutional Amendment (Evolutionary Politics)
  console.log('\n4. Passing the First Amendment (Transition to Decentralized Governance)');

  // 4a. Form a Council (Mitigating Isolation Risk)
  const council = [await generateZone(), await generateZone(), await generateZone()];
  console.log(`   👥 Council formed with ${council.length} independent nodes.`);

  // 4b. Propose Amendment
  const amendmentPayload = {
    proposal: 'Amendment I',
    action: 'Add Article 4',
    content: 'The right of the people to keep and bear Private Keys shall not be infringed.',
    ratifiedBy: 'Council Consensus (Multi-sig Governance)'
  };

  const amendmentInput: AttestationInput = {
    zone: founder.id, // Founder proposes, but implies they cannot ratify alone anymore
    subject: sha256Hex(JSON.stringify(amendmentPayload)) as SubjectHash,
    canon: AMENDMENT_CANON,
    time: (Math.floor(Date.now() / 1000) + 1000) as unknown as UnixTimestamp,
    refs: [constitution.id as HashHex] // Modifies the Constitution
  };

  const { attestation: amendment } = await createAttestation(amendmentInput, founder.privateKey);
  console.log(`   📝 Amendment Proposed by Founder: ${amendment.id.substring(0, 16)}...`);
  console.log(`      "${amendmentPayload.content}"`);

  // 4c. Council Votes
  const votes = [];
  for (const member of council) {
    const voteInput: AttestationInput = {
      zone: member.id,
      subject: sha256Hex(JSON.stringify({ vote: 'YES', proposal: amendment.id })) as SubjectHash,
      canon: VOTE_CANON,
      time: (Math.floor(Date.now() / 1000) + 1050) as unknown as UnixTimestamp,
      refs: [amendment.id as HashHex]
    };
    const { attestation: vote } = await createAttestation(voteInput, member.privateKey);
    votes.push(vote);
    console.log(`   🗳️  Vote from Council Member ${member.id.substring(0, 8)}...: YES`);
  }

  // 5. Verification of Political Structure
  console.log('\n5. Verifying Political Structure');

  // Verify Ratification
  const yesVotes = votes.length;
  const threshold = Math.ceil(council.length * 0.66);
  const isRatified = yesVotes >= threshold;
  console.log(
    `   📊 Ratification Status: ${yesVotes}/${council.length} votes (Threshold: ${threshold})`
  );
  console.log(`   ✅ Amendment Ratified by Community: ${isRatified ? 'YES' : 'NO'}`);

  const history = [constitution, billOfRights, amendment];

  // Check if Rights are grounded in Constitution
  const rightsRoot = history.find((a) => a.id === billOfRights.refs[0]);
  const isConstitutional = rightsRoot?.id === constitution.id;

  console.log(`   🔍 Are Rights Constitutional? ${isConstitutional ? '✅ YES' : '❌ NO'}`);
  console.log(`      (Provenance: Rights -> Constitution -> GLR)`);

  console.log('\n✅ Constitution Demo completed!');
  console.log('='.repeat(80));
}

runConstitutionDemo().catch(console.error);
