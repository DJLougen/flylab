# WebMCP Challenge submission

The live application and public source links below have been verified. Add the demo-video and challenge-entry URLs after those artifacts exist.

Submission deadline: **September 3, 2026 at 1:00 p.m. PDT**.

## Submission fields

**Project name**

FlyLab

**Tagline**

A source-aware virtual fruit-fly lab where people and agents design controlled experiments together without blurring evidence, simulation, and hypothesis.

**One-sentence summary**

FlyLab uses seven WebMCP tools to turn an adult MDN backward-walking question into a cited hypothesis, human-approved virtual experiment, reproducible simulation analysis, bounded next-experiment proposal, and provenance-rich evidence bundle inside one shared interface.

**Submission description**

FlyLab is an agent-native virtual neuroethology lab built around a scientifically transparent adult *Drosophila* MDN backward-walking vertical slice. Instead of asking an agent to guess its way through a complex brain viewer, the site exposes seven structured scientific actions: find curated circuits, draft a falsifiable hypothesis, design controls, run an approved simulation, quantify behavior, compare trials, and save the evidence lineage.

The person and agent share the same laboratory state. The agent can gather cited evidence and prepare a controlled baseline/sham/bilateral/lateralized protocol, but simulation is locked until the person reviews and approves the visible parameters. If the person edits the protocol, approval and downstream results are cleared. After execution, every trajectory and metric remains labeled as a simulation prediction or a derivation from one. The agent can propose a bounded follow-up, but it cannot execute that proposal automatically.

