/**
 * Optional Canons Module for Glogos Protocol
 * 
 * This module implements the "Static Core, Dynamic Shell" architecture
 * where the core protocol remains neutral and optional canons provide
 * extended functionality through client-side validation.
 * 
 * @module optional-canons
 */

import { sha256Hex } from '../crypto/index.js';
import type { 
  Attestation, 
  HashHex, 
  ZoneId, 
  CanonId,
  AttestationId 
} from '../types/index.js';

// ============================================================================
// Canon Registry
// ============================================================================

/**
 * Optional Canon identifiers
 */
export const OPTIONAL_CANONS = {
  /** Triple-entry accounting for value transfer */
  TRIPLE_ENTRY: sha256Hex('opt:finance:triple-entry:1.0'),
  /** Taint propagation for reputation/security */
  TAINT_PROPAGATION: sha256Hex('opt:security:taint-propagation:1.0'),
  /** Timestamp service for document notarization */
  TIMESTAMP_SERVICE: sha256Hex('opt:service:timestamp:1.0'),
  /** Voting and governance */
  VOTING: sha256Hex('opt:governance:voting:1.0'),
  /** KYC attestation linking */
  KYC: sha256Hex('opt:identity:kyc:1.0'),
} as const;

/**
 * Canon metadata
 */
export interface CanonMetadata {
  readonly id: CanonId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly schema?: object;
}

/**
 * Registry of known optional canons
 */
export const OPTIONAL_CANON_REGISTRY: ReadonlyMap<string, CanonMetadata> = new Map([
  [OPTIONAL_CANONS.TRIPLE_ENTRY, {
    id: OPTIONAL_CANONS.TRIPLE_ENTRY as CanonId,
    name: 'opt:finance:triple-entry:1.0',
    version: '1.0',
    description: 'Triple-entry accounting for value transfer with double-spend protection',
  }],
  [OPTIONAL_CANONS.TAINT_PROPAGATION, {
    id: OPTIONAL_CANONS.TAINT_PROPAGATION as CanonId,
    name: 'opt:security:taint-propagation:1.0',
    version: '1.0',
    description: 'Taint propagation for reputation scoring and fraud prevention',
  }],
  [OPTIONAL_CANONS.TIMESTAMP_SERVICE, {
    id: OPTIONAL_CANONS.TIMESTAMP_SERVICE as CanonId,
    name: 'opt:service:timestamp:1.0',
    version: '1.0',
    description: 'RFC 3161-compatible timestamping service',
  }],
]);

// ============================================================================
// Triple-Entry Accounting
// ============================================================================

/**
 * Transaction types for triple-entry accounting
 */
export type TransactionType = 'mint' | 'transfer' | 'burn';

/**
 * Triple-entry transaction payload
 */
export interface TripleEntryPayload {
  readonly asset: string;
  readonly amount: bigint;
  readonly from_zone: ZoneId;
  readonly to_zone: ZoneId;
  readonly type: TransactionType;
  readonly memo?: string;
}

/**
 * Balance computation result
 */
export interface BalanceResult {
  readonly balance: bigint;
  readonly incoming: bigint;
  readonly outgoing: bigint;
  readonly transactionCount: number;
}

/**
 * Triple-entry validation result
 */
export interface TripleEntryValidation {
  readonly valid: boolean;
  readonly error?: string;
  readonly balance?: BalanceResult;
}

/**
 * Attestation store interface for balance computation
 */
export interface AttestationStore {
  get(id: AttestationId): Promise<Attestation | null>;
  getPayload(attestation: Attestation): Promise<TripleEntryPayload | null>;
}

/**
 * Validate a triple-entry transaction
 */
export async function validateTripleEntry(
  attestation: Attestation,
  payload: TripleEntryPayload,
  store: AttestationStore
): Promise<TripleEntryValidation> {
  // 1. Verify from_zone matches attestation signer
  if (payload.from_zone !== attestation.zone) {
    return {
      valid: false,
      error: `Sender zone mismatch: payload.from_zone (${payload.from_zone}) !== attestation.zone (${attestation.zone})`,
    };
  }

  // 2. For mints, verify issuer authority
  if (payload.type === 'mint') {
    const issuer = extractIssuer(payload.asset);
    if (payload.from_zone !== issuer) {
      return {
        valid: false,
        error: `Only issuer (${issuer}) can mint asset ${payload.asset}`,
      };
    }
    return { valid: true };
  }

  // 3. For transfers, validate balance via refs traversal
  if (payload.type === 'transfer') {
    const balance = await computeBalance(
      payload.from_zone,
      payload.asset,
      attestation.refs,
      store
    );

    if (balance.balance < payload.amount) {
      return {
        valid: false,
        error: `Insufficient balance: ${balance.balance} < ${payload.amount}`,
        balance,
      };
    }

    return { valid: true, balance };
  }

  // 4. For burns, same as transfer (need sufficient balance)
  if (payload.type === 'burn') {
    const balance = await computeBalance(
      payload.from_zone,
      payload.asset,
      attestation.refs,
      store
    );

    if (balance.balance < payload.amount) {
      return {
        valid: false,
        error: `Insufficient balance for burn: ${balance.balance} < ${payload.amount}`,
        balance,
      };
    }

    return { valid: true, balance };
  }

  return { valid: false, error: 'Unknown transaction type' };
}

