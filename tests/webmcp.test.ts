import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';

import {
  FLYLAB_ERROR_CODES,
  FLYLAB_PROVENANCE_MANIFEST_VERSION,
  FLYLAB_TOOL_RESULT_VERSION,
  FlyLabDomainError,
  canonicalOperationInput,
  flyLabToolContracts,
  flyLabToolOutputContracts,
  diagnosticFromWebMCPError,
  installFlyLabWebMCP,
  prepareCancellableCommit,
  requireCurrentStateRevision,
  verifyAtCurrentStateRevision,
  validateToolInput,
  type ToolActionResult,
  type FlyLabToolAction,
} from '../lib/webmcp.js';
import { FLYLAB_AGENT_CONTEXT_VERSION } from '../lib/agent-context.js';
import { flyLabAgentContractDocument } from '../lib/agent-contract-document.js';
import { PROVENANCE_DEFINITIONS } from '../lib/flylab.js';

const expectedNames = [
  'analyze_fly_behavior',
  'compare_fly_trials',
  'design_stimulation_trial',
  'draft_fly_hypothesis',
  'find_fly_circuits',
  'inspect_flylab_state',
  'run_fly_simulation',
  'save_fly_evidence',
];

const mutationContext = {
  page_session_id: 'session_test_0001',
  expected_state_revision: 1,
};

const structuredHypothesisFields = {
  primary_outcome: 'backward_distance_mm',
  expected_direction: 'increase',
  controls: ['condition_baseline', 'condition_sham'],
  evidence_limitations: ['The cited assay does not calibrate the reduced-order FlyLab model.'],
};

const derivedProvenanceManifest = {
  entries: [{
    path: '',
    artifact_id: null,
    artifact_type: 'test_fixture',
    scope: 'container' as const,
    labels: ['derived' as const],
    parent_ids: [],
    evidence_ids: [],
    source_ids: [],
    boundary: 'Synthetic derived fixture used only to verify the WebMCP result envelope.',
  }],
  operationalPaths: [] as string[],
};

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

