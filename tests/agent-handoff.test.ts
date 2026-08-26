import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildFlyLabAgentContext, type FlyLabAgentSnapshot } from '../lib/agent-context.js';
import { buildFlyLabAgentHandoff, type FlyLabWebMCPStatus } from '../lib/agent-handoff.js';

const initialSnapshot: FlyLabAgentSnapshot = {
  revision: 1,
  stage: 'discover',
  goal: 'Untrusted person-authored mission',
  simulationRunning: false,
  evidenceSaveRunning: false,
  selectedCircuitId: null,
  discoveredEvidenceIds: [],
  hypothesisEligibleEvidenceIds: [],
  causalEvidenceIdsByPerturbation: { activate: [], silence: [] },
  hypothesisId: null,
  hypothesisEvidenceIds: [],
  hypothesisPredictedBehavior: null,
  hypothesisPerturbation: null,
  experimentId: null,
  experimentApproved: false,
  conditionIds: [],
  batchId: null,
  analysisIds: [],
  analysisMetricsById: {},
  comparisonId: null,
  comparisonAnalysisIds: [],
  bundleId: null,
  nextTrialBudget: 5,
};

describe('FlyLab inline agent handoff', () => {
  test('separates workflow recommendation from browser-local invocability in every transport state', () => {
    const context = buildFlyLabAgentContext(initialSnapshot);
    const expected = {
      checking: { status: 'checking', registered: null, available: false, invocable: null, blocker: 'webmcp_availability_checking' },
      active: { status: 'active', registered: 8, available: true, invocable: 'find_fly_circuits', blocker: null },
      unsupported: { status: 'unsupported', registered: 0, available: false, invocable: null, blocker: 'webmcp_unavailable_in_this_browser' },
      failed: { status: 'registration_failed', registered: 0, available: false, invocable: null, blocker: 'webmcp_registration_failed' },
    } as const;

    for (const status of Object.keys(expected) as FlyLabWebMCPStatus[]) {
      const packet = buildFlyLabAgentHandoff(context, status);
      const transport = packet.transport;
      const wanted = expected[status];

      assert.equal(packet.schema_version, 'flylab.agent-handoff.v1');
      assert.equal(packet.workflow_recommendation.tool, 'find_fly_circuits');
      assert.equal(transport.workflow_next_tool, 'find_fly_circuits');
      assert.equal(transport.status, wanted.status);
      assert.equal(transport.registered_tool_count, wanted.registered);
      assert.equal(transport.agent_invocation_available, wanted.available);
      assert.equal(transport.invocable_next_tool, wanted.invocable);
      assert.equal(transport.invocable_next_action.callable, wanted.available);
      assert.equal(transport.invocable_next_action.blocked_by, wanted.blocker);
      assert.equal(transport.fallback.mutation_available, false);
      assert.match(transport.execution_note, wanted.available ? /inspect_flylab_state/ : /not a fallback transport/i);
    }

    assert.deepEqual(buildFlyLabAgentHandoff(context, 'unsupported').trust.untrusted_human_fields, ['agent_context.state.goal']);
  });
});
