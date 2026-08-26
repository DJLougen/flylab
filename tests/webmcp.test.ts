import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  flyLabToolContracts,
  installFlyLabWebMCP,
  type FlyLabToolAction,
} from '../lib/webmcp.js';

const expectedNames = [
  'analyze_fly_behavior',
  'compare_fly_trials',
  'design_stimulation_trial',
  'draft_fly_hypothesis',
  'find_fly_circuits',
  'run_fly_simulation',
  'save_fly_evidence',
];

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

describe('FlyLab WebMCP contracts', () => {
  test('exposes exactly the seven intended, uniquely named scientific tools', () => {
    const names = flyLabToolContracts.map((contract) => contract.name);

    assert.equal(flyLabToolContracts.length, 7);
    assert.equal(new Set(names).size, 7);
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
    assert.deepEqual(annotations.find_fly_circuits, {
      readOnlyHint: true,
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
      ['draft_fly_hypothesis', 'find_fly_circuits', 'save_fly_evidence'],
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
  test('registers and invokes all seven contracts, then unregisters them on dispose', async () => {
    const registrations: Array<{
      tool: {
        name: string;
        annotations?: Record<string, boolean>;
        execute(input: unknown, context: { signal: AbortSignal }): Promise<unknown>;
      };
      signal?: AbortSignal;
    }> = [];
    const modelContext = {
      async registerTool(
        tool: {
          name: string;
          annotations?: Record<string, boolean>;
          execute(input: unknown, context: { signal: AbortSignal }): Promise<unknown>;
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
    assert.equal(registrations.length, 7);
    assert.deepEqual(
      registrations.map(({ tool }) => tool.name).sort(),
      expectedNames,
    );
    assert.ok(registrations.every(({ signal }) => signal instanceof AbortSignal));
    assert.ok(registrations.every(({ signal }) => signal?.aborted === false));
    assert.equal(new Set(registrations.map(({ signal }) => signal)).size, 1);

    const discovery = registrations.find(({ tool }) => tool.name === 'find_fly_circuits');
    assert.ok(discovery);
    const callController = new AbortController();
    const result = await discovery.tool.execute(
      { query: 'MDN', behavior: 'backward_walking' },
      { signal: callController.signal },
    ) as {
      isError?: boolean;
      structuredContent?: { ok?: boolean; tool?: string; summary?: string };
    };
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent?.ok, true);
    assert.equal(result.structuredContent?.tool, 'find_fly_circuits');
    assert.equal(result.structuredContent?.summary, 'ok');

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
    assert.equal(registrationSignals.length, 3);
    assert.equal(new Set(registrationSignals).size, 1);
    assert.ok(registrationSignals.every((signal) => signal.aborted));
  });
});
