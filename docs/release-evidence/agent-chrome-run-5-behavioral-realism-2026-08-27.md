# FlyLab behavioral-realism retest — Chrome run 5

## Outcome

**Scientific UI workflow: COMPLETE. Native WebMCP agent invocation: NOT EXERCISED. Behavioral realism: NOT YET VALIDATED.**

FlyLab's public page registered all eight WebMCP tools in the relaunched external Chrome process. The controlling Codex task still exposed zero of those page-registered tools, so the scientific workflow was completed through FlyLab's visible **Manual recovery walkthrough**. That walkthrough used the page's local validated workflow handlers, including the visible operator approval control, but it did not test Site Tool discovery, model-visible invocation, or a WebMCP callback.

The run selected the adult giant-fiber pathway, separated measured and connectome-derived evidence from model assumptions, drafted a falsifiable hypothesis, accepted an exact three-arm virtual protocol through the visible operator approval control, ran 24 seeded simulations, analyzed all five declared metrics, compared the conditions, and saved a mission evidence bundle. The browser download watcher timed out; the expected export file was later found and independently validated.

All behavioral results in this log are **simulation-predicted outputs from FlyLab model 0.2.0**. They are not observations or measurements from animals.

## Run identity

| Field | Value |
|---|---|
| Test date | 2026-08-27 |
| Browser surface | User's external Chrome, controlled through the ChatGPT/Codex Chrome extension |
| URL | `https://flylab-neuroethology.d-lougen.chatgpt.site/` |
| FlyLab page session | `session_fd2776cb8bb44735` — the same page session recorded in run 4 |
| Final page state | revision `12`; local workflow `8/8`; stage complete |
| Browser-side Site Tools | connected; `8/8` registered |
| Agent-visible FlyLab tools | `0/8` |
| WebMCP callback observed | no |
| Execution path | visible Manual recovery walkthrough using page-local validated handlers |
| Model | FlyLab mapped-motor embodiment model `0.2.0` |
| Metric method | `flylab.behavior-metrics.v4` |
| Seed policy | `flylab.seed-policy.v2` |
| Workspace HEAD when this log was written | `ef0663d1d50c062edd0ec129b21527d9677e61dd` |

The workspace hash is local context only. This interactive run did not independently bind the public deployment to that commit.

## Transport classification

This run must not be presented as a native ChatGPT WebMCP transcript.

```text
FlyLab page -> document.modelContext.registerTool -> 8/8 accepted
Codex task  -> callable FlyLab Site Tools          -> 0/8 exposed
Operator    -> visible recovery walkthrough       -> complete UI workflow
```

The recovery workflow is useful for testing FlyLab's scientific state machine, approval binding, model outputs, UI, and evidence export. It does not prove that an agent discovered or invoked the eight registered Site Tools. Run 4 remains the clean browser-registration/client-exposure diagnosis; run 5 adds a complete scientific and behavioral-model audit through the honest fallback route.

## Mission

> Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.

## Discovery and evidence boundary

FlyLab ranked the giant-fiber circuit above the MDN circuit for this mission:

| Candidate | Score | Matched goal terms | Decision |
|---|---:|---|---|
| GF / DNp01 | 59 | escape, leg, output, wing | selected |
| MDN | 27 | leg, separate | not selected |

Discovery artifact: `discovery_fe453d8567d44d583c6bbdc79659ceb45a54e067f754f61823d8a8219d3eabb8`

Selected circuit: `circuit_gf_adult` — Giant fiber escape pathway, motor map `motor_map_gf_escape_v1`.

### Evidence used as scientific support

| Evidence ID | Provenance | Supported connection or claim | Allowed interpretation |
|---|---|---|---|
| `E-GF-CAUSAL-010` | measured | Adult targeted GF activation elicited short-mode escape; silencing reduced it; timing selected the fast pathway | causal direction under the cited adult assays |
| `E-GF-PATH-011` | measured | GF reaches the TTM jump-muscle motor branch and the PSI/DLM wing branch | anatomical/physiological leg-and-wing output context |
| `E-FANC-ESCAPE-012` | connectome-inferred | FANC reconstruction provides structural hypotheses for coupled premotor pathways | structural context only, not perturbation evidence |