describe('FlyLab WebMCP contracts', () => {
  test('exposes one inspector and seven uniquely named scientific workflow actions', () => {
    const names = flyLabToolContracts.map((contract) => contract.name);

    assert.equal(flyLabToolContracts.length, 8);
    assert.equal(new Set(names).size, 8);
    assert.deepEqual([...names].sort(), expectedNames);
    for (const name of names) {
      assert.match(name, /^[A-Za-z0-9_.-]{1,128}$/);
    }
  });

  test('uses only current standard annotation keys with explicit booleans', () => {
    for (const contract of flyLabToolContracts) {
      assert.deepEqual(
        Object.keys(contract.annotations).sort(),
        ['readOnlyHint', 'untrustedContentHint'],
        `${contract.name} has non-standard or missing annotations`,
      );
      assert.equal(typeof contract.annotations.readOnlyHint, 'boolean');
      assert.equal(typeof contract.annotations.untrustedContentHint, 'boolean');
      assert.equal('destructiveHint' in contract.annotations, false);
      assert.equal('idempotentHint' in contract.annotations, false);
      assert.equal('openWorldHint' in contract.annotations, false);
    }

    const annotations = Object.fromEntries(
      flyLabToolContracts.map((contract) => [contract.name, contract.annotations]),
    );
    assert.deepEqual(annotations.inspect_flylab_state, {
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    assert.deepEqual(annotations.find_fly_circuits, {
      readOnlyHint: false,
      untrustedContentHint: true,
    });
    assert.equal(
      flyLabToolContracts.filter((contract) => contract.annotations.readOnlyHint).length,
      1,
    );
    assert.deepEqual(
      flyLabToolContracts
        .filter((contract) => contract.annotations.untrustedContentHint)
        .map((contract) => contract.name)
        .sort(),
      ['draft_fly_hypothesis', 'find_fly_circuits', 'inspect_flylab_state', 'save_fly_evidence'],
    );
  });

  test('gives every tool a closed object schema and useful discovery metadata', () => {
    for (const contract of flyLabToolContracts) {
      assert.ok(contract.title.length > 0);
      assert.ok(contract.description.length >= 80);
      assert.equal(contract.inputSchema.type, 'object');
      assert.equal(contract.inputSchema.additionalProperties, false);
      assert.ok(contract.inputSchema.properties);
      assert.ok(Array.isArray(contract.inputSchema.required));
    }
  });

  test('requires page-session and revision preconditions on every mutation and operation IDs on run/save', () => {
    for (const contract of flyLabToolContracts) {
      if (contract.name === 'inspect_flylab_state') {
        assert.equal(contract.inputSchema.required.includes('page_session_id'), false);
        assert.equal(contract.inputSchema.required.includes('expected_state_revision'), false);
        continue;
      }
      assert.ok(contract.inputSchema.required.includes('page_session_id'), contract.name);
      assert.ok(contract.inputSchema.required.includes('expected_state_revision'), contract.name);
      assert.ok('page_session_id' in contract.inputSchema.properties, contract.name);
      assert.ok('expected_state_revision' in contract.inputSchema.properties, contract.name);
    }
    for (const name of ['run_fly_simulation', 'save_fly_evidence']) {
      const contract = flyLabToolContracts.find((item) => item.name === name);
      assert.ok(contract?.inputSchema.required.includes('operation_id'), name);
      assert.ok(contract && 'operation_id' in contract.inputSchema.properties, name);
    }
    const runContract = flyLabToolContracts.find((item) => item.name === 'run_fly_simulation');
    assert.ok(runContract?.inputSchema.required.includes('approved_protocol_hash'));
    assert.ok(runContract && 'approved_protocol_hash' in runContract.inputSchema.properties);
    const saveContract = flyLabToolContracts.find((item) => item.name === 'save_fly_evidence');
    assert.equal(saveContract?.inputSchema.required.includes('title'), false);
    assert.ok(saveContract && 'title' in saveContract.inputSchema.properties);
    assert.throws(
      () => validateToolInput('find_fly_circuits', { query: 'MDN' }),
      (error: unknown) => (error as { code?: string }).code === 'INVALID_INPUT',
    );
    assert.doesNotThrow(() => validateToolInput('run_fly_simulation', {
      ...mutationContext,
      experiment_id: 'exp_1',
      approved_protocol_hash: `sha256:${'a'.repeat(64)}`,
      operation_id: 'run_once_1',
    }));
    assert.throws(
      () => validateToolInput('run_fly_simulation', { ...mutationContext, experiment_id: 'exp_1' }),
      (error: unknown) => (error as { code?: string }).code === 'INVALID_INPUT',
    );
    assert.doesNotThrow(() => validateToolInput('save_fly_evidence', {
      ...mutationContext,
      scope: 'mission',
      hypothesis_id: 'hyp_1',
      experiment_id: 'exp_1',
      batch_ids: ['batch_1'],
      analysis_ids: ['analysis_1'],
      comparison_id: 'comparison_1',
      operation_id: 'save_once_1',
    }));
  });

  test('compares operation inputs by exact canonical JSON rather than key order or a short hash', () => {
    const first = canonicalOperationInput({
      page_session_id: 'session_test_0001',
      expected_state_revision: 4,
      experiment_id: 'exp_1',
      approved_protocol_hash: `sha256:${'a'.repeat(64)}`,
      operation_id: 'run_1',
      nested: { z: 2, a: 1 },
    });
    const reordered = canonicalOperationInput({
      nested: { a: 1, z: 2 },
      operation_id: 'different_retry_id',
      approved_protocol_hash: `sha256:${'a'.repeat(64)}`,
      experiment_id: 'exp_1',
      expected_state_revision: 99,
      page_session_id: 'session_test_0001',
    });
    const changed = canonicalOperationInput({
      page_session_id: 'session_test_0001',
      expected_state_revision: 99,
      experiment_id: 'exp_1',
      approved_protocol_hash: `sha256:${'b'.repeat(64)}`,
      operation_id: 'run_1',
      nested: { a: 1, z: 2 },
    });

    assert.equal(first, reordered);
    assert.notEqual(first, changed);
  });

  test('publishes a machine-readable manifest synchronized with the live WebMCP tool surface', () => {
    const manifest = JSON.parse(readFileSync('public/flylab-agent-manifest.json', 'utf8')) as {
      schema_version?: string;
      transport?: {
        required_first_call?: string;
        state_contract?: string;
        result_contract?: string;
        provenance_manifest_contract?: string;
        tool_contract_document?: string;
      };
      discovery?: {
        contract_url?: string;
        webmcp_standard_discovery?: boolean;
        inline_state_selector?: string;
        inline_runtime_selector?: string;
        inline_handoff_selector?: string;
        unsupported_browser_behavior?: string;
      };
      tools?: Array<{ name?: string }>;
      output_contracts?: Record<string, unknown>;
      provenance?: {
        schema_version?: string;
        summary_field?: string;
        manifest_field?: string;
        inheritance?: string;
        operational_boundary?: string;
        untrusted_annotation_boundary?: string;
        definitions?: Record<string, string>;
      };
      provenance_labels?: string[];
      operator_gate?: { webmcp_tool?: boolean; blocks?: string };
      hypothesis_evidence_gate?: {
        required_role?: string;
        required_support_kind?: string;
        must_match?: string[];
        supplemental_only?: string[];
        excluded?: string[];
      };
    };

    assert.equal(manifest.schema_version, 'flylab.agent-manifest.v3');
    assert.equal(manifest.transport?.required_first_call, 'inspect_flylab_state');
    assert.equal(manifest.transport?.state_contract, FLYLAB_AGENT_CONTEXT_VERSION);
    assert.equal(manifest.transport?.result_contract, FLYLAB_TOOL_RESULT_VERSION);
    assert.equal(manifest.transport?.provenance_manifest_contract, FLYLAB_PROVENANCE_MANIFEST_VERSION);
    assert.equal(manifest.transport?.tool_contract_document, '/flylab-tool-contracts.json');
    assert.equal(manifest.discovery?.contract_url, '/flylab-tool-contracts.json');
    assert.equal(manifest.discovery?.webmcp_standard_discovery, false);
    assert.equal(manifest.discovery?.inline_state_selector, '#flylab-agent-context');
    assert.equal(manifest.discovery?.inline_runtime_selector, '#flylab-agent-runtime');
    assert.equal(manifest.discovery?.inline_handoff_selector, '#flylab-agent-handoff');
    assert.match(manifest.discovery?.unsupported_browser_behavior ?? '', /does not polyfill WebMCP/i);
    assert.deepEqual(manifest.tools?.map((tool) => tool.name).sort(), expectedNames);
    assert.deepEqual(manifest.output_contracts, flyLabToolOutputContracts);
    assert.deepEqual(Object.keys(manifest.output_contracts ?? {}).sort(), expectedNames);
    assert.equal(manifest.provenance?.schema_version, FLYLAB_PROVENANCE_MANIFEST_VERSION);
    assert.equal(manifest.provenance?.summary_field, 'provenance');
    assert.equal(manifest.provenance?.manifest_field, 'provenance_manifest');
    assert.match(manifest.provenance?.inheritance ?? '', /more specific nested entry overrides/i);
    assert.match(manifest.provenance?.operational_boundary ?? '', /not scientific evidence/i);
    assert.match(manifest.provenance?.untrusted_annotation_boundary ?? '', /excluded from scientific provenance counts/i);
    assert.deepEqual(manifest.provenance?.definitions, PROVENANCE_DEFINITIONS);
    assert.deepEqual(manifest.provenance_labels, Object.keys(PROVENANCE_DEFINITIONS));
    assert.equal(manifest.operator_gate?.webmcp_tool, false);
    assert.equal(manifest.operator_gate?.blocks, 'run_fly_simulation');
    assert.deepEqual(manifest.hypothesis_evidence_gate, {
      required_role: 'hypothesis_support',
      required_support_kind: 'perturbation_effect',
      must_match: ['perturbation', 'predicted_behavior'],
      supplemental_only: ['structural_path', 'specimen_inventory', 'motor_context'],
      excluded: ['model_context', 'catalog_context'],
    });
  });

  test('derives a complete public contract document from the registered tool source', () => {
    assert.equal(flyLabAgentContractDocument.schema_version, 'flylab.webmcp-contracts.v3');
    assert.equal(flyLabAgentContractDocument.transport.required_first_call, 'inspect_flylab_state');
    assert.equal(flyLabAgentContractDocument.transport.context_contract, FLYLAB_AGENT_CONTEXT_VERSION);
    assert.equal(flyLabAgentContractDocument.transport.result_contract, FLYLAB_TOOL_RESULT_VERSION);
    assert.equal(flyLabAgentContractDocument.transport.provenance_manifest_contract, FLYLAB_PROVENANCE_MANIFEST_VERSION);
    assert.match(flyLabAgentContractDocument.transport.execution_note, /not a fallback transport/i);
    assert.equal(flyLabAgentContractDocument.result_contract.schema_version, FLYLAB_TOOL_RESULT_VERSION);
    assert.ok(flyLabAgentContractDocument.result_contract.success_fields.includes('provenance_manifest'));
    assert.ok(flyLabAgentContractDocument.result_contract.success_fields.includes('provenance_scope'));
    assert.deepEqual(flyLabAgentContractDocument.result_contract.domain_error_codes, FLYLAB_ERROR_CODES);
    assert.equal(flyLabAgentContractDocument.context_contract.schema_version, FLYLAB_AGENT_CONTEXT_VERSION);
    assert.equal(flyLabAgentContractDocument.provenance_contract.schema_version, FLYLAB_PROVENANCE_MANIFEST_VERSION);
    assert.deepEqual(flyLabAgentContractDocument.provenance_contract.definitions, PROVENANCE_DEFINITIONS);
    assert.match(flyLabAgentContractDocument.provenance_contract.inheritance, /more specific nested entry overrides/i);
    assert.match(flyLabAgentContractDocument.provenance_contract.operational_boundary, /not scientific evidence/i);
    assert.match(flyLabAgentContractDocument.provenance_contract.untrusted_annotation_boundary, /never scientific evidence/i);
    assert.deepEqual(
      flyLabAgentContractDocument.tools,
      flyLabToolContracts.map((contract) => ({
        name: contract.name,
        title: contract.title,
        description: contract.description,
        annotations: contract.annotations,
        input_schema: contract.inputSchema,
        output_contract: flyLabToolOutputContracts[contract.name],
      })),
    );
    assert.equal(flyLabAgentContractDocument.tools.length, 8);
    for (const tool of flyLabAgentContractDocument.tools) {
      assert.equal(tool.input_schema.type, 'object');
      assert.equal(tool.input_schema.additionalProperties, false);
      assert.ok(tool.output_contract.required_data_fields.length > 0);
      assert.ok(tool.output_contract.scientific_paths.every((path) => path === '' || path.startsWith('/')));
      assert.ok(tool.output_contract.operational_paths.every((path) => path.startsWith('/')));
    }
  });

  test('requires baseline and model-sham controls in every trial design', () => {
    const input = {
      ...mutationContext,
      hypothesis_id: 'hyp_1',
      target_circuit_id: 'circuit_mdn_adult',
      perturbation: 'activate',
      laterality: 'bilateral',
      activation_level: 0.65,
      onset_ms: 1000,
      duration_ms: 2000,
      trial_duration_ms: 5000,
      replicates: 8,
      include_baseline: true,
      include_sham_control: false,
      seed: 73142,
    };

    assert.throws(
      () => validateToolInput('design_stimulation_trial', input),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_INPUT');
        assert.deepEqual((error as { details?: Record<string, unknown> }).details, {
          required_controls: ['baseline', 'model_sham'],
        });
        return true;
      },
    );
  });

  test('requires the full analysis panel and accepts bounded hypothesis evidence arrays', () => {
    assert.throws(
      () => validateToolInput('analyze_fly_behavior', {
        ...mutationContext,
        batch_id: 'batch_1',
        metrics: ['backward_distance_mm'],
      }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_INPUT');
        return true;
      },
    );

    assert.doesNotThrow(() => validateToolInput('analyze_fly_behavior', {
      ...mutationContext,
      batch_id: 'batch_1',
      metrics: ['backward_distance_mm', 'signed_speed_mm_s', 'response_latency_ms', 'heading_change_deg', 'stance_stability'],
    }));
    assert.doesNotThrow(() => validateToolInput('analyze_fly_behavior', {
      ...mutationContext,
      batch_id: 'batch_gf',
      metrics: ['short_mode_escape_probability', 'response_latency_ms', 'vertical_displacement_mm', 'wing_recruitment', 'leg_recruitment'],
    }));
    assert.doesNotThrow(() => validateToolInput('draft_fly_hypothesis', {
      ...mutationContext,
      ...structuredHypothesisFields,
      circuit_id: 'circuit_mdn_adult',
      claim: 'MDN activation will increase predicted backward walking.',
      predicted_behavior: 'backward_walking',
      perturbation: 'activate',
      evidence_ids: Array.from({ length: 9 }, (_, index) => `evidence_${index}`),
      falsification_criterion: 'No predicted increase over controls.',
    }));
    assert.doesNotThrow(() => validateToolInput('draft_fly_hypothesis', {
      ...mutationContext,
      ...structuredHypothesisFields,
      circuit_id: 'circuit_mdn_adult',
      claim: 'MDN activation will increase predicted retreat behavior.',
      predicted_behavior: 'retreat',
      perturbation: 'activate',
      evidence_ids: ['evidence_retreat'],
      falsification_criterion: 'No predicted retreat increase over controls.',
    }));

    const searchContract = flyLabToolContracts.find((contract) => contract.name === 'find_fly_circuits');
    const hypothesisContract = flyLabToolContracts.find((contract) => contract.name === 'draft_fly_hypothesis');
    const searchBehavior = searchContract?.inputSchema.properties.behavior as { enum?: readonly string[] };
    const searchBodyPart = searchContract?.inputSchema.properties.body_part as { enum?: readonly string[] };
    const predictedBehavior = hypothesisContract?.inputSchema.properties.predicted_behavior as { enum?: readonly string[] };
    assert.ok(searchBehavior.enum?.includes('retreat'));
    assert.ok(predictedBehavior.enum?.includes('retreat'));
    assert.ok(searchBehavior.enum?.includes('short_mode_escape'));
    assert.ok(predictedBehavior.enum?.includes('short_mode_escape'));
    assert.equal(predictedBehavior.enum?.includes('escape'), false);
    assert.equal(predictedBehavior.enum?.includes('wing_depression'), false);
    assert.ok(searchBodyPart.enum?.includes('left_wing'));
    assert.ok(searchBodyPart.enum?.includes('right_midleg'));
  });
});

describe('FlyLab WebMCP registration lifecycle', () => {
  test('fails closed with zero registrations when document.modelContext is absent', async () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {},
    });

    const result = await installFlyLabWebMCP({});

    assert.equal(result.supported, false);
    assert.equal(result.diagnostic.document_model_context_present, false);
    assert.equal(result.diagnostic.register_tool_type, 'undefined');
    assert.equal(result.diagnostic.registration_attempted, false);
    assert.equal(result.diagnostic.availability_reason, 'document_model_context_absent');
    assert.equal(result.diagnostic.failed_tool_name, null);
    assert.equal(result.diagnostic.registration_error_name, null);
    assert.equal(result.diagnostic.registration_error, null);
    assert.doesNotThrow(() => result.dispose());
  });

  test('distinguishes a present modelContext with no registerTool method', async () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { readyState: 'complete', modelContext: {} },
    });

    const result = await installFlyLabWebMCP({});

    assert.equal(result.supported, false);
    assert.equal(result.diagnostic.document_ready_state, 'complete');
    assert.equal(result.diagnostic.document_model_context_present, true);
    assert.equal(result.diagnostic.register_tool_type, 'undefined');
    assert.equal(result.diagnostic.availability_reason, 'register_tool_missing');
  });

  test('registers and invokes all eight contracts, then unregisters them on dispose', async () => {
    const registrations: Array<{
      tool: {
        name: string;
        annotations?: Record<string, boolean>;
        execute(input: unknown, context?: { signal?: AbortSignal }): Promise<unknown>;
      };
      signal?: AbortSignal;
    }> = [];
    const modelContext = {
      async registerTool(
        tool: {
          name: string;
          annotations?: Record<string, boolean>;
          execute(input: unknown, context?: { signal?: AbortSignal }): Promise<unknown>;
        },
        options?: { signal?: AbortSignal },
      ) {
        registrations.push({ tool, signal: options?.signal });
      },
    };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { modelContext },
    });

    const action: FlyLabToolAction = async () => ({
      summary: 'ok',
      data: {},
      provenance: ['derived'],
      provenanceManifest: derivedProvenanceManifest,
      stateRevision: 1,
      previousStateRevision: 1,
      createdArtifactIds: [],
    });
    const actions = Object.fromEntries(
      expectedNames.map((name) => [name, action]),
    );
    let discoveryActionCalls = 0;
    actions.find_fly_circuits = async (input, context) => {
      discoveryActionCalls += 1;
      return action(input, context);
    };
    const observedInvocations: string[] = [];
    let runtimeRevision = 1;

    const installation = await installFlyLabWebMCP(actions, {
      onToolInvocation: (toolName) => observedInvocations.push(toolName),
      getRuntimeMetadata: () => ({ pageSessionId: mutationContext.page_session_id, stateRevision: runtimeRevision }),
    });

    assert.equal(installation.supported, true);
    assert.equal(installation.diagnostic.registration_attempted, true);
    assert.equal(installation.diagnostic.registrations_accepted_before_rollback, 8);
    assert.equal(installation.diagnostic.availability_reason, 'active');
    assert.equal(installation.diagnostic.registration_error, null);
    assert.equal(registrations.length, 8);
    assert.deepEqual(
      registrations.map(({ tool }) => tool.name).sort(),
      expectedNames,
    );
    assert.ok(registrations.every(({ signal }) => signal instanceof AbortSignal));
    assert.ok(registrations.every(({ signal }) => signal?.aborted === false));
    assert.equal(new Set(registrations.map(({ signal }) => signal)).size, 1);

    const inspector = registrations.find(({ tool }) => tool.name === 'inspect_flylab_state');
    assert.ok(inspector);
    const inspection = await inspector.tool.execute({}) as {
      isError?: boolean;
      structuredContent?: { ok?: boolean; tool?: string };
    };
    assert.notEqual(inspection.isError, true);
    assert.equal(inspection.structuredContent?.ok, true);
    assert.equal(inspection.structuredContent?.tool, 'inspect_flylab_state');
    assert.deepEqual(observedInvocations, ['inspect_flylab_state']);

    const discovery = registrations.find(({ tool }) => tool.name === 'find_fly_circuits');
    assert.ok(discovery);
    const wrongSession = await discovery.tool.execute({
      ...mutationContext,
      page_session_id: 'session_wrong_0001',
      query: 'MDN',
      behavior: 'backward_walking',
    }) as {
      isError?: boolean;
      structuredContent?: { error?: { code?: string }; recovery?: { tool?: string } };
    };
    assert.equal(wrongSession.isError, true);
    assert.equal(wrongSession.structuredContent?.error?.code, 'STALE_STATE');
    assert.equal(wrongSession.structuredContent?.recovery?.tool, 'inspect_flylab_state');
    const wrongRevision = await discovery.tool.execute({
      ...mutationContext,
      expected_state_revision: 999,
      query: 'MDN',
      behavior: 'backward_walking',
    }) as { isError?: boolean; structuredContent?: { error?: { code?: string } } };
    assert.equal(wrongRevision.isError, true);
    assert.equal(wrongRevision.structuredContent?.error?.code, 'STALE_STATE');
    assert.equal(discoveryActionCalls, 0, 'central mutation guards must reject stale requests before action dispatch');

    const result = await discovery.tool.execute(
      { ...mutationContext, query: 'MDN', behavior: 'backward_walking' },
    ) as {
      isError?: boolean;
      structuredContent?: {
        ok?: boolean;
        result_version?: string;
        tool?: string;
        summary?: string;
        page_session_id?: string;
        previous_state_revision?: number;
        state_revision?: number;
        created_artifact_ids?: string[];
        idempotent_replay?: boolean;
        verification?: { selector?: string };
        provenance_scope?: string;
        provenance_manifest?: { schema_version?: string };
      };
    };
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent?.ok, true);
    assert.equal(result.structuredContent?.tool, 'find_fly_circuits');
    assert.equal(result.structuredContent?.summary, 'ok');
    assert.equal(result.structuredContent?.page_session_id, mutationContext.page_session_id);
    assert.equal(result.structuredContent?.previous_state_revision, 1);
    assert.equal(result.structuredContent?.state_revision, 1);
    assert.deepEqual(result.structuredContent?.created_artifact_ids, []);
    assert.equal(result.structuredContent?.idempotent_replay, false);
    assert.equal(result.structuredContent?.verification?.selector, '#flylab-agent-context');
    assert.equal(result.structuredContent?.result_version, FLYLAB_TOOL_RESULT_VERSION);
    assert.match(result.structuredContent?.provenance_scope ?? '', /union summary only/i);
    assert.equal(result.structuredContent?.provenance_manifest?.schema_version, FLYLAB_PROVENANCE_MANIFEST_VERSION);
    assert.equal(discoveryActionCalls, 1);
    assert.deepEqual(observedInvocations, [
      'inspect_flylab_state',
      'find_fly_circuits',
      'find_fly_circuits',
      'find_fly_circuits',
    ]);

    actions.find_fly_circuits = async () => ({
      summary: 'invalid transition fixture',
      data: {},
      provenance: ['derived'],
      provenanceManifest: derivedProvenanceManifest,
      stateRevision: 1,
    } as unknown as ToolActionResult);
    const invalidSuccess = await discovery.tool.execute(
      { ...mutationContext, query: 'MDN', behavior: 'backward_walking' },
    ) as {
      isError?: boolean;
      structuredContent?: {
        error?: { code?: string; details?: { contract_violation?: string; field?: string } };
      };
    };
    assert.equal(invalidSuccess.isError, true);
    assert.equal(invalidSuccess.structuredContent?.error?.code, 'SIMULATION_UNAVAILABLE');
    assert.equal(invalidSuccess.structuredContent?.error?.details?.contract_violation, 'invalid_success_metadata');
    assert.equal(invalidSuccess.structuredContent?.error?.details?.field, 'previousStateRevision');

    const runRegistration = registrations.find(({ tool }) => tool.name === 'run_fly_simulation');
    assert.ok(runRegistration);
    const runInput = {
      ...mutationContext,
      experiment_id: 'exp_1',
      approved_protocol_hash: `sha256:${'a'.repeat(64)}`,
      operation_id: 'run_conflict_1',
    };
    actions.run_fly_simulation = async () => {
      throw new FlyLabDomainError('INVALID_INPUT', 'operation ID conflict', false, {
        conflict: 'operation_id_input_mismatch',
        recovery: 'Generate a new operation_id for a different logical operation.',
      });
    };
    const operationConflict = await runRegistration.tool.execute(runInput) as {
      isError?: boolean;
      structuredContent?: { recovery?: { tool?: string; input?: { operation_id?: string }; reason?: string } };
    };
    assert.equal(operationConflict.isError, true);
    assert.equal(operationConflict.structuredContent?.recovery?.tool, 'run_fly_simulation');
    assert.equal(operationConflict.structuredContent?.recovery?.input?.operation_id, '<new_operation_id>');
    assert.match(operationConflict.structuredContent?.recovery?.reason ?? '', /new operation_id/i);

    actions.run_fly_simulation = async () => {
      throw new FlyLabDomainError('APPROVAL_REQUIRED', 'operator approval required', false, {
        blocked_by: 'human_approval',
      });
    };
    const approvalRequired = await runRegistration.tool.execute({
      ...runInput,
      operation_id: 'run_requires_approval_1',
    }) as {
      isError?: boolean;
      structuredContent?: { recovery?: { tool?: string; reason?: string } };
    };
    assert.equal(approvalRequired.isError, true);
    assert.equal(approvalRequired.structuredContent?.recovery?.tool, 'inspect_flylab_state');
    assert.match(approvalRequired.structuredContent?.recovery?.reason ?? '', /visible operator approval/i);

    const invalidInspection = await inspector.tool.execute({ unexpected: true }) as {
      isError?: boolean;
      structuredContent?: { error?: { code?: string } };
    };
    assert.equal(invalidInspection.isError, true);
    assert.equal(invalidInspection.structuredContent?.error?.code, 'INVALID_INPUT');

    let cancelledActionCalls = 0;
    actions.find_fly_circuits = async () => {
      cancelledActionCalls += 1;
      return {
        summary: 'should not run',
        data: {},
        provenance: ['derived'],
        provenanceManifest: derivedProvenanceManifest,
        stateRevision: 2,
        previousStateRevision: 1,
        createdArtifactIds: ['artifact_cancelled'],
      };
    };
    const callController = new AbortController();
    callController.abort();
    await assert.rejects(
      discovery.tool.execute(
        { ...mutationContext, query: 'MDN', behavior: 'backward_walking' },
        { signal: callController.signal },
      ),
      { name: 'AbortError' },
    );
    assert.equal(cancelledActionCalls, 0, 'a pre-cancelled invocation must not start its action');

    const postCommitController = new AbortController();
    actions.find_fly_circuits = async () => {
      cancelledActionCalls += 1;
      postCommitController.abort(new DOMException('cancel arrived after commit', 'AbortError'));
      runtimeRevision = 3;
      return {
        summary: 'committed before cancellation became observable',
        data: { committed: true },
        provenance: ['derived'],
        provenanceManifest: derivedProvenanceManifest,
        stateRevision: 3,
        previousStateRevision: 1,
        createdArtifactIds: ['artifact_committed'],
      };
    };
    const postCommitResult = await discovery.tool.execute(
      { ...mutationContext, query: 'MDN', behavior: 'backward_walking' },
      { signal: postCommitController.signal },
    ) as { isError?: boolean; structuredContent?: { ok?: boolean; state_revision?: number } };
    assert.notEqual(postCommitResult.isError, true, 'a committed synchronous mutation must report success, not cancellation');
    assert.equal(postCommitResult.structuredContent?.ok, true);
    assert.equal(postCommitResult.structuredContent?.state_revision, 3);

    installation.dispose();

    assert.ok(registrations.every(({ signal }) => signal?.aborted === true));
  });

  test('names a rejected tool and aborts partial registration', async () => {
    const registrationSignals: AbortSignal[] = [];
    const modelContext = {
      async registerTool(
        tool: { name: string },
        options?: { signal?: AbortSignal },
      ) {
        if (options?.signal) registrationSignals.push(options.signal);
        if (tool.name === 'design_stimulation_trial') {
          throw new DOMException('schema rejected', 'NotAllowedError');
        }
      },
    };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { modelContext },
    });

    const action: FlyLabToolAction = async () => ({
      summary: 'ok',
      data: {},
      provenance: ['derived'],
      provenanceManifest: derivedProvenanceManifest,
      stateRevision: 1,
      previousStateRevision: 1,
      createdArtifactIds: [],
    });
    const actions = Object.fromEntries(
      expectedNames.map((name) => [name, action]),
    );

    let registrationError: unknown;
    try {
      await installFlyLabWebMCP(actions);
      assert.fail('Expected the fourth registration to fail.');
    } catch (error) {
      registrationError = error;
    }
    assert.match(
      registrationError instanceof Error ? registrationError.message : '',
      /WebMCP registration failed for design_stimulation_trial: schema rejected/,
    );
    const diagnostic = diagnosticFromWebMCPError(registrationError);
    assert.ok(diagnostic);
    assert.equal(diagnostic.availability_reason, 'registration_failed');
    assert.equal(diagnostic.registration_attempted, true);
    assert.equal(diagnostic.registrations_accepted_before_rollback, 3);
    assert.equal(diagnostic.failed_tool_name, 'design_stimulation_trial');
    assert.equal(diagnostic.registration_error_name, 'NotAllowedError');
    assert.equal(diagnostic.registration_error, 'schema rejected');
    assert.equal(registrationSignals.length, 4);
    assert.equal(new Set(registrationSignals).size, 1);
    assert.ok(registrationSignals.every((signal) => signal.aborted));
  });
});

