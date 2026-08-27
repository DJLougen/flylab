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
  discoveryDecisionId: null,
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
  approvalExperimentId: null,
  approvedProtocolHash: null,
  approvedSeedManifestHash: null,
  approvalTimestamp: null,
  conditionIds: [],
  batchId: null,
  analysisIds: [],
  analysisMetricsById: {},
  comparisonId: null,
  comparisonAnalysisIds: [],
  bundleId: null,
  nextTrialBudget: 5,
  artifactManifest: {},
};

describe('FlyLab inline agent handoff', () => {
  test('separates workflow recommendation from browser-local invocability in every transport state', () => {
    const context = buildFlyLabAgentContext(initialSnapshot);
    const expected = {
      checking: { status: 'checking', registered: null, available: false, pageHandler: false, client: 'unavailable', invocable: null, callable: false, blocker: 'webmcp_availability_checking' },
      active: { status: 'active', registered: 8, available: null, pageHandler: true, client: 'unknown_to_page', invocable: null, callable: false, blocker: 'webmcp_client_availability_unconfirmed' },
      unsupported: { status: 'unsupported', registered: 0, available: false, pageHandler: false, client: 'unavailable', invocable: null, callable: false, blocker: 'webmcp_unavailable_in_this_browser' },
      failed: { status: 'registration_failed', registered: 0, available: false, pageHandler: false, client: 'unavailable', invocable: null, callable: false, blocker: 'webmcp_registration_failed' },
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
      assert.equal(transport.page_invocation_handler_available, wanted.pageHandler);
      assert.equal(transport.webmcp_invocation_observed, false);
      assert.equal(transport.webmcp_client_availability, wanted.client);
      assert.equal(transport.invocable_next_tool, wanted.invocable);
      assert.equal(transport.invocable_next_action.callable, wanted.callable);
      assert.equal(transport.invocable_next_action.blocked_by, wanted.blocker);
      assert.equal(packet.agent_context.workflow_next_tool, 'find_fly_circuits');
      assert.equal(packet.agent_context.next_tool, wanted.invocable);
      assert.equal(packet.agent_context.next_action.workflow_preconditions_satisfied, true);
      assert.equal(packet.agent_context.next_action.workflow_blocked_by, null);
      assert.equal(packet.agent_context.next_action.callable, wanted.callable);
      assert.equal(packet.agent_context.next_action.blocked_by, wanted.blocker);
      assert.equal(packet.agent_context.next_action.callability_scope, 'current_page_transport_and_workflow_state');
      assert.equal(transport.fallback.mutation_available, false);
      assert.equal(transport.fallback.browser_documentation_url, '/agent');
      assert.match(transport.execution_note, wanted.pageHandler ? /inspect_flylab_state/ : /not a fallback transport/i);
    }

    const unsupported = buildFlyLabAgentHandoff(context, 'unsupported');
    assert.equal(unsupported.agent_context.schema_version, 'flylab.agent-context.v3');
    assert.deepEqual(unsupported.agent_context.artifact_manifest, {});
    assert.match(unsupported.agent_context.provenance_policy.inheritance, /artifact_manifest/);
    assert.deepEqual(unsupported.trust.untrusted_human_fields, ['agent_context.state.goal']);
  });

  test('publishes exact capability evidence and separately records an observed WebMCP callback', () => {
    const context = buildFlyLabAgentContext(initialSnapshot);
    const diagnostic = {
      schema_version: 'flylab.webmcp-capability-diagnostic.v1' as const,
      document_ready_state: 'complete',
      secure_context: true,
      origin_agent_cluster: true,
      permissions_policy_tools_allowed: true,
      document_model_context_present: false,
      register_tool_type: 'undefined',
      registration_attempted: false,
      registrations_accepted_before_rollback: 0,
      failed_tool_name: null,
      registration_error_name: null,
      registration_error: null,
      availability_reason: 'document_model_context_absent' as const,
    };

    const unsupported = buildFlyLabAgentHandoff(context, 'unsupported', diagnostic);
    assert.deepEqual(unsupported.transport.capability_diagnostic, diagnostic);
    assert.equal(unsupported.transport.page_registration_status, 'api_unavailable');
    assert.equal(unsupported.transport.webmcp_invocation_observed, false);
    assert.equal(unsupported.transport.webmcp_client_availability, 'unavailable');

    const observed = buildFlyLabAgentHandoff(context, 'active', undefined, true, 'session_test');
    assert.equal(observed.transport.page_session_id, 'session_test');
    assert.equal(observed.transport.page_registration_status, 'registered');
    assert.equal(observed.transport.agent_invocation_available, true);
    assert.equal(observed.transport.webmcp_invocation_observed, true);
    assert.equal(observed.transport.webmcp_client_availability, 'invocation_observed_this_page_session');
    assert.equal(observed.transport.invocable_next_tool, 'find_fly_circuits');
    assert.equal(observed.agent_context.next_tool, 'find_fly_circuits');
    assert.equal(observed.agent_context.next_action.callable, true);
    assert.equal(observed.agent_context.next_action.blocked_by, null);
    assert.match(observed.transport.execution_note, /tool callback has been observed/i);

    const rolledBackAfterObservation = buildFlyLabAgentHandoff(context, 'failed', undefined, true, 'session_test');
    assert.equal(rolledBackAfterObservation.transport.webmcp_invocation_observed, true);
    assert.equal(rolledBackAfterObservation.transport.webmcp_client_availability, 'unavailable');
    assert.equal(rolledBackAfterObservation.transport.agent_invocation_available, false);
    assert.equal(rolledBackAfterObservation.transport.invocable_next_tool, null);
    assert.equal(rolledBackAfterObservation.transport.invocable_next_action.callable, false);
    assert.equal(rolledBackAfterObservation.transport.invocable_next_action.blocked_by, 'webmcp_registration_failed');
    assert.equal(rolledBackAfterObservation.agent_context.next_tool, null);
    assert.equal(rolledBackAfterObservation.agent_context.next_action.callable, false);
    assert.equal(rolledBackAfterObservation.agent_context.next_action.blocked_by, 'webmcp_registration_failed');
  });

  test('preserves a workflow-owned blocker when the next action is not a WebMCP tool', () => {
    const waitingForHuman = buildFlyLabAgentContext({
      ...initialSnapshot,
      discoveryDecisionId: 'discovery_test',
      selectedCircuitId: 'circuit_gf_adult',
      hypothesisId: 'hyp_test',
      hypothesisPredictedBehavior: 'short_mode_escape',
      hypothesisPerturbation: 'activate',
      experimentId: 'exp_test',
      conditionIds: ['condition_baseline', 'condition_sham', 'condition_bilateral'],
    });
    const packet = buildFlyLabAgentHandoff(waitingForHuman, 'unsupported');

    assert.equal(packet.workflow_recommendation.kind, 'human_gate');
    assert.equal(packet.transport.invocable_next_tool, null);
    assert.equal(packet.transport.invocable_next_action.callable, false);
    assert.equal(packet.transport.invocable_next_action.blocked_by, 'human_approval');
    assert.equal(packet.agent_context.next_action.workflow_preconditions_satisfied, false);
    assert.equal(packet.agent_context.next_action.callable, false);
    assert.equal(packet.agent_context.next_action.blocked_by, 'human_approval');
  });
});
