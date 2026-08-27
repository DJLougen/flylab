# FlyLab mapped-motor model card

## Identity and permitted interpretation

| Field | Value |
|---|---|
| Model | `FlyLab mapped-motor embodiment model` |
| Version | `0.3.0` |
| Controller | `state-coherent-mapped-circuit-adapter.v2` |
| Environment | `stateful-open-field-model-scale.v3` |
| Parameter set | `flylab.mapped-motor-parameters.v3` |
| Seed policy | `flylab.seed-policy.v2` |
| Metric method | `flylab.behavior-metrics.v5` |
| Parameter provenance | `agent_hypothesized` |
| Batch provenance | `simulation_predicted` |
| Analysis provenance | `derived`, `simulation_predicted` |

This is a deterministic challenge model with separate MDN reverse-walk and giant-fiber short-mode escape motor maps. GF state-transition order and approximate event intervals are constrained by cited adult escape measurements, but probabilities, amplitudes, gains, MDN dynamics, and recovery remain hand-authored and unfitted. It does not execute FlyGym, connectome neurons, electrical or chemical synapses, neural dynamics, biomechanics, muscles, aerodynamics, or a wet-lab protocol. Distances and speeds use declared **model-scale millimeter units**. They are internally consistent within FlyLab but are not calibrated biological effect sizes.

FlyGym v2.1.0 is a pinned embodiment reference only. The FlyLab controller and equations below are local implementation choices, not results from FlyGym.

## Canonical parameter object

The block below is machine-checked against the exported runtime object. A parameter change that does not update this card fails the test suite.

