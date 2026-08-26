# FlyLab

FlyLab is a WebMCP-enabled virtual neuroethology lab for investigating how an adult fruit-fly neural circuit could influence behavior. A person and an agent share one visible workflow: find source-backed evidence, write a falsifiable hypothesis, design controls, approve a protocol, run a seeded simulation, quantify behavior, select a follow-up, and save the complete evidence lineage.

- **Live lab:** [flylab-neuroethology.d-lougen.chatgpt.site](https://flylab-neuroethology.d-lougen.chatgpt.site)
- **Public source:** [github.com/DJLougen/flylab](https://github.com/DJLougen/flylab)

> **Current release boundary:** FlyLab is an adult Moonwalker descending neuron (MDN) backward-walking vertical slice. Its embodiment is the **FlyLab reduced-order model** version `0.1.1` with the versioned `mdn-inspired-retreat-adapter.v1` controller. It does not execute FlyGym, simulate neural dynamics, or emulate a complete fly brain.

## What the challenge release demonstrates

- Seven browser-native WebMCP tools that operate the same lab interface a person sees.
- A curated, primary-source-backed adult MDN evidence path.
- An orbitable Three.js CNS viewer with six reconstruction-derived BANC v888 neuron skeletons, camera presets, cell inspection, and replay-linked laterality highlighting.
- A controlled protocol with baseline, model-sham, bilateral, left-only, and right-only conditions.
- A hard human-approval gate before simulation.
- Deterministic virtual trials with recorded seeds, model versions, condition IDs, and run hashes.
- Method-versioned behavioral summaries and an evidence ledger that never upgrades simulation output into biological measurement.
- Bounded autoresearch: the agent may rank results and propose one follow-up, but it cannot execute that follow-up by itself.

## Quick start

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server. WebMCP discovery requires a compatible browser. For the challenge, use ChatGPT's in-app browser or a Chrome build with WebMCP enabled.

Verification commands:

```bash
npm test
npm run lint
npm run build
npm run verify:webmcp
```

`npm test` compiles the TypeScript test target and runs Node's built-in test runner. The deterministic suite covers same-seed reproducibility, changed-seed divergence, control-arm construction, provenance labels, laterality-to-circuit mapping, morphology checksums, exactly seven WebMCP contracts, current annotation keys, and registration disposal. `npm run verify:webmcp` opens the public deployment in an isolated Chrome profile with Chrome's official WebMCP testing feature, verifies the real browser API, enumerates the exact seven tools through Chrome's WebMCP protocol, and completes a live `find_fly_circuits` invocation.

## Human-agent workflow

The intended sequence is deliberately explicit:

1. The agent calls `find_fly_circuits` to search FlyLab's bounded evidence catalog.
2. It calls `draft_fly_hypothesis` to create a falsifiable claim labeled `agent_hypothesized`.
3. It calls `design_stimulation_trial` to create the visible controlled protocol.
4. **A person reviews or edits the protocol and approves it.** Editing clears approval and all downstream results.
5. The agent may call `run_fly_simulation` for that exact approved experiment.
6. It calls `analyze_fly_behavior` to compute versioned metrics from simulation-predicted run outputs.
7. It calls `compare_fly_trials` to rank conditions and propose, but not execute, one bounded follow-up.
8. It calls `save_fly_evidence` to commit the full visible lineage to the browser's local evidence ledger.

The approval step is intentionally not a WebMCP tool. It remains a human action in the shared interface.

## WebMCP tools

| Tool | Purpose | State and trust boundary |
|---|---|---|
| `find_fly_circuits` | Return matching adult circuits, evidence records, citations, and dataset versions. | Read-only; externally sourced content is marked untrusted. |
| `draft_fly_hypothesis` | Create an editable claim, prediction, evidence links, and falsification criterion. | Writes lab state; output remains an agent hypothesis. |
| `design_stimulation_trial` | Create controls, timing, laterality, activation level, replicate count, and seed manifest. | Writes a draft protocol; execution remains locked. |
| `run_fly_simulation` | Execute an approved experiment or return its existing deterministic batch. | Writes simulation runs; results are `simulation_predicted`. |
| `analyze_fly_behavior` | Calculate requested behavior metrics from a completed batch. | Writes a method-versioned analysis; results are derived from simulation. |
| `compare_fly_trials` | Rank compatible analyses and create one next-experiment proposal. | Writes a comparison; the proposal is not execution authority. |
| `save_fly_evidence` | Save sources, claims, model assumptions, protocol, seeds, runs, analyses, and comparison. | Writes an immutable, locally persisted evidence bundle. |

The current WebMCP implementation uses `document.modelContext.registerTool(...)`, closed object schemas, `readOnlyHint`, `untrustedContentHint`, cancellable execution, and AbortSignal-owned registration lifecycle.
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

An experiment stores its base seed. Replicate seeds are derived deterministically from the base seed, condition order, and replicate index. The saved lineage includes model/controller/environment versions, condition and run IDs, analysis method version, a run hash, source records, assumptions, and an evidence-bundle manifest hash. Repeating the same experiment and seed produces the same batch; changing the seed changes the generated runs.

The circuit viewer bundles simplified render assets derived from the six pinned BANC v888 L2 SWC skeletons. The asset manifest records every source URL, SHA-256 checksum, source node count, shared coordinate transform, and topology-preserving simplification rule. The neuron lines are reconstruction-derived; the translucent CNS envelope is explicitly schematic. Purple glow means the current FlyLab model targets that MDN during the replay window, while cyan marks its bundled structural LBL40 path. Neither means measured activity or signal propagation.

See [Scientific Boundaries](docs/SCIENTIFIC_BOUNDARIES.md) for the complete interpretation rules.

## Primary sources and license pointers

FlyLab ships a small curated evidence catalog rather than live literature retrieval.

- [Bidaye et al., *Science* 344, 97–101 (2014)](https://doi.org/10.1126/science.1249964) — targeted adult MDN activation and silencing assays; publisher copyright.
- [Sen et al., *Current Biology* 27, 766–771 (2017)](https://doi.org/10.1016/j.cub.2017.02.008) — acute and stochastic adult MDN activation assays; Elsevier copyright.
- [Feng et al., *Nature Communications* 11, 6166 (2020)](https://doi.org/10.1038/s41467-020-19936-x) — motor-circuit studies of MDN-induced backward walking; CC BY 4.0.
- [Cande et al., *eLife* 7:e34275 (2018)](https://doi.org/10.7554/eLife.34275) — broad descending-neuron activation screen; CC BY 4.0. The associated [Dryad version 1 dataset](https://doi.org/10.5061/dryad.fr89c0c) is CC0-1.0.
- [Bates et al., *Nature* (2026)](https://doi.org/10.1038/s41586-026-10735-w) — BANC structural context. FlyLab pins the [BANC Dataverse version 3.0 / `banc_888` snapshot](https://doi.org/10.7910/DVN/7WTH1N), licensed CC BY 4.0, with source-file checksums; the official [BANC released-data documentation](https://github.com/htem/bancpipeline#released-data-products) identifies the L2 SWC skeleton products used by the viewer.
- [FlyEM MANC `manc:v1.2.1`](https://www.janelia.org/project-team/flyem/manc-connectome) — reference matches to a separate adult male ventral nerve cord specimen; CC BY 4.0. Matching IDs do not identify the same physical cells as the female BANC specimen.
- [Wang-Chen et al., *Nature Methods* (2024)](https://doi.org/10.1038/s41592-024-02497-y) — NeuroMechFly v2/FlyGym publication. The pinned [FlyGym v2.1.0 release](https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0) is Apache-2.0; FlyLab uses it as an embodiment reference and does not execute it.

FlyLab's own distribution terms should be taken from the repository license, if and when one is added; third-party source licenses do not automatically license this project.

## Project guide

- [Two-minute demo](docs/DEMO.md)
- [WebMCP verification](docs/WEBMCP_VERIFICATION.md)
- [Scientific boundaries](docs/SCIENTIFIC_BOUNDARIES.md)
- [Challenge submission copy](docs/CHALLENGE_SUBMISSION.md)
- `lib/flylab.ts` — evidence records, manifests, deterministic model, metrics, and comparison logic
- `lib/webmcp.ts` — seven tool contracts, validation, result envelopes, and registration lifecycle
- `components/FlyBrain3D.tsx` — Three.js BANC morphology viewer and accessible six-neuron inspector
- `scripts/build-banc-morphology.mjs` — reproducible SWC download, checksum, transform, and render-asset build
- `app/page.tsx` — shared human-agent laboratory interface and approval boundary
- `tests/` — deterministic model and WebMCP contract tests

## Responsible interpretation

FlyLab is a hypothesis and simulation sandbox. It does not perform a wet-lab experiment, prescribe an animal protocol, establish necessity or sufficiency beyond cited conditions, infer natural neural activity, or generate new biological evidence. Its purpose is to make assumptions, controls, predictions, and source lineage inspectable while a person remains in control.
