import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  EVIDENCE,
  analyzeBatch,
  compareAnalyses,
  designExperiment,
  makeHypothesis,
  simulateExperiment,
  type Experiment,
  type ProvenanceLabel,
} from '../lib/flylab.js';

const baseExperimentInput = {
  hypothesisId: 'hyp_mdn_backward_walking',
  targetCircuitId: 'circuit_mdn_adult',
  perturbation: 'activate' as const,
  laterality: 'bilateral' as const,
  activationLevel: 0.72,
  onsetMs: 900,
  durationMs: 1800,
  trialDurationMs: 5000,
  replicates: 6,
  includeBaseline: true,
  includeShamControl: true,
  seed: 424242,
};

function makeExperiment(overrides: Partial<typeof baseExperimentInput> = {}): Experiment {
  return designExperiment({ ...baseExperimentInput, ...overrides });
}

describe('FlyLab reduced-order simulation', () => {
  test('the same protocol and seed reproduce the identical batch', () => {
    const first = simulateExperiment(makeExperiment());
    const second = simulateExperiment(makeExperiment());

    assert.deepEqual(second, first);
    assert.equal(second.id, first.id);
    assert.equal(second.runHash, first.runHash);
    assert.deepEqual(
      second.conditionRuns.flatMap((condition) => condition.replicates.map((run) => run.seed)),
      first.conditionRuns.flatMap((condition) => condition.replicates.map((run) => run.seed)),
    );
  });

  test('changing only the seed changes the generated runs and trajectories', () => {
    const first = simulateExperiment(makeExperiment({ seed: 424242 }));
    const second = simulateExperiment(makeExperiment({ seed: 424243 }));

    assert.notEqual(second.id, first.id);
    assert.notEqual(second.runHash, first.runHash);
    assert.notDeepEqual(second.conditionRuns, first.conditionRuns);
    assert.notDeepEqual(
      second.conditionRuns[0]?.trajectory,
      first.conditionRuns[0]?.trajectory,
    );
  });

  test('records the protocol and marks target drive only in perturbation windows', () => {
    const experiment = makeExperiment();
    const batch = simulateExperiment(experiment);
    const byCondition = new Map(batch.conditionRuns.map((run) => [run.conditionId, run]));

    assert.deepEqual(batch.protocol, {
      onsetMs: experiment.onsetMs,
      durationMs: experiment.durationMs,
      trialDurationMs: experiment.trialDurationMs,
      replicates: experiment.replicates,
      seed: experiment.seed,
    });
    assert.ok(byCondition.get('condition_baseline')?.trajectory.every((point) => !point.active));
    assert.ok(byCondition.get('condition_sham')?.trajectory.every((point) => !point.active));
    assert.ok(byCondition.get('condition_bilateral')?.trajectory.some((point) => point.active));
    assert.ok(byCondition.get('condition_bilateral')?.trajectory
      .filter((point) => point.active)
      .every((point) => point.t >= experiment.onsetMs && point.t <= experiment.onsetMs + experiment.durationMs));
  });

  test('bilateral experiment design includes baseline, sham, primary, and unilateral controls', () => {
    const experiment = makeExperiment();
    const conditions = new Map(
      experiment.conditions.map((condition) => [condition.id, condition]),
    );

    assert.equal(experiment.approved, false);
    assert.equal(new Set(experiment.conditions.map((condition) => condition.id)).size, 5);
    assert.deepEqual(
      experiment.conditions.map((condition) => condition.id),
      [
        'condition_baseline',
        'condition_sham',
        'condition_bilateral',
        'condition_left',
        'condition_right',
      ],
    );
    assert.deepEqual(conditions.get('condition_baseline'), {
      id: 'condition_baseline',
      label: 'Baseline · no model drive',
      kind: 'baseline',
      laterality: 'none',
      activationLevel: 0,
    });
    assert.deepEqual(conditions.get('condition_sham'), {
      id: 'condition_sham',
      label: 'Model sham control',
      kind: 'sham',
      laterality: 'none',
      activationLevel: baseExperimentInput.activationLevel,
    });
    assert.equal(conditions.get('condition_bilateral')?.kind, 'perturbation');
    assert.equal(conditions.get('condition_left')?.laterality, 'left');
    assert.equal(conditions.get('condition_right')?.laterality, 'right');
  });
});

describe('FlyLab provenance', () => {
  test('evidence and every generated stage use only the five declared provenance labels', () => {
    const allowed = new Set<ProvenanceLabel>([
      'measured',
      'derived',
      'connectome_inferred',
      'simulation_predicted',
      'agent_hypothesized',
    ]);

    const hypothesis = makeHypothesis({
      circuitId: 'circuit_mdn_adult',
      claim: 'Bilateral MDN activation will increase backward walking.',
      predictedBehavior: 'backward_walking',
      perturbation: 'activate',
      evidenceIds: ['E-MDN-ACTIVATION-001'],
      falsificationCriterion: 'No increase over baseline in backward distance.',
    });
    const batch = simulateExperiment(makeExperiment({ hypothesisId: hypothesis.id }));
    const analysis = analyzeBatch(batch, [
      'backward_distance_mm',
      'signed_speed_mm_s',
      'response_latency_ms',
    ]);
    const comparison = compareAnalyses(
      [analysis],
      'backward_distance_mm',
      'maximize',
      undefined,
      5,
    );

    const observed: ProvenanceLabel[] = [
      ...EVIDENCE.map((record) => record.provenance),
      hypothesis.provenance,
      ...batch.provenance,
      ...analysis.provenance,
      comparison.proposal.provenance,
    ];

    assert.ok(observed.every((label) => allowed.has(label)));
    assert.deepEqual(new Set(EVIDENCE.map((record) => record.provenance)), new Set([
      'measured',
      'derived',
      'connectome_inferred',
      'simulation_predicted',
    ]));
    assert.deepEqual(batch.provenance, ['simulation_predicted']);
    assert.deepEqual(analysis.provenance, ['derived', 'simulation_predicted']);
    assert.equal(hypothesis.provenance, 'agent_hypothesized');
    assert.equal(comparison.proposal.provenance, 'agent_hypothesized');
  });
});
