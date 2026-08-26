import { ANALYSIS_METRICS, type ProvenanceLabel } from './flylab.js';

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
  stateRevision: number;
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
  'escape',
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
    description: "Search FlyLab's curated adult Drosophila evidence index by behavior, circuit, or neuron name. Use before drafting a hypothesis. Returns stable circuit IDs, citations, and explicit evidence labels; it does not run a simulation.",
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    inputSchema: objectSchema({
      query: { type: 'string', minLength: 1, maxLength: 240, description: 'Behavior, circuit, neuron type, or scientific question to search.' },
      behavior: { type: 'string', enum: [...behaviorEnum, 'any'], default: 'any' },
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
    description: 'Execute one approved, bounded FlyLab experiment and animate its conditions in the shared arena. Returns exact model, controller, seed and run IDs with simulation_predicted provenance.',
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    inputSchema: objectSchema({
      experiment_id: { type: 'string', minLength: 1, maxLength: 100 },
    }, ['experiment_id']),
  },
  {
    name: 'analyze_fly_behavior',
    title: 'Analyze fly behavior',
    description: 'Compute and save FlyLab\'s predefined, required five-metric panel by aggregating simulation-generated per-run summaries. Also returns reverse-initiation frequency. The displayed condition replay is illustrative and separate; outputs are not wet-lab evidence.',
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    inputSchema: objectSchema({
      batch_id: { type: 'string', minLength: 1, maxLength: 100 },
      metrics: { type: 'array', items: { type: 'string', enum: metricEnum }, minItems: 5, maxItems: 5, uniqueItems: true, description: 'The complete predefined metric set; partial panels are not supported in this release.' },
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
    description: 'Commit a complete FlyLab hypothesis, experiment, runs, analyses, comparison, citations, model versions and seeds to the visible browser-local evidence ledger. Returns a stable bundle ID and manifest hash.',
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
      if (!(metricEnum.every((metric) => (input.metrics as string[]).includes(metric)))) {
        throw new FlyLabDomainError('METRIC_UNAVAILABLE', 'The challenge release requires the complete predefined five-metric panel.', false, {
          required_metrics: metricEnum,
        });
      }
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
  const payload = {
    ok: true,
    result_version: 'flylab.tool-result.v1',
    tool,
    summary: result.summary,
    state_revision: result.stateRevision,
    provenance: result.provenance,
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
    result_version: 'flylab.tool-result.v1',
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

export async function installFlyLabWebMCP(actions: Record<string, FlyLabToolAction>) {
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!modelContext || typeof modelContext.registerTool !== 'function') {
    return { supported: false, dispose() {} };
  }

  const registrationController = new AbortController();
  try {
    for (const contract of flyLabToolContracts) {
      try {
        await modelContext.registerTool({
          ...contract,
          inputSchema: contract.inputSchema as Record<string, unknown>,
          execute: async (rawInput: unknown, context?: { signal?: AbortSignal }) => {
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
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown browser error';
        throw new Error(`WebMCP registration failed for ${contract.name}: ${detail}`);
      }
    }
  } catch (error) {
    registrationController.abort();
    throw error;
  }

  return {
    supported: true,
    dispose() { registrationController.abort(); },
  };
}
