# WebMCP Challenge submission

The current agent-native candidate is deployed publicly and has passed the complete Chrome 151 WebMCP workflow against the live HTTPS URL. The repository is public, licensed under Apache-2.0, reproducible from a fresh public clone, and configured with public CI. The tested demo preflight requires exactly 15 frames—13 page-state frames plus two headed-browser WebMCP proof composites—and 15 rights-cleared narration clips; it fails closed until those inputs, narration rights, and explicit interface approval are present. The final inputs have not been assembled, and public YouTube upload and Devpost publication remain pending.

Submission deadline: **September 3, 2026 at 1:00 p.m. PDT**, as shown by the [OpenAI challenge page](https://openai.com/webmcp-challenge/) and the binding [Devpost official rules](https://webmcp.devpost.com/rules).

FlyLab was created on August 26, 2026 during the challenge period. The dated [first public commit](https://github.com/DJLougen/flylab/commit/a45eb82ad29d62a1bf7afc0aff89f71a70384db9) records the initial challenge build. The deployed, audited agent-native application is [commit `1048469`](https://github.com/DJLougen/flylab/commit/104846997773c6905ed4c6da26fea67e0676c148); its [successful public CI run](https://github.com/DJLougen/flylab/actions/runs/33017176540) covers exact dependency installation, all 59 tests, lint, production build, and dependency audit. Its primary audience is a computational-neuroethology researcher or educator reviewing a source-backed virtual MDN experiment. The concrete failure it prevents is an agent silently continuing from stale page state or presenting a simulation result after its evidence lineage, protocol, or human approval has changed. Agent-tool builders are a secondary audience.

## Prepared submission copy

The available Devpost session is logged out, so the exact field labels inside the authenticated submission form have not been inspected. The headings below organize prepared copy only; they do not claim to reproduce Devpost's private form labels, and submission is not complete.

**Project name**

FlyLab

**Tagline**

Agent-operable, human-auditable neuroethology without blurring evidence, simulation, and hypothesis.

**One-sentence summary**

FlyLab gives agents one read-only state inspector and seven WebMCP scientific actions that turn an adult MDN backward-walking question into a cited hypothesis, human-approved virtual experiment, reproducible analysis, bounded follow-up, and provenance-rich evidence bundle inside one shared page session.

**Submission description**

FlyLab is an agent-native virtual neuroethology lab built around a scientifically transparent adult *Drosophila* MDN backward-walking vertical slice. Instead of asking an agent to guess its way through a complex brain viewer, the site exposes one read-only control-plane inspector plus seven structured scientific actions: find curated circuits, draft a falsifiable hypothesis, design controls, run an approved simulation, quantify behavior, compare trials, and save the evidence lineage.

The person and agent share the same open-page state. `inspect_flylab_state` returns `flylab.agent-context.v2`: operational recovery state plus an `artifact_manifest` containing the current scientific artifacts and compact lineage. It lets an agent recover the current monotonic revision, compact artifact records rather than bare IDs, discovered evidence, hypothesis perturbation, analysis metric sets, exact comparison lineage, person-selected limits, blocker, and one valid next action after a person edit or interruption—without scraping the interface. The agent can gather cited evidence and prepare a protocol with mandatory baseline/model-sham controls, but simulation is locked until the person reviews and approves the exact visible identifiers and parameters. While blocked, the inspector returns `waiting_for_human` and no callable next tool. If the person edits the protocol, approval and downstream results are cleared. Long preparations compare their captured revision with live state; `STALE_STATE` publishes nothing and directs the agent back to the inspector. After execution, the illustrative condition replay remains a simulation prediction while behavior cards are labeled as derived aggregates of separate simulation-generated per-run summaries. The agent can propose a bounded follow-up, but it cannot execute that proposal automatically.

FlyLab's current embodiment is a deterministic reduced-order model, version `0.1.3`, with the MDN-inspired `mdn-inspired-retreat-adapter.v2`. Its numeric parameters are hand-authored and uncalibrated; the public [model card](MODEL_CARD.md) gives every equation and constant. It is not FlyGym, a complete fly brain, or a wet-lab experiment. Sources, assumptions, dataset and model versions, seeds, run IDs, analyses, limitations, and a manifest hash are saved together so a compelling result never loses its boundary. The WebMCP surface follows OpenAI's [Site tools documentation](https://learn.chatgpt.com/docs/webmcp).

The circuit view is an orbitable Three.js rendering of six pinned, reconstruction-derived BANC v888 L2 skeletons—four MDNs and two LBL40 cells—with camera presets and accessible cell inspection. Purple replay illumination marks the MDNs receiving the selected unitless model drive; cyan marks four directed MDN→LBL40 structural rows totaling 153 v3-predicted synaptic links after the released postsynapse-size ≥10-voxel filter. This v3 future-work product differs from the v2 ≥5-voxel product used in the BANC paper analyses. Neither the link counts nor the visual encodings are measured neural activity, physiological weights, connection probabilities, causal efficacy, or biological signal propagation. The surrounding CNS shell is explicitly schematic.

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

## Judging-criteria mapping

The official rules weight four criteria equally. FlyLab's evidence for each is:

| Criterion | FlyLab evidence |
|---|---|
| **WebMCP Leverage** | Eight non-trivial page-registered tools expose the scientific workflow at the operation level rather than reproducing UI clicks. `flylab.tool-result.v2` and `flylab.agent-context.v2` share the visible page revision, field-addressed scientific provenance, current artifact manifest, exact lineage, human approval blocker, cancellation boundary, structured recovery, and one valid next action. |
| **Execution** | The no-login HTTPS application delivers a coherent adult MDN vertical slice with an interactive Three.js arena and circuit viewer, controlled seeded simulation, analysis, bounded follow-up, and evidence export. The release is covered by public CI and a complete Chrome 151 WebMCP workflow against the deployed site. |
| **Potential Impact** | FlyLab addresses a specific failure for neuroscience researchers and educators: agents can no longer silently blur measured findings, derived summaries, connectome structure, simulation predictions, and new hypotheses or continue from stale experimental state. |
| **Creativity & Ambition** | One shared browser instrument combines source-backed neuroethology, reconstruction-derived 3D cells, a deterministic experiment state machine, provenance-preserving evidence bundles, and a deliberately non-tool human review gate. |

## Public requirements and prepared artifacts

This maps the requirements visible on the public challenge page and rules to the release materials already prepared. It is a readiness map, not a claim that the final entry has been submitted.

| Public requirement | Prepared artifact or current status |
|---|---|
| Working WebMCP project | The no-login [live application](https://flylab-neuroethology.d-lougen.chatgpt.site) and [Chrome workflow verification](WEBMCP_VERIFICATION.md) exercise all eight page-registered tools. |
| Public source code | The [public repository](https://github.com/DJLougen/flylab), Apache-2.0 license, reproducibility instructions, and [passing release CI](https://github.com/DJLougen/flylab/actions/runs/33017176540) are prepared. |
| Public demo video under three minutes with audio | The [15-frame demo plan and fail-closed preflight](DEMO.md), narration plan, rights gate, captions, and [YouTube metadata template](YOUTUBE_DESCRIPTION.md) are prepared; approved frames, rights-cleared audio, final MP4, upload, and signed-out playback verification remain pending. |
| Clear explanation and judge access | This submission copy, [judge instructions](JUDGE_TESTING.md), public agent manifest, and generated machine-readable tool contract describe the WebMCP workflow, supervisor gate, recovery semantics, and scientific boundaries. |
| Final challenge entry with working app, repository, and video links | App and repository URLs are prepared; the video and entry URLs remain placeholders. The available Devpost session is logged out, so its exact authenticated field labels remain uninspected and are not invented here. |

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

The tools use closed object schemas, strict runtime validation, standard `readOnlyHint` and `untrustedContentHint` annotations, cancellable execution, monotonic shared revisions, structured domain failures, and AbortSignal-owned registration lifecycle. Every success uses the `flylab.tool-result.v2` envelope. Its top-level `provenance` array is only the unique label union for the result; `flylab.provenance-manifest.v1` assigns labels, artifact IDs, parents, evidence IDs, source IDs, and scientific boundaries to RFC 6901 paths within `structuredContent.data`. A manifest entry applies to its scientific subtree unless a more specific nested entry overrides it. Declared operational paths do not inherit scientific provenance, and caller-supplied titles, goals, and notes remain untrusted administrative annotations excluded from scientific provenance counts.

The inspector is the sole read-only action. Its `flylab.agent-context.v2` response separates operational recovery state from `artifact_manifest`, which carries field-auditable records for the selected circuit, discovered evidence, hypothesis, experiment, batch, analyses, comparison, and evidence bundle when present. Discovery evidence, hypothesis, trial target/perturbation, batch, analysis metric sets, comparison, and save inputs are validated as one exact lineage. State-changing laboratory actions remain distinct, and externally sourced or person-authored text is marked untrusted.

`save_fly_evidence` returns the portable `flylab.evidence-export` version 2 object directly in `structuredContent.data.evidence_export`; it is not reconstructed later from the interface. That exact returned object contains `bundle`, `integrity`, and `payload`. The bundle and integrity records carry the SHA-256 of `JSON.stringify(payload)`, while the payload preserves the selected circuit, hypothesis, controlled experiment and condition IDs, batch and run IDs, analyses, comparison and unexecuted proposal, evidence/source partitions, field-addressed provenance manifest, and untrusted administrative annotation. The bundle also publishes `provenanceIndex`, `provenanceCounts`, and `lineageEdges`; the untrusted annotation is included for auditability but excluded from scientific provenance and scientific lineage.

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
- A pinned BANC Dataverse version 3.0 `banc_888` slice with checksummed source files, four proofread MDN rows, two LBL40 rows, and four selected directed MDN→LBL40 rows totaling 153 v3-predicted synaptic links after the postsynapse-size ≥10-voxel filter; this future-work v3 product is distinct from the paper's v2 ≥5-voxel analyses
- Six checksummed, reconstruction-derived BANC v888 SWC render assets in an interactive Three.js circuit viewer
- A procedural Three.js adult-fly arena model with research-informed external landmarks and an explicit schematic boundary
- Deterministic seeded virtual trials
- Five required method-versioned behavior metrics plus an always-reported reverse-initiation summary; no-response latency is JSON `null` / UI `n/a`
- Five-class provenance model
- Visible human-approval boundary
- Bounded next-experiment proposal
- Exact-lineage evidence bundle and directly returned portable evidence export with separately scoped hypothesis-support, circuit-context, and model-method source closures, field-addressed provenance, lineage edges, model manifests, and payload hash
- 59 automated tests for the model, model-card parity, recovery state machine, claim-compatible evidence gating, exact evidence export, synchronized public agent manifest and generated contract document, unsupported/active transport handoffs, absent-API fail-closed behavior, WebMCP v2 contracts, and publication-safe 15-frame submission and direct-build gates

**Not claimed**

- Whole-brain neural dynamics
- Actual FlyGym or NeuroMechFly execution
- Direct BANC/MANC connectome simulation
- A biological dose-response model
- New wet-lab evidence or autonomous biological experimentation

FlyGym is a future adapter path, not a hidden dependency or current runtime claim.

## Reproducibility and provenance

The same protocol and seed reproduce the same experiment, runs, trajectories, and run hash. Changing the seed changes the generated runs. Saving requires the current hypothesis, experiment, sole batch, comparison, and exactly the comparison's complete analysis set. Every saved bundle and its exact returned `evidence_export` include:

- the hypothesis's exact supporting source/evidence closure
- a separately scoped model-method evidence/source closure in which the local model card defines the method and FlyGym remains an embodiment reference
- a five-label `provenanceIndex`, matching counts, field-addressed `provenanceManifest`, and explicit lineage edges
- hypothesis and falsification criterion
- exact controlled protocol
- model/controller/environment versions and assumptions
- base and derived seeds
- run IDs and run hash
- analysis method version and complete predefined required metric panel
- comparison and non-authorized follow-up proposal
- the evidence-export payload manifest hash, repeated in the bundle and integrity record

The five labels are `measured`, `derived`, `connectome_inferred`, `simulation_predicted`, and `agent_hypothesized`.

## Primary sources and reuse pointers

- [Bidaye et al., *Science* (2014)](https://doi.org/10.1126/science.1249964) — adult MDN activation and silencing assays; publisher copyright.
- [Sen et al., *Current Biology* (2017)](https://doi.org/10.1016/j.cub.2017.02.008) — acute and stochastic adult MDN activation assays; Elsevier copyright.
- [Feng et al., *Nature Communications* (2020)](https://doi.org/10.1038/s41467-020-19936-x) — MDN-induced backward-walking motor circuits; CC BY 4.0.
- [Cande et al., *eLife* (2018)](https://doi.org/10.7554/eLife.34275) — broad descending-neuron screen; CC BY 4.0. The [Dryad version 1 dataset](https://doi.org/10.5061/dryad.fr89c0c) is CC0-1.0.
- [Bates et al., *Nature* (2026)](https://doi.org/10.1038/s41586-026-10735-w) — BANC article context. The pinned [BANC static dataset, Harvard Dataverse version 3.0 / `banc_888`](https://doi.org/10.7910/DVN/7WTH1N) is CC BY 4.0. FlyLab uses two unrestricted Feather inputs, including the v3 edge product, and six simplified L2 SWC render derivatives. Its four selected MDN→LBL40 rows total 153 v3-predicted synaptic links after the ≥10-voxel filter; the paper analyses use v2 with a ≥5-voxel filter. These counts are structural data, not physiology or activity. Render changes are one shared coordinate transform and topology-preserving simplification. The broader deposit has mixed file-level access. Full modification notices are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
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

## Entrant attestations

These eligibility and ownership facts must be verified personally by the entrant. They deliberately remain unchecked until that review is complete.

- [ ] Confirm the entrant is at least the age of majority where they reside and resides in an OpenAI-supported country or territory that is not excluded by the official rules, including the province of Quebec exclusion.
- [ ] Confirm the entrant is not a Promotion Entity, its employee or agent, a judge or judge employer, an excluded affiliate or household/immediate-family member, or otherwise subject to a real or apparent conflict of interest.
- [ ] Confirm FlyLab will be the entrant's only WebMCP Challenge submission.
- [ ] Confirm FlyLab was not developed or derived from a project developed with disqualifying financial or preferential support from OpenAI or Devpost.
- [ ] Confirm the submitted original work is owned by the entrant and does not violate another party's intellectual-property, privacy, publicity, contractual, or other rights.
- [ ] Confirm every incorporated third-party SDK, package, dataset, reconstruction, font, and other asset is used under applicable permission or license terms and that all required attribution and modification notices are included.

## Submission checklist

- [x] Verify the live HTTPS URL without private-site authentication.
- [x] Confirm Chrome with the official WebMCP testing feature accepts all eight registrations.
- [ ] Optional, rollout-dependent QA: confirm ChatGPT's in-app browser discovers exactly eight tools in a model/account/workspace where Site Tools are available. This is not a submission blocker because the challenge rules also accept the independently verified Chrome 149+ path. The current Codex in-app runtime has been verified to fail closed with `agent_invocation_available: false`, explicit unsupported-runtime copy, and read-only contract/state discovery instead of claiming registration.
- [x] Run `npm test`, `npm run lint`, and `npm run build` against the release candidate.
- [x] Re-clone the public GitHub repository and pass dependency installation, all 59 tests, lint, and production build from only the published files.
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
- [ ] Freeze the submitted Devpost entry, public repository, and live site after the September 3, 2026 1:00 p.m. PT deadline until winners are announced, except for a modification Devpost or the Sponsor expressly permits under the official rules. See the challenge [resource guidance](https://webmcp.devpost.com/resources) and modification rules.
- [ ] Confirm the replacement video contains no unauthorized music, third-party trademarks, or other protected media.
- [ ] Publish a public YouTube demo under three minutes with audio.
- [ ] Verify the YouTube video in a signed-out browser, then replace `[YOUTUBE_DEMO_URL]`.
- [ ] Publish and verify the Devpost entry, then replace `[DEVPOST_ENTRY_URL]`.
- [ ] Include the required working app, repository, and demo video in the final challenge entry.