/**
 * Extract issuer zone from asset identifier
 * Asset format: IOU:CURRENCY:zone_issuer
 */
export function extractIssuer(asset: string): string {
  const parts = asset.split(':');
  if (parts.length >= 3) {
    return parts.slice(2).join(':');
  }
  return asset;
}

/**
 * Compute balance for a zone at a point in the DAG
 */
export async function computeBalance(
  zone: ZoneId,
  asset: string,
  refs: readonly HashHex[],
  store: AttestationStore,
  maxDepth = 1000
): Promise<BalanceResult> {
  let incoming = BigInt(0);
  let outgoing = BigInt(0);
  let transactionCount = 0;
  
  const visited = new Set<string>();
  const queue: Array<{ id: HashHex; depth: number }> = 
    refs.map(r => ({ id: r, depth: 0 }));

  const GLR = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    
    if (visited.has(id) || id === GLR || depth > maxDepth) {
      continue;
    }
    visited.add(id);

    const attestation = await store.get(id as AttestationId);
    if (!attestation) continue;

    // Check if this is a triple-entry attestation for our asset
    if (attestation.canon !== OPTIONAL_CANONS.TRIPLE_ENTRY) {
      // Still traverse refs for non-finance attestations
      for (const ref of attestation.refs) {
        queue.push({ id: ref, depth: depth + 1 });
      }
      continue;
    }

    const payload = await store.getPayload(attestation);
    if (!payload || payload.asset !== asset) {
      for (const ref of attestation.refs) {
        queue.push({ id: ref, depth: depth + 1 });
      }
      continue;
    }

    transactionCount++;

    // Incoming: someone sent to this zone
    if (payload.to_zone === zone && payload.type !== 'burn') {
      incoming += payload.amount;
    }

    // Outgoing: this zone sent to someone (including burns)
    if (payload.from_zone === zone) {
      outgoing += payload.amount;
    }

    // Continue traversal
    for (const ref of attestation.refs) {
      queue.push({ id: ref, depth: depth + 1 });
    }
  }

  return {
    balance: incoming - outgoing,
    incoming,
    outgoing,
    transactionCount,
  };
}

// ============================================================================
// Taint Propagation
// ============================================================================

/**
 * Taint severity levels
 */
export type TaintSeverity = 'info' | 'warning' | 'critical' | 'banned';

/**
 * Taint categories
 */
export type TaintCategory = 
  | 'double-spend'
  | 'fraud'
  | 'spam'
  | 'impersonation'
  | 'malware'
  | 'sanctions';

/**
 * Taint attestation payload
 */
export interface TaintPayload {
  readonly target_zone: ZoneId;
  readonly severity: TaintSeverity;
  readonly category: TaintCategory;
  readonly evidence: readonly AttestationId[];
  readonly description: string;
  readonly effective_from: number;
}

/**
 * Taint information for a zone
 */
export interface TaintInfo {
  readonly zone: ZoneId;
  readonly severity: TaintSeverity;
  readonly category: TaintCategory;
  readonly oracle: ZoneId;
  readonly attestationId: AttestationId;
  readonly effectiveFrom: number;
}

/**
 * Taint check result
 */
export interface TaintResult {
  readonly tainted: boolean;
  readonly direct: boolean;
  readonly info?: TaintInfo;
  readonly chain?: Array<{
    attestationId: AttestationId;
    depth: number;
    taint: TaintInfo;
  }>;
}

/**
 * Merge strategy for multiple oracles
 */
export type TaintMergeStrategy = 'most_severe' | 'consensus' | 'any';

/**
 * Taint filter configuration
 */
export interface TaintFilterConfig {
  readonly subscribedOracles: readonly ZoneId[];
  readonly mergeStrategy: TaintMergeStrategy;
  readonly maxTraversalDepth: number;
}