<!-- MODEL_PARAMETERS_JSON_START -->
```json
{
  "name": "flylab.mapped-motor-parameters.v3",
  "provenance": "agent_hypothesized",
  "calibration": "State-transition order and approximate GF event intervals are constrained by cited adult escape measurements; probabilities, amplitudes, controller gains, recovery timing and dynamics, and MDN dynamics remain hand-authored and are not fitted to held-out data.",
  "calibrationStatus": "literature_constrained_event_order_unfitted_amplitudes",
  "unitBoundary": "Distances and speeds use declared model-scale millimeter units. They are internally consistent but are not biologically calibrated effect sizes.",
  "durationReferenceMs": 1800,
  "durationGainBounds": [
    0.35,
    1.2
  ],
  "unilateralGain": 0.72,
  "maximumMotorDrive": 1.1,
  "silencingReferenceMotorDrive": 0.72,
  "maximumSuppressionFraction": 0.92,
  "reverseProbability": {
    "baseline": 0.08,
    "driveGain": 0.79,
    "minimum": 0.02,
    "maximum": 0.97
  },
  "signedSpeed": {
    "forwardBaselineMmS": 0.92,
    "forwardDrivePenaltyMmS": 0.25,
    "reverseInterceptMmS": 0.62,
    "reverseDriveGainMmS": 2.25,
    "jitterScaleMmS": 0.36,
    "forwardJitterScaleMmS": 0.28
  },
  "responseLatency": {
    "interceptMs": 540,
    "inverseDriveGainMs": 1320,
    "jitterScaleMs": 260,
    "minimumClampMs": 180
  },
  "backwardDistanceScale": {
    "minimum": 0.72,
    "maximum": 0.92
  },
  "heading": {
    "baseDeg": 11,
    "driveGainDeg": 34,
    "bilateralJitterScaleDeg": 7,
    "unilateralJitterScaleDeg": 12
  },
  "stanceStability": {
    "baseline": 0.91,
    "drivePenalty": 0.08,
    "jitterScale": 0.06,
    "minimum": 0.62,
    "maximum": 0.98
  },
  "reverseWalk": {
    "legRecruitment": {
      "baseline": 0.18,
      "driveGain": 0.72,
      "jitterScale": 0.06
    }
  },
  "escapeTakeoff": {
    "responseProbability": {
      "baseline": 0.04,
      "driveGain": 0.9,
      "minimum": 0.01,
      "maximum": 0.98
    },
    "responseLatency": {
      "interceptMs": 1.4,
      "inverseDriveGainMs": 3.2,
      "jitterScaleMs": 0.4,
      "minimumClampMs": 1.4
    },
    "eventTiming": {
      "controllerLeadMs": 0.6,
      "groundReleaseDelayMs": 1.1,
      "wingDelayAfterGroundReleaseMs": 1.5,
      "recoveryBaseMs": 180,
      "recoveryDriveGainMs": 120,
      "recoveryJitterScaleMs": 20,
      "sourceIds": [
        "SRC-GAITANIDIS-PLOS-BIOLOGY-2025"
      ],
      "boundary": "The order and approximate millisecond intervals are literature-constrained calibration targets across distinct direct-GF and light-off paradigms; they are not a fitted equivalence to FlyLab unitless drive."
    },
    "verticalDisplacement": {
      "interceptModelMm": 0.42,
      "driveGainModelMm": 2.6,
      "jitterScaleModelMm": 0.24
    },
    "wingRecruitment": {
      "baseline": 0.05,
      "driveGain": 0.9,
      "jitterScale": 0.08
    },
    "legRecruitment": {
      "baseline": 0.06,
      "driveGain": 0.92,
      "jitterScale": 0.08
    },
    "forwardSpeedGainModelMmS": 0.7,
    "trajectoryLiftGainModelMm": 0.035,
    "trajectoryForwardGainModelMm": 0.018
  },
  "trajectory": {
    "steps": 80,
    "reverseDriveThreshold": 0.12,
    "baseStepModelMm": 0.018,
    "driveStepGainModelMm": 0.036,
    "positionJitterScaleModelMm": 0.006,
    "headingJitterScaleDeg": 0.08,
    "activeTurnBaseDegPerStep": 0.32,
    "activeTurnGainDegPerStep": 0.34
  },
  "stateTrajectory": {
    "protocolWindowSemantics": "[onset_ms, min(trial_duration_ms, onset_ms + duration_ms))",
    "distanceScale": {
      "minimum": 0.98,
      "range": 0.04
    },
    "eventSamplingBoundaryEpsilonMs": 0.001,
    "reverseControllerLead": {
      "latencyFraction": 0.2,
      "maximumMs": 60
    },
    "stanceStability": {
      "preparationPenalty": 0.05,
      "reverseWalkPenalty": 0.1,
      "jump": 0.35,
      "wingDeployment": 0.25,
      "airborne": 0.5
    },
    "takeoffPose": {
      "jumpPitchDeg": -14,
      "wingDeploymentPitchDeltaDeg": 20,
      "airborneRecoveryPitchDeg": 6,
      "wingDeploymentLegDecayFraction": 0.75,
      "airborneLegRetentionFraction": 0.2,
      "unilateralBodyRollPerHeading": 0.2
    },
    "illustrativeCompatibilityPose": {
      "takeoffPitchDeg": 10,
      "airborneStanceStability": 0.6
    }
  }
}
```
<!-- MODEL_PARAMETERS_JSON_END -->

## Inputs and conditions

Each experiment records behavior, perturbation mode, supported laterality, nominal control level `a`, onset, duration, trial duration, replicate count, base seed, conditions, motor map, model version, and assumptions. `a` is unitless on `[0, 1]`; it is not light power, firing rate, expression level, or a measured dose.

Every experiment contains baseline, model-sham, and perturbation arms. A bilateral design contains left-only and right-only perturbation arms only when the selected motor map supports unilateral routing. The current MDN map does; the GF map is intentionally bilateral-only because its side-specific leg/wing routing is not implemented. Each condition separates:

- `nominalControlLevel`: the requested unitless setting;
- `expectedModelEffect`: a machine-readable description of how the adapter treats it; and
- the computed mapped motor-drive value `d` used by the model.

The sham may retain the nominal setting, but its expected effect is explicit. For activation it has zero effective motor drive. For silencing it retains the same hand-authored reference motor drive as the unsuppressed control.