### Model-only records

`E-FLYLAB-MODEL-004` supplied method and model context and was not used as causal evidence. The following final links are explicitly hand-authored adapters, not measured or connectome-derived biological links:

- TTM to left and right midleg;
- DLM to left and right wing.

FlyLab also states that the simulator does not execute neurons, synapses, muscles, aerodynamics, a connectome, or FlyGym. The GF rendering is a schematic bilateral literature map and does not encode all reported biological laterality.

## Falsifiable hypothesis

Hypothesis ID: `hyp_8ed2c08229a3dcedfb531ef95981faf0d0be0f6261ecae9f0379ea89d0bc29bf`

> In FlyLab, bilateral giant-fiber model drive will increase predicted short-mode escape relative to baseline and model-sham conditions.

- Primary outcome: `short_mode_escape_probability`
- Expected direction: increase
- Controls: baseline and model sham
- Falsification criterion: no increase relative to both controls
- Provenance: `agent_hypothesized`
- Boundary: the cited assays support direction, not FlyLab's reduced-order effect size or its brain-to-leg-and-wing transfer function

## Exact approved virtual protocol

Experiment ID: `exp_f7e5caa469e53ceb9421b4b7bcbe362186a93a61645099ce0f9f568609b6c84b`

| Field | Approved value |
|---|---|
| Target | `circuit_gf_adult` via `motor_map_gf_escape_v1` |
| Perturbation | activate |
| Laterality | bilateral |
| Body targets | left/right midleg and left/right wing |
| Nominal activation level | `0.75`, unitless model control |
| Onset | 500 ms |
| Duration | 900 ms |
| Trial duration | 3000 ms |
| Conditions | baseline; zero-effect model sham; bilateral GF / DNp01 model drive |
| Replicates | 8 per condition; 24 virtual runs total |
| Base seed | 91827 |
| Pairing | common random numbers by replicate; stride 37 |
| Primary outcome | simulated short-mode escape probability |

The visible **Approve this exact experiment** control was clicked only after reviewing this protocol. This records authorization through an operator-visible control; it does not establish the operator's human identity.

| Approval field | Value |
|---|---|
| Approved at | `2026-08-27T14:18:53.554Z` |
| Protocol hash | `sha256:6705d6e0d8e34a39f4920f966f4025ac80baacb8f146d0947b54282317c46212` |
| Seed-manifest hash | `sha256:668f800d71e5381b5801d33119f35684ea8b3da09e1f31702c8cbf94282bfd94` |

No follow-up experiment was executed without a second approval.

## Simulation and analysis lineage

| Artifact | ID |
|---|---|
| Simulation batch | `batch_1a046d19ef3e04564fa4a7215ebdbb7faf6f560affce846c34a53d952e3b738e` |
| Behavioral analysis | `analysis_b4ff21a7158378543d3fe1862922ecc83903c00cdc7b9a89f962ebed7fae0f8b` |
| Condition comparison | `comparison_09cb44cd0d37072f8c97901c795be9f138ec49f80278f9e10be3196f7686f76a` |
| Unexecuted follow-up proposal | `proposal_61703a0682a4798ee0479ddc1105855a45d366dab8f19b0f4b0f2ab92296dfd1` |

## All declared behavioral metrics

Condition-level values are means across eight seeded virtual runs per arm. Latency is averaged over responsive runs only. Distances are model-scale values, and recruitment values are synthetic unitless indices.

| Condition | Initiated | Latency, responsive only | Short-mode probability | Vertical displacement | Wing index | Leg index |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 1/8 (12.5%) | 669.54 ms (`n=1`) | 0.125 | 0.053 model mm | 0.049 | 0.064 |
| Model sham | 1/8 (12.5%) | 669.54 ms (`n=1`) | 0.125 | 0.053 model mm | 0.049 | 0.064 |
| Bilateral GF / DNp01 | 3/8 (37.5%) | 488.06 ms (`n=3`) | 0.375 | 0.522 model mm | 0.386 | 0.409 |

Simulation-predicted bilateral-minus-control differences:

