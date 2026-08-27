import {
  illustrativeTrajectorySeedFromPolicy,
  replicateSeedFromPolicy,
  runTrajectorySeedFromPolicy,
  sha256,
  snapshotExperimentProtocol,
  type Experiment,
  type ExperimentProtocolSnapshot,
  type ExperimentSeedPolicy,
} from './flylab.js';

export const EXPERIMENT_APPROVAL_SCHEMA = 'flylab.experiment-approval' as const;
export const EXPERIMENT_APPROVAL_SCHEMA_VERSION = 1 as const;

export type Sha256Digest = `sha256:${string}`;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer TItem)[]
    ? readonly DeepReadonly<TItem>[]
    : T extends object
      ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
      : T;

export interface ExperimentReplicateSeed {
  readonly replicate_index: number;
  readonly seed: number;
  readonly trajectory_seed: number;
}

export interface ExperimentConditionSeedManifest {
  readonly condition_id: string;
  readonly condition_index: number;
  readonly trajectory_seed: number;
  readonly replicates: readonly ExperimentReplicateSeed[];
}

export interface ExperimentSeedManifest {
  readonly base_seed: number;
  readonly seed_policy: DeepReadonly<ExperimentSeedPolicy>;
  readonly condition_count: number;
  readonly replicates_per_condition: number;
  readonly conditions: readonly ExperimentConditionSeedManifest[];
}

export interface ExperimentApprovalProtocol extends ExperimentProtocolSnapshot {
  readonly modelVersion: Experiment['model']['version'];
}

export interface ExperimentApproval {
  readonly schema: typeof EXPERIMENT_APPROVAL_SCHEMA;
  readonly schema_version: typeof EXPERIMENT_APPROVAL_SCHEMA_VERSION;
  readonly experiment_id: string;
  readonly approved_at: string;
  readonly model_version: Experiment['model']['version'];
  readonly metric_method_version: Experiment['metricMethodVersion'];
  readonly seed_policy_version: ExperimentSeedPolicy['version'];
  readonly seed_policy: DeepReadonly<ExperimentSeedPolicy>;
  readonly protocol: DeepReadonly<ExperimentApprovalProtocol>;
  readonly protocol_hash: Sha256Digest;
  readonly seed_manifest: ExperimentSeedManifest;
  readonly seed_manifest_hash: Sha256Digest;
}

function deepCloneAndFreeze<T>(value: T): DeepReadonly<T> {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepCloneAndFreeze(item))) as DeepReadonly<T>;
  }
  if (value !== null && typeof value === 'object') {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = deepCloneAndFreeze(item);
    }
    return Object.freeze(clone) as DeepReadonly<T>;
  }
  return value as DeepReadonly<T>;
}

function normalizeApprovedAt(approvedAt: string | Date): string {
  const parsed = approvedAt instanceof Date ? new Date(approvedAt.getTime()) : new Date(approvedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError('approvedAt must be a valid date or timestamp string.');
  }
  return parsed.toISOString();
}