## Mapped motor-drive adapter

Let:

```text
duration_gain = clamp(duration_ms / 1800, 0.35, 1.2)
laterality_gain = 1.0 for bilateral, otherwise 0.72
adapter_amount = nominal_control_level × duration_gain × laterality_gain
```

Activation experiments use:

```text
d_baseline = 0
d_sham = 0
d_perturbation = clamp(adapter_amount, 0, 1.1)
```

Silencing experiments use a hand-authored reference motor drive of `0.72`:

```text
d_baseline = 0.72
d_sham = 0.72
suppression_fraction = clamp(adapter_amount, 0, 0.92)
d_perturbation = 0.72 × (1 − suppression_fraction)
```

This makes suppression magnitude operational rather than silently discarding it. It is still only a model assumption. Baseline and sham in a silencing trial represent an unsuppressed motor-program reference, not measured endogenous circuit activity or a physical assay.

## Seeded, state-coherent replicate model

For zero-based replicate index `r`, every condition reuses the same seed:

```text
replicate_seed = base_seed + r × 37
per_run_trajectory_seed = replicate_seed + 104729
illustrative_condition_trajectory_seed = base_seed + 130363  (legacy compatibility only)
```

This is a common-random-number design: replicate `r` reuses the same latent draws across arms, so equal effective drives are exactly paired and differing drives are compared under the same draw sequence. The seeded generator is Mulberry32. A second Mulberry32 stream, seeded by `per_run_trajectory_seed`, applies a small common distance scale in `[0.98, 1.02)`. The helper below appears in several target-value equations:

```text
jitter(scale) = ((u1 + u2 + u3 + u4) / 4 − 0.5) × scale
```

where each `u` is the next seeded uniform draw on `[0, 1)`.

The `illustrative_condition_trajectory_seed` remains in the serialized seed policy for compatibility with older consumers. Its condition-level trace is labeled `illustrative_condition_replay`, is excluded from analysis, and is not the arena's authoritative replay. The current arena selects and replays an exact seeded `per_run_simulated_trajectory` from the batch.

### Response threshold, candidate latency, and expression

The first paired draw is compared with the applicable model probability:

```text
p_reverse = clamp(0.08 + 0.79 × d, 0.02, 0.97)
p_short_mode_escape = clamp(0.04 + 0.90 × d, 0.01, 0.98)
response_threshold_crossed = next_uniform_draw < applicable_probability
```

These probabilities and their dose relationship are hand-authored model assumptions. The per-run record distinguishes the probability from what happened in that seeded run with `responseThresholdProbability` and `responseThresholdCrossed`.

Only a crossed threshold produces a candidate latency. The candidate is lower-bounded but deliberately not upper-clamped to the observation window:

```text
candidate_mdn_latency_ms = max(180, 540 + (1 − d) × 1320 + jitter(260))
candidate_gf_latency_ms = max(1.4, 1.4 + (1 − d) × 3.2 + jitter(0.4))
response_window_ms = trial_duration_ms − onset_ms
```

The model then assigns one of three dispositions:

- `not_crossed`: the response draw did not cross the threshold;
- `censored`: the threshold crossed, but the motor map's required expression gate did not fit before the trial boundary; or
- `expressed`: the required expression gate fit and its modeled body sequence appears in the state trajectory.

For MDN, expression requires `candidate_mdn_latency_ms < response_window_ms`. For GF, expression requires the candidate movement onset plus the `1.1 ms` ground-release delay and `1.5 ms` wing-deployment delay to fit strictly inside the response window. A non-crossed or censored run has JSON `null` for `responseLatencyMs`, remains in stance, and has zero expressed displacement, leg deployment, wing deployment, and takeoff even when its premotor drive is nonzero. A censored candidate remains available separately as `candidateResponseLatencyMs`; trial duration is never substituted as an observed response.

### Target values for expressed runs

An expressed MDN run receives the hand-authored target speed:

```text
target_signed_speed_model_mm_s = −(0.62 + 2.25 × d + jitter(0.36))
```

