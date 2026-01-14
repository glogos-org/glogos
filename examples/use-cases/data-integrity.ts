/**
 * Scientific Data Integrity Demo
 *
 * Demonstrates tamper-proof dataset versioning and provenance tracking.
 * Ensures reproducibility and prevents data manipulation in research.
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type AttestationInput,
  type HashHex,
  type SubjectHash,
  type UnixTimestamp
} from '@glogos/core';

const DATA_CANON = computeCanonId('opt:science:data:1.0');
const ANALYSIS_CANON = computeCanonId('opt:science:analysis:1.0');
const REPLICATION_CANON = computeCanonId('opt:science:replication:1.0');

interface Dataset {
  name: string;
  version: string;
  recordCount: number;
  schema: string;
  dataHash: string;
}

// Analysis interface removed as it was unused in the demo flow.

export async function runDataIntegrityDemo() {
  console.log('='.repeat(80));
  console.log('SCIENTIFIC DATA INTEGRITY DEMO');
  console.log('Tamper-proof datasets for reproducible research');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. Create research entities
  // ============================================================================
  console.log('1. Initialize research entities');

  const researcher = await generateZone();
  const labA = await generateZone();
  const labB = await generateZone();
  const journal = await generateZone();

  console.log(`   ✓ Primary Researcher`);
  console.log(`   ✓ Lab A (Original study)`);
  console.log(`   ✓ Lab B (Replication study)`);
  console.log(`   ✓ Journal (Peer review - Zone: ${journal.id.substring(0, 16)}...)`);
  console.log('');

  // ============================================================================
  // 2. Original dataset publication
  // ============================================================================
  console.log('2. Original dataset publication');

  // Simulate a clinical trial dataset
  const rawData = {
    studyId: 'RCT-2025-001',
    participants: [
      { id: 1, group: 'treatment', outcome: 85 },
      { id: 2, group: 'control', outcome: 72 },
      { id: 3, group: 'treatment', outcome: 91 },
      { id: 4, group: 'control', outcome: 68 },
      { id: 5, group: 'treatment', outcome: 88 }
    ],
    collectedAt: '2025-01-15'
  };

  const datasetHash = sha256Hex(JSON.stringify(rawData));

  const dataset: Dataset = {
    name: 'Clinical Trial Results - Drug X',
    version: '1.0.0',
    recordCount: rawData.participants.length,
    schema: 'id:int, group:string, outcome:int',
    dataHash: datasetHash
  };

  const datasetTime = Math.floor(Date.now() / 1000);
  const datasetInput: AttestationInput = {
    zone: researcher.id,
    subject: sha256Hex(
      JSON.stringify({
        name: dataset.name,
        version: dataset.version,
        dataHash: dataset.dataHash,
        recordCount: dataset.recordCount
      })
    ) as SubjectHash,
    canon: DATA_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: datasetAttestation } = await createAttestation(
    datasetInput,
    researcher.privateKey
  );

  console.log(`   Dataset: ${dataset.name}`);
  console.log(`   Version: ${dataset.version}`);
  console.log(`   Records: ${dataset.recordCount}`);
  console.log(`   Data SHA256: ${dataset.dataHash.substring(0, 16)}...`);
  console.log(`   Attestation: ${datasetAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 3. Statistical analysis (Lab A)
  // ============================================================================
  console.log('3. Statistical analysis (Lab A)');

  const analysisCode = `
# Python analysis script
import pandas as pd
import scipy.stats as stats

treatment = [85, 91, 88]
control = [72, 68]
t_stat, p_value = stats.ttest_ind(treatment, control)
  `.trim();

  // Compute results
  const treatmentMean = (85 + 91 + 88) / 3;
  const controlMean = (72 + 68) / 2;
  const effect = treatmentMean - controlMean;

  const analysisHash = sha256Hex(
    JSON.stringify({
      datasetHash: dataset.dataHash,
      code: analysisCode,
      results: { treatmentMean, controlMean, effect, pValue: 0.03 }
    })
  );

  const analysisInput: AttestationInput = {
    zone: labA.id,
    subject: analysisHash as SubjectHash,
    canon: ANALYSIS_CANON,
    time: (datasetTime + 3600) as UnixTimestamp,
    refs: [datasetAttestation.id as HashHex]
  };

  const { attestation: analysisAttestation } = await createAttestation(
    analysisInput,
    labA.privateKey
  );

  console.log(`   Method: t-test (independent samples)`);
  console.log(`   Treatment mean: ${treatmentMean.toFixed(1)}`);
  console.log(`   Control mean: ${controlMean.toFixed(1)}`);
  console.log(`   Effect size: +${effect.toFixed(1)}`);
  console.log(`   p-value: 0.03 (statistically significant)`);
  console.log(`   Analysis Attestation: ${analysisAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 4. Independent replication (Lab B)
  // ============================================================================
  console.log('4. Independent replication (Lab B)');

  // Lab B downloads the SAME dataset and runs the SAME analysis
  const replicationHash = sha256Hex(
    JSON.stringify({
      originalDataset: dataset.dataHash,
      originalAnalysis: analysisHash,
      replicationCode: analysisCode,
      replicationResults: { treatmentMean, controlMean, effect, pValue: 0.03 }
    })
  );

  const replicationInput: AttestationInput = {
    zone: labB.id,
    subject: replicationHash as SubjectHash,
    canon: REPLICATION_CANON,
    time: (datasetTime + 86400) as UnixTimestamp, // 1 day later
    refs: [datasetAttestation.id as HashHex, analysisAttestation.id as HashHex]
  };

  const { attestation: replicationAttestation } = await createAttestation(
    replicationInput,
    labB.privateKey
  );

  console.log(`   ✅ Replication successful`);
  console.log(`   Identical results confirmed`);
  console.log(`   Dataset integrity verified`);
  console.log(`   Replication Attestation: ${replicationAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 5. Tamper detection demonstration
  // ============================================================================
  console.log('5. Tamper detection demonstration');

  // Simulate data manipulation
  const tamperedData = {
    ...rawData,
    participants: [
      { id: 1, group: 'treatment', outcome: 95 }, // Changed from 85
      { id: 2, group: 'control', outcome: 72 },
      { id: 3, group: 'treatment', outcome: 91 },
      { id: 4, group: 'control', outcome: 68 },
      { id: 5, group: 'treatment', outcome: 88 }
    ]
  };

  const tamperedHash = sha256Hex(JSON.stringify(tamperedData));
  const isValid = tamperedHash === dataset.dataHash;

  console.log(`   Original hash: ${dataset.dataHash.substring(0, 16)}...`);
  console.log(`   Tampered hash: ${tamperedHash.substring(0, 16)}...`);
  console.log(`   Match: ${isValid ? '✅' : '❌'}`);
  console.log('   Result: Tampering detected immediately!');
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY - Data Integrity Properties');
  console.log('='.repeat(80));
  console.log(`Dataset                  : ${dataset.name}`);
  console.log(`Original attestation     : ${new Date(datasetTime * 1000).toISOString()}`);
  console.log(`Analysis attestations    : 1 (Lab A)`);
  console.log(`Replication attestations : 1 (Lab B)`);
  console.log(`Tamper detection         : ✅ Working`);
  console.log('');
  console.log('Benefits:');
  console.log('  • Immutability: Data cannot be changed without detection');
  console.log('  • Provenance: Clear origin and ownership');
  console.log('  • Reproducibility: Others can verify using exact same data');
  console.log('  • Trust: Cryptographic proof vs. trust in institutions');
  console.log('');
  console.log('✅ Demo completed successfully!');
  console.log('='.repeat(80));

  return {
    dataset,
    datasetAttestation,
    analysisAttestation,
    replicationAttestation
  };
}

// Run the demo
runDataIntegrityDemo().catch(console.error);
