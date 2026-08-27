import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createExperimentApproval,
  createExperimentSeedManifest,
  verifyExperimentApproval,
  type ExperimentApproval,
} from '../lib/experiment-approval.js';
import {
  designExperiment,
  reviseExperiment,
  sha256,
  type Experiment,
} from '../lib/flylab.js';

function makeExperiment(): Experiment {
  return designExperiment({
    hypothesisId: 'hyp_mdn_backward_walking',
    targetCircuitId: 'circuit_mdn_adult',
    perturbation: 'activate',
    laterality: 'bilateral',
    activationLevel: 0.72,
    onsetMs: 900,
    durationMs: 1800,
    trialDurationMs: 5000,
    replicates: 3,
    includeBaseline: true,
    includeShamControl: true,
    seed: 424242,
  });
}

describe('FlyLab experiment approval contract', () => {
  test('hashes the same protocol deterministically and excludes approval time from both hashes', async () => {
    const experiment = makeExperiment();
    const first = await createExperimentApproval(experiment, '2026-08-26T12:00:00.000Z');
    const second = await createExperimentApproval(experiment, '2026-08-27T15:30:00.000Z');

    assert.equal(first.protocol_hash, second.protocol_hash);
    assert.equal(first.seed_manifest_hash, second.seed_manifest_hash);
    assert.notEqual(first.approved_at, second.approved_at);
    assert.equal(first.protocol_hash, await sha256(first.protocol));
    assert.equal(first.seed_manifest_hash, await sha256(first.seed_manifest));
    assert.equal(await verifyExperimentApproval(first, experiment), true);
    assert.equal(await verifyExperimentApproval(second, experiment), true);
  });

  test('invalidates approval after a protocol edit', async () => {
    const experiment = makeExperiment();
    const approval = await createExperimentApproval(experiment, '2026-08-26T12:00:00.000Z');
    const revised = reviseExperiment(experiment, 'durationMs', 2100);

    assert.equal(await verifyExperimentApproval(approval, revised), false);
  });

  test('publishes the exact and complete seed manifest for every condition and replicate', async () => {
    const experiment = makeExperiment();
    const manifest = createExperimentSeedManifest(experiment);
    const approval = await createExperimentApproval(experiment, '2026-08-26T12:00:00.000Z');
    const { illustrativeTrajectoryOffset, replicateStride, trajectoryOffset } = experiment.seedPolicy;

    assert.deepEqual(approval.seed_manifest, manifest);
    assert.equal(manifest.condition_count, experiment.conditions.length);
    assert.equal(manifest.replicates_per_condition, experiment.replicates);
    assert.equal(manifest.conditions.length, experiment.conditions.length);
    assert.equal(
      manifest.conditions.reduce((total, condition) => total + condition.replicates.length, 0),
      experiment.conditions.length * experiment.replicates,
    );

    manifest.conditions.forEach((condition, conditionIndex) => {
      assert.equal(condition.condition_id, experiment.conditions[conditionIndex]?.id);
      assert.equal(condition.condition_index, conditionIndex);
      assert.equal(condition.trajectory_seed, experiment.seed + illustrativeTrajectoryOffset);
      assert.deepEqual(
        condition.replicates,
        Array.from({ length: experiment.replicates }, (_, replicateIndex) => ({
          replicate_index: replicateIndex,
          seed: experiment.seed + replicateIndex * replicateStride,
          trajectory_seed: experiment.seed + replicateIndex * replicateStride + trajectoryOffset,
        })),
      );
    });
    assert.ok(manifest.conditions.every((condition) => (
      condition.trajectory_seed === manifest.conditions[0]?.trajectory_seed
      && condition.replicates.every((replicate, replicateIndex) => (
        replicate.seed === manifest.conditions[0]?.replicates[replicateIndex]?.seed
        && replicate.trajectory_seed
          === manifest.conditions[0]?.replicates[replicateIndex]?.trajectory_seed
      ))
    )));
  });

  test('binds experiment, model, metric method, and complete seed policy versions', async () => {
    const experiment = makeExperiment();
    const approval = await createExperimentApproval(experiment, '2026-08-26T12:00:00.000Z');

    assert.equal(approval.experiment_id, experiment.id);
    assert.equal(approval.model_version, experiment.model.version);
    assert.equal(approval.metric_method_version, experiment.metricMethodVersion);
    assert.equal(approval.seed_policy_version, experiment.seedPolicy.version);
    assert.deepEqual(approval.seed_policy, experiment.seedPolicy);
    assert.equal(approval.protocol.modelVersion, experiment.model.version);
    assert.deepEqual(approval.protocol.seedPolicy, experiment.seedPolicy);

    const changedModel = {
      ...experiment,
      model: { ...experiment.model, version: '0.2.1' },
    } as unknown as Experiment;
    const changedMetric = {
      ...experiment,
      metricMethodVersion: `${experiment.metricMethodVersion}.edited`,
    } as unknown as Experiment;
    const changedSeedPolicy = {
      ...experiment,
      seedPolicy: { ...experiment.seedPolicy, version: `${experiment.seedPolicy.version}.edited` },
    } as unknown as Experiment;

    assert.equal(await verifyExperimentApproval(approval, changedModel), false);
    assert.equal(await verifyExperimentApproval(approval, changedMetric), false);
    assert.equal(await verifyExperimentApproval(approval, changedSeedPolicy), false);
  });

  test('is detached, deeply frozen, and survives a JSON round trip', async () => {
    const experiment = makeExperiment();
    const approval = await createExperimentApproval(experiment, '2026-08-26T12:00:00Z');
    const parsed = JSON.parse(JSON.stringify(approval)) as ExperimentApproval;

    assert.equal(approval.approved_at, '2026-08-26T12:00:00.000Z');
    assert.equal(Object.isFrozen(approval), true);
    assert.equal(Object.isFrozen(approval.protocol), true);
    assert.equal(Object.isFrozen(approval.protocol.conditions), true);
    assert.equal(Object.isFrozen(approval.protocol.conditions[0]), true);
    assert.equal(Object.isFrozen(approval.seed_manifest.conditions[0]?.replicates), true);
    assert.notStrictEqual(approval.protocol.conditions, experiment.conditions);
    assert.notStrictEqual(approval.seed_policy, experiment.seedPolicy);
    assert.deepEqual(parsed, approval);
    assert.equal(await verifyExperimentApproval(parsed, experiment), true);
  });
});