- response initiation and short-mode escape: `+0.25`, or 25 percentage points;
- response latency: `-181.48 ms`, but on different responsive subsets (`n=3` versus `n=1`);
- vertical displacement: `+0.469 model mm`;
- wing recruitment: `+0.338` index units;
- leg recruitment: `+0.345` index units.

Baseline and sham were exactly identical because both have zero effective drive and reuse the same latent draws under the common-random-number design. That is expected model behavior, not independent replication of a null effect.

The simulated hypothesis was not falsified in this seed set: the bilateral arm ranked `0.375`, above baseline and sham at `0.125`. With only eight runs per condition, the probability resolution is 12.5 percentage points and there are no uncertainty intervals. This is a demo-scale model result, not robust evidence of biological effect size.

## Per-run realism audit

Every bilateral replicate used `effectiveMotorDrive = 0.375`, despite a nominal protocol level of `0.75`. The export exposes a 900 ms drive duration and a 1800 ms duration reference, consistent with a hidden `0.5x` duration gain. The visible protocol did not explain that transformation.

The bilateral generator's response-threshold probability field was fixed at `0.3775` for every replicate. Three seeds initiated the modeled response, so the observed bilateral fraction was `3/8 = 0.375`. The threshold probability and observed fraction are distinct quantities.

| Seed | Response latency | Vertical displacement | Wing index | Leg index |
|---:|---:|---:|---:|---:|
| 91827 | 483.68 ms | 1.390 model mm | 0.379 | 0.425 |
| 91864 | 502.22 ms | 1.391 model mm | 0.384 | 0.397 |
| 91938 | 478.29 ms | 1.398 model mm | 0.375 | 0.402 |

The other five bilateral runs did **not** initiate a response and had zero vertical displacement, yet still reported wing indices from `0.376` to `0.403` and leg indices from `0.394` to `0.421`. This is the clearest current indication that FlyLab generates response state, appendage recruitment, and body motion as partially independent scores rather than as one causally consistent fly.

Across every paired seed, bilateral drive adds the same fixed increments: `+0.3375` to the generator's response-threshold probability, `+0.2625 model mm/s` signed speed, `+0.3375` wing index, `+0.345` leg index, and `-0.03` stance stability, with no bilateral heading effect. This deterministic linear structure is useful for reproducibility but makes the current controller visibly hand-authored rather than biologically variable.

The trajectories contain 81 points per run, but speed, heading, and stance vary only modestly across response states. The current 3D replay is correctly labeled schematic and illustrative; it is not a raw replicate trace and is excluded from metric calculation.

## What the run says about “making the fly a fly”

The provenance system is stronger than the behavior model. FlyLab now does a good job of telling the reader which claims are measured, connectome-inferred, simulated, or hypothesized. The next development cycle should make the simulated body obey one coherent causal state instead of adding more catalog evidence or visual polish.

### P0 — make one embodied event drive every output

1. Replace the independent Bernoulli-plus-scalar generator with an explicit state machine: stance → preparation → jump → wing deployment → airborne → recovery.
2. Derive leg pose, wing pose, ground contact, lift, velocity, trajectory, and reported metrics from that same state trajectory.
3. Gate or relabel appendage outputs. If `responseInitiated` is false, “escape recruitment” should not look fully expressed; a pre-threshold signal should be named premotor/controller activation rather than body recruitment.
4. Surface the complete nominal-control-to-effective-drive calculation. A reviewer should be able to see why `0.75` became `0.375` before approving the run.
5. Calibrate GF short-mode timing. The simulated 488 ms latency is on a fundamentally different timescale from primary measurements: direct GF stimulation produces an approximately 1.4 ms short-latency DLM response, while light-off-induced escape showed first movement at about 3.4 ms, airborne state at about 4.5 ms, and wing extension or beating another 1–2 ms later ([Gaitanidis et al., PLOS Biology, 2025](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3003553)). Those paradigms are not one-to-one equivalents of FlyLab's unitless virtual activation, so use them as calibration targets rather than claiming a direct match. Model and display the order and interval of jump-muscle activation, leg extension, wing deployment, and ground release; the original short-mode study also identifies relative GF timing as the mechanism selecting the rapid response ([von Reyn et al., Nature Neuroscience, 2014](https://www.nature.com/articles/nn.3741)).

