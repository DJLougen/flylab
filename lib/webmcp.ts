import { ANALYSIS_METRICS, BODY_PART_IDS, type ProvenanceLabel } from './flylab.js';
import type { FlyLabWebMCPCapabilityDiagnostic } from './agent-handoff.js';

export const FLYLAB_ERROR_CODES = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'EVIDENCE_MISMATCH',
  'UNSUPPORTED_TARGET',
  'INVALID_TIMING',
  'STALE_STATE',
  'APPROVAL_REQUIRED',
  'RUN_LIMIT_EXCEEDED',
  'SIMULATION_UNAVAILABLE',
  'INCOMPLETE_BATCH',
  'METRIC_UNAVAILABLE',
  'INCOMPARABLE_ANALYSES',
  'INCOMPLETE_PROVENANCE',
] as const;

export type FlyLabErrorCode = (typeof FLYLAB_ERROR_CODES)[number];

export class FlyLabDomainError extends Error {
  constructor(
    readonly code: FlyLabErrorCode,
    message: string,
    readonly retryable = false,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface ToolActionResult {
  summary: string;
  data: Record<string, unknown>;
  provenance: ProvenanceLabel[];
  provenanceManifest: {
    entries: FlyLabProvenanceManifestEntry[];
    operationalPaths: string[];
  };
  stateRevision: number;
}

export const FLYLAB_TOOL_RESULT_VERSION = 'flylab.tool-result.v2' as const;
export const FLYLAB_PROVENANCE_MANIFEST_VERSION = 'flylab.provenance-manifest.v1' as const;

export interface FlyLabProvenanceManifestEntry {
  /** JSON Pointer relative to structuredContent.data. An empty string addresses the data root. */
  path: string;
  artifact_id: string | null;
  artifact_type: string;
  scope: 'artifact' | 'record' | 'container';
  labels: ProvenanceLabel[];
  parent_ids: string[];
  evidence_ids: string[];
  source_ids: string[];
  boundary: string;
}

export type FlyLabActionActor = 'webmcp_agent' | 'human_ui' | 'guided_example';

export type FlyLabToolAction = (
  input: Record<string, unknown>,
  context: { signal: AbortSignal; actor: FlyLabActionActor },
) => Promise<ToolActionResult>;

export function throwIfCancellationRequested(signal: AbortSignal, pageCancellationRequested = false) {
  if (signal.aborted || pageCancellationRequested) {
    throw signal.reason ?? new DOMException('Tool cancelled', 'AbortError');
  }
}

/**
 * Prepares work without publishing it, then performs one synchronous commit.
 *
 * JavaScript runs the abort check and synchronous commit without yielding, so an
 * invocation cancelled before this boundary cannot publish its prepared result.
 */
export async function prepareCancellableCommit<TPrepared, TCommitted>({
  signal,
  prepare,
  commit,
  cancellationRequested,
}: {
  signal: AbortSignal;
  prepare: (signal: AbortSignal) => TPrepared | Promise<TPrepared>;
  commit: (prepared: TPrepared) => TCommitted;
  cancellationRequested?: () => boolean;
}): Promise<TCommitted> {
  throwIfCancellationRequested(signal, cancellationRequested?.() ?? false);
  const prepared = await prepare(signal);
  throwIfCancellationRequested(signal, cancellationRequested?.() ?? false);
  return commit(prepared);
}

export function requireCurrentStateRevision(
  expectedRevision: number,
  actualRevision: number,
  details: Record<string, unknown> = {},
) {
  if (expectedRevision !== actualRevision) {
    throw new FlyLabDomainError(
      'STALE_STATE',
      'The shared FlyLab page changed while this action was preparing. Inspect the current state before continuing.',
      false,
      {
        expected_state_revision: expectedRevision,
        actual_state_revision: actualRevision,
        recovery_tool: 'inspect_flylab_state',
        ...details,
      },
    );
  }
}

const provenanceEnum = [
  'measured',
  'derived',
  'connectome_inferred',
  'simulation_predicted',
  'agent_hypothesized',
];

const metricEnum = ANALYSIS_METRICS;

const behaviorEnum = [
  'backward_walking',
  'retreat',
  'forward_walking',
  'turning',
  'short_mode_escape',
  'grooming',
];

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const flyLabToolContracts = [
  {
    name: 'inspect_flylab_state',
    title: 'Inspect FlyLab state',
    description: 'Read the current shared FlyLab page state before starting or resuming work. Returns the state revision, artifact IDs, exact next valid action, blockers, the visible non-WebMCP review gate, and the complete tool pipeline. It does not modify the page.',
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: objectSchema({}),
  },
  {
    name: 'find_fly_circuits',
    title: 'Find fly circuits',
    description: "Search FlyLab's curated adult Drosophila evidence and embodied motor-map index by behavior, body part, circuit, or neuron name. Use before drafting a hypothesis. Returns stable circuit IDs, typed brain-to-body paths, citations, model-readiness boundaries, and explicit evidence labels; it does not run a simulation.",
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    inputSchema: objectSchema({
      query: { type: 'string', minLength: 1, maxLength: 240, description: 'Behavior, circuit, neuron type, or scientific question to search.' },
      behavior: { type: 'string', enum: [...behaviorEnum, 'any'], default: 'any' },
      body_part: { type: 'string', enum: [...BODY_PART_IDS, 'any'], default: 'any' },
      evidence_labels: { type: 'array', items: { type: 'string', enum: provenanceEnum }, minItems: 1, maxItems: 5, uniqueItems: true },
      limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
    }, ['query']),
  },
  {
    name: 'draft_fly_hypothesis',
    title: 'Draft fly hypothesis',
    description: 'Create a visible, editable and falsifiable hypothesis from a selected circuit and discovered evidence. At least one cited role=hypothesis_support record must have kind=perturbation_effect matching the requested perturbation and behavior; structural, inventory, and motor-context records are supplemental only. Returns an agent_hypothesized record and does not run a simulation.',
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    inputSchema: objectSchema({
      circuit_id: { type: 'string', minLength: 1, maxLength: 100 },
      claim: { type: 'string', minLength: 10, maxLength: 500 },
      predicted_behavior: { type: 'string', enum: behaviorEnum },
      perturbation: { type: 'string', enum: ['activate', 'silence'] },
      evidence_ids: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, minItems: 1, maxItems: 20, uniqueItems: true, description: 'Discovered hypothesis-support IDs. Must include at least one perturbation_effect record matching perturbation and predicted_behavior; structural, inventory, and motor-context IDs may only supplement it.' },
      falsification_criterion: { type: 'string', minLength: 5, maxLength: 300 },
    }, ['circuit_id', 'claim', 'predicted_behavior', 'perturbation', 'evidence_ids', 'falsification_criterion']),
  },
  {
    name: 'design_stimulation_trial',
    title: 'Design stimulation trial',
    description: 'Create and display a controlled adult-fly perturbation protocol for a saved hypothesis. Returns baseline, sham and perturbation conditions, timing, seeds and model assumptions; human approval is still required before execution.',
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    inputSchema: objectSchema({
      hypothesis_id: { type: 'string', minLength: 1, maxLength: 100 },
      target_circuit_id: { type: 'string', minLength: 1, maxLength: 100 },
      perturbation: { type: 'string', enum: ['activate', 'silence'] },
      laterality: { type: 'string', enum: ['bilateral', 'left', 'right'] },
      activation_level: { type: 'number', minimum: 0, maximum: 1, description: 'Unitless simulation control; not biological light power.' },
      onset_ms: { type: 'integer', minimum: 0, maximum: 5000 },
      duration_ms: { type: 'integer', minimum: 50, maximum: 5000 },
      trial_duration_ms: { type: 'integer', minimum: 1000, maximum: 10000 },
      replicates: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
      include_baseline: { type: 'boolean', const: true, default: true, description: 'Required for the controlled FlyLab vertical slice.' },
      include_sham_control: { type: 'boolean', const: true, default: true, description: 'Required for the controlled FlyLab vertical slice.' },
      seed: { type: 'integer', minimum: 0, maximum: 2147483647 },
    }, ['hypothesis_id', 'target_circuit_id', 'perturbation', 'laterality', 'activation_level', 'onset_ms', 'duration_ms', 'trial_duration_ms', 'replicates', 'include_baseline', 'include_sham_control', 'seed']),
  },
  {
    name: 'run_fly_simulation',
    title: 'Run fly simulation',
    description: 'Execute one approved, bounded FlyLab experiment and animate its conditions in the shared arena. Returns exact model, controller, seed and run IDs with field-level attribution: outputs are simulation_predicted, the approved protocol and controller mapping are agent_hypothesized, and model metadata is derived.',
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    inputSchema: objectSchema({
      experiment_id: { type: 'string', minLength: 1, maxLength: 100 },
    }, ['experiment_id']),
  },
  {
    name: 'analyze_fly_behavior',
    title: 'Analyze fly behavior',
    description: 'Compute and save the selected motor map\'s complete five-metric panel by aggregating simulation-generated per-run summaries. The required metric IDs are returned on the circuit motor map and simulation batch. The displayed condition replay is illustrative and separate; outputs are not wet-lab evidence.',
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    inputSchema: objectSchema({
      batch_id: { type: 'string', minLength: 1, maxLength: 100 },
      metrics: { type: 'array', items: { type: 'string', enum: metricEnum }, minItems: 5, maxItems: 5, uniqueItems: true, description: 'The complete five-metric panel declared by the selected circuit motor map; partial or mixed panels are rejected.' },
    }, ['batch_id', 'metrics']),
  },
  {
    name: 'compare_fly_trials',
    title: 'Compare fly trials',
    description: 'Rank conditions from one or more saved analyses against a behavioral objective and create one bounded next-experiment proposal. It never executes the proposal automatically.',
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    inputSchema: objectSchema({
      analysis_ids: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, minItems: 1, maxItems: 8, uniqueItems: true },
      objective_metric: { type: 'string', enum: metricEnum },
      objective: { type: 'string', enum: ['maximize', 'minimize'] },
    }, ['analysis_ids', 'objective_metric', 'objective']),
  },
  {
    name: 'save_fly_evidence',
    title: 'Save fly evidence',
    description: 'Commit a complete FlyLab hypothesis, experiment, runs, analyses, comparison, citations, model versions and seeds to the visible browser-local evidence ledger. Returns the stable bundle metadata and exact portable evidence-export envelope, including its manifest hash.',
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    inputSchema: objectSchema({
      title: { type: 'string', minLength: 1, maxLength: 120 },
      hypothesis_id: { type: 'string', minLength: 1, maxLength: 100 },
      experiment_id: { type: 'string', minLength: 1, maxLength: 100 },
      batch_ids: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, minItems: 1, maxItems: 1, uniqueItems: true },
      analysis_ids: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, minItems: 1, maxItems: 8, uniqueItems: true },
      comparison_id: { type: 'string', minLength: 1, maxLength: 100 },
      note: { type: 'string', maxLength: 500 },
    }, ['title', 'hypothesis_id', 'experiment_id', 'batch_ids', 'analysis_ids', 'comparison_id']),
  },
] as const;