async function cryptographicSha256(value: unknown): Promise<Sha256Digest> {
  const digest = await sha256(value);
  if (!digest.startsWith('sha256:')) {
    throw new Error('Experiment approval requires a runtime with cryptographic SHA-256 support.');
  }
  return digest as Sha256Digest;
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function snapshotApprovalProtocol(experiment: Experiment): DeepReadonly<ExperimentApprovalProtocol> {
  return deepCloneAndFreeze({
    ...snapshotExperimentProtocol(experiment),
    modelVersion: experiment.model.version,
  });
}

/**
 * Materializes every simulator seed governed by an experiment's versioned seed
 * policy. Replicate indexes are zero-based, matching simulateExperiment.
 */
export function createExperimentSeedManifest(experiment: Experiment): ExperimentSeedManifest {
  const manifest: ExperimentSeedManifest = {
    base_seed: experiment.seed,
    seed_policy: { ...experiment.seedPolicy },
    condition_count: experiment.conditions.length,
    replicates_per_condition: experiment.replicates,
    conditions: experiment.conditions.map((condition, conditionIndex) => ({
      condition_id: condition.id,
      condition_index: conditionIndex,
      trajectory_seed: illustrativeTrajectorySeedFromPolicy(experiment.seedPolicy, experiment.seed),
      replicates: Array.from({ length: experiment.replicates }, (_, replicateIndex) => {
        const replicateSeed = replicateSeedFromPolicy(
          experiment.seedPolicy,
          experiment.seed,
          replicateIndex,
        );
        return {
          replicate_index: replicateIndex,
          seed: replicateSeed,
          trajectory_seed: runTrajectorySeedFromPolicy(experiment.seedPolicy, replicateSeed),
        };
      }),
    })),
  };
  return deepCloneAndFreeze(manifest);
}

/**
 * Creates a detached, deeply frozen, JSON-compatible approval record. The
 * approval timestamp is metadata and is deliberately outside both hashes.
 */
export async function createExperimentApproval(
  experiment: Experiment,
  approvedAt: string | Date,
): Promise<ExperimentApproval> {
  const protocol = snapshotApprovalProtocol(experiment);
  const seedManifest = createExperimentSeedManifest(experiment);
  const approvedAtTimestamp = normalizeApprovedAt(approvedAt);
  const [protocolHash, seedManifestHash] = await Promise.all([
    cryptographicSha256(protocol),
    cryptographicSha256(seedManifest),
  ]);

  return deepCloneAndFreeze({
    schema: EXPERIMENT_APPROVAL_SCHEMA,
    schema_version: EXPERIMENT_APPROVAL_SCHEMA_VERSION,
    experiment_id: protocol.experimentId,
    approved_at: approvedAtTimestamp,
    model_version: protocol.modelVersion,
    metric_method_version: protocol.metricMethodVersion,
    seed_policy_version: protocol.seedPolicy.version,
    seed_policy: protocol.seedPolicy,
    protocol,
    protocol_hash: protocolHash,
    seed_manifest: seedManifest,
    seed_manifest_hash: seedManifestHash,
  });
}

/**
 * Verifies both the approval's internal hash commitments and every binding to
 * the current experiment. It does not mutate or re-approve the experiment.
 */
export async function verifyExperimentApproval(
  approval: Readonly<ExperimentApproval>,
  currentExperiment: Experiment,
): Promise<boolean> {
  const currentProtocol = snapshotApprovalProtocol(currentExperiment);
  const currentSeedManifest = createExperimentSeedManifest(currentExperiment);
  if (approval.schema !== EXPERIMENT_APPROVAL_SCHEMA
    || approval.schema_version !== EXPERIMENT_APPROVAL_SCHEMA_VERSION
    || approval.experiment_id !== currentProtocol.experimentId
    || approval.model_version !== currentProtocol.modelVersion
    || approval.metric_method_version !== currentProtocol.metricMethodVersion
    || approval.seed_policy_version !== currentProtocol.seedPolicy.version
    || !sameJsonValue(approval.seed_policy, currentProtocol.seedPolicy)) {
    return false;
  }

  const approvedAt = new Date(approval.approved_at);
  if (Number.isNaN(approvedAt.getTime()) || approvedAt.toISOString() !== approval.approved_at) {
    return false;
  }

  const [storedProtocolHash, storedSeedManifestHash, currentProtocolHash, currentSeedManifestHash] = await Promise.all([
    cryptographicSha256(approval.protocol),
    cryptographicSha256(approval.seed_manifest),
    cryptographicSha256(currentProtocol),
    cryptographicSha256(currentSeedManifest),
  ]);

  return approval.protocol_hash === storedProtocolHash
    && approval.seed_manifest_hash === storedSeedManifestHash
    && approval.protocol_hash === currentProtocolHash
    && approval.seed_manifest_hash === currentSeedManifestHash
    && sameJsonValue(approval.protocol, currentProtocol)
    && sameJsonValue(approval.seed_manifest, currentSeedManifest);
}
