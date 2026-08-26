import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import {
  CIRCUITS,
  EVIDENCE,
  MODEL_PARAMETERS,
  analyzeBatch,
  circuitSupportsBehavior,
  compareAnalyses,
  designExperiment,
  evidenceBundleTitle,
  makeHypothesis,
  simulateExperiment,
  type Experiment,
  type ProvenanceLabel,
} from '../lib/flylab.js';

type ExperimentInput = Parameters<typeof designExperiment>[0];

const baseExperimentInput: ExperimentInput = {
  hypothesisId: 'hyp_mdn_backward_walking',
  targetCircuitId: 'circuit_mdn_adult',
  perturbation: 'activate',
  laterality: 'bilateral',
  activationLevel: 0.72,
  onsetMs: 900,
  durationMs: 1800,
  trialDurationMs: 5000,
  replicates: 6,
  includeBaseline: true,
  includeShamControl: true,
  seed: 424242,
};

function makeExperiment(overrides: Partial<ExperimentInput> = {}): Experiment {
  return designExperiment({ ...baseExperimentInput, ...overrides });
}

describe('FlyLab bounded circuit catalog', () => {
  test('accepts only behaviors declared by the selected circuit', () => {
    assert.equal(circuitSupportsBehavior('circuit_mdn_adult', 'backward_walking'), true);
    assert.equal(circuitSupportsBehavior('circuit_mdn_adult', 'retreat'), true);
    assert.equal(circuitSupportsBehavior('circuit_mdn_adult', 'grooming'), false);
    assert.equal(circuitSupportsBehavior('missing_circuit', 'backward_walking'), false);
  });

  test('names evidence bundles from the actual perturbation and behavior', () => {
    assert.equal(
      evidenceBundleTitle('activate', 'backward_walking'),
      'MDN-inspired drive and predicted backward walking',
    );
    assert.equal(
      evidenceBundleTitle('silence', 'retreat'),
      'MDN-inspired suppression and predicted retreat',
    );
  });
});

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

  test('defines response latency from nominal onset and removes pre-onset time from distance', () => {
    const early = simulateExperiment(makeExperiment({ onsetMs: 0 }));
    const late = simulateExperiment(makeExperiment({ onsetMs: 1000 }));
    const earlyReplicates = early.conditionRuns.flatMap((condition) => condition.replicates);
    const lateReplicates = late.conditionRuns.flatMap((condition) => condition.replicates);
    const responsivePairs = earlyReplicates
      .map((replicate, index) => [replicate, lateReplicates[index]!] as const)
      .filter((pair) => pair[0].responseLatencyMs !== null && pair[1].responseLatencyMs !== null);

    assert.ok(responsivePairs.length > 0);
    assert.ok(lateReplicates.every((replicate) => (
      replicate.responseLatencyMs === null
      || replicate.responseLatencyMs <= late.protocol.trialDurationMs - late.protocol.onsetMs
    )));
    assert.ok(responsivePairs.every(([earlyRun, lateRun]) => lateRun.backwardDistanceMm <= earlyRun.backwardDistanceMm));
    assert.ok(responsivePairs.some(([earlyRun, lateRun]) => lateRun.backwardDistanceMm < earlyRun.backwardDistanceMm));
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
      nominalControlLevel: 0,
      expectedModelEffect: 'no_retreat_drive',
    });
    assert.deepEqual(conditions.get('condition_sham'), {
      id: 'condition_sham',
      label: 'Model sham · nominal control, zero effect',
      kind: 'sham',
      laterality: 'none',
      nominalControlLevel: baseExperimentInput.activationLevel,
      expectedModelEffect: 'zero_effect_sham',
    });
    assert.equal(conditions.get('condition_bilateral')?.kind, 'perturbation');
    assert.equal(conditions.get('condition_left')?.laterality, 'left');
    assert.equal(conditions.get('condition_right')?.laterality, 'right');
  });

  test('silencing designs label every perturbation arm as suppression', () => {
    const experiment = makeExperiment({ perturbation: 'silence' });
    const labels = experiment.conditions
      .filter((condition) => condition.kind === 'perturbation')
      .map((condition) => condition.label);

    assert.ok(labels.every((label) => label.includes('suppression')));
    assert.ok(labels.every((label) => !label.includes('drive')));
  });

  test('stronger silencing reduces the hand-authored reference retreat response', () => {
    const weak = analyzeBatch(simulateExperiment(makeExperiment({
      perturbation: 'silence',
      activationLevel: 0.1,
    })), ['backward_distance_mm']);
    const strong = analyzeBatch(simulateExperiment(makeExperiment({
      perturbation: 'silence',
      activationLevel: 0.9,
    })), ['backward_distance_mm']);
    const weakPrimary = weak.conditions.find((condition) => condition.conditionId === 'condition_bilateral');
    const strongPrimary = strong.conditions.find((condition) => condition.conditionId === 'condition_bilateral');
    const weakBaseline = weak.conditions.find((condition) => condition.conditionId === 'condition_baseline');
    const strongBaseline = strong.conditions.find((condition) => condition.conditionId === 'condition_baseline');

    assert.ok(weakPrimary && strongPrimary && weakBaseline && strongBaseline);
    assert.ok(strongPrimary.reverseInitiationProbability <= weakPrimary.reverseInitiationProbability);
    assert.ok(strongPrimary.backwardDistanceMm < weakPrimary.backwardDistanceMm);
    assert.equal(strongBaseline.reverseInitiationProbability, weakBaseline.reverseInitiationProbability);
    assert.equal(strongBaseline.backwardDistanceMm, weakBaseline.backwardDistanceMm);
  });

  test('follow-up proposals inherit the actual laterality, mode, and nearby control level', () => {
    const experiment = makeExperiment({ perturbation: 'silence', laterality: 'right', activationLevel: 0.9 });
    const batch = simulateExperiment(experiment);
    const analysis = analyzeBatch(batch, ['backward_distance_mm']);
    const comparison = compareAnalyses([analysis], 'backward_distance_mm', 'maximize', undefined, 4, experiment);

    assert.match(comparison.proposal.rationale, /model-suppression/);
    assert.match(comparison.proposal.rationale, /right condition/);
    assert.match(comparison.proposal.rationale, /0\.90/);
    assert.deepEqual(comparison.proposal.activationLevels, [0.75, 1]);
    assert.equal(comparison.objective, 'maximize');
    assert.equal(comparison.objectiveMetric, 'backward_distance_mm');

    const lowerExperiment = makeExperiment({ perturbation: 'silence', laterality: 'right', activationLevel: 0.1 });
    const lowerAnalysis = analyzeBatch(simulateExperiment(lowerExperiment), ['backward_distance_mm']);
    const lowerComparison = compareAnalyses([lowerAnalysis], 'backward_distance_mm', 'maximize', undefined, 4, lowerExperiment);
    assert.notEqual(lowerComparison.proposal.id, comparison.proposal.id);
    assert.notDeepEqual(lowerComparison.proposal.activationLevels, comparison.proposal.activationLevels);
  });

  test('the experiment identity covers every person-editable protocol field', () => {
    const original = makeExperiment();
    const activationEdit = makeExperiment({ activationLevel: 0.77 });
    const durationEdit = makeExperiment({ durationMs: 2100 });
    const replicateEdit = makeExperiment({ replicates: 9 });
    const combinedEdit = makeExperiment({ durationMs: 2100, replicates: 9 });

    assert.notEqual(activationEdit.id, original.id);
    assert.notEqual(durationEdit.id, original.id);
    assert.notEqual(replicateEdit.id, original.id);
    assert.notEqual(combinedEdit.id, durationEdit.id);
    assert.notEqual(combinedEdit.id, replicateEdit.id);
    assert.equal(activationEdit.approved, false);
    assert.ok(activationEdit.conditions
      .filter((condition) => condition.kind !== 'baseline')
      .every((condition) => condition.nominalControlLevel === 0.77));
  });

  test('the shared design constructor rejects impossible timing and missing controls', () => {
    assert.throws(
      () => makeExperiment({ onsetMs: 4000, durationMs: 1500, trialDurationMs: 5000 }),
      /onset \+ duration inside the trial/,
    );
    assert.throws(() => makeExperiment({ includeBaseline: false }), /requires baseline and model-sham controls/);
    assert.throws(() => makeExperiment({ includeShamControl: false }), /requires baseline and model-sham controls/);
    assert.throws(() => makeExperiment({ onsetMs: 5001 }), /published onset/);
    assert.throws(() => makeExperiment({ durationMs: 5001, trialDurationMs: 7000 }), /published onset/);
    assert.throws(() => makeExperiment({ trialDurationMs: 10001 }), /published onset/);
    assert.throws(() => makeExperiment({ seed: -1 }), /seed must be an integer/);
    assert.throws(() => makeExperiment({ seed: 2147483648 }), /seed must be an integer/);
    assert.doesNotThrow(() => makeExperiment({ onsetMs: 5000, durationMs: 5000, trialDurationMs: 10000, seed: 2147483647 }));
  });

  test('canonicalizes metric order so equivalent analysis calls share one identity', () => {
    const batch = simulateExperiment(makeExperiment());
    const canonical = analyzeBatch(batch, [
      'backward_distance_mm',
      'signed_speed_mm_s',
      'response_latency_ms',
      'heading_change_deg',
      'stance_stability',
    ]);
    const reversed = analyzeBatch(batch, [
      'stance_stability',
      'heading_change_deg',
      'response_latency_ms',
      'signed_speed_mm_s',
      'backward_distance_mm',
    ]);

    assert.equal(reversed.id, canonical.id);
    assert.deepEqual(reversed.metrics, canonical.metrics);
    assert.deepEqual(reversed, canonical);
  });

  test('reports response latency as unavailable when no seeded run responds', () => {
    const batch = simulateExperiment(makeExperiment());
    assert.ok(batch.conditionRuns
      .flatMap((run) => run.replicates)
      .filter((replicate) => !replicate.reverseInitiated)
      .every((replicate) => replicate.responseLatencyMs === null));
    const condition = batch.conditionRuns[0];
    assert.ok(condition);
    const noResponseBatch = {
      ...batch,
      conditionRuns: [
        {
          ...condition,
          replicates: condition.replicates.map((replicate) => ({
            ...replicate,
            reverseInitiated: false,
          })),
        },
        ...batch.conditionRuns.slice(1),
      ],
    };
    const analysis = analyzeBatch(noResponseBatch, ['response_latency_ms']);
    const result = analysis.conditions.find((item) => item.conditionId === condition.conditionId);

    assert.equal(result?.responsiveN, 0);
    assert.equal(result?.responseLatencyMs, null);
  });
});