/**
 * Machine-readable result documentation kept beside the runtime contracts.
 * These describe the exact top-level `data` fields returned by each action;
 * nested scientific attribution is supplied by every result's provenance manifest.
 */
export const flyLabToolOutputContracts = {
  inspect_flylab_state: {
    required_data_fields: ['agent_context'],
    produced_artifacts: [],
    scientific_paths: ['/agent_context/artifact_manifest'],
    operational_paths: ['/agent_context/state', '/agent_context/next_action', '/agent_context/human_gate', '/agent_context/pipeline'],
  },
  find_fly_circuits: {
    required_data_fields: ['candidate_circuits', 'selection_status', 'disambiguation', 'circuits', 'evidence', 'connectome_records', 'dataset_versions', 'embodiment_coverage', 'selected_circuit_id', 'candidate_match_count', 'hypothesis_eligible_evidence_ids', 'causal_evidence_ids_by_perturbation', 'evidence_role_policy', 'coverage_warning', 'next_action'],
    produced_artifacts: ['circuit_selection', 'evidence_record', 'connectome_record', 'embodied_motor_map'],
    scientific_paths: ['/circuits', '/evidence', '/connectome_records', '/dataset_versions', '/embodiment_coverage'],
    operational_paths: ['/candidate_circuits', '/selection_status', '/disambiguation', '/selected_circuit_id', '/candidate_match_count', '/hypothesis_eligible_evidence_ids', '/causal_evidence_ids_by_perturbation', '/evidence_role_policy', '/coverage_warning', '/next_action'],
  },
  draft_fly_hypothesis: {
    required_data_fields: ['hypothesis', 'next_action'],
    produced_artifacts: ['hypothesis'],
    scientific_paths: ['/hypothesis'],
    operational_paths: ['/next_action'],
  },
  design_stimulation_trial: {
    required_data_fields: ['experiment', 'approval_required', 'agent_status', 'blocked_by', 'agent_actionable', 'human_gate', 'next_action'],
    produced_artifacts: ['experiment', 'trial_condition', 'embodied_motor_map'],
    scientific_paths: ['/experiment', '/experiment/motorMap', '/experiment/model', '/experiment/model/controllerMapping'],
    operational_paths: ['/experiment/approved', '/approval_required', '/agent_status', '/blocked_by', '/agent_actionable', '/human_gate', '/next_action'],
  },
  run_fly_simulation: {
    required_data_fields: ['id', 'experimentId', 'targetCircuitId', 'behavior', 'motorMap', 'status', 'conditionRuns', 'runHash', 'protocol', 'model', 'provenance', 'boundary', 'next_action'],
    produced_artifacts: ['simulation_batch', 'simulation_run', 'illustrative_trajectory', 'embodied_motor_map'],
    scientific_paths: ['', '/motorMap', '/conditionRuns', '/protocol', '/model', '/model/controllerMapping', '/boundary'],
    operational_paths: ['/status', '/next_action'],
  },
  analyze_fly_behavior: {
    required_data_fields: ['analysis', 'metric_definitions', 'unit_boundary', 'next_action'],
    produced_artifacts: ['behavior_analysis'],
    scientific_paths: ['/analysis', '/metric_definitions', '/unit_boundary'],
    operational_paths: ['/next_action'],
  },
  compare_fly_trials: {
    required_data_fields: ['comparison', 'execution_authorized', 'next_action'],
    produced_artifacts: ['trial_comparison', 'follow_up_proposal'],
    scientific_paths: ['/comparison', '/comparison/proposal'],
    operational_paths: ['/execution_authorized', '/next_action'],
  },
  save_fly_evidence: {
    required_data_fields: ['bundle', 'evidence_export', 'export_media_type', 'export_filename', 'local_reference', 'storage_scope', 'next_action'],
    produced_artifacts: ['evidence_bundle', 'portable_evidence_export'],
    scientific_paths: ['/bundle', '/evidence_export'],
    operational_paths: ['/export_media_type', '/export_filename', '/local_reference', '/storage_scope', '/next_action'],
  },
} as const satisfies Record<(typeof flyLabToolContracts)[number]['name'], {
  required_data_fields: readonly string[];
  produced_artifacts: readonly string[];
  scientific_paths: readonly string[];
  operational_paths: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(input: Record<string, unknown>, key: string, minimumLength = 1, maximumLength = 500) {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length < minimumLength || value.length > maximumLength) {
    throw new FlyLabDomainError('INVALID_INPUT', `${key} must contain ${minimumLength}–${maximumLength} characters.`, false, { field: key });
  }
}