An expressed GF run receives the hand-authored target values:

```text
target_signed_speed_model_mm_s = max(0, 0.92 + 0.70 × d + jitter(0.28))
target_vertical_displacement_model_mm = max(0, 0.42 + 2.60 × d + jitter(0.24))
target_wing_recruitment = clamp(0.05 + 0.90 × d + jitter(0.08), 0, 1)
target_leg_recruitment = clamp(0.06 + 0.92 × d + jitter(0.08), 0, 1)
```

MDN leg recruitment uses:

```text
target_leg_recruitment = clamp(0.18 + 0.72 × d + jitter(0.06), 0, 1)
```

`lateral_sign` is `−1` for left, `+1` for right, and `0` for controls or bilateral conditions. `mode_sign` is `+1` for activation and `−1` for suppression. The lateral effect is `d` for activation and `0.72 − d` for suppression.

```text
heading_change_deg = lateral_sign × mode_sign × (11 + 34 × lateral_effect)
                     + jitter(7 if bilateral else 12)
```

The sign convention and magnitude are hand-authored display/model choices, not a fit to Sen et al.'s laterality assay.

Baseline and target stance indices are also seeded, synthetic controller values:

```text
baseline_stance_stability = clamp(0.91 + jitter(0.06), 0.62, 0.98)
target_stance_stability = clamp(0.91 − 0.08 × d + jitter(0.06), 0.62, 0.98)
```

All amplitudes, probabilities, gains, heading rules, stance values, and MDN dynamics in this section are unfitted model assumptions. They are not measured activation, biological effect sizes, or uncertainty estimates.

## Authoritative state trajectory

Each replicate produces a complete `flylab.per-run-state-trajectory.v2` trace. Its possible states are:

```text
stance → preparation → reverse_walk → recovery
stance → preparation → jump → wing_deployment → airborne → recovery
```

The first sequence applies to an expressed MDN run and the second to an expressed GF run. Non-crossed and censored runs remain in `stance`. `preparation` can carry premotor drive but no displacement or expressed leg/wing output. Each trajectory point includes exact modeled time, position, heading, state, ground contact, leg extension, wing deployment, body pitch, body roll, premotor drive, motor-output status, and stance stability.

The trace contains the 81 uniform samples implied by the configured 80 intervals plus exact event times, immediate `±0.001 ms` neighbors, and between-event midpoints. Position is integrated only between modeled movement onset and recovery. Appendage deployment, lift, pitch, ground contact, and `motorOutputActive` are derived from the same state at the same timestamp. The Three.js arena uses the selected replicate's exact trace and seed; it does not synthesize a separate visual response.

### GF timing calibration boundary

For expressed GF runs, the event timeline is:

```text
controller_threshold = movement_onset − 0.6 ms
ground_release = movement_onset + 1.1 ms
wing_deployment = ground_release + 1.5 ms
recovery_duration = max(1, 180 + 120 × d + jitter(20)) ms
recovery = min(trial_duration, wing_deployment + recovery_duration)
```

