/**
 * Sybil Resistance Demo (Trust Graph)
 *
 * Demonstrates how opt:social:trust-graph mitigates Sybil attacks.
 *
 * Scenario:
 * 1. Honest Community: Alice, Bob, Charlie (inter-connected).
 * 2. Attacker: Mallory creates 100 Sybil bots.
 * 3. Voting: Bots try to rig a poll.
 * 4. Defense: Client filters votes based on "Web of Trust" distance.
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type Attestation,
  type SubjectHash,
  type UnixTimestamp,
  type HashHex,
  type ZoneId
} from '@glogos/core';

const TRUST_CANON = computeCanonId('opt:social:trust:1.0');
const VOTE_CANON = computeCanonId('opt:gov:vote:1.0');

export async function runSybilDemo() {
  console.log('='.repeat(80));
  console.log('SYBIL RESISTANCE DEMO (Web of Trust)');
  console.log('Preventing fake identities from hijacking governance.');
  console.log('='.repeat(80));

  // 1. Setup Honest Nodes
  const alice = await generateZone(); // Trust Anchor (You)
  const bob = await generateZone(); // Friend
  const charlie = await generateZone(); // Friend of Friend

  console.log('1. Honest Network Established');
  console.log(`   👩 Alice (Anchor): ${alice.id.substring(0, 8)}...`);
  console.log(`   Mw Bob (Friend):   ${bob.id.substring(0, 8)}...`);
  console.log(`   Mw Charlie (FoF):  ${charlie.id.substring(0, 8)}...`);

  // 2. Build Trust Graph (Attestations)
  // Alice trusts Bob
  await createAttestation(
    {
      zone: alice.id,
      subject: sha256Hex(JSON.stringify({ trust: bob.id, weight: 1.0 })) as SubjectHash,
      canon: TRUST_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [GLR as HashHex]
    },
    alice.privateKey
  );

  // Bob trusts Charlie
  await createAttestation(
    {
      zone: bob.id,
      subject: sha256Hex(JSON.stringify({ trust: charlie.id, weight: 1.0 })) as SubjectHash,
      canon: TRUST_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [GLR as HashHex]
    },
    bob.privateKey
  );

  console.log('   🔗 Trust Links: Alice -> Bob -> Charlie');

  // 3. The Sybil Attack
  console.log('\n2. Sybil Attack Initiated');
  const mallory = await generateZone(); // Attacker
  console.log(`   fw Mallory (Attacker): ${mallory.id.substring(0, 8)}...`);

  const sybils = [];
  const SYBIL_COUNT = 50;
  for (let i = 0; i < SYBIL_COUNT; i++) {
    sybils.push(await generateZone());
  }
  console.log(`   🤖 Mallory created ${SYBIL_COUNT} Sybil bots.`);

  // 4. The Vote
  console.log('\n3. Voting Process: "Should we ban Mallory?"');
  const votes: Attestation[] = [];

  // Honest votes: YES
  const voteYesPayload = sha256Hex(
    JSON.stringify({ vote: 'YES', proposal: 'Ban Mallory' })
  ) as SubjectHash;

  votes.push(
    (
      await createAttestation(
        {
          zone: alice.id,
          subject: voteYesPayload,
          canon: VOTE_CANON,
          time: 0 as unknown as UnixTimestamp,
          refs: []
        },
        alice.privateKey
      )
    ).attestation
  );
  votes.push(
    (
      await createAttestation(
        {
          zone: bob.id,
          subject: voteYesPayload,
          canon: VOTE_CANON,
          time: 0 as unknown as UnixTimestamp,
          refs: []
        },
        bob.privateKey
      )
    ).attestation
  );
  votes.push(
    (
      await createAttestation(
        {
          zone: charlie.id,
          subject: voteYesPayload,
          canon: VOTE_CANON,
          time: 0 as unknown as UnixTimestamp,
          refs: []
        },
        charlie.privateKey
      )
    ).attestation
  );

  // Sybil votes: NO (trying to save Mallory)
  const voteNoPayload = sha256Hex(
    JSON.stringify({ vote: 'NO', proposal: 'Ban Mallory' })
  ) as SubjectHash;

  for (const bot of sybils) {
    votes.push(
      (
        await createAttestation(
          {
            zone: bot.id,
            subject: voteNoPayload,
            canon: VOTE_CANON,
            time: 0 as unknown as UnixTimestamp,
            refs: []
          },
          bot.privateKey
        )
      ).attestation
    );
  }

  // 5. Naive Counting (Vulnerable)
  console.log('\n4. Result: Naive Counting (1 Identity = 1 Vote)');
  const yesCount = votes.filter((v) => v.subject === voteYesPayload).length;
  const noCount = votes.filter((v) => v.subject === voteNoPayload).length;

  console.log(`   YES: ${yesCount}`);
  console.log(`   NO:  ${noCount}`);
  console.log(`   ❌ Result: Mallory is SAVED by bots!`);

  // 6. Trust Graph Filtering (Sybil Resistant)
  console.log('\n5. Result: Trust Graph Filtering (Max Distance = 2)');

  // Simple BFS to find trusted zones from Alice
  const trustedZones = new Set<ZoneId>();
  trustedZones.add(alice.id); // Distance 0

  // In a real app, we would traverse the DAG of TRUST_CANON attestations.
  // Here we simulate the known graph: Alice -> Bob -> Charlie
  const graph = new Map<ZoneId, ZoneId[]>();
  graph.set(alice.id, [bob.id]);
  graph.set(bob.id, [charlie.id]);
  // Mallory might trust her bots, but no one trusts Mallory!
  graph.set(
    mallory.id,
    sybils.map((s) => s.id)
  );

  function getTrustedNodes(startNode: ZoneId, maxHops: number): Set<ZoneId> {
    const trusted = new Set<ZoneId>([startNode]);
    let currentLayer = [startNode];

    for (let i = 0; i < maxHops; i++) {
      const nextLayer: ZoneId[] = [];
      for (const node of currentLayer) {
        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!trusted.has(neighbor)) {
            trusted.add(neighbor);
            nextLayer.push(neighbor);
          }
        }
      }
      currentLayer = nextLayer;
    }
    return trusted;
  }

  const trustedSet = getTrustedNodes(alice.id, 2); // Alice trusts up to FoF
  console.log(
    `   🛡️  Trusted Zones (from Alice): ${Array.from(trustedSet)
      .map((id) => id.substring(0, 8))
      .join(', ')}`
  );

  // Filter votes
  const trustedVotes = votes.filter((v) => trustedSet.has(v.zone));
  const trustedYes = trustedVotes.filter((v) => v.subject === voteYesPayload).length;
  const trustedNo = trustedVotes.filter((v) => v.subject === voteNoPayload).length;

  console.log(`   YES: ${trustedYes}`);
  console.log(`   NO:  ${trustedNo}`);
  console.log(`   ✅ Result: Mallory is BANNED! (Sybil votes ignored)`);

  console.log('\n   Insight: Even with 1 million bots, Mallory cannot penetrate');
  console.log('            the Trust Graph because no honest node trusts her.');
  console.log('='.repeat(80));
}

runSybilDemo().catch(console.error);