function requireNumber(input: Record<string, unknown>, key: string, minimum: number, maximum: number, integer = false) {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    throw new FlyLabDomainError('INVALID_INPUT', `${key} must be ${integer ? 'an integer' : 'a number'} from ${minimum} to ${maximum}.`, false, { field: key });
  }
}

function requireStringArray(input: Record<string, unknown>, key: string, minimum = 1, maximum = 8, allowed?: readonly string[]) {
  const value = input[key];
  if (!Array.isArray(value)
    || value.length < minimum
    || value.length > maximum
    || value.some((item) => typeof item !== 'string' || !item || (allowed && !allowed.includes(item)))
    || new Set(value).size !== value.length) {
    throw new FlyLabDomainError('INVALID_INPUT', `${key} must contain ${minimum}–${maximum} string IDs.`, false, { field: key });
  }
}

function requireEnum(input: Record<string, unknown>, key: string, allowed: readonly string[]) {
  const value = input[key];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new FlyLabDomainError('INVALID_INPUT', `${key} must be one of: ${allowed.join(', ')}.`, false, { field: key });
  }
}

export function validateToolInput(toolName: string, rawInput: unknown): Record<string, unknown> {
  if (!isRecord(rawInput)) {
    throw new FlyLabDomainError('INVALID_INPUT', 'Tool input must be an object.');
  }
  const input = rawInput;
  const contract = flyLabToolContracts.find((item) => item.name === toolName);
  if (!contract) throw new FlyLabDomainError('INVALID_INPUT', `Unknown FlyLab tool: ${toolName}`);
  const allowedKeys = new Set(Object.keys(contract.inputSchema.properties));
  const unexpected = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unexpected.length) {
    throw new FlyLabDomainError('INVALID_INPUT', 'Tool input contains unsupported fields.', false, { fields: unexpected });
  }
  switch (toolName) {
    case 'inspect_flylab_state':
      break;
    case 'find_fly_circuits':
      requireString(input, 'query', 1, 240);
      if (input.behavior !== undefined) requireEnum(input, 'behavior', [...behaviorEnum, 'any']);
      if (input.body_part !== undefined) requireEnum(input, 'body_part', [...BODY_PART_IDS, 'any']);
      if (input.evidence_labels !== undefined) requireStringArray(input, 'evidence_labels', 1, 5, provenanceEnum);
      if (input.limit !== undefined) requireNumber(input, 'limit', 1, 20, true);
      break;
    case 'draft_fly_hypothesis':
      requireString(input, 'circuit_id', 1, 100); requireString(input, 'claim', 10, 500); requireEnum(input, 'predicted_behavior', behaviorEnum);
      requireEnum(input, 'perturbation', ['activate', 'silence']); requireStringArray(input, 'evidence_ids', 1, 20); requireString(input, 'falsification_criterion', 5, 300);
      break;
    case 'design_stimulation_trial':
      requireString(input, 'hypothesis_id', 1, 100); requireString(input, 'target_circuit_id', 1, 100); requireEnum(input, 'perturbation', ['activate', 'silence']); requireEnum(input, 'laterality', ['bilateral', 'left', 'right']);
      requireNumber(input, 'activation_level', 0, 1); requireNumber(input, 'onset_ms', 0, 5000, true); requireNumber(input, 'duration_ms', 50, 5000, true);
      requireNumber(input, 'trial_duration_ms', 1000, 10000, true); requireNumber(input, 'replicates', 1, 20, true); requireNumber(input, 'seed', 0, 2147483647, true);
      if (typeof input.include_baseline !== 'boolean' || typeof input.include_sham_control !== 'boolean') throw new FlyLabDomainError('INVALID_INPUT', 'include_baseline and include_sham_control must be booleans.');
      if (input.include_baseline !== true || input.include_sham_control !== true) {
        throw new FlyLabDomainError('INVALID_INPUT', 'The controlled FlyLab vertical slice requires both baseline and model-sham conditions.', false, {
          required_controls: ['baseline', 'model_sham'],
        });
      }
      if ((input.onset_ms as number) + (input.duration_ms as number) > (input.trial_duration_ms as number)) {
        throw new FlyLabDomainError('INVALID_TIMING', 'Activation must end before the trial ends.', false, { onset_ms: input.onset_ms, duration_ms: input.duration_ms, trial_duration_ms: input.trial_duration_ms });
      }
      break;
    case 'run_fly_simulation':
      requireString(input, 'experiment_id', 1, 100);
      break;
    case 'analyze_fly_behavior':
      requireString(input, 'batch_id', 1, 100); requireStringArray(input, 'metrics', 5, 5, metricEnum);
      break;
    case 'compare_fly_trials':
      requireStringArray(input, 'analysis_ids'); requireEnum(input, 'objective_metric', metricEnum); requireEnum(input, 'objective', ['maximize', 'minimize']);
      break;
    case 'save_fly_evidence':
      requireString(input, 'title', 1, 120); requireString(input, 'hypothesis_id', 1, 100); requireString(input, 'experiment_id', 1, 100);
      requireStringArray(input, 'batch_ids', 1, 1); requireStringArray(input, 'analysis_ids'); requireString(input, 'comparison_id', 1, 100);
      if (input.note !== undefined) requireString(input, 'note', 0, 500);
      break;
  }
  return input;
}

