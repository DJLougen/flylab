# Scientific boundaries

This document defines what the current FlyLab challenge release does, what its outputs mean, and what must not be inferred from them.

## Validated product scope

The challenge release is intentionally bounded:

- organism and stage: adult *Drosophila*
- neural targets: Moonwalker descending neurons (MDNs) for legged retreat and Giant Fiber/DNp01 for short-mode middle-leg/wing escape output
- behavior objectives: backward walking/retreat and reduced-order GF short-mode escape in a simplified open field
- perturbations: activate or silence in a unitless model control
- laterality: bilateral, left, or right
- controlled design: baseline, model-sham, primary perturbation, and unilateral comparisons for a bilateral design

The catalog contains two exposed circuits, `circuit_mdn_adult` and `circuit_gf_adult`. A broad query does not imply whole-fly coverage. The body coverage registry marks a body part only where a source-backed path reaches a hand-authored reduced-order controller; this does not mean all muscles, joints, sensory inputs, or behaviors are represented.

## What the current embodiment is

The runtime manifest is:

```text
model       FlyLab mapped-motor embodiment model
version     0.2.0
controller  mapped-circuit-to-body-adapter.v1
environment open-field-model-scale.v2
```

The model is a deterministic, reduced-order body-controller generator. It converts a bounded circuit-control abstraction into either MDN reverse-walk or GF short-mode escape outputs. Its typed motor maps are provenance records and controller bindings, not executable connectomes.

The current embodiment is **not**:

- FlyGym or NeuroMechFly execution
- a MuJoCo or biomechanically complete fly
- a neural-network, conductance, spiking, or whole-brain dynamics model
- a direct simulation of the BANC or MANC connectome
- a virtual optogenetic apparatus
- a wet-lab experiment

The `activationLevel` value is a unitless internal control. It must not be reported as light power, firing rate, calcium activity, voltage, expression strength, or biological dose.

## 3D arena-body boundary

