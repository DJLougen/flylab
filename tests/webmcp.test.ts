import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  flyLabToolContracts,
  installFlyLabWebMCP,
  prepareCancellableCommit,
  type FlyLabToolAction,
} from '../lib/webmcp.js';

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
});

describe('FlyLab WebMCP registration lifecycle', () => {
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
});
