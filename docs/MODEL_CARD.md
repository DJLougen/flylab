# FlyLab mapped-motor model card

## Identity and permitted interpretation

| Field | Value |
|---|---|
| Model | `FlyLab mapped-motor embodiment model` |
| Version | `0.2.0` |
| Controller | `mapped-circuit-to-body-adapter.v1` |
| Environment | `open-field-model-scale.v2` |
| Parameter set | `flylab.mapped-motor-parameters.v2` |
| Seed policy | `flylab.seed-policy.v2` |
| Metric method | `flylab.behavior-metrics.v4` |
| Parameter provenance | `agent_hypothesized` |
| Batch provenance | `simulation_predicted` |
| Analysis provenance | `derived`, `simulation_predicted` |

This is a deterministic, hand-authored challenge model with separate MDN reverse-walk and giant-fiber short-mode escape motor maps. Its constants were not fitted to the cited fly assays, connectome contact counts, neural recordings, or FlyGym output. It does not execute FlyGym, connectome neurons, electrical or chemical synapses, neural dynamics, biomechanics, contacts, muscles, aerodynamics, or a wet-lab protocol. Distances and speeds use declared **model-scale millimeter units**. They are internally consistent within FlyLab but are not calibrated biological effect sizes.

FlyGym v2.1.0 is a pinned embodiment reference only. The FlyLab controller and equations below are local implementation choices, not results from FlyGym.

## Canonical parameter object

The block below is machine-checked against the exported runtime object. A parameter change that does not update this card fails the test suite.

<!-- MODEL_PARAMETERS_JSON_START -->
```json
{
  "name": "flylab.mapped-motor-parameters.v2",
  "provenance": "agent_hypothesized",
  "calibration": "Hand-authored for deterministic challenge demonstration; not fitted to the cited fly assays, BANC contact counts, neural recordings, or FlyGym output.",
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
      "interceptMs": 165,
      "inverseDriveGainMs": 510,
      "jitterScaleMs": 90,
      "minimumClampMs": 55
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

## Seeded replicate summaries

For zero-based replicate index `r`, every condition reuses the same seed:

```text
replicate_seed = base_seed + r × 37
per_run_trajectory_seed = replicate_seed + 104729
illustrative_condition_trajectory_seed = base_seed + 130363
```

This is a common-random-number design: replicate `r` reuses the same latent draws across arms, so equal effective drives are exactly paired and differing drives are compared under the same draw sequence. The seeded generator is Mulberry32. The helper below appears in several equations:

```text
jitter(scale) = ((u1 + u2 + u3 + u4) / 4 − 0.5) × scale
```

where each `u` is the next seeded uniform draw on `[0, 1)`.

### Reverse initiation

```text
p_reverse = clamp(0.08 + 0.79 × d, 0.02, 0.97)
reverse_initiated = next_uniform_draw < p_reverse
```

### Signed model-scale speed

If reverse initiation occurs:

```text
signed_speed_model_mm_s = −(0.62 + 2.25 × d + jitter(0.36))
```

Otherwise:

```text
signed_speed_model_mm_s = 0.92 − 0.25 × d + jitter(0.28)
```

### Response latency

For a responsive run, with `response_window_ms = trial_duration_ms − onset_ms`:

```text
latency_ms = clamp(
  540 + (1 − d) × 1320 + jitter(260),
  min(180, response_window_ms),
  response_window_ms
)
```

For a non-responsive run, latency is JSON `null`; FlyLab never substitutes trial duration.

### Backward distance

```text
reverse_seconds = max(response_window_ms − latency_ms, 0) / 1000
distance_scale = 0.72 + next_uniform_draw × (0.92 − 0.72)
backward_distance_model_mm = abs(signed_speed_model_mm_s) × reverse_seconds × distance_scale
```

Non-responsive runs receive zero backward distance.

### Heading change

`lateral_sign` is `−1` for left, `+1` for right, and `0` for controls or bilateral conditions. `mode_sign` is `+1` for activation and `−1` for suppression. The lateral effect is `d` for activation and `0.72 − d` for suppression.

```text
heading_change_deg = lateral_sign × mode_sign × (11 + 34 × lateral_effect)
                     + jitter(7 if bilateral else 12)
