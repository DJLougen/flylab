# WebMCP Challenge submission

The current agent-first candidate is deployed publicly and has passed the complete Chrome 151 WebMCP workflow against the live HTTPS URL. The repository is public, licensed under Apache-2.0, reproducible from a fresh public clone, and configured with public CI. The current 13-frame page sequence is verified, but the two headed-browser WebMCP proof composites and rights-cleared narration still require interface approval and recording. Public YouTube upload and Devpost publication are pending.

Submission deadline: **September 3, 2026 at 1:00 p.m. PDT**, as shown by the [OpenAI challenge page](https://openai.com/webmcp-challenge/) and the binding [Devpost official rules](https://webmcp.devpost.com/rules).

FlyLab was created on August 26, 2026 during the challenge period. Its primary audience is a computational-neuroethology researcher or educator reviewing a source-backed virtual MDN experiment. The concrete failure it prevents is an agent silently continuing from stale page state or presenting a simulation result after its evidence lineage, protocol, or human approval has changed. Agent-tool builders are a secondary audience.

## Submission fields

**Project name**

FlyLab

**Tagline**

Agent-operable, human-auditable neuroethology without blurring evidence, simulation, and hypothesis.

**One-sentence summary**

FlyLab gives agents one read-only state inspector and seven WebMCP scientific actions that turn an adult MDN backward-walking question into a cited hypothesis, human-approved virtual experiment, reproducible analysis, bounded follow-up, and provenance-rich evidence bundle inside one shared page session.

**Submission description**

FlyLab is an agent-native virtual neuroethology lab built around a scientifically transparent adult *Drosophila* MDN backward-walking vertical slice. Instead of asking an agent to guess its way through a complex brain viewer, the site exposes one read-only control-plane inspector plus seven structured scientific actions: find curated circuits, draft a falsifiable hypothesis, design controls, run an approved simulation, quantify behavior, compare trials, and save the evidence lineage.

The person and agent share the same open-page state. `inspect_flylab_state` lets an agent recover the current monotonic revision, artifact IDs, discovered evidence, hypothesis perturbation, analysis metric sets, exact comparison lineage, person-selected limits, blocker, and one valid next action after a person edit or interruption—without scraping the interface. The agent can gather cited evidence and prepare a protocol with mandatory baseline/model-sham controls, but simulation is locked until the person reviews and approves the exact visible identifiers and parameters. While blocked, the inspector returns `waiting_for_human` and no callable next tool. If the person edits the protocol, approval and downstream results are cleared. Long preparations compare their captured revision with live state; `STALE_STATE` publishes nothing and directs the agent back to the inspector. After execution, the illustrative condition replay remains a simulation prediction while behavior cards are labeled as derived aggregates of separate simulation-generated per-run summaries. The agent can propose a bounded follow-up, but it cannot execute that proposal automatically.

FlyLab's current embodiment is a deterministic reduced-order model, version `0.1.3`, with the MDN-inspired `mdn-inspired-retreat-adapter.v2`. Its numeric parameters are hand-authored and uncalibrated; the public [model card](MODEL_CARD.md) gives every equation and constant. It is not FlyGym, a complete fly brain, or a wet-lab experiment. Sources, assumptions, dataset and model versions, seeds, run IDs, analyses, limitations, and a manifest hash are saved together so a compelling result never loses its boundary. The WebMCP surface follows OpenAI's [Site tools documentation](https://learn.chatgpt.com/docs/webmcp).

The circuit view is an orbitable Three.js rendering of six real, pinned BANC v888 L2 skeleton reconstructions—four MDNs and two LBL40 cells—with camera presets and accessible cell inspection. Purple replay illumination marks the MDNs receiving the selected unitless model drive; cyan marks bundled connectome-inferred structural LBL40 paths. These encodings are not measured neural activity or biological signal propagation. The surrounding CNS shell is explicitly schematic.

The open-field arena now renders the adult fly itself in Three.js. Its major external landmarks are research-informed, while its mesh and decorative gait remain explicitly schematic. The replayed position, heading, and target window come from the reduced-order simulation; the body is not a scan, a FlyGym execution, or a biomechanical reconstruction.

**Why WebMCP**

FlyLab's tools are discovered from the website the person already has open, operate the same live page state and signed-in context, and make every human edit immediately authoritative for the agent. A conventional remote MCP server would not naturally share that visible in-page protocol and approval state, while visual browser automation would depend on brittle coordinates and inferred control meanings. WebMCP lets the agent act at the scientific-operation level without separating it from the human's instrument.

**Problem**

Neuroscience workflows combine different kinds of evidence: biological measurements, derived behavior screens, structural connectomes, simulation output, and new hypotheses. Conventional interfaces make those boundaries easy to lose, while visual browser automation forces agents to spend effort clicking instead of reasoning about experiments.

**Solution**

FlyLab makes the scientific workflow itself callable. WebMCP gives the agent high-level, validated actions that update the same protocol, arena, activity log, result cards, and evidence ledger the person sees. Stable record IDs connect each step, structured errors prevent invalid transitions, and the human retains authority at the point that matters most: experiment execution.

This is not a generic CRUD wrapper: one browser session combines an interactive 3D scientific instrument, an exact evidence-to-experiment state machine, deterministic simulation, and a deliberately non-tool human approval boundary.

**What makes the human-agent experience meaningful**

- The agent handles evidence retrieval, protocol structure, repetitive seeded trials, metric calculation, and comparison.
- The person sees every intermediate artifact and can inspect sources, edit parameters, reject the design, or approve the exact protocol.
- No WebMCP site tool can approve a protocol. Approval requires visible UI interaction and is intentionally not presented as identity-authenticated protection against general browser automation.
- Editing invalidates approval and downstream artifacts.
- The agent proposes one follow-up within a person-selected budget and stops.
- The final bundle preserves sources and scientific limitations, not just a polished answer.

## WebMCP implementation

FlyLab registers exactly eight tools using the current `document.modelContext` API—one read-only agent-state inspector and seven scientific workflow actions:

1. `inspect_flylab_state`
2. `find_fly_circuits`
3. `draft_fly_hypothesis`
4. `design_stimulation_trial`
5. `run_fly_simulation`
6. `analyze_fly_behavior`
7. `compare_fly_trials`
8. `save_fly_evidence`

The tools use closed object schemas, strict runtime validation, standard `readOnlyHint` and `untrustedContentHint` annotations, cancellable execution, monotonic shared revisions, structured domain failures, and AbortSignal-owned registration lifecycle. The inspector is the sole read-only action and returns operational state with no scientific provenance. Discovery evidence, hypothesis, trial target/perturbation, batch, analysis metric sets, comparison, and save inputs are validated as one exact lineage. State-changing laboratory actions remain distinct, and externally sourced or person-authored text is marked untrusted.

The canonical workflow is:

```text
inspect shared page state
→ find evidence
→ draft hypothesis
→ design controlled protocol
→ human review and approval
→ run seeded simulation
→ analyze behavior
→ compare and propose next experiment
→ save evidence bundle
```

## Scientific and technical scope

**Implemented now**

- Curated adult MDN evidence records with primary-source links
- Schema- and runtime-mandatory baseline/model-sham controls; bilateral designs add left-only and right-only comparisons
- A pinned BANC `banc_888` slice with checksummed source files, four proofread MDN rows, two LBL40 rows, and four selected directed MDN→LBL40 edge rows
- Six checksummed, reconstruction-derived BANC v888 SWC render assets in an interactive Three.js circuit viewer
- A procedural Three.js adult-fly arena model with research-informed external landmarks and an explicit schematic boundary
- Deterministic seeded virtual trials
- Five required method-versioned behavior metrics plus an always-reported reverse-initiation summary; no-response latency is JSON `null` / UI `n/a`
- Five-class provenance model
- Visible human-approval boundary
- Bounded next-experiment proposal
- Exact-lineage evidence bundle with separately scoped hypothesis-support and model-method source closures, model manifests, and hash
- 52 automated tests for the model, model-card parity, recovery state machine, claim-compatible evidence gating, evidence export, synchronized public agent manifest, WebMCP contracts, and publication-safe submission assets

**Not claimed**

- Whole-brain neural dynamics
- Actual FlyGym or NeuroMechFly execution
- Direct BANC/MANC connectome simulation
- A biological dose-response model
- New wet-lab evidence or autonomous biological experimentation

FlyGym is a future adapter path, not a hidden dependency or current runtime claim.

## Reproducibility and provenance

The same protocol and seed reproduce the same experiment, runs, trajectories, and run hash. Changing the seed changes the generated runs. Saving requires the current hypothesis, experiment, sole batch, comparison, and exactly the comparison's complete analysis set. Every saved bundle includes:

- the hypothesis's exact supporting source/evidence closure
- a separately scoped model-method evidence/source closure in which the local model card defines the method and FlyGym remains an embodiment reference
- provenance labels
- hypothesis and falsification criterion
- exact controlled protocol
- model/controller/environment versions and assumptions
- base and derived seeds
- run IDs and run hash
- analysis method version and complete predefined required metric panel
- comparison and non-authorized follow-up proposal
- evidence-bundle manifest hash

The five labels are `measured`, `derived`, `connectome_inferred`, `simulation_predicted`, and `agent_hypothesized`.

## Primary sources and reuse pointers

- [Bidaye et al., *Science* (2014)](https://doi.org/10.1126/science.1249964) — adult MDN activation and silencing assays; publisher copyright.
- [Sen et al., *Current Biology* (2017)](https://doi.org/10.1016/j.cub.2017.02.008) — acute and stochastic adult MDN activation assays; Elsevier copyright.
- [Feng et al., *Nature Communications* (2020)](https://doi.org/10.1038/s41467-020-19936-x) — MDN-induced backward-walking motor circuits; CC BY 4.0.
- [Cande et al., *eLife* (2018)](https://doi.org/10.7554/eLife.34275) — broad descending-neuron screen; CC BY 4.0. The [Dryad version 1 dataset](https://doi.org/10.5061/dryad.fr89c0c) is CC0-1.0.
- [Bates et al., *Nature* (2026)](https://doi.org/10.1038/s41586-026-10735-w) — BANC article context. The pinned [BANC static dataset, Harvard Dataverse version 3.0 / `banc_888`](https://doi.org/10.7910/DVN/7WTH1N) is CC BY 4.0. FlyLab uses two unrestricted Feather inputs and six simplified L2 SWC render derivatives; changes are one shared coordinate transform and topology-preserving simplification. The broader deposit has mixed file-level access. Full modification notices are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
- [FlyEM MANC `manc:v1.2.1`](https://www.janelia.org/project-team/flyem/manc-connectome) — cross-dataset reference to a separate adult male specimen; CC BY 4.0.
- [Wang-Chen et al., *Nature Methods* (2024)](https://doi.org/10.1038/s41592-024-02497-y) — NeuroMechFly v2/FlyGym reference. The pinned [FlyGym v2.1.0 release](https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0) is Apache-2.0 and is not executed by this release.

## Demo prompt

Begin by calling `inspect_flylab_state`, then ask:

> Find source-backed adult fruit-fly circuits associated with backward walking. Draft a falsifiable MDN activation hypothesis and design a controlled MDN-inspired model-drive experiment with baseline, model-sham, bilateral, left-only, and right-only comparisons. Use unitless model drive 0.65, onset 1000 ms, duration 2000 ms, trial duration 5000 ms, eight replicates per arm, and seed 73142. Stop before running anything so I can inspect and approve the protocol.

After human approval, the person sets the visible next-trial budget to five replicates. Call `inspect_flylab_state` again to confirm that human control, then ask:

> Run the exact approved experiment. Analyze all five behavior metrics, rank conditions by backward distance using my visible next-trial budget, do not execute the proposed follow-up, and save the exact supporting evidence and comparison lineage.

See [DEMO.md](DEMO.md) for the current proof, narration-rights, build, and pre-upload requirements. [YOUTUBE_DESCRIPTION.md](YOUTUBE_DESCRIPTION.md) is the current metadata template and must be completed from the passing delivery report after the approved demo is generated.

Judge-ready prerequisites, prompts, expected state transitions, and recovery checks are in [JUDGE_TESTING.md](JUDGE_TESTING.md).

## Submission links

- Live application: [https://flylab-neuroethology.d-lougen.chatgpt.site](https://flylab-neuroethology.d-lougen.chatgpt.site)
- Public source repository: [https://github.com/DJLougen/flylab](https://github.com/DJLougen/flylab)
- Demo video: `[YOUTUBE_DEMO_URL]` — pending public upload and verification
- Challenge entry: `[DEVPOST_ENTRY_URL]` — pending publication and verification

## Submission checklist

- [x] Verify the live HTTPS URL without private-site authentication.
- [x] Confirm Chrome with the official WebMCP testing feature accepts all eight registrations.
- [ ] Confirm ChatGPT's in-app browser discovers exactly eight tools.
- [x] Run `npm test`, `npm run lint`, and `npm run build` against the release candidate.
- [x] Re-clone the public GitHub repository and pass dependency installation, all 52 tests, lint, and production build from only the published files.
- [x] Add public CI for exact dependency installation, tests, lint, build, and dependency audit.
- [x] Confirm the deployed workflow stops at the non-WebMCP review gate before the visible approval click.
- [x] Confirm on the final deployment that editing a protocol clears approval, playback, analyses, and the follow-up proposal.
- [x] Confirm on the final deployment that cancellation does not create a completed batch through both WebMCP protocol cancellation and the visible human cancel control.
- [x] Confirm on the final deployment that canceling evidence preparation creates no bundle, local-storage entry, or ledger entry and preserves the callable save recovery state.
- [x] Confirm on the final deployment that repeating all seven state-changing calls preserves `saved` stage, `complete` next action, bundle ID, manifest hash, and saved timestamp.
- [ ] Confirm the result and evidence badges remain visible in the replacement recording.
- [x] Confirm the follow-up proposal is not executed.
- [x] Confirm the saved bundle displays an ID and manifest hash.
- [x] Confirm every linked scientific URL resolves to the intended primary page, allowing for publisher anti-bot interstitials where DOI and authoritative metadata independently confirm the destination. See [source verification](SOURCE_VERIFICATION.md).
- [x] Confirm no copy or narration claims actual FlyGym execution or new biological results.
- [ ] Regenerate the narrated under-three-minute MP4 after approval of the final agent-first interface; show real WebMCP discovery/invocation, same-page state changes, the Three.js BANC reconstruction view, English captions, thumbnail, and gallery stills.
- [x] Add an owner-approved Apache-2.0 `LICENSE` file that Devpost can detect at the top of the repository.
- [x] Replace the untracked social illustration with a 1200 × 630 capture of FlyLab's own interface and document its origin.
- [x] Remove macOS System Voice recording from the demo builder; require separately supplied narration and explicit publication-rights confirmation.
- [x] Prepare concise judge instructions and a no-login Chrome fallback in [JUDGE_TESTING.md](JUDGE_TESTING.md).
- [ ] Confirm the public app remains free and unrestricted through the end of judging on September 21, 2026 at 5:00 p.m. PT.
- [ ] Confirm the replacement video contains no unauthorized music, third-party trademarks, or other protected media.
- [ ] Publish a public YouTube demo under three minutes with audio.
- [ ] Verify the YouTube video in a signed-out browser, then replace `[YOUTUBE_DEMO_URL]`.
- [ ] Publish and verify the Devpost entry, then replace `[DEVPOST_ENTRY_URL]`.
- [ ] Include the required working app, repository, and demo video in the final challenge entry.
