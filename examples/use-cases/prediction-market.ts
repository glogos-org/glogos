/**
 * Prediction Market Demo
 *
 * Demonstrates asset price predictability and reputation using Glogos protocol.
 *
 * Nobel Prize 2013: Eugene Fama, Lars Peter Hansen, & Robert Shiller
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
  type HashHex
} from '@glogos/core';

const MARKET_CANON = computeCanonId('opt:market:prediction:1.0');
const FORECAST_CANON = computeCanonId('opt:market:forecast:1.0');
const RESOLUTION_CANON = computeCanonId('opt:market:resolution:1.0');

interface Forecast {
  predictor: ZoneId;
  event: string;
  prediction: string;
  probability: number;
  attestation: Attestation;
}

export async function runPredictionDemo() {
  console.log('='.repeat(80));
  console.log('PREDICTION MARKET DEMO');
  console.log('Fama, Hansen, & Shiller - Nobel Prize 2013');
  console.log('='.repeat(80));

  const oracle = await generateZone();
  const predictors = [await generateZone(), await generateZone()];

  // 1. Create Market
  const marketInput: AttestationInput = {
    zone: oracle.id,
    subject: sha256Hex(JSON.stringify({ event: 'Election 2024', type: 'Binary' })) as SubjectHash,
    canon: MARKET_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: market } = await createAttestation(marketInput, oracle.privateKey);
  console.log(`   Market created: Election 2024 (${market.id.substring(0, 8)})`);

  // 2. Predictors make forecasts
  const forecasts: Forecast[] = [];
  for (const p of predictors) {
    const forecastInput: AttestationInput = {
      zone: p.id,
      subject: sha256Hex(
        JSON.stringify({ prediction: 'Candidate A', probability: 0.75 })
      ) as SubjectHash,
      canon: FORECAST_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [market.id]
    };
    const { attestation } = await createAttestation(forecastInput, p.privateKey);
    forecasts.push({
      predictor: p.id,
      event: 'Election 2024',
      prediction: 'Candidate A',
      probability: 0.75,
      attestation
    });
    console.log(`   Forecast by ${p.id.substring(0, 8)}: Candidate A with 75%`);
  }

  // 3. Market Resolution
  const resolutionInput: AttestationInput = {
    zone: oracle.id,
    subject: sha256Hex(JSON.stringify({ outcome: 'Candidate A' })) as SubjectHash,
    canon: RESOLUTION_CANON,
    time: (Math.floor(Date.now() / 1000) + 100) as unknown as UnixTimestamp,
    refs: [market.id]
  };
  const { attestation: resolution } = await createAttestation(resolutionInput, oracle.privateKey);
  console.log(`   Market resolved: Candidate A won! (${resolution.id.substring(0, 8)})`);

  console.log('✅ Prediction demo completed!');
  console.log('='.repeat(80));
}

runPredictionDemo().catch(console.error);