/**
 * Taint filter for client-side reputation checking
 */
export class TaintFilter {
  private readonly config: TaintFilterConfig;
  private readonly taintCache: Map<string, TaintInfo[]> = new Map();

  constructor(config: TaintFilterConfig) {
    this.config = config;
  }

  /**
   * Load taint data from subscribed oracles
   */
  async loadTaintData(
    store: AttestationStore,
    getByZoneAndCanon: (zone: ZoneId, canon: CanonId) => Promise<Attestation[]>
  ): Promise<void> {
    for (const oracle of this.config.subscribedOracles) {
      const attestations = await getByZoneAndCanon(
        oracle,
        OPTIONAL_CANONS.TAINT_PROPAGATION as CanonId
      );

      for (const att of attestations) {
        const payload = await store.getPayload(att) as unknown as TaintPayload;
        if (!payload) continue;

        const existing = this.taintCache.get(payload.target_zone) || [];
        existing.push({
          zone: payload.target_zone,
          severity: payload.severity,
          category: payload.category,
          oracle,
          attestationId: att.id,
          effectiveFrom: payload.effective_from,
        });
        this.taintCache.set(payload.target_zone, existing);
      }
    }
  }

  /**
   * Check if a zone is tainted
   */
  getTaint(zone: ZoneId): TaintInfo | null {
    const taints = this.taintCache.get(zone);
    if (!taints || taints.length === 0) return null;

    switch (this.config.mergeStrategy) {
      case 'most_severe':
        return this.getMostSevere(taints);
      case 'consensus':
        return this.getConsensus(taints);
      case 'any':
      default:
        return taints[0];
    }
  }

  /**
   * Check attestation for taint (direct and via refs chain)
   */
  async checkAttestation(
    attestation: Attestation,
    store: AttestationStore
  ): Promise<TaintResult> {
    // Direct taint check
    const directTaint = this.getTaint(attestation.zone);
    if (directTaint) {
      return {
        tainted: true,
        direct: true,
        info: directTaint,
      };
    }

    // Refs chain taint check
    const chain = await this.checkRefsChain(attestation.refs, store);
    if (chain.length > 0) {
      return {
        tainted: true,
        direct: false,
        chain,
      };
    }

    return { tainted: false, direct: false };
  }

  /**
   * Check refs chain for tainted connections
   */
  private async checkRefsChain(
    refs: readonly HashHex[],
    store: AttestationStore
  ): Promise<Array<{ attestationId: AttestationId; depth: number; taint: TaintInfo }>> {
    const GLR = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const visited = new Set<string>();
    const queue: Array<{ id: HashHex; depth: number }> = 
      refs.map(r => ({ id: r, depth: 1 }));
    const tainted: Array<{ attestationId: AttestationId; depth: number; taint: TaintInfo }> = [];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      
      if (visited.has(id) || id === GLR || depth > this.config.maxTraversalDepth) {
        continue;
      }
      visited.add(id);

      const att = await store.get(id as AttestationId);
      if (!att) continue;

      const taint = this.getTaint(att.zone);
      if (taint) {
        tainted.push({
          attestationId: att.id,
          depth,
          taint,
        });
      }

      for (const ref of att.refs) {
        queue.push({ id: ref, depth: depth + 1 });
      }
    }

    return tainted;
  }

  private getMostSevere(taints: TaintInfo[]): TaintInfo {
    const severityOrder: Record<TaintSeverity, number> = {
      info: 0,
      warning: 1,
      critical: 2,
      banned: 3,
    };

    return taints.reduce((most, current) => 
      severityOrder[current.severity] > severityOrder[most.severity] ? current : most
    );
  }

  private getConsensus(taints: TaintInfo[]): TaintInfo | null {
    // Require majority of oracles to agree
    const threshold = Math.ceil(this.config.subscribedOracles.length / 2);
    return taints.length >= threshold ? this.getMostSevere(taints) : null;
  }
}

// ============================================================================
// Canon Detection and Routing
// ============================================================================

/**
 * Detect which optional canon an attestation uses
 */
export function detectCanon(attestation: Attestation): CanonMetadata | null {
  return OPTIONAL_CANON_REGISTRY.get(attestation.canon) || null;
}

/**
 * Check if an attestation uses a specific optional canon
 */
export function usesCanon(attestation: Attestation, canonId: string): boolean {
  return attestation.canon === canonId;
}

/**
 * Check if an attestation uses any optional canon
 */
export function usesOptionalCanon(attestation: Attestation): boolean {
  return OPTIONAL_CANON_REGISTRY.has(attestation.canon);
}