```

The sign convention and magnitude are hand-authored display/model choices, not a fit to Sen et al.'s laterality assay.

### Stance-stability index

```text
stance_stability = clamp(0.91 − 0.08 × d + jitter(0.06), 0.62, 0.98)
```

The per-run record also carries a non-panel reverse-walk leg-recruitment index for embodiment traces:

```text
leg_recruitment = clamp(0.18 + 0.72 × d + jitter(0.06), 0, 1)
```

It is a synthetic controller summary, not a measured activation or one of the MDN analysis panel's five metrics.

This is a synthetic unitless model index. It does not derive from foot contacts, forces, joint kinematics, or a validated gait-stability measure.

## Giant-fiber short-mode escape adapter

The giant-fiber profile uses the same bounded unitless motor drive `d`, but routes it to a separate response model. The cited literature supports the adult GF short-mode escape pathway and its TTM jump-leg and PSI/DLM wing branches; it does not supply the following numeric gains.

```text
p_short_mode_escape = clamp(0.04 + 0.90 × d, 0.01, 0.98)
latency_ms = clamp(165 + (1 − d) × 510 + jitter(90), min(55, response_window_ms), response_window_ms)
signed_speed_model_mm_s = 0.92 + 0.70 × d + jitter(0.28)
vertical_displacement_model_mm = max(0, 0.42 + 2.60 × d + jitter(0.24))
wing_recruitment = clamp(0.05 + 0.90 × d + jitter(0.08), 0, 1)
leg_recruitment = clamp(0.06 + 0.92 × d + jitter(0.08), 0, 1)
```

Non-responsive runs receive zero vertical displacement. These outputs are seeded reduced-order indices and model-scale motion, not wingbeat amplitude, muscle force, aerodynamic lift, a synaptic response, or a fit to the sub-millisecond physiological timing reported in giant-fiber experiments. GF silencing uses the same hand-authored reference-drive convention as MDN silencing; it is not a model of the parallel long-mode escape pathway.

## Per-run and illustrative trajectories

Every replicate has a complete `per_run_simulated_trajectory` generated from its recorded trajectory seed. Its response onset, direction, speed, heading, and vertical displacement are consistent with that run's scalar result. The simulation response returns the full trace; the analysis response returns its ID, seed, role, completion status, and point count for audit.

The Three.js condition replay is generated separately from the replicate summaries above. It is labeled `illustrative_condition_replay`, is not any run trajectory, and is never used to calculate metric cards.

The replay has 80 equal time steps. The MDN reverse-walk program uses:

```text
step_model_mm = 0.018 + 0.036 × d
```

and backward direction when `d > 0.12`. The bilateral GF short-mode escape program never applies that reversal and instead uses:

```text
forward_step_model_mm = 0.018 + 0.018 × d
vertical_step_model_mm = 0.035 × d during the active target window
```

Both programs use position jitter scale `0.006` model mm and out-of-target heading jitter scale `0.08` degrees. During a supported unilateral MDN perturbation target window, the per-step heading increment is:

```text
lateral_sign × mode_sign × (0.32 + 0.34 × lateral_effect)
```

The `active` flag and circuit/body glow indicate only that a perturbation arm is in its target window. The separate `motorOutputActive` flag controls modeled appendage motion and lift. Baseline and sham remain unilluminated even when a silencing trial's reference drive produces a modeled motor response.

## Analysis

`flylab.behavior-metrics.v4` reports condition means across the seeded replicate summaries. Each motor map declares its complete five-metric panel. Every metric publishes a machine-readable formula, unit, sign convention, aggregation, null rule, full-trial window semantics, method version, provenance, and interpretation boundary. Response initiation has a separately declared summary definition. MDN additionally reports reverse initiation and GF reports short-mode escape probability—not total takeoff probability. Heading change is returned and displayed as the absolute condition-mean magnitude. Response latency is averaged over responsive runs only and reports both `responsiveN` and total `n`; a no-response condition is JSON `null`. The response also exposes per-run audit rows linked to trajectory IDs. FlyLab does not claim a formal preregistration artifact.

The comparison ranks those model-derived condition summaries by the requested objective and proposes nearby nominal control levels. The ranking remains `derived` plus `simulation_predicted`; the follow-up proposal remains `agent_hypothesized` and is never executed automatically.

## Reproducibility and change control

The authoritative numeric parameter object is `MODEL_PARAMETERS` in `lib/flylab.ts`; the equations above mirror that object. Model, controller, environment, seed-policy, metric-method, and parameter-set identifiers are serialized into experiments, batches, approvals, and evidence exports. A change to model behavior requires a version change, updated tests, this model card, and a newly verified release candidate.