### P1 — test coordination, not only whole-controller gain

1. Add branch interventions: GF activation plus TTM branch silencing, GF activation plus wing-branch silencing, and GF silencing under a loom-like trigger. These can falsify whether the model truly coordinates leg and wing branches.
2. Add sensory and pre-stimulus state: looming geometry/velocity, posture, walking state, ground contact, and readiness. A real fly's escape is state dependent, not only a seeded Bernoulli draw.
3. Add behavior-first metrics: leg-to-wing onset offset, jump impulse, ground-release time, takeoff success, body pitch/roll/yaw, vertical velocity and acceleration, wingbeat onset/frequency, airborne stability, and landing/recovery.
4. Choose replicate counts from a prespecified precision or power target and show exact binomial intervals or paired bootstrap intervals. A range such as 50–100 is an illustrative planning proposal, not a number derived from this bundle; eight, and the proposed follow-up budget of ten, are too small for a stable probability readout.
5. Calibrate parameter distributions against measured timing and kinematic datasets, then reserve separate observations for held-out validation. Measured perturbation evidence should support causal direction; connectome records should remain structural priors.
6. Decide whether the sham is only a deterministic zero-effect model control or is meant to represent an experimental sham. If it is experimental, model the relevant light, heat, expression, genotype, handling, and assay effects; otherwise keep the current honest label and explain that it contributes no independent simulated information.

### P2 — improve experimental information and reviewer trust

1. Replace the narrow proposed `0.6/0.9` follow-up with a preregistered dose-response, for example `0, 0.25, 0.5, 0.75, 1.0`, including monotonicity and timing expectations. This grid is a proposed example, not an inference from the saved bundle.
2. Add paired-difference and uncertainty views. Explain that exact baseline/sham equality is expected under zero effective drive plus common random numbers.
3. Give model `0.2.0` a visible calibration-status badge: hand-authored, uncalibrated, reduced-order.
4. Keep the schematic 3D viewer, but animate the actual state sequence and allow replay of a selected seeded trajectory. Do not let a polished animation imply neural, muscle, or aerodynamic fidelity that the model does not have.
5. Repair the integrity documentation. `docs/SCIENTIFIC_BOUNDARIES.md` currently describes IDs and run hashes as FNV-1a, while artifact IDs are SHA-256-derived and only `runHash` is FNV-1a. The 32-bit `runHash` covers run/trajectory identifier pairs, not metric or trajectory contents, so it should be renamed as a lineage summary or expanded to a content digest. The full payload SHA-256 remains the actual content-integrity check.
6. Publish a standalone machine-readable JSON Schema for the v3 export. The repository currently verifies the envelope through TypeScript contracts and tests, which is reproducible but less portable for outside judges and downstream agents.

## Engineering change map

Keep three kinds of realism separate so a visual improvement is not mistaken for a model improvement:

| Scope | Primary implementation area | Required change |
|---|---|---|
| Outcome/model realism | `lib/flylab.ts` around the model parameters, effective-drive calculation, seeded outcomes, and per-run trajectory construction | shared state machine, calibrated distributions, causal invariants, visible drive derivation |
| Representational fidelity | `app/page.tsx` around the selected condition replay | replay an actual chosen seeded trajectory and expose its response state instead of relying only on the separate illustrative condition path |
| Visual plausibility | `components/FlyArena3D.tsx` | animate state-derived joints, contacts, body attitude, wing deployment, and lift while retaining the schematic boundary |
| Circuit-to-body mapping | `lib/embodied-fly.ts` | version branch-specific leg/wing controls and expose what remains hypothesized |
| Scientific contract | `docs/MODEL_CARD.md` and `docs/SCIENTIFIC_BOUNDARIES.md` | bump model/method versions when semantics change; document calibration, invariants, and interpretation limits |
| Verification | `tests/flylab.test.ts` and `tests/fly-arena-3d.test.ts` | add per-run state invariants, branch-ablation selectivity, aggregate recomputation, and seeded replay parity |