The open-field arena renders the representative animal as a procedural Three.js model. It includes the major adult external landmarks needed to read it as *Drosophila*: distinct head, thorax, and tapered segmented abdomen; two large compound eyes and three ocelli; paired branched aristae; one membranous wing pair plus two halteres; and six thorax-rooted legs. These landmark choices are informed by the adult scanning-electron-microscopy atlas from [Jürgens et al. (2024)](https://doi.org/10.1093/genetics/iyae129).

The mesh is not a scan, specimen reconstruction, segmentation, morphometric dataset, or FlyGym/NeuroMechFly body. Dimensions, colors, materials, and fine geometry are visual approximations. The small alternating-tripod motion cue is informed by adult measurements of straight forward walking from [Chun, Biswas & Bhandawat (2021)](https://doi.org/10.7554/eLife.65878), but that study does not support backward-gait biomechanics, and FlyLab does not solve foot contacts, forces, or joint dynamics. The cue must not be interpreted as a measured gait replay.

Both visual citations are exported in the agent-inspectable `VISUAL_REFERENCES` registry under `DATASET_MANIFEST.visualReferences`. They have `relation=visual_reference`, `hypothesisEligible=false`, and explicit interpretation boundaries, so an agent cannot use them as MDN hypothesis support.

Trajectory position, heading, lift, condition, and model-drive timing come from the versioned reduced-order simulation. The motor map selects the schematic appendage cue: six-leg walking for MDN or T2-leg extension plus wing tuck/downstroke for GF. Appendage rendering does not feed back into the simulation. The purple ring indicates selection of the unitless model-drive target window, not neural activity or an optical stimulus. Modeled movement instead follows `motorOutputActive`, so a silencing baseline or sham can replay the hand-authored reference drive without being falsely illuminated as a perturbation target.

## 3D circuit-view boundary

The Three.js circuit view contains two geometry classes that must not be confused:

- The six neuron lines are reconstruction-derived from the frozen BANC v888 L2 SWC products: four MDNs and two LBL40 cells. They share one recorded BANC-to-scene transform. Render assets preserve roots, branch points, endpoints, and intermediate points selected by cumulative path distance. Each raw source URL and SHA-256 checksum is pinned in the dataset manifest.
- The GF→TTMn/TTM leg branch and GF→PSI→DLMn/DLM wing branch are literature-schematic lines. They have no bundled reconstruction or dataset ID and must never be described as BANC neuron geometry.
- The translucent central-brain, optic-lobe, cervical-connective, VNC, T2, and T3 envelopes are schematic orientation geometry. The GF jump branch terminates in the displayed T2 context; these envelopes are not BANC neuropil meshes, segmentation boundaries, volumetric measurements, or complete arborization assignments.

During replay, purple illumination means that a neuron or schematic path is the current FlyLab **model-drive target**. In the MDN view, cyan marks the bundled structural LBL40 path. In the GF view, cyan marks the cited literature path, not an EM reconstruction. The viewer does not display firing, voltage, calcium, optogenetic dose, direction or speed of biological signal propagation, or inferred neural dynamics.

Left-only model drive selects the two metadata-left MDNs and highlights their connectome-inferred right LBL40 target (52 + 51 v3-predicted synaptic links). Right-only drive selects the two metadata-right MDNs and highlights their left LBL40 target (26 + 24). These counts come from the v3 future-work product after its postsynapse-size ≥10-voxel filter; the Bates et al. paper analyses use v2 (≥5). This is a visualization of pinned identity and topology, not evidence that link count is functional weight, physiology, activity, or causal efficacy.

FlyGym is a future adapter path: the tool contracts, experiment manifest, seed lineage, and evidence boundaries could wrap a FlyGym-backed worker later. The current manifest pins FlyGym v2.1.0 and commit `ca65a510c2afe6ac61c51df4f274c8d190c2f95f` as a software reference, but the released browser model does not execute it.

## Evidence classes

FlyLab uses five labels with non-overlapping meanings.

| Label | Permitted interpretation | Prohibited upgrade |
|---|---|---|
| `measured` | A biological observation reported under the cited experiment's conditions. | Not automatically universal, natural, necessary, or dose-responsive. |
| `derived` | A calculated summary or transformation. | Not a raw observation, and not automatically a causal result. |
| `connectome_inferred` | A structural pathway hypothesis based on wiring information. | Connectivity is not neural activity, functional influence, or behavior. |
| `simulation_predicted` | A value or trajectory generated by the versioned FlyLab model. | Not a measurement from an animal or a validated biological forecast. |
| `agent_hypothesized` | A falsifiable claim or proposed follow-up. | Not evidence and not authorization to execute. |

The evidence chain used in the demonstration is:

1. Measured literature records describe assay-specific adult MDN activation, silencing, laterality, and downstream motor-circuit findings.
2. A separate measured record describes the broad Cande descending-neuron screen as expansion context, not MDN-specific causal evidence.
3. A deterministic filter of the pinned BANC metadata derives a specimen-level inventory of four proofread MDN rows, two per side.
4. A connectome-inferred record preserves four directed MDN→LBL40 rows totaling 153 v3-predicted synaptic links after the postsynapse-size ≥10-voxel filter. This future-work v3 product is distinct from the v2 (≥5) product used in the paper analyses.
5. The selected circuit catalog artifact is labeled derived, and the agent drafts an explicitly labeled hypothesis and proposed protocol.
6. The FlyLab model produces a simulation-predicted batch and trajectories.
7. The analysis aggregates simulation-generated per-run summary records and is labeled both derived and simulation-predicted. The displayed condition-level replay trajectory is a separate illustrative path and is not the raw path underlying the metric cards.
8. The comparison ranking remains derived plus simulation-predicted, while its proposed follow-up remains agent-hypothesized.
9. The saved evidence-bundle metadata is derived and carries counts for each top-level scientific lineage artifact and evidence record. Nested copies of model and dataset manifests are not recursively counted.

No later stage overwrites the provenance of an earlier one.

Every evidence record also declares a claim-support scope. A hypothesis must cite at least one `role=hypothesis_support`, `kind=perturbation_effect` record whose declared perturbation and behavior match the proposed claim. `structural_path`, `specimen_inventory`, and `motor_context` records may supplement that causal record but cannot replace it. `model_context` and `catalog_context` records are rejected as hypothesis evidence. Source-level mappings state exactly which source supports which portion of a record and give a figure, section, file, row, or release locator.

The operational lineage is equally strict. Discovery returns the full source closure required by the selected circuit and motor map, while `matches_requested_evidence_labels` and the eligible-ID lists preserve the active filter. A hypothesis may cite only the selected circuit and filtered discovered IDs. Changing the filter invalidates a hypothesis that no longer belongs to that selection. A trial's target and perturbation must match the saved hypothesis. A comparison accepts analyses from exactly one batch and requires its objective metric in each analysis. Saving requires the current hypothesis, experiment, sole batch, and comparison plus exactly the comparison's complete analysis-ID set. The exact selected circuit, the hypothesis-supporting evidence/source closure, separately scoped model-method evidence/source closure, and those exact analyses are serialized; unrelated catalog context is not relabeled as support. The local model card is related as `method_definition`; the FlyGym paper and pinned release are related only as `embodiment_reference` and do not define FlyLab's equations.

## Reproducibility contract

An experiment records:

- hypothesis and circuit IDs
- perturbation, laterality, and unitless nominal control level
- onset, duration, and trial duration in milliseconds
- replicate count and condition definitions
- base random seed
- model, controller, environment, and boundary strings
- model assumptions

For replicate `r` in condition index `c`, the implementation derives the seed as:

```text
replicate_seed = base_seed + c × 1009 + r × 37
```

The same normalized experiment inputs produce the same experiment ID. Identity covers all design inputs and all three person-editable fields: activation level, duration, and replicate count. UI edits rebuild the full protocol through `designExperiment` instead of patching only the display. The same experiment and seed produce identical run IDs, trajectories, replicate summaries, batch ID, and run hash. Changing the seed changes the generated runs. This contract is covered by deterministic local tests.

IDs and run hashes use a stable FNV-1a-derived identifier. Evidence payloads use SHA-256 when Web Crypto is available, with a labeled FNV-1a fallback otherwise. Saving prepares a downloadable `flylab.evidence-export` schema-version-`2` JSON envelope and attempts to store the same envelope in browser local storage on a best-effort basis. The envelope contains bundle metadata, the complete payload, and the existing payload manifest hash; it does not introduce a second hash. Caller-supplied bundle titles and notes are serialized as `untrusted_annotation` administrative metadata, remain outside the five scientific provenance labels, and are excluded from scientific provenance counts.

The saved payload includes the exact selected circuit record, the hypothesis's exact supporting source/evidence closure, hypothesis, experiment, simulation batch, exactly the analyses referenced by the comparison, the comparison, dataset manifest, model manifest, seeds, and assumptions. A timestamp records when the bundle was saved; it is not part of the scientific result. The manifest hash covers `JSON.stringify(payload)` in its saved property order. It is useful for detecting payload changes, but it is not a digital signature, proof of authorship, or guarantee of immutability.

## Controls and metrics

Every accepted protocol contains mandatory baseline and model-sham controls. Every supported protocol contains its requested perturbation arm; bilateral protocols add unilateral arms only when the selected motor map supports them. The current MDN map supports bilateral, left, and right routing, while the GF map is intentionally bilateral-only. The conditions are:

- activation baseline: no mapped motor drive
- activation sham: the nominal control setting is recorded separately from its zero effective motor drive
- silencing baseline: a hand-authored reference motor drive with no suppression
- silencing sham: the nominal suppression setting is recorded while the reference motor drive is retained
- the requested MDN or GF perturbation
- left-only and right-only MDN perturbations when the requested MDN arm is bilateral

These are model conditions, not a substitute for a biological control design. FlyLab does not model optics, heat, genotype, expression, handling, sex-specific effects, experimental batch effects, or endogenous MDN activity. The complete activation and suppression equations, every numeric constant, the synthetic stance-index definition, and the model-scale unit boundary are published in [the model card](MODEL_CARD.md).

The MDN behavior analysis exposes:

- reverse-initiation probability across seeded runs
- backward distance in uncalibrated model-scale millimeters
- signed speed in uncalibrated model-scale millimeters per second, where negative denotes backward movement
- response latency in milliseconds for responsive runs
- absolute heading change in degrees for comparison
- stance-stability index

The GF panel replaces those gait metrics with short-mode escape probability, response latency, vertical displacement, wing recruitment, and leg recruitment. This is not total takeoff probability; the parallel long-mode pathway is not modeled.

The analysis method version is `flylab.behavior-metrics.v3`. Each motor map declares its complete five-metric panel, and the tool returns machine-readable `metric_definitions` plus a `unit_boundary`; FlyLab does not claim a formal preregistration artifact. Response initiation is also reported as an always-present simulation summary. The condition-level Three.js replay trajectory is independently generated for illustration and must not be presented as the raw per-replicate trace used to calculate cards. When no seeded run responds, latency is JSON `null`; trial duration is never substituted. Recruitment values are synthetic unitless indices, and vertical displacement is model-scale motion—not muscle force or aerodynamic lift. These estimates are not biological confidence intervals, animal effect sizes, or statistical evidence for a biological hypothesis.

## Operational shared-state boundary

Every successful tool call returns `state_revision`. Agent actions and person edits advance one shared monotonic revision. `run_fly_simulation` and `save_fly_evidence` capture the revision before preparation and compare it with the live revision immediately before commit. If it changed, they publish nothing and return non-retryable `STALE_STATE` with expected/actual revisions and `inspect_flylab_state` as recovery. An agent must inspect again and issue a new call with current artifact IDs; it must not blindly retry a stale request. Failure/cancellation activity never rewinds the newer mission's stage.

## Human approval and autoresearch boundary

`inspect_flylab_state` is an operational, read-only recovery tool. It reports the current open-page revision, fixed artifact references, person-selected proposal budget, approval status, and exactly one valid next action. It returns no scientific provenance, cannot approve a protocol, cannot run an experiment, and must not be interpreted as evidence about a fly.

`design_stimulation_trial` always creates an unapproved experiment. `run_fly_simulation` refuses to run it with `APPROVAL_REQUIRED` until a person clicks the visible approval control.

Human edits to activation level, duration, or replicate count:

- generate a revised experiment identity
- clear approval
- clear prior batch, analyses, comparison, and evidence bundle
- require another review and approval

Changing the next-trial budget also advances the shared revision and clears any comparison, evidence bundle, and export derived from the prior budget.

`compare_fly_trials` may rank saved analyses and generate one bounded activation-level proposal. The UI calls this **propose only**. The proposal does not create an approved protocol and cannot run a new batch. The person controls the next-trial budget and must explicitly direct and approve any subsequent experiment.

This boundary supports assisted research planning, not autonomous biological experimentation.

## Source-specific cautions

### MDN perturbation and motor-circuit evidence

[Bidaye et al., *Science* (2014)](https://doi.org/10.1126/science.1249964) supports assay-specific adult MDN activation and silencing claims; the article is under publisher copyright. [Sen et al., *Current Biology* (2017)](https://doi.org/10.1016/j.cub.2017.02.008) supports the acute activation and asymmetric-recruitment context; the article is under Elsevier copyright. [Feng et al., *Nature Communications* (2020)](https://doi.org/10.1038/s41467-020-19936-x), licensed CC BY 4.0, supports downstream LBL40 and LUL130 motor-circuit claims.

Each claim remains scoped to the cited assay. Sufficiency under one protocol does not establish a universal dose-response rule, natural recruitment, or necessity in every context. FlyLab keeps the measured LUL130 claim without inventing a BANC node, because the pinned BANC metadata contains no LUL130 annotation.

### Giant-fiber leg/wing escape evidence

[von Reyn et al., *Nature Neuroscience* (2014)](https://doi.org/10.1038/nn.3741) supports assay-scoped GF activation, silencing, recording, and short-mode escape claims. [King & Wyman, *Journal of Neurocytology* (1980)](https://doi.org/10.1007/BF01205017) supports the primary thoracic anatomy of the TTM jump-leg and PSI/DLM flight-muscle branches. [Allen & Murphey, *European Journal of Neuroscience* (2007)](https://doi.org/10.1111/j.1460-9568.2007.05686.x) supports the electrical and cholinergic chemical components of the mixed GF–TTMn synapse only; FlyLab does not attribute it to the PSI/DLM or neuromuscular branches. [Azevedo et al., *Nature* (2024)](https://doi.org/10.1038/s41586-024-07389-x) supplies adult-female FANC structural context for coordinated leg/wing escape output.

GF loss does not abolish every escape pathway; the parallel long-mode takeoff pathway is explicitly outside the current model. The cited sub-millisecond physiology does not calibrate FlyLab's hand-authored response-latency model. FANC is a separate specimen and dataset from BANC. FlyLab bundles no GF reconstruction or FANC edge table, and its schematic lines have no dataset IDs.

### Descending-neuron screen

[Cande et al., *eLife* 7:e34275 (2018)](https://doi.org/10.7554/eLife.34275), licensed CC BY 4.0, supports a measured broad-screen context: 130 sparse split-GAL4 lines targeting approximately 160 neurons across 58 anatomical types in solitary adult males. The associated [Dryad version 1 dataset](https://doi.org/10.5061/dryad.fr89c0c) is CC0-1.0. FlyLab does not use this screen as MDN-specific causal validation, and a driver-line phenotype cannot automatically be assigned to one EM-reconstructed neuron.

### Structural connectome context

[Bates et al., *Nature* (2026)](https://doi.org/10.1038/s41586-026-10735-w) is the primary article pointer for BANC. FlyLab pins the [BANC static dataset, Dataverse version 3.0 / snapshot `banc_888`](https://doi.org/10.7910/DVN/7WTH1N), licensed CC BY 4.0, and retains the two source-file identifiers plus MD5 and SHA-256 checksums. Those two cited Feather inputs are unrestricted; the broader deposit has mixed file-level access. The bundled slice contains four proofread MDN rows, two LBL40 rows, and four selected directed MDN→LBL40 rows totaling 153 v3-predicted synaptic links after the postsynapse-size ≥10-voxel filter. The v3 product is supplied for future work; the paper analyses use v2 with a ≥5-voxel filter.

These are factual records from one adult female specimen, not a population estimate. The circuit’s machine-readable `specimenInventory` therefore states exactly four MDNs—two metadata-left and two metadata-right—and explicitly prohibits treating that specimen count as universal. FlyLab does not execute BANC neurons or interpret v3 link counts as physiological weights, connection probabilities, activity, or causal efficacy. The reconstruction is incomplete, and the stored `norm` field is preserved without a biological interpretation.

The viewer additionally bundles topology-preserving render assets from the corresponding six v888 SWC skeleton products. Their raw checksums and source URLs are recorded separately from the metadata and edgelist checksums. Simplification changes rendering density, not cell identity or the registered source coordinate system; the result remains a display derivative rather than a new measurement.

The manifest also references [FlyEM MANC `manc:v1.2.1`](https://www.janelia.org/project-team/flyem/manc-connectome), licensed CC BY 4.0, for pinned cross-dataset matches. MANC is a separate adult male ventral nerve cord specimen; a matching fragment or cell type is never the same physical cell as one in BANC.

### Embodiment-method reference

[Wang-Chen et al., *Nature Methods* (2024)](https://doi.org/10.1038/s41592-024-02497-y) describes NeuroMechFly v2 and FlyGym. FlyLab pins the Apache-2.0 [FlyGym v2.1.0 release](https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0) as its embodiment reference, including the release commit and browser-stack versions. The current reduced-order browser model does not execute or reproduce FlyGym.

## Claims the project may make

- FlyLab exposes source-backed adult MDN leg-retreat and giant-fiber leg/wing escape workflows.
- Agents can query typed motor paths and explicit body-part coverage before proposing a virtual experiment.
- The agent can design and analyze controlled, seeded **virtual** experiments.
- Same-seed simulation is deterministic in the current model.
- The interface preserves explicit provenance and human approval.
- The current model predicts a virtual trajectory under its documented assumptions.

## Claims the project must not make

- FlyLab simulates a complete fruit-fly brain.
- The connectome alone produces the displayed behavior.
- FlyLab currently simulates every body part, motor neuron, muscle, or natural behavior of a fly.
- The current application runs FlyGym or NeuroMechFly.
- A simulation result is a newly measured biological result.
- The displayed activation value maps to an experimental dose.
- The proposed follow-up is a validated wet-lab protocol.
- The agent discovered a novel biological mechanism.
- Model variation represents biological uncertainty or population statistics.
