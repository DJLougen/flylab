# FlyLab reduced-order model card

## Identity and permitted interpretation

| Field | Value |
|---|---|
| Model | `FlyLab reduced-order embodiment model` |
| Version | `0.1.3` |
| Controller | `mdn-inspired-retreat-adapter.v2` |
| Environment | `open-field-model-scale.v2` |
| Parameter set | `flylab.reduced-order-parameters.v1` |
| Parameter provenance | `agent_hypothesized` |
| Batch provenance | `simulation_predicted` |
| Analysis provenance | `derived`, `simulation_predicted` |

This is a deterministic, hand-authored challenge model. Its constants were not fitted to the cited fly assays, BANC contact counts, neural recordings, or FlyGym output. It does not execute FlyGym, BANC neurons, neural dynamics, biomechanics, contacts, forces, or a wet-lab protocol. Distances and speeds use declared **model-scale millimeter units**. They are internally consistent within FlyLab but are not calibrated biological effect sizes.

FlyGym v2.1.0 is a pinned embodiment reference only. The FlyLab controller and equations below are local implementation choices, not results from FlyGym.

## Canonical parameter object

The block below is machine-checked against the exported runtime object. A parameter change that does not update this card fails the test suite.

<!-- MODEL_PARAMETERS_JSON_START -->
```json
{
  "name": "flylab.reduced-order-parameters.v1",
  "provenance": "agent_hypothesized",
  "calibration": "Hand-authored for deterministic challenge demonstration; not fitted to the cited fly assays, BANC contact counts, neural recordings, or FlyGym output.",
  "unitBoundary": "Distances and speeds use declared model-scale millimeter units. They are internally consistent but are not biologically calibrated effect sizes.",
  "durationReferenceMs": 1800,
  "durationGainBounds": [
    0.35,
    1.2
  ],
  "unilateralGain": 0.72,
  "maximumRetreatDrive": 1.1,
  "silencingReferenceDrive": 0.72,
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

Each experiment records perturbation mode, laterality, nominal control level `a`, onset, duration, trial duration, replicate count, base seed, conditions, model version, and assumptions. `a` is unitless on `[0, 1]`; it is not light power, firing rate, expression level, or a measured dose.

Every experiment contains baseline, model-sham, and perturbation arms. A bilateral design also contains left-only and right-only perturbation arms. Each condition separates:

- `nominalControlLevel`: the requested unitless setting;
- `expectedModelEffect`: a machine-readable description of how the adapter treats it; and
- the computed retreat-drive value `d` used by the model.

The sham may retain the nominal setting, but its expected effect is explicit. For activation it has zero effective retreat drive. For silencing it retains the same hand-authored reference retreat drive as the unsuppressed control.

## Retreat-drive adapter

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

Silencing experiments use a hand-authored reference retreat drive of `0.72`:

```text
d_baseline = 0.72
d_sham = 0.72
suppression_fraction = clamp(adapter_amount, 0, 0.92)
d_perturbation = 0.72 × (1 − suppression_fraction)
```

This makes suppression magnitude operational rather than silently discarding it. It is still only a model assumption. Baseline and sham in a silencing trial represent an unsuppressed simulated retreat reference, not measured endogenous MDN activity or a physical obstacle assay.

## Seeded replicate summaries

For replicate index `r` in condition index `c`:

```text
replicate_seed = base_seed + c × 1009 + r × 37
```

The seeded generator is Mulberry32. The helper below appears in several equations:

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

This is a synthetic unitless model index. It does not derive from foot contacts, forces, joint kinematics, or a validated gait-stability measure.

## Illustrative condition trajectory

The Three.js replay is generated separately from the replicate summaries above. It is an illustrative condition path and is not the raw trajectory used to calculate the metric cards.

The replay has 80 equal time steps. Within the nominal protocol window, its step magnitude is:

```text
step_model_mm = 0.018 + 0.036 × d
```

The path uses backward direction when `d > 0.12`, position jitter scale `0.006` model mm, and out-of-target heading jitter scale `0.08` degrees. During a unilateral perturbation target window, the per-step heading increment is:

```text
lateral_sign × mode_sign × (0.32 + 0.34 × lateral_effect)
```

The `active` flag and circuit glow indicate only that a perturbation arm is in its target window. Baseline and sham remain unilluminated even when a silencing trial's reference drive produces modeled retreat.

## Analysis

`flylab.behavior-metrics.v2` reports condition means across the seeded replicate summaries. Reverse-initiation probability is the responsive fraction. Response latency is averaged over responsive runs only and reports both `responsiveN` and total `n`. Analysis requires the complete predefined five-metric panel. FlyLab does not claim a formal preregistration artifact.

The comparison ranks those model-derived condition summaries by the requested objective and proposes nearby nominal control levels. The ranking remains `derived` plus `simulation_predicted`; the follow-up proposal remains `agent_hypothesized` and is never executed automatically.

## Reproducibility and change control

The authoritative numeric parameter object is `MODEL_PARAMETERS` in `lib/flylab.ts`; the equations above mirror that object. Model, controller, environment, and parameter-set identifiers are serialized into experiments, batches, and evidence exports. A change to model behavior requires a version change, updated tests, this model card, and a fresh public deployment.