FlyLab's current embodiment is a deterministic reduced-order model, version `0.1.1`, with the MDN-inspired `mdn-inspired-retreat-adapter.v1`. It is not FlyGym, a complete fly brain, or a wet-lab experiment. Sources, assumptions, dataset and model versions, seeds, run IDs, analyses, limitations, and a manifest hash are saved together so a compelling result never loses its boundary. The WebMCP surface follows OpenAI's [Site tools documentation](https://learn.chatgpt.com/docs/webmcp).

**Problem**

Neuroscience workflows combine different kinds of evidence: biological measurements, derived behavior screens, structural connectomes, simulation output, and new hypotheses. Conventional interfaces make those boundaries easy to lose, while visual browser automation forces agents to spend effort clicking instead of reasoning about experiments.

**Solution**

FlyLab makes the scientific workflow itself callable. WebMCP gives the agent high-level, validated actions that update the same protocol, arena, activity log, result cards, and evidence ledger the person sees. Stable record IDs connect each step, structured errors prevent invalid transitions, and the human retains authority at the point that matters most: experiment execution.

**What makes the human-agent experience meaningful**

- The agent handles evidence retrieval, protocol structure, repetitive seeded trials, metric calculation, and comparison.
- The person sees every intermediate artifact and can inspect sources, edit parameters, reject the design, or approve the exact protocol.
- Approval cannot be called by the agent.
- Editing invalidates approval and downstream artifacts.
- The agent proposes one follow-up within a person-selected budget and stops.
- The final bundle preserves sources and scientific limitations, not just a polished answer.

## WebMCP implementation

FlyLab registers exactly seven tools using the current `document.modelContext` API:

1. `find_fly_circuits`
2. `draft_fly_hypothesis`
3. `design_stimulation_trial`
4. `run_fly_simulation`
5. `analyze_fly_behavior`
6. `compare_fly_trials`
7. `save_fly_evidence`

The tools use closed object schemas, strict runtime validation, standard `readOnlyHint` and `untrustedContentHint` annotations, cancellable execution, structured domain failures, and AbortSignal-owned registration lifecycle. Read-only discovery is distinguished from state-changing laboratory actions. Externally sourced or authored text is marked untrusted.

The canonical workflow is:

```text
find evidence
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
- Baseline, model-sham, bilateral, left-only, and right-only conditions
- A pinned BANC `banc_888` slice with checksummed source files, four proofread MDN rows, two LBL40 rows, and four selected directed MDN→LBL40 edge rows
- Deterministic seeded virtual trials
- Five method-versioned behavior metrics
- Five-class provenance model
- Visible human-approval boundary
- Bounded next-experiment proposal
- Local evidence bundle with model/source manifests and hash
- Deterministic tests for the model and WebMCP contracts

**Not claimed**

- Whole-brain neural dynamics
- Actual FlyGym or NeuroMechFly execution
- Direct BANC/MANC connectome simulation
- A biological dose-response model
- New wet-lab evidence or autonomous biological experimentation

FlyGym is a future adapter path, not a hidden dependency or current runtime claim.

## Reproducibility and provenance

The same protocol and seed reproduce the same experiment, runs, trajectories, and run hash. Changing the seed changes the generated runs. Every saved bundle includes:

- source and evidence records
- provenance labels
- hypothesis and falsification criterion
- exact controlled protocol
- model/controller/environment versions and assumptions
- base and derived seeds
- run IDs and run hash
- analysis method version and requested metrics
- comparison and non-authorized follow-up proposal
- evidence-bundle manifest hash

The five labels are `measured`, `derived`, `connectome_inferred`, `simulation_predicted`, and `agent_hypothesized`.

## Primary sources and reuse pointers

- [Bidaye et al., *Science* (2014)](https://doi.org/10.1126/science.1249964) — adult MDN activation and silencing assays; publisher copyright.
- [Sen et al., *Current Biology* (2017)](https://doi.org/10.1016/j.cub.2017.02.008) — acute and stochastic adult MDN activation assays; Elsevier copyright.
- [Feng et al., *Nature Communications* (2020)](https://doi.org/10.1038/s41467-020-19936-x) — MDN-induced backward-walking motor circuits; CC BY 4.0.
- [Cande et al., *eLife* (2018)](https://doi.org/10.7554/eLife.34275) — broad descending-neuron screen; CC BY 4.0. The [Dryad version 1 dataset](https://doi.org/10.5061/dryad.fr89c0c) is CC0-1.0.
- [Bates et al., *Nature* (2026)](https://doi.org/10.1038/s41586-026-10735-w) — BANC article context. The pinned [Dataverse version 3.0 / `banc_888` snapshot](https://doi.org/10.7910/DVN/7WTH1N) is CC BY 4.0.
- [FlyEM MANC `manc:v1.2.1`](https://www.janelia.org/project-team/flyem/manc-connectome) — cross-dataset reference to a separate adult male specimen; CC BY 4.0.
- [Wang-Chen et al., *Nature Methods* (2024)](https://doi.org/10.1038/s41592-024-02497-y) — NeuroMechFly v2/FlyGym reference. The pinned [FlyGym v2.1.0 release](https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0) is Apache-2.0 and is not executed by this release.

## Demo prompt

First ask:

> Find source-backed adult fruit-fly circuits associated with backward walking. Draft a falsifiable MDN activation hypothesis and design a controlled bilateral activation experiment with baseline, sham, left-only, and right-only comparisons. Use unitless model drive 0.65, onset 1000 ms, duration 2000 ms, trial duration 5000 ms, eight replicates per arm, and seed 73142. Stop before running anything so I can inspect and approve the protocol.

After human approval, ask:

> Run the exact approved experiment. Analyze all five behavior metrics, rank conditions by backward distance, propose one follow-up with a five-replicate budget, do not execute that proposal, and save the complete evidence bundle.

See [DEMO.md](DEMO.md) for the timed two-minute recording script.

## Submission links

- Live application: [https://flylab-neuroethology.d-lougen.chatgpt.site](https://flylab-neuroethology.d-lougen.chatgpt.site)
- Public source repository: [https://github.com/DJLougen/flylab](https://github.com/DJLougen/flylab)
- Demo video: `[DEMO_VIDEO_URL]`
- Challenge entry: `[DEVPOST_ENTRY_URL]`

## Submission checklist

- [x] Verify the live HTTPS URL without private-site authentication.
- [x] Confirm Chrome with the official WebMCP testing feature accepts all seven registrations.
- [ ] Confirm ChatGPT's in-app browser discovers exactly seven tools.
- [x] Run `npm test`, `npm run lint`, and `npm run build` against the submitted commit.
- [ ] Confirm the first demo prompt stops at human approval.
- [ ] Confirm editing a protocol clears approval and previous downstream artifacts.
- [ ] Confirm cancellation does not create a completed batch.
- [ ] Confirm the result and evidence badges remain visible in the recording.
- [ ] Confirm the follow-up proposal is not executed.
- [ ] Confirm the saved bundle displays an ID and manifest hash.
- [ ] Confirm every linked scientific URL resolves to the intended primary page.
- [ ] Confirm no copy or narration claims actual FlyGym execution or new biological results.
- [ ] Add an owner-approved open-source `LICENSE` file that Devpost can detect at the top of the repository.
- [ ] Publish a public YouTube demo under three minutes with audio.
- [ ] Replace the two remaining bracketed URL placeholders with verified public URLs.
- [ ] Include the required working app, repository, and demo video in the final challenge entry.
