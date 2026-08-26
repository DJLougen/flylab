# FlyLab

[![CI](https://github.com/DJLougen/flylab/actions/workflows/ci.yml/badge.svg)](https://github.com/DJLougen/flylab/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

FlyLab is a WebMCP-enabled virtual neuroethology lab for investigating how an adult fruit-fly neural circuit could influence behavior. It is agent-operable, human-auditable, and scientifically bounded: a person and an agent share one visible page session while structured site tools expose the exact workflow state, next valid action, approval boundary, and evidence lineage.

Created on August 26, 2026 during the WebMCP Challenge period, FlyLab is for computational-neuroethology researchers, neuroscience educators, and agent-tool builders who need inspectable experiment state without UI scraping.

- **Live lab:** [flylab-neuroethology.d-lougen.chatgpt.site](https://flylab-neuroethology.d-lougen.chatgpt.site)
- **Public source:** [github.com/DJLougen/flylab](https://github.com/DJLougen/flylab)

> **Current release boundary:** FlyLab is an adult Moonwalker descending neuron (MDN) backward-walking vertical slice. Its embodiment is the **FlyLab reduced-order model** version `0.1.3` with the versioned `mdn-inspired-retreat-adapter.v2` controller. It does not execute FlyGym, simulate neural dynamics, or emulate a complete fly brain.

## What the challenge release demonstrates

- One read-only WebMCP state inspector plus seven structured scientific workflow actions that operate the same page interface a person sees.
- A curated, primary-source-backed adult MDN evidence path.
- A procedural Three.js adult-fly arena model with six legs, one wing pair plus halteres, compound eyes, branched aristae, a segmented abdomen, replay-linked heading, and an explicitly schematic morphology boundary.
- An orbitable Three.js CNS viewer with six reconstruction-derived BANC v888 neuron skeletons, camera presets, cell inspection, and replay-linked laterality highlighting.
- Runtime- and schema-enforced baseline and model-sham controls; bilateral designs also add left-only and right-only comparisons.
- A hard human-approval gate before simulation.
- Deterministic virtual trials with recorded seeds, model versions, condition IDs, and run hashes.
- Method-versioned behavioral summaries and an evidence ledger that never upgrades simulation output into biological measurement, with a portable JSON download for each saved bundle.
- Bounded autoresearch: the agent may rank results and propose one follow-up, but it cannot execute that follow-up by itself.

## Quick start

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server. WebMCP invocation requires a compatible browser plus a workspace where Site Tools are available. FlyLab's independently verified path is Chrome 149 or newer with WebMCP testing enabled. ChatGPT's in-app browser can expose the same tools when the feature is available for that model, account, and workspace; FlyLab does not treat an absent browser API as a successful registration.

Verification commands:

```bash
npm test
npm run lint
npm run build
npm run verify:webmcp
```

`npm test` compiles the TypeScript test target and runs Node's built-in test runner. The current 59-test suite covers same-seed reproducibility, changed-seed divergence, mandatory controls, canonical and idempotent artifact identity, onset-referenced/null response latency, exact artifact recovery, stale prepared-commit rejection, cancellation timing, claim-compatible evidence gating, source-support closure, model-card parameter parity, provenance labels, laterality-to-circuit mapping, morphology checksums, the eight WebMCP contracts, the synchronized public agent manifest and complete contract document, unsupported/active transport handoffs, absent-API fail-closed behavior, current annotation keys, registration disposal, and publication-safe submission assets and preflight gates. `npm run verify:webmcp` opens the public deployment in an isolated Chrome profile with Chrome's official WebMCP testing feature, verifies the real browser API, enumerates the exact eight tools through Chrome's WebMCP protocol, calls `inspect_flylab_state`, and completes a live `find_fly_circuits` invocation.

## Human-agent workflow

The intended sequence is deliberately explicit:

1. The agent calls `inspect_flylab_state` first and after interruptions or person edits. It receives the current revision, artifact IDs, hypothesis behavior and perturbation, analysis metric sets, comparison lineage, gate status, person-selected limits, and exactly one valid next action without scraping the page.
2. It calls `find_fly_circuits` to search FlyLab's bounded evidence catalog.
3. It calls `draft_fly_hypothesis` to create a falsifiable claim labeled `agent_hypothesized`.
4. It calls `design_stimulation_trial` to create the visible controlled protocol.
5. **A person reviews or edits the protocol and approves it.** Editing clears approval and all downstream results. While blocked, the inspector reports `waiting_for_human`, `next_tool: null`, and `blocked_by: human_approval`.
6. The agent may call `run_fly_simulation` for that exact approved experiment.
7. It calls `analyze_fly_behavior` to compute versioned metrics from simulation-predicted run outputs.
8. It calls `compare_fly_trials` to rank conditions and propose, but not execute, one bounded follow-up.
9. It calls `save_fly_evidence` to commit the full visible lineage to the evidence ledger. A person can then download that exact saved bundle as versioned JSON instead of relying on best-effort browser-local storage.

The approval step is intentionally not a WebMCP tool. It remains a human action in the shared interface.

## WebMCP tools

| Tool | Purpose | State and trust boundary |
|---|---|---|
| `inspect_flylab_state` | Return the current page revision, artifact IDs, visible review gate, limits, pipeline, and exactly one next action. | Sole read-only tool; operational and provenance-free. Human-authored goal text is marked untrusted. |
| `find_fly_circuits` | Return matching adult circuits, evidence records, citations, and dataset versions. | Selects the circuit in shared page state; externally sourced content is marked untrusted. |
| `draft_fly_hypothesis` | Create an editable claim, prediction, evidence links, and falsification criterion. | Requires a discovered `perturbation_effect` record matching the claim's perturbation and behavior; structural/inventory/motor records are supplemental only. Output remains an agent hypothesis. |
| `design_stimulation_trial` | Create controls, timing, laterality, activation level, replicate count, and seed manifest. | Writes a draft protocol; execution remains locked. |
| `run_fly_simulation` | Execute an approved experiment or return its existing deterministic batch. | Writes simulation runs; results are `simulation_predicted`. |
| `analyze_fly_behavior` | Calculate requested behavior metrics from a completed batch. | Writes a method-versioned analysis; results are derived from simulation. |
| `compare_fly_trials` | Rank compatible analyses and create one next-experiment proposal. | Writes a comparison; the proposal is not execution authority. |
| `save_fly_evidence` | Save sources, claims, model assumptions, protocol, seeds, runs, analyses, and comparison. | Prepares a manifest-hashed, downloadable JSON envelope and attempts a browser-local convenience copy. |

The current WebMCP implementation uses `document.modelContext.registerTool(...)`, closed object schemas, `readOnlyHint`, `untrustedContentHint`, cancellable execution, and AbortSignal-owned registration lifecycle. Every successful tool call returns `state_revision`; agent actions and person edits advance one shared monotonic revision. Long-running simulation and evidence-save work capture that revision, prepare without publishing, then compare it with the live revision at commit. A mismatch publishes nothing and returns non-retryable `STALE_STATE` with expected/actual revisions and `inspect_flylab_state` as recovery. A cancellation observed before commit cannot publish the prepared batch or bundle, while a mutation already synchronously committed reports success rather than a false cancellation. Every success uses the `flylab.tool-result.v2` structured envelope; domain failures are machine-readable, and the inspector is the canonical recovery contract.

The HTML publishes FlyLab-specific documentation links to the [agent manifest](public/flylab-agent-manifest.json) and the live `/flylab-tool-contracts.json` document. The contract endpoint is generated from the same eight definitions registered with WebMCP, including full input schemas, annotations, error codes, result fields, and recovery rules. The page also embeds `flylab.agent-context.v2` workflow state, transport availability, and a combined recovery packet at `#flylab-agent-context`, `#flylab-agent-runtime`, and `#flylab-agent-handoff`. These are honest read-only aids when WebMCP is unavailable; they do not polyfill the browser API, make a tool callable, or claim standardized WebMCP manifest discovery.
It follows OpenAI's [Site tools documentation](https://learn.chatgpt.com/docs/webmcp) for making website capabilities directly available to agents.

## Reproducibility and provenance

Every claim or artifact uses one or more of five labels:

| Label | Meaning in FlyLab |
|---|---|
| `measured` | Reported biological observation from a cited experiment. |
| `derived` | A transformation or summary of recorded or simulated data. |
| `connectome_inferred` | A structural pathway hypothesis; wiring is not activity or behavior. |
| `simulation_predicted` | Output generated by the versioned FlyLab model. |
| `agent_hypothesized` | A proposed claim or follow-up that still requires testing and human judgment. |

The labels travel with the machine-readable artifacts: the curated circuit record is `derived`; a designed protocol is `agent_hypothesized`; a batch is `simulation_predicted`; an analysis and comparison are both `derived` plus `simulation_predicted`; a follow-up proposal is `agent_hypothesized`; and the saved bundle metadata is `derived`. The `save_fly_evidence` result carries both that metadata and the complete portable evidence-export envelope; it is not a metadata-only response. An experiment stores its base seed. Replicate seeds are derived deterministically from the base seed, condition order, and replicate index. Discovery records only evidence IDs returned by the current filter; a hypothesis may cite only those IDs for the selected circuit, and it must include a `perturbation_effect` record that matches both the proposed perturbation and behavior. Structural, inventory, motor-context, model-method, and catalog records cannot substitute for causal support. Comparison accepts analyses from exactly one batch and requires its objective metric in every analysis. Saving requires the current hypothesis, experiment, sole batch, comparison, and exactly the comparison's complete analysis-ID set. The exact selected circuit, hypothesis-supporting evidence/source closure, separately scoped model-method evidence/source closure, and those exact analyses are serialized. The local model card is the method definition; FlyGym is carried only as a pinned embodiment reference and does not define the controller. Caller-supplied titles and notes travel separately as `untrusted_annotation` administrative metadata and are excluded from scientific provenance counts. The lineage also includes model/controller/environment versions, condition and run IDs, analysis method version, a run hash, assumptions, and a manifest hash. The `flylab.evidence-export` schema-version-`2` download carries the complete saved payload and metadata. Its hash detects changes; it is not a digital signature or guarantee of immutability. Repeating the same experiment and seed produces the same batch; changing the seed changes the generated runs.

The circuit viewer bundles simplified render assets derived from the six pinned BANC v888 L2 SWC skeletons. The asset manifest records every source URL, SHA-256 checksum, source node count, shared coordinate transform, and topology-preserving simplification rule. The neuron lines are reconstruction-derived; the translucent CNS envelope is explicitly schematic. Purple glow means the current FlyLab model targets that MDN during the replay window, while cyan marks its bundled structural LBL40 path. Neither means measured activity or signal propagation.

The open-field view uses a procedural Three.js model, not a scanned animal or a biomechanical reconstruction. Its major visible landmarks are informed by the adult external-anatomy atlas from Jürgens et al.; its restrained alternating-tripod gait cue is informed by Chun et al. The body animation is display-only: trajectory position and heading still come exclusively from the versioned FlyLab reduced-order model.

The exact six-neuron/four-row table slice is independently reproducible from the two pinned BANC Feather files. See [Reproducing the BANC v888 circuit slice](docs/BANC_SLICE_REPRODUCIBILITY.md) for source hashes, the read-only verification command, extraction rules, and the small canonical artifact used to test the runtime records.

See [Scientific Boundaries](docs/SCIENTIFIC_BOUNDARIES.md) for the complete interpretation rules.
See the [reduced-order model card](docs/MODEL_CARD.md) for every controller equation, constant, condition semantic, unit boundary, and calibration limitation.
Third-party data attribution and modification notices are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The generated [production and bundled-runtime license inventory](THIRD_PARTY_LICENSES.txt) is also deployed as a public site asset.

## Primary sources and license pointers

FlyLab ships a small curated evidence catalog rather than live literature retrieval.

- [Bidaye et al., *Science* 344, 97–101 (2014)](https://doi.org/10.1126/science.1249964) — targeted adult MDN activation and silencing assays; publisher copyright.
- [Sen et al., *Current Biology* 27, 766–771 (2017)](https://doi.org/10.1016/j.cub.2017.02.008) — acute and stochastic adult MDN activation assays; Elsevier copyright.
- [Feng et al., *Nature Communications* 11, 6166 (2020)](https://doi.org/10.1038/s41467-020-19936-x) — motor-circuit studies of MDN-induced backward walking; CC BY 4.0.
- [Cande et al., *eLife* 7:e34275 (2018)](https://doi.org/10.7554/eLife.34275) — broad descending-neuron activation screen; CC BY 4.0. The associated [Dryad version 1 dataset](https://doi.org/10.5061/dryad.fr89c0c) is CC0-1.0.
- [Bates et al., *Nature* (2026)](https://doi.org/10.1038/s41586-026-10735-w) — BANC structural context. FlyLab pins the [BANC Dataverse version 3.0 / `banc_888` snapshot](https://doi.org/10.7910/DVN/7WTH1N), licensed CC BY 4.0, with source-file checksums; FlyLab's two cited Feather inputs are unrestricted, while the broader deposit has mixed file-level access. The official [BANC released-data documentation](https://github.com/htem/bancpipeline#released-data-products) identifies the L2 SWC skeleton products used by the viewer.
- [FlyEM MANC `manc:v1.2.1`](https://www.janelia.org/project-team/flyem/manc-connectome) — reference matches to a separate adult male ventral nerve cord specimen; CC BY 4.0. Matching IDs do not identify the same physical cells as the female BANC specimen.
- [Wang-Chen et al., *Nature Methods* (2024)](https://doi.org/10.1038/s41592-024-02497-y) — NeuroMechFly v2/FlyGym publication. The pinned [FlyGym v2.1.0 release](https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0) is Apache-2.0; FlyLab uses it as an embodiment reference and does not execute it.
- [Jürgens et al., *Genetics* 228:iyae129 (2024)](https://doi.org/10.1093/genetics/iyae129) — scanning-electron-microscopy atlas used as a reference for the schematic arena fly's major adult external landmarks.
- [Chun, Biswas & Bhandawat, *eLife* 10:e65878 (2021)](https://doi.org/10.7554/eLife.65878) — adult walking kinematics used only to guide the display-level alternating-tripod gait cue.

FlyLab's original source code and documentation are licensed under the [Apache License 2.0](LICENSE). Third-party data and software retain their own terms; those licenses do not become FlyLab's license and FlyLab's license does not replace theirs.

## Project guide

- [Challenge demo](docs/DEMO.md)
- [WebMCP verification](docs/WEBMCP_VERIFICATION.md)
- [Judge testing instructions](docs/JUDGE_TESTING.md)
- [Chrome-only manual WebMCP test](docs/CHROME_MANUAL_TEST.md)
- [Scientific boundaries](docs/SCIENTIFIC_BOUNDARIES.md)
- [Scientific source verification](docs/SOURCE_VERIFICATION.md)
- [BANC v888 slice reproducibility](docs/BANC_SLICE_REPRODUCIBILITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Challenge submission copy](docs/CHALLENGE_SUBMISSION.md)
- `lib/flylab.ts` — evidence records, manifests, deterministic model, metrics, and comparison logic
- `lib/agent-context.ts` — pure shared-page state machine, approval gate, artifact references, and next-action contract
- `lib/evidence-export.ts` — portable evidence-envelope schema, serialization, and filename helpers
- `lib/webmcp.ts` — eight tool contracts, validation, result envelopes, and registration lifecycle
- `components/FlyBrain3D.tsx` — Three.js BANC morphology viewer and accessible six-neuron inspector
- `components/FlyArena3D.tsx` — procedural Three.js adult-fly arena renderer and replay-linked pose
- `scripts/build-banc-morphology.mjs` — reproducible SWC download, checksum, transform, and render-asset build
- `app/page.tsx` — shared human-agent laboratory interface and approval boundary
- `tests/` — deterministic model and WebMCP contract tests

## Responsible interpretation

FlyLab is a hypothesis and simulation sandbox. It does not perform a wet-lab experiment, prescribe an animal protocol, establish necessity or sufficiency beyond cited conditions, infer natural neural activity, or generate new biological evidence. Its purpose is to make assumptions, controls, predictions, and source lineage inspectable while a person remains in control.
