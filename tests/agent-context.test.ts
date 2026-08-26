import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  FLYLAB_AGENT_CONTEXT_VERSION,
  buildFlyLabAgentContext,
  type FlyLabAgentSnapshot,
} from '../lib/agent-context.js';

const baseSnapshot: FlyLabAgentSnapshot = {
  revision: 12,
  stage: 'discover',
  goal: 'Investigate adult MDN-driven backward walking.',
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

function context(overrides: Partial<FlyLabAgentSnapshot> = {}) {
  return buildFlyLabAgentContext({ ...baseSnapshot, ...overrides });
}

describe('FlyLab agent context', () => {
  test('returns a fixed, versioned recovery contract without changing the revision', () => {
    const result = context();

    assert.equal(result.schema_version, FLYLAB_AGENT_CONTEXT_VERSION);
    assert.equal(result.page_session_scope, 'current_open_page');
    assert.equal(result.state.revision, baseSnapshot.revision);
    assert.equal(result.state.goal, baseSnapshot.goal);
    assert.equal(result.agent_status, 'ready');
    assert.equal(result.next_tool, 'find_fly_circuits');
    assert.equal(result.next_action.kind, 'tool');
    assert.equal(result.next_action.callable, true);
    assert.equal(result.artifacts.selected_circuit_id, null);
    assert.deepEqual(result.artifacts.discovered_evidence_ids, []);
    assert.deepEqual(result.artifacts.hypothesis_eligible_evidence_ids, []);
    assert.deepEqual(result.artifacts.causal_evidence_ids_by_perturbation, { activate: [], silence: [] });
    assert.deepEqual(result.artifacts.hypothesis_evidence_ids, []);
    assert.equal(result.artifacts.experiment_id, null);
    assert.deepEqual(result.artifacts.condition_ids, []);
    assert.deepEqual(result.artifacts.analysis_ids, []);
    assert.deepEqual(result.artifacts.analysis_metrics_by_id, {});
    assert.deepEqual(result.artifacts.comparison_analysis_ids, []);
    assert.equal(result.artifacts.evidence_bundle_id, null);
    assert.equal(result.human_controls.next_trial_budget, 5);
    assert.equal(result.human_gate.status, 'not_applicable');
    assert.equal(result.human_gate.agent_can_satisfy, false);
    assert.equal(result.pipeline[0].name, 'inspect_flylab_state');
    assert.equal(result.pipeline[0].status, 'available');
    assert.equal(result.pipeline.length, 9);
  });

  test('derives exactly one next tool from the current artifact lineage', () => {
    const cases: Array<{
      overrides: Partial<FlyLabAgentSnapshot>;
      expected: string;
    }> = [
      {
        overrides: {
          selectedCircuitId: 'circuit_mdn_adult',
          discoveredEvidenceIds: ['E-MDN-ACTIVATION-001', 'E-DN-SCREEN-002'],
          hypothesisEligibleEvidenceIds: ['E-MDN-ACTIVATION-001'],
          causalEvidenceIdsByPerturbation: {
            activate: ['E-MDN-ACTIVATION-001'],
            silence: [],
          },
          stage: 'hypothesize',
        },
        expected: 'draft_fly_hypothesis',
      },
      {
        overrides: {
          selectedCircuitId: 'circuit_mdn_adult',
          hypothesisId: 'hyp_1',
          hypothesisPredictedBehavior: 'backward_walking',
          hypothesisPerturbation: 'activate',
          stage: 'design',
        },
        expected: 'design_stimulation_trial',
      },
      {
        overrides: {
          selectedCircuitId: 'circuit_mdn_adult',
          hypothesisId: 'hyp_1',
          experimentId: 'exp_1',
          experimentApproved: true,
          conditionIds: ['condition_baseline', 'condition_bilateral'],
          stage: 'run',
        },
        expected: 'run_fly_simulation',
      },
      {
        overrides: {
          selectedCircuitId: 'circuit_mdn_adult',
          hypothesisId: 'hyp_1',
          experimentId: 'exp_1',
          experimentApproved: true,
          batchId: 'batch_1',
          stage: 'analyze',
        },
        expected: 'analyze_fly_behavior',
      },
      {
        overrides: {
          selectedCircuitId: 'circuit_mdn_adult',
          hypothesisId: 'hyp_1',
          experimentId: 'exp_1',
          experimentApproved: true,
          batchId: 'batch_1',
          analysisIds: ['analysis_1'],
          analysisMetricsById: { analysis_1: ['backward_distance_mm'] },
          stage: 'continue',
        },
        expected: 'compare_fly_trials',
      },
      {
        overrides: {
          selectedCircuitId: 'circuit_mdn_adult',
          hypothesisId: 'hyp_1',
          experimentId: 'exp_1',
          experimentApproved: true,
          batchId: 'batch_1',
          analysisIds: ['analysis_1'],
          analysisMetricsById: { analysis_1: ['backward_distance_mm'] },
          comparisonId: 'comparison_1',
          comparisonAnalysisIds: ['analysis_1'],
          stage: 'continue',
        },
        expected: 'save_fly_evidence',
      },
    ];

    for (const item of cases) {
      const result = context(item.overrides);
      assert.equal(result.agent_status, 'ready');
      assert.equal(result.next_action.kind, 'tool');
      assert.equal(result.next_action.callable, true);
      assert.equal(result.next_tool, item.expected);
      if (item.expected === 'draft_fly_hypothesis') {
        assert.deepEqual(result.next_action.input_refs, {
          circuit_id: 'circuit_mdn_adult',
          evidence_ids: ['E-MDN-ACTIVATION-001'],
        });
        assert.deepEqual(result.artifacts.causal_evidence_ids_by_perturbation, {
          activate: ['E-MDN-ACTIVATION-001'],
          silence: [],
        });
      }
      if (item.expected === 'design_stimulation_trial') {
        assert.deepEqual(result.next_action.input_refs, {
          hypothesis_id: 'hyp_1',
          target_circuit_id: 'circuit_mdn_adult',
          perturbation: 'activate',
        });
      }
      if (item.expected === 'save_fly_evidence') {
        assert.deepEqual(result.next_action.input_refs, {
          hypothesis_id: 'hyp_1',
          experiment_id: 'exp_1',
          batch_ids: ['batch_1'],
          analysis_ids: ['analysis_1'],
          comparison_id: 'comparison_1',
        });
      }
    }
  });

  test('stops at the visible non-WebMCP review gate for every unapproved experiment', () => {
    const result = context({
      selectedCircuitId: 'circuit_mdn_adult',
      hypothesisId: 'hyp_1',
      experimentId: 'exp_revised',
      experimentApproved: false,
      conditionIds: ['condition_baseline', 'condition_sham', 'condition_bilateral'],
      stage: 'design',
    });

    assert.equal(result.agent_status, 'waiting_for_human');
    assert.equal(result.next_tool, null);
    assert.equal(result.next_action.kind, 'human_gate');
    assert.equal(result.next_action.callable, false);
    assert.equal(result.next_action.blocked_by, 'human_approval');
    assert.equal(result.human_gate.status, 'required');
    assert.equal(result.human_gate.subject_experiment_id, 'exp_revised');
    assert.equal(result.human_gate.blocks_tool, 'run_fly_simulation');
    assert.equal(result.pipeline.find((step) => step.name === 'human_approval')?.status, 'human_required');
    assert.equal(result.pipeline.find((step) => step.name === 'run_fly_simulation')?.status, 'blocked');
  });

  test('reports a running invocation as wait, never as another callable tool', () => {
    const result = context({
      selectedCircuitId: 'circuit_mdn_adult',
      hypothesisId: 'hyp_1',
      experimentId: 'exp_1',
      experimentApproved: true,
      simulationRunning: true,
      stage: 'run',
    });

    assert.equal(result.agent_status, 'running');
    assert.equal(result.next_tool, null);
    assert.equal(result.next_action.kind, 'wait');
    assert.equal(result.next_action.callable, false);
    assert.equal(result.pipeline.find((step) => step.name === 'run_fly_simulation')?.status, 'running');
  });

  test('reports evidence preparation as wait instead of advertising a duplicate save', () => {
    const result = context({
      selectedCircuitId: 'circuit_mdn_adult',
      hypothesisId: 'hyp_1',
      experimentId: 'exp_1',
      experimentApproved: true,
      batchId: 'batch_1',
      analysisIds: ['analysis_1'],
      comparisonId: 'comparison_1',
      comparisonAnalysisIds: ['analysis_1'],
      evidenceSaveRunning: true,
      stage: 'continue',
    });

    assert.equal(result.agent_status, 'running');
    assert.equal(result.next_tool, null);
    assert.equal(result.next_action.kind, 'wait');
    assert.equal(result.next_action.callable, false);
    assert.match(result.next_action.reason, /Wait for the evidence bundle/);
    assert.equal(result.pipeline.find((step) => step.name === 'save_fly_evidence')?.status, 'running');
  });

  test('derives stage from the deepest retained artifact and prioritizes an active repeat save', () => {
    const result = context({
      selectedCircuitId: 'circuit_mdn_adult',
      hypothesisId: 'hyp_1',
      experimentId: 'exp_1',
      experimentApproved: true,
      batchId: 'batch_1',
      analysisIds: ['analysis_1'],
      comparisonId: 'comparison_1',
      comparisonAnalysisIds: ['analysis_1'],
      bundleId: 'evidence_1',
      evidenceSaveRunning: true,
      stage: 'hypothesize',
    });

    assert.equal(result.state.stage, 'saved');
    assert.equal(result.agent_status, 'running');
    assert.equal(result.next_action.kind, 'wait');
    assert.equal(result.pipeline.find((step) => step.name === 'save_fly_evidence')?.status, 'running');
  });

  test('reports completion only after the evidence bundle exists', () => {
    const result = context({
      selectedCircuitId: 'circuit_mdn_adult',
      hypothesisId: 'hyp_1',
      experimentId: 'exp_1',
      experimentApproved: true,
      batchId: 'batch_1',
      analysisIds: ['analysis_1'],
      comparisonId: 'comparison_1',
      bundleId: 'evidence_1',
      stage: 'saved',
    });

    assert.equal(result.agent_status, 'complete');
    assert.equal(result.next_tool, null);
    assert.equal(result.next_action.kind, 'complete');
    assert.equal(result.next_action.callable, false);
    assert.equal(result.artifacts.evidence_bundle_id, 'evidence_1');
    assert.equal(result.pipeline.at(-1)?.status, 'complete');
  });
});
