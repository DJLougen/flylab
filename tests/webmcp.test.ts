import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';

import {
  FLYLAB_ERROR_CODES,
  flyLabToolContracts,
  installFlyLabWebMCP,
  prepareCancellableCommit,
  requireCurrentStateRevision,
  validateToolInput,
  type FlyLabToolAction,
} from '../lib/webmcp.js';
import { flyLabAgentContractDocument } from '../lib/agent-contract-document.js';

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

  test('publishes a machine-readable manifest synchronized with the live WebMCP tool surface', () => {
    const manifest = JSON.parse(readFileSync('public/flylab-agent-manifest.json', 'utf8')) as {
      schema_version?: string;
      transport?: { required_first_call?: string; state_contract?: string; tool_contract_document?: string };
      discovery?: {
        contract_url?: string;
        webmcp_standard_discovery?: boolean;
        inline_state_selector?: string;
        inline_runtime_selector?: string;
        inline_handoff_selector?: string;
        unsupported_browser_behavior?: string;
      };
      tools?: Array<{ name?: string }>;
      supervisor_gate?: { webmcp_tool?: boolean; blocks?: string };
      hypothesis_evidence_gate?: {
        required_role?: string;
        required_support_kind?: string;
        must_match?: string[];
        supplemental_only?: string[];
        excluded?: string[];
      };
    };

    assert.equal(manifest.schema_version, 'flylab.agent-manifest.v1');
    assert.equal(manifest.transport?.required_first_call, 'inspect_flylab_state');
    assert.equal(manifest.transport?.state_contract, 'flylab.agent-context.v1');
    assert.equal(manifest.transport?.tool_contract_document, '/flylab-tool-contracts.json');
    assert.equal(manifest.discovery?.contract_url, '/flylab-tool-contracts.json');
    assert.equal(manifest.discovery?.webmcp_standard_discovery, false);
    assert.equal(manifest.discovery?.inline_state_selector, '#flylab-agent-context');
    assert.equal(manifest.discovery?.inline_runtime_selector, '#flylab-agent-runtime');
    assert.equal(manifest.discovery?.inline_handoff_selector, '#flylab-agent-handoff');
    assert.match(manifest.discovery?.unsupported_browser_behavior ?? '', /does not polyfill WebMCP/i);
    assert.deepEqual(manifest.tools?.map((tool) => tool.name).sort(), expectedNames);
    assert.equal(manifest.supervisor_gate?.webmcp_tool, false);
    assert.equal(manifest.supervisor_gate?.blocks, 'run_fly_simulation');
    assert.deepEqual(manifest.hypothesis_evidence_gate, {
      required_role: 'hypothesis_support',
      required_support_kind: 'perturbation_effect',
      must_match: ['perturbation', 'predicted_behavior'],
      supplemental_only: ['structural_path', 'specimen_inventory', 'motor_context'],
      excluded: ['model_context', 'catalog_context'],
    });
  });

  test('derives a complete public contract document from the registered tool source', () => {
    assert.equal(flyLabAgentContractDocument.schema_version, 'flylab.webmcp-contracts.v1');
    assert.equal(flyLabAgentContractDocument.transport.required_first_call, 'inspect_flylab_state');
    assert.match(flyLabAgentContractDocument.transport.execution_note, /not a fallback transport/i);
    assert.deepEqual(flyLabAgentContractDocument.result_contract.domain_error_codes, FLYLAB_ERROR_CODES);
    assert.deepEqual(
      flyLabAgentContractDocument.tools,
      flyLabToolContracts.map((contract) => ({
        name: contract.name,
        title: contract.title,
        description: contract.description,
        annotations: contract.annotations,
        input_schema: contract.inputSchema,
      })),
    );
    assert.equal(flyLabAgentContractDocument.tools.length, 8);
    for (const tool of flyLabAgentContractDocument.tools) {
      assert.equal(tool.input_schema.type, 'object');
      assert.equal(tool.input_schema.additionalProperties, false);
    }
  });

  test('requires baseline and model-sham controls in every trial design', () => {
    const input = {
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
        batch_id: 'batch_1',
        metrics: ['backward_distance_mm'],
      }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_INPUT');
        return true;
      },
    );

    assert.doesNotThrow(() => validateToolInput('analyze_fly_behavior', {
      batch_id: 'batch_1',
      metrics: ['backward_distance_mm', 'signed_speed_mm_s', 'response_latency_ms', 'heading_change_deg', 'stance_stability'],
    }));
    assert.doesNotThrow(() => validateToolInput('draft_fly_hypothesis', {
      circuit_id: 'circuit_mdn_adult',
      claim: 'MDN activation will increase predicted backward walking.',
      predicted_behavior: 'backward_walking',
      perturbation: 'activate',
      evidence_ids: Array.from({ length: 9 }, (_, index) => `evidence_${index}`),
      falsification_criterion: 'No predicted increase over controls.',
    }));
    assert.doesNotThrow(() => validateToolInput('draft_fly_hypothesis', {
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
    const predictedBehavior = hypothesisContract?.inputSchema.properties.predicted_behavior as { enum?: readonly string[] };
    assert.ok(searchBehavior.enum?.includes('retreat'));
    assert.ok(predictedBehavior.enum?.includes('retreat'));
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
    assert.doesNotThrow(() => result.dispose());
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
      stateRevision: 1,
    });
    const actions = Object.fromEntries(
      expectedNames.map((name) => [name, action]),
    );

    const installation = await installFlyLabWebMCP(actions);

    assert.equal(installation.supported, true);
    assert.equal(registrations.length, 8);
    assert.deepEqual(
      registrations.map(({ tool }) => tool.name).sort(),
      expectedNames,
    );
    assert.ok(registrations.every(({ signal }) => signal instanceof AbortSignal));
    assert.ok(registrations.every(({ signal }) => signal?.aborted === false));
    assert.equal(new Set(registrations.map(({ signal }) => signal)).size, 1);

    const discovery = registrations.find(({ tool }) => tool.name === 'find_fly_circuits');
    assert.ok(discovery);
    const result = await discovery.tool.execute(
      { query: 'MDN', behavior: 'backward_walking' },
    ) as {
      isError?: boolean;
      structuredContent?: { ok?: boolean; tool?: string; summary?: string };
    };
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent?.ok, true);
    assert.equal(result.structuredContent?.tool, 'find_fly_circuits');
    assert.equal(result.structuredContent?.summary, 'ok');

    const inspector = registrations.find(({ tool }) => tool.name === 'inspect_flylab_state');
    assert.ok(inspector);
    const inspection = await inspector.tool.execute({}) as {
      isError?: boolean;
      structuredContent?: { ok?: boolean; tool?: string };
    };
    assert.notEqual(inspection.isError, true);
    assert.equal(inspection.structuredContent?.ok, true);
    assert.equal(inspection.structuredContent?.tool, 'inspect_flylab_state');

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
        stateRevision: 2,
      };
    };
    const callController = new AbortController();
    callController.abort();
    await assert.rejects(
      discovery.tool.execute(
        { query: 'MDN', behavior: 'backward_walking' },
        { signal: callController.signal },
      ),
      { name: 'AbortError' },
    );
    assert.equal(cancelledActionCalls, 0, 'a pre-cancelled invocation must not start its action');

    const postCommitController = new AbortController();
    actions.find_fly_circuits = async () => {
      cancelledActionCalls += 1;
      postCommitController.abort(new DOMException('cancel arrived after commit', 'AbortError'));
      return {
        summary: 'committed before cancellation became observable',
        data: { committed: true },
        provenance: ['derived'],
        stateRevision: 3,
      };
    };
    const postCommitResult = await discovery.tool.execute(
      { query: 'MDN', behavior: 'backward_walking' },
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
          throw new Error('schema rejected');
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
      stateRevision: 1,
    });
    const actions = Object.fromEntries(
      expectedNames.map((name) => [name, action]),
    );

    await assert.rejects(
      installFlyLabWebMCP(actions),
      /WebMCP registration failed for design_stimulation_trial: schema rejected/,
    );
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
});