describe('FlyLab provenance', () => {
  test('canonicalizes hypothesis evidence IDs so a reordered citation set is idempotent', () => {
    const input = {
      circuitId: 'circuit_mdn_adult',
      claim: 'Bilateral MDN activation will increase backward walking.',
      predictedBehavior: 'backward_walking',
      perturbation: 'activate' as const,
      evidenceIds: ['E-BANC-PATH-003', 'E-MDN-ACTIVATION-001'],
      falsificationCriterion: 'No increase over baseline in backward distance.',
    };
    const first = makeHypothesis(input);
    const second = makeHypothesis({ ...input, evidenceIds: [...input.evidenceIds].reverse() });

    assert.equal(second.id, first.id);
    assert.deepEqual(second.evidenceIds, first.evidenceIds);
    assert.deepEqual(second.causalEvidenceIds, ['E-MDN-ACTIVATION-001']);
  });

  test('rejects structural-only and wrong-perturbation evidence as causal hypothesis support', () => {
    const base = {
      circuitId: 'circuit_mdn_adult',
      claim: 'Bilateral MDN activation will increase backward walking.',
      predictedBehavior: 'backward_walking',
      perturbation: 'activate' as const,
      falsificationCriterion: 'No increase over baseline in backward distance.',
    };

    assert.throws(() => makeHypothesis({ ...base, evidenceIds: ['E-BANC-PATH-003'] }), /perturbation_effect/);
    assert.throws(() => makeHypothesis({ ...base, evidenceIds: ['E-MDN-SILENCING-005'] }), /matching activate/);
  });

  test('keeps every claim locator closed over the evidence source IDs', () => {
    for (const record of EVIDENCE) {
      assert.deepEqual(
        [...new Set(record.sourceSupport.map((mapping) => mapping.sourceId))].sort(),
        [...record.sourceIds].sort(),
        `${record.id} sourceSupport must map every declared source exactly`,
      );
      assert.ok(record.sourceSupport.every((mapping) => mapping.locator && mapping.supports));
    }
  });

  test('keeps the model card canonical parameter block identical to the runtime model', () => {
    const modelCard = readFileSync('docs/MODEL_CARD.md', 'utf8');
    const match = modelCard.match(/<!-- MODEL_PARAMETERS_JSON_START -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- MODEL_PARAMETERS_JSON_END -->/);

    assert.ok(match, 'model card must contain the machine-checked parameter block');
    assert.deepEqual(JSON.parse(match[1]), MODEL_PARAMETERS);
  });

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
    const experiment = makeExperiment({ hypothesisId: hypothesis.id });
    const batch = simulateExperiment(experiment);
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
      ...CIRCUITS.flatMap((record) => record.provenance),
      hypothesis.provenance,
      ...experiment.provenance,
      ...batch.provenance,
      ...analysis.provenance,
      ...comparison.provenance,
      comparison.proposal.provenance,
    ];

    assert.ok(observed.every((label) => allowed.has(label)));
    assert.deepEqual(new Set(EVIDENCE.map((record) => record.provenance)), new Set([
      'measured',
      'derived',
      'connectome_inferred',
    ]));
    assert.deepEqual(batch.provenance, ['simulation_predicted']);
    assert.deepEqual(analysis.provenance, ['derived', 'simulation_predicted']);
    assert.deepEqual(CIRCUITS[0].provenance, ['derived']);
    assert.equal(hypothesis.provenance, 'agent_hypothesized');
    assert.deepEqual(experiment.provenance, ['agent_hypothesized']);
    assert.deepEqual(comparison.provenance, ['derived', 'simulation_predicted']);
    assert.equal(comparison.proposal.provenance, 'agent_hypothesized');
  });
});