function toolSuccess(tool: string, result: ToolActionResult) {
  const manifestLabels = [...new Set(result.provenanceManifest.entries.flatMap((entry) => entry.labels))];
  const summaryLabels = [...new Set(result.provenance)];
  if (manifestLabels.length !== summaryLabels.length
    || manifestLabels.some((label) => !summaryLabels.includes(label))) {
    throw new Error(`${tool} provenance summary does not match its field-addressable manifest.`);
  }
  const payload = {
    ok: true,
    result_version: FLYLAB_TOOL_RESULT_VERSION,
    tool,
    summary: result.summary,
    state_revision: result.stateRevision,
    provenance: result.provenance,
    provenance_scope: 'Union summary only. Use provenance_manifest entries for field-level attribution.',
    provenance_manifest: {
      schema_version: FLYLAB_PROVENANCE_MANIFEST_VERSION,
      path_scope: 'JSON Pointer paths relative to structuredContent.data; each entry labels its complete subtree unless a narrower entry overrides it.',
      entries: result.provenanceManifest.entries,
      operational_paths: result.provenanceManifest.operationalPaths,
    },
    data: result.data,
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function toolFailure(tool: string, error: FlyLabDomainError) {
  const payload = {
    ok: false,
    result_version: FLYLAB_TOOL_RESULT_VERSION,
    tool,
    error: { code: error.code, message: error.message, retryable: error.retryable, details: error.details },
  };
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

interface ModelContext {
  registerTool(
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
      execute: (input: unknown, context?: { signal?: AbortSignal }) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ): Promise<void>;
}

type ModelContextDocument = Document & {
  modelContext?: ModelContext;
  permissionsPolicy?: { allowsFeature?(feature: string): boolean };
  featurePolicy?: { allowsFeature?(feature: string): boolean };
};

type WebMCPRegistrationError = Error & {
  flylabWebMCPDiagnostic?: FlyLabWebMCPCapabilityDiagnostic;
};

export function detectFlyLabWebMCPRuntime(): FlyLabWebMCPCapabilityDiagnostic {
  const targetDocument = typeof document === 'undefined' ? null : document as ModelContextDocument;
  const targetWindow = typeof window === 'undefined' ? null : window;
  const modelContext = targetDocument?.modelContext;
  const registerToolType = typeof modelContext?.registerTool;
  let permissionsPolicyToolsAllowed: boolean | null = null;
  const policy = targetDocument?.permissionsPolicy ?? targetDocument?.featurePolicy;
  if (typeof policy?.allowsFeature === 'function') {
    try {
      permissionsPolicyToolsAllowed = policy.allowsFeature('tools');
    } catch {
      permissionsPolicyToolsAllowed = null;
    }
  }

  return {
    schema_version: 'flylab.webmcp-capability-diagnostic.v1',
    document_ready_state: targetDocument?.readyState ?? null,
    secure_context: typeof targetWindow?.isSecureContext === 'boolean' ? targetWindow.isSecureContext : null,
    origin_agent_cluster: typeof targetWindow?.originAgentCluster === 'boolean' ? targetWindow.originAgentCluster : null,
    permissions_policy_tools_allowed: permissionsPolicyToolsAllowed,
    document_model_context_present: Boolean(modelContext),
    register_tool_type: registerToolType,
    registration_attempted: false,
    registrations_accepted_before_rollback: 0,
    failed_tool_name: null,
    registration_error_name: null,
    registration_error: null,
    availability_reason: !modelContext
      ? 'document_model_context_absent'
      : registerToolType !== 'function'
        ? 'register_tool_missing'
        : 'checking',
  };
}

export function diagnosticFromWebMCPError(error: unknown): FlyLabWebMCPCapabilityDiagnostic | null {
  if (!error || typeof error !== 'object') return null;
  return (error as WebMCPRegistrationError).flylabWebMCPDiagnostic ?? null;
}

export async function installFlyLabWebMCP(
  actions: Record<string, FlyLabToolAction>,
  options: { onToolInvocation?: (toolName: string) => void } = {},
) {
  const initialDiagnostic = detectFlyLabWebMCPRuntime();
  const modelContext = typeof document === 'undefined'
    ? undefined
    : (document as ModelContextDocument).modelContext;
  if (!modelContext || typeof modelContext.registerTool !== 'function') {
    return { supported: false, diagnostic: initialDiagnostic, dispose() {} };
  }

  const registrationController = new AbortController();
  let acceptedRegistrationCount = 0;
  let failedToolName: string | null = null;
  let registrationErrorName: string | null = null;
  let registrationErrorMessage: string | null = null;
  try {
    for (const contract of flyLabToolContracts) {
      try {
        await modelContext.registerTool({
          ...contract,
          inputSchema: contract.inputSchema as Record<string, unknown>,
          execute: async (rawInput: unknown, context?: { signal?: AbortSignal }) => {
            options.onToolInvocation?.(contract.name);
            const signal = context?.signal ?? new AbortController().signal;
            try {
              throwIfCancellationRequested(signal);
              const input = validateToolInput(contract.name, rawInput);
              const action = actions[contract.name];
              if (!action) throw new FlyLabDomainError('SIMULATION_UNAVAILABLE', `${contract.name} is not connected.`);
              const result = await action(input, { signal, actor: 'webmcp_agent' });
              return toolSuccess(contract.name, result);
            } catch (error) {
              throwIfCancellationRequested(signal);
              if (error instanceof Error && error.name === 'AbortError') throw error;
              if (error instanceof FlyLabDomainError) return toolFailure(contract.name, error);
              console.error(`FlyLab tool failed: ${contract.name}`, error);
              throw new Error(`${contract.name} could not complete`);
            }
          },
        }, { signal: registrationController.signal });
        acceptedRegistrationCount += 1;
      } catch (error) {
        failedToolName = contract.name;
        registrationErrorName = error instanceof Error ? error.name || 'Error' : 'NonErrorThrow';
        registrationErrorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }
  } catch (error) {
    registrationController.abort();
    const detail = registrationErrorMessage ?? (error instanceof Error ? error.message : String(error));
    const wrapped = new Error(`WebMCP registration failed for ${failedToolName ?? 'unknown tool'}: ${detail}`) as WebMCPRegistrationError;
    wrapped.name = 'FlyLabWebMCPRegistrationError';
    wrapped.flylabWebMCPDiagnostic = {
      ...initialDiagnostic,
      registration_attempted: true,
      registrations_accepted_before_rollback: acceptedRegistrationCount,
      failed_tool_name: failedToolName,
      registration_error_name: registrationErrorName ?? (error instanceof Error ? error.name || 'Error' : 'NonErrorThrow'),
      registration_error: detail,
      availability_reason: 'registration_failed',
    };
    throw wrapped;
  }

  return {
    supported: true,
    diagnostic: {
      ...initialDiagnostic,
      registration_attempted: true,
      registrations_accepted_before_rollback: acceptedRegistrationCount,
      availability_reason: 'active' as const,
    },
    dispose() { registrationController.abort(); },
  };
}