The existing illustrative condition trajectory and the per-run trajectory are distinct code paths. Changing only the 3D animation can make the demo look more fly-like without making its simulated outcomes more coherent. The release evidence should continue to distinguish those claims.

## Recommended next acceptance test

The next behavioral-model version should not be considered “more fly-like” until it passes this controlled test:

1. Run baseline, sham, whole-GF activation, GF+TTM-branch silencing, and GF+wing-branch silencing with at least 100 paired seeds per arm.
2. Predeclare a state-transition schema and leg-to-wing timing outcome.
3. Assert invariants on every run:
   - no airborne state before ground release;
   - no takeoff success without a jump transition;
   - no wing-deployment metric without the corresponding body state;
   - branch silencing selectively removes its downstream kinematics;
   - all aggregate metrics recompute exactly from the state trajectory.
4. Compare timing and kinematic distributions with held-out biological reference data, while retaining the labels `simulation_predicted` and `derived` for model outputs.
5. Save a new evidence bundle containing calibration data identity, fitted parameters, held-out evaluation, invariant-test results, and the exact approval binding.

## Saved evidence bundle

| Field | Value |
|---|---|
| Bundle ID | `evidence_06b9daf2e1c7d6a6404e4f81841549882f41b884018b04d731be0a27c52c5660` |
| Scope | mission |
| Saved at | `2026-08-27T14:20:25.581Z` |
| Included identifiers | 136 |
| Payload/manifest hash | `sha256:567bc5246caab3c1027d378dcaa371bea0d6578e8c994ed360b12914ea4539a0` |
| Retained evidence file | [`evidence_06b9daf2e1c7d6a6404e4f81841549882f41b884018b04d731be0a27c52c5660.flylab-evidence.json`](evidence_06b9daf2e1c7d6a6404e4f81841549882f41b884018b04d731be0a27c52c5660.flylab-evidence.json) |
| File size | 1,086,632 bytes |
| Envelope SHA-256 | `ba6662a5b5c4bd8d185238a47ec4e205f5b5a204f8b4b31959f672db05f55bb0` |
| Schema | `flylab.evidence-export`, version 3 |

The JSON parses successfully. Re-serializing `.payload` with compact JSON produces SHA-256 `567bc5246caab3c1027d378dcaa371bea0d6578e8c994ed360b12914ea4539a0`, exactly matching the declared manifest hash. The browser download watcher timed out; the expected file was later found and passed the independent envelope and payload checks above. This validates the retained file, but does not retroactively turn the timed-out watcher into a successful observed download.

An independent read-only audit also regenerated the hypothesis, approved experiment, full batch (including all trajectory points), analysis, and comparison with the current compiled implementation; each regenerated JSON artifact matched the exported payload byte for byte. All 24 run IDs, 27 trajectory IDs, seeds, 81-point trajectory shapes, metric aggregates, 136 included identifiers, lineage edges, and provenance pointers passed consistency checks.

Bundle provenance counts (labels can overlap for an identifier, so these are not mutually exclusive and need not sum to the 136 included identifiers):

| Label | Identifiers |
|---|---:|
| measured | 27 |
| derived | 28 |
| connectome-inferred | 4 |
| simulation-predicted | 54 |
| agent-hypothesized | 26 |

The integrity field is a change-detection checksum, not a digital signature or guarantee of immutability.

## Successor remediation status

This file remains the contemporaneous historical audit of the visible-fallback FlyLab `0.2.0` run. A `0.3` successor remediation is in progress to address the state-coherence, replay, integrity, and portable-schema findings above. No native WebMCP verification, public deployment, or biological validation of that successor is claimed here; fresh release evidence should be linked when those checks are complete rather than rewriting run 5 as if it exercised the newer model.

## Final classification

Run 5 is a successful end-to-end test of FlyLab's visible scientific workflow and evidence packaging. It is not a native WebMCP agent invocation, not a wet-lab experiment, and not biological validation. Its most important product result is a concrete next objective: preserve FlyLab's strong provenance boundaries while replacing loosely coupled scores with a calibrated, stateful, physically consistent leg–wing takeoff event.
