import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import {
  ANALYSIS_METRICS,
  CIRCUITS,
  EMBODIED_MOTOR_MAPS,
  EVIDENCE,
  EXPERIMENT_SEED_POLICY,
  HYPOTHESIS_CONTROL_IDS,
  METRIC_DEFINITIONS,
  METRIC_LABELS,
  METRIC_METHOD_VERSION,
  MODEL_MANIFEST,
  MODEL_PARAMETERS,
  RESPONSE_INITIATION_SUMMARY_DEFINITION,
  RESPONSE_OBSERVATION_SUMMARY_DEFINITION,
  SOURCES,
  analyzeBatch,
  circuitMatchesSearch,
  circuitSupportsBehavior,
  compareAnalyses,
  computeSimulationRunContentHash,
  deriveConditionMotorDrive,
  deterministicSha256Hex,
  designExperiment,
  embodimentCoverageForCircuits,
  evidenceBundleTitle,
  illustrativeTrajectorySeedFromPolicy,
  makeHypothesis,
  rankCircuitsForSearch,
  replicateSeedFromPolicy,
  reviseExperiment,
  runTrajectorySeedFromPolicy,
  sharedAvailableObjectiveMetrics,
  simulateExperiment,
  snapshotExperimentProtocol,
  stableHash,
  takeRankedMatchesWithTies,
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
    assert.equal(circuitSupportsBehavior('circuit_gf_adult', 'short_mode_escape'), true);
    assert.equal(circuitSupportsBehavior('circuit_gf_adult', 'escape'), false);
    assert.equal(circuitSupportsBehavior('circuit_gf_adult', 'wing_depression'), false);
    assert.equal(circuitSupportsBehavior('circuit_mdn_adult', 'grooming'), false);
    assert.equal(circuitSupportsBehavior('missing_circuit', 'backward_walking'), false);
  });

  test('names evidence bundles from the actual perturbation and behavior', () => {
    assert.equal(
      evidenceBundleTitle('activate', 'backward_walking'),
      'Mapped-circuit drive and predicted backward walking',
    );
    assert.equal(
      evidenceBundleTitle('silence', 'retreat'),
      'Mapped-circuit suppression and predicted retreat',
    );
  });

  test('matches meaningful motor queries without letting stop words create false circuits', () => {
    const mdn = CIRCUITS.find((circuit) => circuit.id === 'circuit_mdn_adult')!;
    const gf = CIRCUITS.find((circuit) => circuit.id === 'circuit_gf_adult')!;

    assert.equal(circuitMatchesSearch(gf, 'control the wings'), true);
    assert.equal(circuitMatchesSearch(gf, 'giant fiber', 'short_mode_escape', 'left_wing'), true);
    assert.equal(circuitMatchesSearch(mdn, 'use the brain to move the legs'), true);
    assert.equal(circuitMatchesSearch(mdn, 'control a proboscis'), false);
    assert.equal(circuitMatchesSearch(gf, 'control a proboscis'), false);
    assert.equal(circuitMatchesSearch(mdn, 'a'), false);
    assert.equal(circuitMatchesSearch(gf, 'in'), false);
    assert.equal(circuitMatchesSearch(gf, 'of'), false);
  });

  test('ranks distinctive jump-leg and wing queries above generic leg matches', () => {
    const jumpMatches = rankCircuitsForSearch('middle leg jump');
    const wingMatches = rankCircuitsForSearch('wing escape');
    const broadMatches = rankCircuitsForSearch('leg');
    const midlegMatches = rankCircuitsForSearch('middle leg');

    assert.equal(jumpMatches[0]?.circuit.id, 'circuit_gf_adult');
    assert.ok((jumpMatches[0]?.score ?? 0) > (jumpMatches[1]?.score ?? 0));
    assert.equal(wingMatches[0]?.circuit.id, 'circuit_gf_adult');
    assert.equal(broadMatches.length, 2);
    assert.equal(broadMatches[0]?.score, broadMatches[1]?.score);
    assert.deepEqual(midlegMatches.map((match) => match.circuit.id).sort(), ['circuit_gf_adult', 'circuit_mdn_adult']);
    assert.equal(midlegMatches[0]?.score, midlegMatches[1]?.score);
    assert.equal(rankCircuitsForSearch('GF')[0]?.circuit.id, 'circuit_gf_adult');
    assert.equal(rankCircuitsForSearch('MDN backward')[0]?.circuit.id, 'circuit_mdn_adult');
  });

  test('preserves every score tie at the result limit boundary', () => {
    const ranked = [
      { id: 'alpha', score: 10 },
      { id: 'beta', score: 10 },
      { id: 'gamma', score: 4 },
    ];

    assert.deepEqual(takeRankedMatchesWithTies(ranked, 1).map((item) => item.id), ['alpha', 'beta']);
    assert.deepEqual(takeRankedMatchesWithTies(ranked, 2).map((item) => item.id), ['alpha', 'beta']);
    assert.deepEqual(takeRankedMatchesWithTies(ranked, 3).map((item) => item.id), ['alpha', 'beta', 'gamma']);
    assert.throws(() => takeRankedMatchesWithTies(ranked, 0), RangeError);
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
    assert.notEqual(second.runContentHash, first.runContentHash);
    assert.notDeepEqual(second.conditionRuns, first.conditionRuns);
    assert.notDeepEqual(
      second.conditionRuns.flatMap((condition) => condition.replicates),
      first.conditionRuns.flatMap((condition) => condition.replicates),
    );
  });

  test('records the protocol and marks target drive only in perturbation windows', () => {
    const experiment = makeExperiment();
    const batch = simulateExperiment(experiment);
    const byCondition = new Map(batch.conditionRuns.map((run) => [run.conditionId, run]));

    assert.deepEqual(batch.protocol, snapshotExperimentProtocol(experiment));
    assert.notEqual(batch.protocol.conditions, experiment.conditions);
    assert.notEqual(batch.protocol.conditions[0], experiment.conditions[0]);
    assert.notEqual(batch.protocol.assumptions, experiment.assumptions);
    assert.notEqual(batch.protocol.seedPolicy, experiment.seedPolicy);
    assert.deepEqual(experiment.seedPolicy, EXPERIMENT_SEED_POLICY);
    assert.deepEqual(batch.protocol.seedPolicy, EXPERIMENT_SEED_POLICY);
    assert.equal(experiment.metricMethodVersion, METRIC_METHOD_VERSION);
    assert.equal(batch.protocol.metricMethodVersion, METRIC_METHOD_VERSION);
    assert.ok(byCondition.get('condition_baseline')?.trajectory.every((point) => !point.active));
    assert.ok(byCondition.get('condition_sham')?.trajectory.every((point) => !point.active));
    assert.ok(byCondition.get('condition_bilateral')?.trajectory.some((point) => point.active));
    assert.ok(byCondition.get('condition_bilateral')?.trajectory
      .filter((point) => point.active)
      .every((point) => point.t >= experiment.onsetMs && point.t < experiment.onsetMs + experiment.durationMs));
    for (const condition of batch.conditionRuns) {
      for (const replicate of condition.replicates) {
        const onset = replicate.trajectory.find((point) => point.t === experiment.onsetMs);
        const offset = replicate.trajectory.find((point) => point.t === experiment.onsetMs + experiment.durationMs);
        assert.ok(onset && offset);
        assert.equal(onset.active, condition.conditionId.startsWith('condition_')
          && !['condition_baseline', 'condition_sham'].includes(condition.conditionId));
        assert.equal(onset.premotorDriveIndex, replicate.effectiveMotorDrive);
        assert.equal(offset.active, false);
        assert.equal(offset.premotorDriveIndex, 0);
      }
    }
  });

  test('derives paired metric and trajectory seeds from the versioned common-random-number policy', () => {
    const experiment = makeExperiment();
    const batch = simulateExperiment(experiment);

    assert.equal(experiment.seedPolicy.version, 'flylab.seed-policy.v2');
    assert.equal(experiment.seedPolicy.generator, 'mulberry32');
    assert.equal(experiment.seedPolicy.design, 'common_random_numbers_by_replicate');
    assert.equal(
      experiment.seedPolicy.replicateFormula,
      'baseSeed + replicateIndex * 37',
    );
    assert.equal(
      experiment.seedPolicy.trajectoryFormula,
      'replicateSeed + 104729',
    );
    assert.equal(
      experiment.seedPolicy.illustrativeTrajectoryFormula,
      'baseSeed + 130363',
    );
    batch.conditionRuns.forEach((condition) => {
      assert.equal(
        condition.trajectorySeed,
        illustrativeTrajectorySeedFromPolicy(experiment.seedPolicy, experiment.seed),
      );
      condition.replicates.forEach((replicate, replicateIndex) => {
        const expectedSeed = replicateSeedFromPolicy(
          experiment.seedPolicy,
          experiment.seed,
          replicateIndex,
        );
        assert.equal(
          replicate.seed,
          expectedSeed,
        );
        assert.equal(
          replicate.trajectorySeed,
          runTrajectorySeedFromPolicy(experiment.seedPolicy, expectedSeed),
        );
      });
    });
    for (let replicateIndex = 0; replicateIndex < experiment.replicates; replicateIndex += 1) {
      assert.equal(
        new Set(batch.conditionRuns.map((condition) => condition.replicates[replicateIndex]?.seed)).size,
        1,
      );
    }

    const analysis = analyzeBatch(batch, ['backward_distance_mm']);
    assert.equal(analysis.methodVersion, experiment.metricMethodVersion);
  });

  test('publishes formal definitions for exactly nine stable metrics and a separate response-initiation summary', () => {
    assert.deepEqual(Object.keys(METRIC_DEFINITIONS), [...ANALYSIS_METRICS]);
    assert.equal('response_initiation_probability' in METRIC_DEFINITIONS, false);
    for (const metric of ANALYSIS_METRICS) {
      const definition = METRIC_DEFINITIONS[metric];
      assert.equal(definition.id, metric);
      assert.deepEqual(METRIC_LABELS[metric], {
        label: definition.label,
        unit: definition.unit,
      });
      assert.ok(definition.formula.length > 0);
      assert.ok(definition.unit.length > 0);
      assert.ok(definition.signConvention.length > 0);
      assert.ok(definition.aggregation.length > 0);
      assert.ok(definition.nullRule.length > 0);
      assert.match(definition.windowSemantics, /full-trial/i);
      assert.equal(definition.methodVersion, METRIC_METHOD_VERSION);
      assert.deepEqual(definition.provenance, ['derived', 'simulation_predicted']);
      assert.match(definition.boundary, /not a measured biological quantity/i);
    }

    assert.equal(RESPONSE_INITIATION_SUMMARY_DEFINITION.id, 'response_initiation_probability');
    assert.equal(RESPONSE_INITIATION_SUMMARY_DEFINITION.methodVersion, METRIC_METHOD_VERSION);
    assert.match(RESPONSE_INITIATION_SUMMARY_DEFINITION.boundary, /not one of the nine stable objective metrics/i);
    assert.equal(RESPONSE_OBSERVATION_SUMMARY_DEFINITION.methodVersion, METRIC_METHOD_VERSION);
    assert.match(
      RESPONSE_OBSERVATION_SUMMARY_DEFINITION.fields.thresholdCrossingProbability.aggregation,
      /distinct from each run/i,
    );
    assert.match(RESPONSE_OBSERVATION_SUMMARY_DEFINITION.boundary, /not biological response rates/i);

    const batch = simulateExperiment(makeExperiment());
    const analysis = analyzeBatch(batch, ['response_latency_ms', 'backward_distance_mm']);
    assert.deepEqual(Object.keys(analysis.metricDefinitions), [
      'backward_distance_mm',
      'response_latency_ms',
    ]);
    assert.deepEqual(
      analysis.responseInitiationSummaryDefinition,
      RESPONSE_INITIATION_SUMMARY_DEFINITION,
    );
    assert.deepEqual(
      analysis.responseObservationSummaryDefinition,
      RESPONSE_OBSERVATION_SUMMARY_DEFINITION,
    );
    assert.throws(
      () => analyzeBatch(batch, ['backward_distance_mm'], 100, batch.protocol.trialDurationMs),
      /supports only the full-trial analysis window/,
    );
  });

  test('makes every completed run inspectable with its own deterministic trajectory and labels condition paths as illustrative', () => {
    const batch = simulateExperiment(makeExperiment());
    const repeated = simulateExperiment(makeExperiment());
    const trajectoryIds = new Set<string>();

    assert.deepEqual(repeated, batch);
    for (const condition of batch.conditionRuns) {
      assert.equal(condition.status, 'complete');
      assert.equal(condition.trajectoryStatus, 'complete');
      assert.equal(condition.trajectoryRole, 'illustrative_condition_replay');
      assert.match(condition.trajectoryBoundary, /not any replicate trajectory/i);
      assert.ok(condition.trajectoryId.startsWith('trajectory_'));
      assert.equal(condition.trajectory.length, MODEL_PARAMETERS.trajectory.steps + 1);
      assert.deepEqual(condition.runIds, condition.replicates.map((replicate) => replicate.id));
      for (const replicate of condition.replicates) {
        assert.equal(replicate.status, 'complete');
        assert.equal(replicate.trajectoryRole, 'per_run_simulated_trajectory');
        assert.deepEqual(replicate.provenance, ['simulation_predicted']);
        assert.ok(replicate.trajectoryId.startsWith('trajectory_'));
        assert.ok(replicate.trajectory.length >= MODEL_PARAMETERS.trajectory.steps + 1);
        for (const eventTime of [
          replicate.eventTimeline.controllerThresholdMs,
          replicate.eventTimeline.movementOnsetMs,
          replicate.eventTimeline.groundReleaseMs,
          replicate.eventTimeline.wingDeploymentMs,
          replicate.eventTimeline.recoveryMs,
        ].filter((value): value is number => value !== null)) {
          assert.ok(replicate.trajectory.some((point) => point.t === eventTime));
        }
        assert.equal(trajectoryIds.has(replicate.trajectoryId), false);
        trajectoryIds.add(replicate.trajectoryId);
      }
      assert.notDeepEqual(condition.trajectory, condition.replicates[0]?.trajectory);
    }
  });

  test('invariant: baseline and model-sham runs with equivalent effective drive are exactly paired', () => {
    for (const perturbation of ['activate', 'silence'] as const) {
      const batch = simulateExperiment(makeExperiment({ perturbation }));
      const baseline = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_baseline');
      const sham = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_sham');

      assert.ok(baseline && sham);
      assert.equal(sham.effectiveMotorDrive, baseline.effectiveMotorDrive);
      assert.deepEqual(sham.trajectory, baseline.trajectory);
      baseline.replicates.forEach((baselineRun, index) => {
        const shamRun = sham.replicates[index]!;
        assert.equal(shamRun.seed, baselineRun.seed);
        assert.equal(shamRun.effectiveMotorDrive, baselineRun.effectiveMotorDrive);
        assert.equal(shamRun.responseThresholdProbability, baselineRun.responseThresholdProbability);
        assert.equal(shamRun.responseInitiated, baselineRun.responseInitiated);
        assert.equal(shamRun.reverseInitiated, baselineRun.reverseInitiated);
        assert.equal(shamRun.shortModeEscapeInitiated, baselineRun.shortModeEscapeInitiated);
        assert.equal(shamRun.backwardDistanceMm, baselineRun.backwardDistanceMm);
        assert.equal(shamRun.backwardDistanceScale, baselineRun.backwardDistanceScale);
        assert.equal(shamRun.signedSpeedMmS, baselineRun.signedSpeedMmS);
        assert.equal(shamRun.responseLatencyMs, baselineRun.responseLatencyMs);
        assert.equal(shamRun.headingChangeDeg, baselineRun.headingChangeDeg);
        assert.equal(shamRun.stanceStability, baselineRun.stanceStability);
        assert.equal(shamRun.verticalDisplacementMm, baselineRun.verticalDisplacementMm);
        assert.equal(shamRun.wingRecruitment, baselineRun.wingRecruitment);
        assert.equal(shamRun.legRecruitment, baselineRun.legRecruitment);
        assert.deepEqual(shamRun.trajectory, baselineRun.trajectory);
      });
    }
  });

  test('invariant: a zero-effect unilateral perturbation matches its reference arm outside protocol metadata', () => {
    const comparableRun = (run: ReturnType<typeof simulateExperiment>['conditionRuns'][number]['replicates'][number]) => {
      const comparable = structuredClone(run) as unknown as Record<string, unknown>;
      for (const field of ['id', 'conditionId', 'driveDerivation', 'trajectoryId']) {
        Reflect.deleteProperty(comparable, field);
      }
      comparable.trajectory = (comparable.trajectory as Array<Record<string, unknown>>).map((point) => {
        const normalizedPoint = { ...point };
        Reflect.deleteProperty(normalizedPoint, 'active');
        return normalizedPoint;
      });
      return comparable;
    };

    for (const perturbation of ['activate', 'silence'] as const) {
      const batch = simulateExperiment(makeExperiment({
        perturbation,
        laterality: 'left',
        activationLevel: 0,
      }));
      const reference = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_baseline');
      const target = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_left');
      assert.ok(reference && target);
      assert.equal(target.effectiveMotorDrive, reference.effectiveMotorDrive);
      target.replicates.forEach((run, index) => {
        assert.deepEqual(comparableRun(run), comparableRun(reference.replicates[index]!));
      });
    }
  });

  test('invariant: paired left and right inputs express opposite causal roll with shared latent outcomes', () => {
    const batch = simulateExperiment(makeExperiment());
    const left = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_left');
    const right = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_right');

    assert.ok(left && right);
    assert.equal(left.effectiveMotorDrive, right.effectiveMotorDrive);
    left.replicates.forEach((leftRun, index) => {
      const rightRun = right.replicates[index]!;
      assert.equal(leftRun.seed, rightRun.seed);
      assert.equal(leftRun.responseInitiated, rightRun.responseInitiated);
      assert.equal(leftRun.responseLatencyMs, rightRun.responseLatencyMs);
      assert.equal(leftRun.stanceStability, rightRun.stanceStability);
      assert.equal(leftRun.legRecruitment, rightRun.legRecruitment);
      if (leftRun.responseInitiated) {
        assert.ok(leftRun.headingChangeDeg < 0);
        assert.ok(rightRun.headingChangeDeg > 0);
        assert.ok(Math.abs(leftRun.backwardDistanceMm - rightRun.backwardDistanceMm) < 0.02);
        assert.ok(Math.abs(leftRun.signedSpeedMmS - rightRun.signedSpeedMmS) < 0.02);
      } else {
        assert.equal(leftRun.headingChangeDeg, 0);
        assert.equal(rightRun.headingChangeDeg, 0);
      }
      leftRun.trajectory.forEach((leftPoint, pointIndex) => {
        const rightPoint = rightRun.trajectory[pointIndex]!;
        assert.ok(Math.abs(leftPoint.bodyRollDeg + rightPoint.bodyRollDeg) < 1e-12);
        assert.equal(leftPoint.z, rightPoint.z);
      });
    });
  });

  test('invariant: greater bilateral drive is monotonic under paired latent draws', () => {
    const batch = simulateExperiment(makeExperiment({ replicates: 20 }));
    const bilateral = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_bilateral');
    const unilateral = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_left');

    assert.ok(bilateral && unilateral);
    assert.ok(bilateral.effectiveMotorDrive > unilateral.effectiveMotorDrive);
    bilateral.replicates.forEach((higherDriveRun, index) => {
      const lowerDriveRun = unilateral.replicates[index]!;
      assert.equal(higherDriveRun.seed, lowerDriveRun.seed);
      assert.ok(higherDriveRun.responseThresholdProbability > lowerDriveRun.responseThresholdProbability);
      assert.ok(Number(higherDriveRun.responseInitiated) >= Number(lowerDriveRun.responseInitiated));
      assert.ok(higherDriveRun.backwardDistanceMm >= lowerDriveRun.backwardDistanceMm);
      assert.ok(higherDriveRun.legRecruitment >= lowerDriveRun.legRecruitment);
      assert.ok(higherDriveRun.stanceStability <= lowerDriveRun.stanceStability);
      if (lowerDriveRun.responseLatencyMs !== null) {
        assert.ok(higherDriveRun.responseLatencyMs !== null);
        assert.ok(higherDriveRun.responseLatencyMs <= lowerDriveRun.responseLatencyMs);
      }
    });
  });

  test('invariant: signed speed and backward-distance direction never contradict', () => {
    const batches = [
      simulateExperiment(makeExperiment({ perturbation: 'activate', replicates: 20 })),
      simulateExperiment(makeExperiment({ perturbation: 'silence', replicates: 20 })),
    ];
    for (const replicate of batches.flatMap((batch) => batch.conditionRuns.flatMap((condition) => condition.replicates))) {
      assert.ok(replicate.backwardDistanceMm >= 0);
      if (replicate.backwardDistanceMm > 0) {
        assert.equal(replicate.reverseInitiated, true);
        assert.ok(replicate.signedSpeedMmS < 0);
      }
      if (replicate.signedSpeedMmS >= 0) assert.equal(replicate.backwardDistanceMm, 0);
      if (replicate.reverseInitiated) assert.ok(replicate.signedSpeedMmS < 0);
    }
    for (const condition of batches.flatMap((batch) => analyzeBatch(batch, [
      'backward_distance_mm',
      'signed_speed_mm_s',
    ]).conditions)) {
      if (condition.backwardDistanceMm > 0) assert.ok(condition.signedSpeedMmS < 0);
      if (condition.signedSpeedMmS >= 0) assert.equal(condition.backwardDistanceMm, 0);
    }
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

  test('does not label a threshold crossing at the trial boundary as an initiated body response', () => {
    const batch = simulateExperiment(makeExperiment({
      onsetMs: 950,
      durationMs: 50,
      trialDurationMs: 1000,
      replicates: 1,
      seed: 0,
    }));

    let censoredCount = 0;
    for (const run of batch.conditionRuns.flatMap((condition) => condition.replicates)) {
      assert.equal(run.responseInitiated, false);
      assert.equal(run.reverseInitiated, false);
      assert.equal(run.responseDisposition, run.responseThresholdCrossed ? 'censored' : 'not_crossed');
      assert.equal(run.eventTimeline.responseDisposition, run.responseDisposition);
      assert.equal(run.eventTimeline.thresholdCrossed, run.responseThresholdCrossed);
      if (run.responseDisposition === 'censored') {
        censoredCount += 1;
        assert.match(run.eventTimeline.boundary, /censored/i);
        assert.ok(run.candidateResponseLatencyMs !== null);
        assert.equal(
          run.eventTimeline.candidateMovementOnsetMs,
          batch.protocol.onsetMs + run.candidateResponseLatencyMs,
        );
        assert.ok(run.eventTimeline.candidateMovementOnsetMs > batch.protocol.trialDurationMs);
      }
      assert.equal(run.responseLatencyMs, null);
      assert.equal(run.signedSpeedMmS, 0);
      assert.equal(run.backwardDistanceMm, 0);
      assert.ok(run.trajectory.every((point) => point.state === 'stance' && !point.motorOutputActive));
    }
    assert.ok(censoredCount > 0);
    const analysis = analyzeBatch(batch, ['response_latency_ms']);
    for (const condition of batch.conditionRuns) {
      const result = analysis.conditions.find((item) => item.conditionId === condition.conditionId);
      const thresholdCrossedN = condition.replicates.filter((run) => run.responseThresholdCrossed).length;
      const expectedCensoredN = condition.replicates.filter((run) => run.responseDisposition === 'censored').length;
      assert.ok(result);
      assert.equal(result.thresholdCrossedN, thresholdCrossedN);
      assert.equal(result.censoredN, expectedCensoredN);
      assert.equal(result.thresholdCrossingProbability, thresholdCrossedN / condition.replicates.length);
    }
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
      label: 'Baseline · no mapped motor drive',
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

  test('canonicalizes an omitted behavior to the circuit default before hashing identity', () => {
    const implicit = makeExperiment();
    const explicit = makeExperiment({ behavior: 'backward_walking' });

    assert.equal(implicit.id, explicit.id);
    assert.deepEqual(implicit, explicit);
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

describe('FlyLab embodied leg-and-wing motor maps', () => {
  const gfExperiment = (overrides: Partial<ExperimentInput> = {}) => designExperiment({
    hypothesisId: 'hyp_gf_short_mode_escape',
    targetCircuitId: 'circuit_gf_adult',
    behavior: 'short_mode_escape',
    perturbation: 'activate',
    laterality: 'bilateral',
    activationLevel: 0.8,
    onsetMs: 500,
    durationMs: 900,
    trialDurationMs: 3000,
    replicates: 12,
    includeBaseline: true,
    includeShamControl: true,
    seed: 91827,
    ...overrides,
  });

  test('publishes the exact Run 5 nominal-control to effective-drive derivation before approval', () => {
    const experiment = gfExperiment({ activationLevel: 0.75, durationMs: 900, replicates: 8, seed: 91827 });
    const bilateral = experiment.conditions.find((condition) => condition.id === 'condition_bilateral');

    assert.ok(bilateral);
    const derivation = deriveConditionMotorDrive(bilateral, experiment);
    assert.equal(derivation.nominalControlLevel, 0.75);
    assert.equal(derivation.rawDurationGain, 0.5);
    assert.equal(derivation.boundedDurationGain, 0.5);
    assert.equal(derivation.lateralityGain, 1);
    assert.equal(derivation.adapterAmount, 0.375);
    assert.equal(derivation.effectiveMotorDrive, 0.375);
    assert.match(derivation.formula, /0\.75 × clamp\(900 \/ 1800/);
    assert.deepEqual(
      snapshotExperimentProtocol(experiment).driveDerivations.find((item) => item.conditionId === bilateral.id),
      derivation,
    );
  });

  test('keeps nonresponding GF runs grounded with zero expressed appendage output despite premotor drive', () => {
    const batch = simulateExperiment(gfExperiment({ activationLevel: 0.75, durationMs: 900, replicates: 8, seed: 91827 }));
    const bilateral = batch.conditionRuns.find((condition) => condition.conditionId === 'condition_bilateral');
    const nonresponders = bilateral?.replicates.filter((run) => !run.responseInitiated) ?? [];

    assert.equal(nonresponders.length, 5);
    for (const run of nonresponders) {
      assert.equal(run.premotorDriveIndex, 0.375);
      assert.equal(run.takeoffSuccess, false);
      assert.equal(run.verticalDisplacementMm, 0);
      assert.equal(run.legRecruitment, 0);
      assert.equal(run.wingRecruitment, 0);
      assert.equal(run.eventTimeline.movementOnsetMs, null);
      assert.equal(run.stanceStability, run.trajectory[0]?.stanceStability);
      assert.ok(run.trajectory.every((point) => (
        point.state === 'stance'
        && point.groundContact
        && !point.motorOutputActive
        && point.legExtension === 0
        && point.wingDeployment === 0
        && point.z === 0
      )));
    }
  });

  test('orders every responsive GF body event and derives all expressed outputs from that state trace', () => {
    const batch = simulateExperiment(gfExperiment({ activationLevel: 0.75, durationMs: 900, replicates: 8, seed: 91827 }));
    const responses = batch.conditionRuns.flatMap((condition) => condition.replicates).filter((run) => run.shortModeEscapeInitiated);

    assert.ok(responses.length > 0);
    for (const run of responses) {
      const timeline = run.eventTimeline;
      const { controllerThresholdMs, movementOnsetMs, groundReleaseMs, wingDeploymentMs, recoveryMs } = timeline;
      assert.ok(controllerThresholdMs !== null);
      assert.ok(movementOnsetMs !== null);
      assert.ok(groundReleaseMs !== null);
      assert.ok(wingDeploymentMs !== null);
      assert.ok(recoveryMs !== null);
      assert.ok(controllerThresholdMs <= movementOnsetMs);
      assert.ok(movementOnsetMs < groundReleaseMs);
      assert.ok(groundReleaseMs < wingDeploymentMs);
      assert.ok(wingDeploymentMs < recoveryMs);
      assert.ok(run.trajectory.filter((point) => point.t < movementOnsetMs).every((point) => (
        point.x === 0 && point.y === 0 && point.z === 0 && !point.motorOutputActive
      )));
      assert.ok(run.trajectory.filter((point) => point.t < groundReleaseMs).every((point) => point.groundContact));
      assert.ok(run.trajectory.filter((point) => point.state === 'airborne').every((point) => !point.groundContact));
      assert.equal(run.takeoffSuccess, run.trajectory.some((point) => point.state === 'airborne' && !point.groundContact));
      assert.equal(run.legRecruitment, Math.max(...run.trajectory.map((point) => point.legExtension)));
      assert.equal(run.wingRecruitment, Math.max(...run.trajectory.map((point) => point.wingDeployment)));
      assert.equal(run.verticalDisplacementMm, Math.max(...run.trajectory.map((point) => point.z)));
    }
  });

  test('recomputes GF aggregates exactly from per-run state-derived summaries', () => {
    const batch = simulateExperiment(gfExperiment({ activationLevel: 0.75, durationMs: 900, replicates: 8, seed: 91827 }));
    const analysis = analyzeBatch(batch, [
      'short_mode_escape_probability',
      'response_latency_ms',
      'vertical_displacement_mm',
      'wing_recruitment',
      'leg_recruitment',
    ]);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

    for (const condition of batch.conditionRuns) {
      const result = analysis.conditions.find((candidate) => candidate.conditionId === condition.conditionId);
      const responsive = condition.replicates.filter((run) => run.responseLatencyMs !== null);
      assert.ok(result);
      assert.equal(result.shortModeEscapeProbability, mean(condition.replicates.map((run) => Number(run.takeoffSuccess))));
      assert.equal(result.verticalDisplacementMm, mean(condition.replicates.map((run) => run.verticalDisplacementMm)));
      assert.equal(result.wingRecruitment, mean(condition.replicates.map((run) => run.wingRecruitment)));
      assert.equal(result.legRecruitment, mean(condition.replicates.map((run) => run.legRecruitment)));
      assert.equal(result.responseLatencyMs, responsive.length ? mean(responsive.map((run) => run.responseLatencyMs!)) : null);
    }
  });

  test('adds a SHA-256 content digest that changes when any run trajectory content changes', () => {
    const batch = simulateExperiment(gfExperiment({ replicates: 2 }));
    assert.match(batch.runHash, /^fnv1a:/);
    assert.match(batch.runContentHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(
      computeSimulationRunContentHash(batch.protocol, batch.model, batch.conditionRuns),
      batch.runContentHash,
    );
    const conditionRuns = structuredClone(batch.conditionRuns);
    conditionRuns[0]!.replicates[0]!.trajectory[0]!.x += 0.000001;
    const changed = `sha256:${deterministicSha256Hex({
      protocol: batch.protocol,
      model: MODEL_MANIFEST,
      conditionRuns,
    })}`;
    assert.notEqual(changed, batch.runContentHash);
  });

  test('rejects a coherently rehashed batch when duplicated summaries contradict the state trace', () => {
    const batch = simulateExperiment(gfExperiment({ replicates: 2 }));
    const inconsistent = structuredClone(batch);
    inconsistent.conditionRuns[0]!.replicates[0]!.verticalDisplacementMm += 0.25;
    inconsistent.runContentHash = computeSimulationRunContentHash(
      inconsistent.protocol,
      inconsistent.model,
      inconsistent.conditionRuns,
    );

    assert.throws(
      () => analyzeBatch(inconsistent, ['vertical_displacement_mm']),
      /contradicts its authoritative state trajectory/i,
    );

    const hiddenStateContradiction = structuredClone(batch);
    const nonresponder = hiddenStateContradiction.conditionRuns
      .flatMap((condition) => condition.replicates)
      .find((run) => run.responseDisposition !== 'expressed');
    assert.ok(nonresponder);
    nonresponder.trajectory[1]!.bodyPitchDeg = 3;
    hiddenStateContradiction.runContentHash = computeSimulationRunContentHash(
      hiddenStateContradiction.protocol,
      hiddenStateContradiction.model,
      hiddenStateContradiction.conditionRuns,
    );
    assert.throws(
      () => analyzeBatch(hiddenStateContradiction, ['vertical_displacement_mm']),
      /expresses body output before movement|without an expressed response/i,
    );

    const compatibilityReplayContradiction = structuredClone(batch);
    compatibilityReplayContradiction.conditionRuns[0]!.trajectory[1]!.x += 0.25;
    compatibilityReplayContradiction.runContentHash = computeSimulationRunContentHash(
      compatibilityReplayContradiction.protocol,
      compatibilityReplayContradiction.model,
      compatibilityReplayContradiction.conditionRuns,
    );
    assert.throws(
      () => analyzeBatch(compatibilityReplayContradiction, ['vertical_displacement_mm']),
      /does not exactly reproduce from its protocol, seed policy, and versioned generator/i,
    );
  });

  test('binds analysis identity to the exact SHA-256 batch content digest', () => {
    const batch = simulateExperiment(gfExperiment({ replicates: 2 }));
    const first = analyzeBatch(batch, ['vertical_displacement_mm']);
    const changed = simulateExperiment(gfExperiment({ replicates: 2, seed: batch.protocol.seed + 1 }));
    const second = analyzeBatch(changed, ['vertical_displacement_mm']);

    assert.equal(first.batchRunContentHash, batch.runContentHash);
    assert.equal(second.batchRunContentHash, changed.runContentHash);
    assert.notEqual(second.batchRunContentHash, first.batchRunContentHash);
    assert.notEqual(second.id, first.id);
  });

  test('catalogs separate source-backed paths into legs and wings', () => {
    const mdnMap = EMBODIED_MOTOR_MAPS.find((item) => item.circuitId === 'circuit_mdn_adult');
    const gfMap = EMBODIED_MOTOR_MAPS.find((item) => item.circuitId === 'circuit_gf_adult');

    assert.ok(mdnMap?.targetBodyParts.includes('left_hindleg'));
    assert.ok(mdnMap?.targetBodyParts.includes('right_foreleg'));
    assert.deepEqual(gfMap?.targetBodyParts, ['left_midleg', 'right_midleg', 'left_wing', 'right_wing']);
    assert.ok(gfMap?.edges.some((edge) => edge.from === 'gf_descending' && edge.to === 'ttmn' && edge.relation === 'mixed_electrochemical'));
    assert.ok(gfMap?.edges.some((edge) => edge.from === 'psi' && edge.to === 'dlmn'));
    assert.deepEqual(gfMap?.supportedLaterality, ['bilateral']);
    assert.deepEqual(gfMap?.behaviors, ['short_mode_escape']);
    assert.match(gfMap?.evidenceBoundary ?? '', /no GF reconstruction/i);
  });

  test('keeps every motor map internally closed and agent-queryable', () => {
    const evidenceIds = new Set(EVIDENCE.map((record) => record.id));
    for (const map of EMBODIED_MOTOR_MAPS) {
      const circuit = CIRCUITS.find((record) => record.id === map.circuitId);
      const nodeIds = map.nodes.map((node) => node.id);
      const edgeIds = map.edges.map((edge) => edge.id);

      assert.ok(circuit, `missing circuit ${map.circuitId}`);
      assert.equal(circuit.motorMapId, map.id);
      assert.equal(new Set(nodeIds).size, nodeIds.length, `${map.id} has duplicate node IDs`);
      assert.equal(new Set(edgeIds).size, edgeIds.length, `${map.id} has duplicate edge IDs`);
      assert.equal(new Set(map.recommendedMetrics).size, 5, `${map.id} must expose five unique metrics`);
      assert.ok(map.recommendedMetrics.every((metric) => ANALYSIS_METRICS.includes(metric as (typeof ANALYSIS_METRICS)[number])));
      for (const edge of map.edges) {
        assert.ok(nodeIds.includes(edge.from), `${edge.id} has missing source ${edge.from}`);
        assert.ok(nodeIds.includes(edge.to), `${edge.id} has missing target ${edge.to}`);
      }
      const rootIds = map.nodes.filter((node) => node.level === 'brain').map((node) => node.id);
      const reachable = new Set(rootIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const edge of map.edges) {
          if (reachable.has(edge.from) && !reachable.has(edge.to)) {
            reachable.add(edge.to);
            changed = true;
          }
        }
      }
      for (const node of map.nodes) {
        if (node.pathStatus === 'mapped') assert.ok(reachable.has(node.id), `${map.id} has unreachable mapped node ${node.id}`);
        if (!reachable.has(node.id)) assert.equal(node.pathStatus, 'context_only_unconnected');
      }
      for (const item of [...map.nodes, ...map.edges]) {
        assert.ok(item.evidenceIds.length > 0, `${item.id} has no evidence boundary`);
        assert.ok(item.evidenceIds.every((id) => evidenceIds.has(id)), `${item.id} references unresolved evidence`);
        assert.ok(item.evidenceIds.every((id) => circuit.evidenceIds.includes(id)), `${item.id} is outside ${circuit.id}'s source-closed evidence set`);
        const supportingSourceIds = item.evidenceIds.flatMap((id) => EVIDENCE.find((record) => record.id === id)?.sourceIds ?? []);
        for (const sourceId of item.sourceIds ?? supportingSourceIds) {
          assert.ok(SOURCES.some((source) => source.id === sourceId), `${item.id} references unresolved source ${sourceId}`);
          assert.ok(supportingSourceIds.includes(sourceId), `${item.id} attributes a source outside its evidence records`);
        }
      }
    }
  });

  test('keeps Allen GF-TTMn modality evidence off unrelated GF branches', () => {
    const gfMap = EMBODIED_MOTOR_MAPS.find((item) => item.circuitId === 'circuit_gf_adult')!;
    const edgeSources = new Map(gfMap.edges.map((edge) => [edge.id, edge.sourceIds ?? []]));

    assert.deepEqual(edgeSources.get('edge_gf_ttmn'), ['SRC-KING-JNEUROCYTOL-1980', 'SRC-ALLEN-EJN-2007']);
    assert.deepEqual(edgeSources.get('edge_gf_psi'), ['SRC-KING-JNEUROCYTOL-1980']);
    assert.deepEqual(edgeSources.get('edge_psi_dlmn'), ['SRC-KING-JNEUROCYTOL-1980']);
    assert.deepEqual(edgeSources.get('edge_dlmn_dlm'), ['SRC-KING-JNEUROCYTOL-1980']);
  });

  test('returns explicit mapped and not-modeled coverage for each selected circuit', () => {
    const gfCoverage = embodimentCoverageForCircuits(['circuit_gf_adult']);
    const mdnCoverage = embodimentCoverageForCircuits(['circuit_mdn_adult']);

    assert.equal(gfCoverage.length, 8);
    assert.equal(gfCoverage.find((entry) => entry.bodyPart === 'left_wing')?.status, 'mapped_reduced_order');
    assert.equal(gfCoverage.find((entry) => entry.bodyPart === 'left_foreleg')?.status, 'not_modeled');
    assert.equal(mdnCoverage.find((entry) => entry.bodyPart === 'right_hindleg')?.status, 'mapped_reduced_order');
    assert.equal(mdnCoverage.find((entry) => entry.bodyPart === 'right_wing')?.status, 'not_modeled');
  });

  test('preserves GF behavior on human edits and rejects unsupported unilateral GF trials', () => {
    const source = gfExperiment();
    const revised = reviseExperiment(source, 'replicates', 7);

    assert.equal(revised.behavior, 'short_mode_escape');
    assert.equal(revised.targetCircuitId, source.targetCircuitId);
    assert.equal(revised.replicates, 7);
    assert.equal(revised.conditions.length, 3);
    assert.notEqual(revised.id, source.id);
    assert.throws(
      () => designExperiment({
        hypothesisId: source.hypothesisId,
        targetCircuitId: source.targetCircuitId,
        behavior: source.behavior,
        perturbation: source.perturbation,
        laterality: 'left',
        activationLevel: source.activationLevel,
        onsetMs: source.onsetMs,
        durationMs: source.durationMs,
        trialDurationMs: source.trialDurationMs,
        replicates: source.replicates,
        includeBaseline: true,
        includeShamControl: true,
        seed: source.seed,
      }),
      /laterality is not supported/,
    );
  });

  test('requires causal GF evidence for a short-mode escape hypothesis', () => {
    const hypothesis = makeHypothesis({
      circuitId: 'circuit_gf_adult',
      claim: 'Mapped bilateral giant-fiber drive will increase simulated short-mode escape takeoff.',
      predictedBehavior: 'short_mode_escape',
      perturbation: 'activate',
      primaryOutcome: 'short_mode_escape_probability',
      expectedDirection: 'increase',
      controls: [...HYPOTHESIS_CONTROL_IDS],
      evidenceIds: ['E-GF-CAUSAL-010', 'E-GF-PATH-011', 'E-FANC-ESCAPE-012'],
      evidenceLimitations: ['The cited assays do not validate the reduced-order simulator effect size.'],
      falsificationCriterion: 'Takeoff probability does not exceed both baseline and model-sham controls.',
    });

    assert.deepEqual(hypothesis.causalEvidenceIds, ['E-GF-CAUSAL-010']);
    assert.throws(() => makeHypothesis({
      circuitId: 'circuit_gf_adult',
      claim: 'Mapped bilateral giant-fiber drive will increase simulated short-mode escape takeoff.',
      predictedBehavior: 'short_mode_escape',
      perturbation: 'activate',
      primaryOutcome: 'short_mode_escape_probability',
      expectedDirection: 'increase',
      controls: [...HYPOTHESIS_CONTROL_IDS],
      evidenceIds: ['E-GF-PATH-011', 'E-FANC-ESCAPE-012'],
      evidenceLimitations: ['The cited assays do not validate the reduced-order simulator effect size.'],
      falsificationCriterion: 'Takeoff probability does not exceed both baseline and model-sham controls.',
    }), /perturbation_effect/);
  });

  test('routes GF drive into seeded jump-leg, wing, and lift outputs', () => {
    const experiment = gfExperiment();
    const batch = simulateExperiment(experiment);
    const repeated = simulateExperiment(gfExperiment());
    const analysis = analyzeBatch(batch, [
      'short_mode_escape_probability',
      'response_latency_ms',
      'vertical_displacement_mm',
      'wing_recruitment',
      'leg_recruitment',
    ]);
    const baseline = analysis.conditions.find((item) => item.conditionId === 'condition_baseline');
    const driven = analysis.conditions.find((item) => item.conditionId === 'condition_bilateral');
    const trajectory = batch.conditionRuns.find((item) => item.conditionId === 'condition_bilateral')?.trajectory ?? [];

    assert.deepEqual(repeated, batch);
    assert.deepEqual(batch.protocol, snapshotExperimentProtocol(experiment));
    assert.equal(batch.protocol.conditions.length, 3);
    assert.equal(batch.motorMap.motorProgram, 'short_mode_escape');
    assert.equal(batch.behavior, 'short_mode_escape');
    assert.ok(baseline && driven);
    assert.ok(driven.shortModeEscapeProbability > baseline.shortModeEscapeProbability);
    assert.ok(driven.verticalDisplacementMm > baseline.verticalDisplacementMm);
    assert.ok(driven.wingRecruitment > baseline.wingRecruitment);
    assert.ok(driven.legRecruitment > baseline.legRecruitment);
    assert.ok(trajectory.some((point) => point.active && point.z > 0));
  });

  test('replays reference motor output during silencing without mislabeling it as the selected target', () => {
    const mdnBatch = simulateExperiment(makeExperiment({ perturbation: 'silence', activationLevel: 0.9 }));
    const gfBatch = simulateExperiment(gfExperiment({ perturbation: 'silence', activationLevel: 0.9, replicates: 20 }));
    const mdnBaseline = mdnBatch.conditionRuns.find((run) => run.conditionId === 'condition_baseline');
    const gfBaseline = gfBatch.conditionRuns.find((run) => run.conditionId === 'condition_baseline');
    const gfPrimary = gfBatch.conditionRuns.find((run) => run.conditionId === 'condition_bilateral');

    assert.ok(mdnBaseline?.trajectory.some((point) => point.motorOutputActive && !point.active));
    assert.ok(gfBaseline?.trajectory.some((point) => point.motorOutputActive && !point.active));
    assert.ok(gfBaseline?.trajectory.some((point) => point.z > 0));
    assert.equal(gfBaseline?.trajectory.at(-1)?.z, 0);
    assert.ok(gfPrimary?.trajectory.some((point) => point.active));
    assert.ok((gfPrimary?.replicates.reduce((sum, run) => sum + run.wingRecruitment, 0) ?? 0)
      < (gfBaseline?.replicates.reduce((sum, run) => sum + run.wingRecruitment, 0) ?? 0));
  });

  test('offers only shared, populated metrics when an objective has no responsive values', () => {
    const analysis = analyzeBatch(simulateExperiment(gfExperiment()), [
      'response_latency_ms',
      'wing_recruitment',
    ]);
    const latencyless = {
      ...analysis,
      conditions: analysis.conditions.map((condition) => ({ ...condition, responseLatencyMs: null })),
    };

    assert.deepEqual(sharedAvailableObjectiveMetrics([latencyless]), ['wing_recruitment']);
  });
});

describe('FlyLab provenance', () => {
  test('canonicalizes hypothesis evidence IDs so a reordered citation set is idempotent', () => {
    const input = {
      circuitId: 'circuit_mdn_adult',
      claim: 'Bilateral MDN activation will increase backward walking.',
      predictedBehavior: 'backward_walking',
      perturbation: 'activate' as const,
      primaryOutcome: 'backward_distance_mm' as const,
      expectedDirection: 'increase' as const,
      controls: [...HYPOTHESIS_CONTROL_IDS],
      evidenceIds: ['E-BANC-PATH-003', 'E-MDN-ACTIVATION-001'],
      evidenceLimitations: [
        'The simulator is not biologically calibrated.',
        'The causal evidence comes from study-specific conditions.',
      ],
      falsificationCriterion: 'No increase over baseline in backward distance.',
    };
    const first = makeHypothesis(input);
    const second = makeHypothesis({
      ...input,
      controls: [...input.controls].reverse(),
      evidenceIds: [...input.evidenceIds].reverse(),
      evidenceLimitations: [...input.evidenceLimitations].reverse(),
    });

    assert.equal(second.id, first.id);
    assert.deepEqual(second.controls, [...HYPOTHESIS_CONTROL_IDS]);
    assert.deepEqual(second.evidenceIds, first.evidenceIds);
    assert.deepEqual(second.evidenceLimitations, first.evidenceLimitations);
    assert.deepEqual(second.causalEvidenceIds, ['E-MDN-ACTIVATION-001']);
    assert.notEqual(makeHypothesis({ ...input, expectedDirection: 'decrease' }).id, first.id);
    assert.notEqual(makeHypothesis({ ...input, primaryOutcome: 'signed_speed_mm_s' }).id, first.id);
    assert.notEqual(makeHypothesis({
      ...input,
      evidenceLimitations: ['A materially different evidence boundary.'],
    }).id, first.id);
  });

  test('does not treat a legacy 32-bit FNV collision as the same hypothesis lineage', () => {
    const base = {
      circuitId: 'circuit_mdn_adult',
      predictedBehavior: 'backward_walking',
      perturbation: 'activate' as const,
      primaryOutcome: 'backward_distance_mm' as const,
      expectedDirection: 'increase' as const,
      controls: [...HYPOTHESIS_CONTROL_IDS],
      evidenceIds: ['E-MDN-ACTIVATION-001'],
      evidenceLimitations: ['The assay does not calibrate the model.'],
      falsificationCriterion: 'No model increase relative to controls.',
    };
    const firstClaim = 'The model predicts response 61dqpaeib1u 25541';
    const secondClaim = 'The model predicts response uhvkgvolk1 87823';
    const legacyIdentity = (claim: string) => ({
      circuitId: base.circuitId,
      claim,
      predictedBehavior: base.predictedBehavior,
      perturbation: base.perturbation,
      primaryOutcome: base.primaryOutcome,
      expectedDirection: base.expectedDirection,
      controls: base.controls,
      evidenceIds: base.evidenceIds,
      evidenceLimitations: base.evidenceLimitations,
      falsificationCriterion: base.falsificationCriterion,
    });

    assert.equal(stableHash(legacyIdentity(firstClaim)), stableHash(legacyIdentity(secondClaim)));
    const first = makeHypothesis({ ...base, claim: firstClaim });
    const second = makeHypothesis({ ...base, claim: secondClaim });
    const expectedFirstId = `hyp_${createHash('sha256')
      .update(JSON.stringify(legacyIdentity(firstClaim)))
      .digest('hex')}`;

    assert.match(first.id, /^hyp_[a-f0-9]{64}$/);
    assert.match(second.id, /^hyp_[a-f0-9]{64}$/);
    assert.equal(first.id, expectedFirstId);
    assert.notEqual(second.id, first.id);
    assert.notEqual(second.claim, first.claim);
    assert.notEqual(
      makeExperiment({ hypothesisId: second.id }).id,
      makeExperiment({ hypothesisId: first.id }).id,
    );
  });

  test('validates structured hypothesis outcomes, controls, and evidence limitations', () => {
    const valid = {
      circuitId: 'circuit_mdn_adult',
      claim: 'Bilateral MDN activation will increase backward walking.',
      predictedBehavior: 'backward_walking',
      perturbation: 'activate' as const,
      primaryOutcome: 'backward_distance_mm' as const,
      expectedDirection: 'increase' as const,
      controls: [...HYPOTHESIS_CONTROL_IDS],
      evidenceIds: ['E-MDN-ACTIVATION-001'],
      evidenceLimitations: ['  Evidence is bounded to the cited assay.  '],
      falsificationCriterion: 'No increase over baseline in backward distance.',
    };

    assert.deepEqual(makeHypothesis(valid).evidenceLimitations, ['Evidence is bounded to the cited assay.']);
    assert.throws(
      () => makeHypothesis({ ...valid, primaryOutcome: 'unknown_metric' as never }),
      /primaryOutcome must be one of/,
    );
    assert.throws(
      () => makeHypothesis({ ...valid, expectedDirection: 'unchanged' as never }),
      /expectedDirection must be increase or decrease/,
    );
    assert.throws(
      () => makeHypothesis({ ...valid, controls: ['condition_baseline'] }),
      /controls must include exactly/,
    );
    assert.throws(
      () => makeHypothesis({ ...valid, controls: ['condition_baseline', 'condition_baseline'] }),
      /controls must include exactly/,
    );
    assert.throws(
      () => makeHypothesis({ ...valid, evidenceLimitations: [] }),
      /at least one nonempty string/,
    );
    assert.throws(
      () => makeHypothesis({ ...valid, evidenceLimitations: ['   '] }),
      /at least one nonempty string/,
    );
  });

  test('rejects structural-only and wrong-perturbation evidence as causal hypothesis support', () => {
    const base = {
      circuitId: 'circuit_mdn_adult',
      claim: 'Bilateral MDN activation will increase backward walking.',
      predictedBehavior: 'backward_walking',
      perturbation: 'activate' as const,
      primaryOutcome: 'backward_distance_mm' as const,
      expectedDirection: 'increase' as const,
      controls: [...HYPOTHESIS_CONTROL_IDS],
      evidenceLimitations: ['The evidence is bounded to the cited assay conditions.'],
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
      primaryOutcome: 'backward_distance_mm',
      expectedDirection: 'increase',
      controls: [...HYPOTHESIS_CONTROL_IDS],
      evidenceIds: ['E-MDN-ACTIVATION-001'],
      evidenceLimitations: ['The evidence is bounded to the cited assay conditions.'],
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