[Gaitanidis et al. (2025)](https://doi.org/10.1371/journal.pbio.3003553) constrains only the state-transition order and selected approximate millisecond targets: the `1.4 ms` candidate-latency floor/intercept references its direct-GF DLM short-latency response; the `1.1 ms` ground-release delay reflects the representative light-off interval from first movement at about `3.4 ms` to airborne at about `4.5 ms`; and `1.5 ms` is the midpoint of its reported additional `1–2 ms` to wing extension/beating. Direct-GF electrophysiology and light-off behavior are distinct paradigms, not a single dose-response dataset. The `0.6 ms` controller lead, candidate-latency drive gain and jitter, threshold probability, motion and recruitment amplitudes, body-controller gains, and recovery dynamics remain hand-authored and unfitted. MDN state timing is entirely hand-authored and unfitted. GF silencing uses the same reference-drive convention as MDN silencing; the parallel long-mode escape pathway is not modeled.

### Trace-derived run summaries

Run summaries are calculated from the authoritative per-run state trajectory rather than generated independently:

- backward distance is the maximum backward-axis displacement;
- signed speed uses movement-onset-to-recovery duration and the realized trace displacement;
- heading change is final minus initial trace heading;
- stance stability is a left-continuous, time-weighted mean over the full trace;
- vertical displacement, leg recruitment, and wing recruitment are trace maxima; and
- takeoff success requires an `airborne` point with `groundContact=false`.

The simulation output contains every per-run trace. Analysis returns per-run audit rows linked to those trace IDs. The compatibility-only `illustrative_condition_replay` is generated by the older condition-level 80-step routine and remains explicitly excluded from the arena, run summaries, condition metrics, and scientific interpretation.

## Analysis

`flylab.behavior-metrics.v5` reports condition means from those trace-derived run summaries. Each motor map declares its complete five-metric panel. Every metric publishes a machine-readable formula, unit, sign convention, aggregation, null rule, full-trial window semantics, method version, provenance, and interpretation boundary. Response initiation is a separately declared expressed-body summary. MDN additionally reports reverse initiation. GF short-mode escape probability counts runs whose trace actually reaches `airborne` without ground contact; it is not the threshold probability and not total takeoff probability. Heading change is the absolute condition-mean signed change. Response latency is averaged over expressed responsive runs only and reports both `responsiveN` and total `n`; a no-response or wholly censored condition is JSON `null`. FlyLab does not claim a formal preregistration artifact.

The analysis tool serializes its formal threshold/censoring method block as `response_observation_summary_definition`, with the definition ID `response_threshold_and_censoring_summary`. All three fields use the full-trial window and are never null:

- `thresholdCrossingProbability = thresholdCrossedN / n`, the empirical fraction of seeded runs whose draw crossed its threshold;
- `thresholdCrossedN = sum(I(responseThresholdCrossed))`, the integer number of threshold-crossing runs; and
- `censoredN = sum(I(responseDisposition = 'censored'))`, the integer number of threshold-crossing candidates whose complete declared body transition did not fit inside the trial window.

`thresholdCrossingProbability` summarizes realized seeded draws. It is distinct from each run's `responseThresholdProbability`, which is the hand-authored generator probability used before the draw. Neither quantity, nor either count, is a biological response rate or a survival-analysis estimate.

The comparison ranks those model-derived condition summaries by the requested objective and proposes nearby nominal control levels. The ranking remains `derived` plus `simulation_predicted`; the follow-up proposal remains `agent_hypothesized` and is never executed automatically.

## Reproducibility and change control

The authoritative numeric parameter object is `MODEL_PARAMETERS` in `lib/flylab.ts`; the equations above mirror that object. Model, controller, environment, seed-policy, metric-method, and parameter-set identifiers are serialized into experiments, batches, approvals, and evidence exports.

The batch carries two hashes with deliberately different scopes:

- legacy `runHash` is FNV-1a over only the ordered `{ runId, trajectoryId }` pairs and is retained as an identity summary for compatibility; and
- `runContentHash` is SHA-256 over `JSON.stringify({ protocol, model, conditionRuns })`, covering the exact protocol, model manifest, complete run records, event timelines, and trajectories.

Analysis recomputes `runContentHash`, rejects a mismatch, records it as `batchRunContentHash`, and binds it into the analysis ID. Approval protocol and seed-manifest commitments use SHA-256 independently of both batch hashes. Portable evidence exports use schema version `3`; the advertised JSON Schema is [flylab-evidence-export-v3.schema.json](https://flylab-neuroethology.d-lougen.chatgpt.site/schemas/flylab-evidence-export-v3.schema.json). A schema or digest validates structure or byte-level consistency only; neither is a digital signature, biological validation, or proof of authorship.

A change to model behavior requires a version change, updated tests, this model card, and a newly verified release candidate. This card describes the implementation; it does not by itself assert that v0.3.0 has passed a particular live-browser or production-release check.