describe('FlyLab cancellable commit boundary', () => {
  test('cancellation after preparation starts prevents a completed batch commit', async () => {
    const controller = new AbortController();
    let completedBatch: { id: string } | null = null;
    let commitCalls = 0;
    let preparationStarted!: () => void;
    let finishPreparation!: (batch: { id: string }) => void;
    const started = new Promise<void>((resolve) => { preparationStarted = resolve; });
    const prepared = new Promise<{ id: string }>((resolve) => { finishPreparation = resolve; });

    const execution = prepareCancellableCommit({
      signal: controller.signal,
      prepare: async () => {
        preparationStarted();
        return prepared;
      },
      commit: (batch) => {
        commitCalls += 1;
        completedBatch = batch;
        return batch;
      },
    });

    await started;
    controller.abort(new DOMException('Agent cancelled the running simulation', 'AbortError'));
    finishPreparation({ id: 'batch_must_not_commit' });

    await assert.rejects(execution, { name: 'AbortError' });
    assert.equal(commitCalls, 0);
    assert.equal(completedBatch, null);
  });

  test('commits a prepared result exactly once when the invocation remains active', async () => {
    const controller = new AbortController();
    let commitCalls = 0;

    const result = await prepareCancellableCommit({
      signal: controller.signal,
      prepare: async () => ({ id: 'batch_complete' }),
      commit: (batch) => {
        commitCalls += 1;
        return batch;
      },
    });

    assert.deepEqual(result, { id: 'batch_complete' });
    assert.equal(commitCalls, 1);
  });

  test('honors a synchronous page cancellation request before a deferred signal abort', async () => {
    const controller = new AbortController();
    let pageCancellationRequested = false;
    let commitCalls = 0;
    let finishPreparation!: (value: { id: string }) => void;
    const prepared = new Promise<{ id: string }>((resolve) => { finishPreparation = resolve; });

    const execution = prepareCancellableCommit({
      signal: controller.signal,
      cancellationRequested: () => pageCancellationRequested,
      prepare: () => prepared,
      commit: (value) => {
        commitCalls += 1;
        return value;
      },
    });

    pageCancellationRequested = true;
    finishPreparation({ id: 'must_not_commit' });

    await assert.rejects(execution, { name: 'AbortError' });
    assert.equal(controller.signal.aborted, false, 'the compatibility signal abort may still be deferred');
    assert.equal(commitCalls, 0);
  });

  test('rejects a prepared commit after the shared page revision changes', () => {
    assert.doesNotThrow(() => requireCurrentStateRevision(7, 7));
    assert.throws(
      () => requireCurrentStateRevision(7, 8, { expected_experiment_id: 'exp_original' }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { code?: string }).code, 'STALE_STATE');
        assert.deepEqual((error as { details?: Record<string, unknown> }).details, {
          expected_state_revision: 7,
          actual_state_revision: 8,
          recovery_tool: 'inspect_flylab_state',
          expected_experiment_id: 'exp_original',
        });
        return true;
      },
    );
  });

  test('rejects an asynchronous approval check when the shared revision changes during hashing', async () => {
    let currentRevision = 7;
    let actualExperimentId = 'exp_approved';
    let finishVerification!: (value: boolean) => void;
    const verification = new Promise<boolean>((resolve) => { finishVerification = resolve; });

    const guardedVerification = verifyAtCurrentStateRevision({
      expectedRevision: 7,
      getCurrentRevision: () => currentRevision,
      verify: () => verification,
      details: () => ({
        expected_experiment_id: 'exp_approved',
        actual_experiment_id: actualExperimentId,
        expected_protocol_hash: `sha256:${'a'.repeat(64)}`,
      }),
    });

    currentRevision = 8;
    actualExperimentId = 'exp_revised';
    finishVerification(true);

    await assert.rejects(
      guardedVerification,
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'STALE_STATE');
        assert.deepEqual((error as { details?: Record<string, unknown> }).details, {
          expected_state_revision: 7,
          actual_state_revision: 8,
          recovery_tool: 'inspect_flylab_state',
          expected_experiment_id: 'exp_approved',
          actual_experiment_id: 'exp_revised',
          expected_protocol_hash: `sha256:${'a'.repeat(64)}`,
        });
        return true;
      },
    );
  });

  test('returns an asynchronous verification result only while its revision remains current', async () => {
    const result = await verifyAtCurrentStateRevision({
      expectedRevision: 7,
      getCurrentRevision: () => 7,
      verify: async () => ({ protocol_hash: `sha256:${'b'.repeat(64)}` }),
    });

    assert.deepEqual(result, { protocol_hash: `sha256:${'b'.repeat(64)}` });
  });
});
