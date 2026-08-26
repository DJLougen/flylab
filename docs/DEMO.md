# FlyLab WebMCP challenge demo (prior v6 artifact)

## Artifact status

The v6 challenge demo is a generated, narrated sequence of 12 FlyLab interface captures. It includes two captures of the interactive Three.js circuit view, but it predates the corrected Three.js arena fly and is no longer submission-ready. Keep it as a reproducible prior artifact until a fresh capture set is generated after interface approval.

The prior local package remains technically verified at **2:15.821**, below the challenge's three-minute limit. Do not upload it. Public YouTube upload and Devpost submission remain pending until the corrected interface has a regenerated, verified video.

The replacement capture must begin with `00-eight-tools-live.png`, show the new agent control plane, and describe the current surface as **one read-only state inspector plus seven scientific workflow actions**. It must visibly show real browser WebMCP discovery/invocation—not the guided example—with `inspect_flylab_state` returning the page revision, artifact IDs, person-only blocker, and exactly one next action before discovery, after approval, and after a protocol edit. Activity must visibly distinguish `webmcp agent · r#` from `human ui · r#`. The seven-tool wording below is archived historical narration and must not be reused.

Credits for the replacement video/description must identify the BANC v888 static dataset, Harvard Dataverse version 3.0, <https://doi.org/10.7910/DVN/7WTH1N>, CC BY 4.0; six simplified L2 SWC render derivatives; and FlyLab's shared coordinate-transform/topology-preserving-simplification changes. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Delivery assets

| Asset | Path | Purpose |
| --- | --- | --- |
| Video | `outputs/demo/v6/FlyLab-WebMCP-Demo.mp4` | Archived only; do not upload |
| Captions | `outputs/demo/v6/FlyLab-WebMCP-Demo.srt` | Archived caption record |
| Narration | `outputs/demo/v6/FlyLab-WebMCP-Demo-narration.txt` | Spoken-script review |
| Thumbnail | `outputs/demo/v6/FlyLab-Devpost-Thumbnail.png` | YouTube and challenge-entry thumbnail |
| Gallery | `outputs/demo/v6/gallery/` | Five submission-ready stills |

Verified delivery properties:

- Duration: `00:02:15.821`
- Video: H.264, 1440 × 900, 30 fps
- Audio: AAC, 48 kHz, stereo, integrated loudness `-15.9 LUFS`
- Captions: embedded English `mov_text` stream plus a separate `.srt`
- File size: 6,557,544 bytes
- Video SHA-256: `f052192ddf4b78ffffb309c766eeca1a97c3c758ff4945273d3726349fe102f1`

## Scientific reading of the circuit view

The Three.js view uses six real BANC v888 L2 skeleton reconstructions: four MDNs and two LBL40 cells. “Real” here refers to reconstruction geometry from the pinned BANC data, not recorded activity in the current FlyLab run.

- Purple indicates the MDN targets receiving the selected **unitless model drive**.
- Cyan indicates bundled, connectome-inferred structural LBL40 paths and contacts.
- Glow indicates model selection during replay. It is **not measured neural activity**, calcium signal, voltage, or biological signal propagation.
- The translucent central-nervous-system shell is schematic.
- Behavioral trajectories come from FlyLab's deterministic reduced-order model. They are `simulation_predicted`, not FlyGym execution, whole-brain dynamics, or wet-lab measurements.
- The displayed condition replay is an illustrative simulation path. Behavior metrics aggregate separate simulation-generated per-run summaries; they are both `derived` and `simulation_predicted`.
- The `measured` evidence label refers to findings summarized from cited biological studies; it does not describe the current model drive or generated trajectory.

## Twelve-frame cue sheet and narration

The frame order, millisecond cues, and spoken text below match the final v6 caption file. Use the `.srt` as the edit-point source of truth.

### 1. Seven tools live — 0:00.000–0:10.478

**Frame:** `00-seven-tools-live.png`

Show the shared laboratory, seven-tool activity rail, empty arena, evidence classes, and current MDN-inspired objective.

> FlyLab keeps measured evidence, structural connectomes, model output, and new hypotheses visibly separate while a person and an agent share one virtual fruit-fly laboratory.

### 2. Circuit evidence found — 0:10.478–0:21.377

**Frame:** `01-circuit-found.png`

Show the Discover step completed with linked adult MDN evidence, pinned BANC version information, and coverage warnings.

> Using a browser-native site tool, not screen scraping, the agent finds the adult Moonwalker descending-neuron circuit with primary sources, pinned BANC version data, and coverage warnings.

### 3. Falsifiable hypothesis drafted — 0:21.377–0:29.564

**Frame:** `02-hypothesis-drafted.png`

Show the hypothesis artifact and its `agent_hypothesized` label.

> It drafts a falsifiable claim labeled agent-hypothesized, so plausible language never silently becomes biological evidence.

### 4. Controlled protocol locked — 0:29.564–0:38.332

**Frame:** `03-protocol-locked.png`

Show baseline, model-sham, bilateral, left-only, and right-only arms together with timing, unitless drive, replicates, seed, controller version, and assumptions.

> The agent designs five controlled arms. Timing, model drive, replicates, seed, controller version, and assumptions stay visible.

### 5. Human approval boundary — 0:38.332–0:47.586

**Frame:** `04-human-approved.png`

Move from the blocked run state to the visibly human-approved protocol. Approval is a person-only interface action, not one of the seven agent tools.

> Execution remains blocked until a person reviews the exact protocol and uses the visible approval control. Approval is deliberately not available as an agent tool.

### 6. Simulation replay — 0:47.586–0:57.061

**Frame:** `05-simulation-replay.png`

Show the completed seeded replay and its `simulation_predicted` label.

> After approval, FlyLab produces seeded deterministic trajectories in a reduced-order model, not FlyGym execution, neural dynamics, or wet-lab data.

### 7. Bilateral BANC circuit view — 0:57.061–1:14.058

**Frame:** `06-circuit-bilateral-active.png`

Show the Three.js reconstruction view with all four MDNs selected in purple and both structural LBL40 paths in cyan.

> The circuit view renders six actual BANC version eight eighty-eight L two skeleton reconstructions: four M D N cells and two L B L forty cells. Purple marks the bilateral model targets. Cyan marks the bundled structural L B L forty paths: four edges and one hundred fifty-three putative contacts.

### 8. Left-only drive and neural-activity boundary — 1:14.058–1:29.546

**Frame:** `07-circuit-left-active.png`

Show only the two metadata-left MDNs and their connectome-inferred right LBL40 target highlighted. Keep the on-screen reconstruction and schematic-shell cautions legible.

> Switching to left-only illuminates only the two metadata-left M D N cells and their connectome-inferred right L B L forty target, totaling one hundred three contacts. The translucent central nervous system shell is schematic, and glow is model selection, not measured neural activity.

### 9. Behavior analysis — 1:29.546–1:41.542

**Frame:** `08-behavior-analysis.png`

Show the preregistered behavior metrics and the paired `derived` and `simulation_predicted` provenance labels.

> The agent calculates the preregistered behavior metrics from the completed batch. Results carry both derived and simulation-predicted labels, preserving the difference between arithmetic on a model and measurements from flies.

### 10. Bounded follow-up — 1:41.542–1:51.255

**Frame:** `09-bounded-follow-up.png`

Show the ranked conditions and one proposed follow-up without executing it.

> FlyLab can rank conditions and propose one bounded follow-up, but that proposal has no execution authority. A new or edited experiment would require another human review.

### 11. Evidence bundle saved — 1:51.255–2:04.473

**Frame:** `10-evidence-saved.png`

Show the saved bundle ID and manifest-hash prefix.

> Finally, the agent saves sources, evidence classes, hypothesis, protocol, seeds, runs, model versions, analyses, limitations, and the next proposal into one manifest-hashed evidence bundle.

### 12. Evidence ledger close — 2:04.473–2:15.610

**Frame:** `11-evidence-ledger.png`

Close on the evidence ledger so the measured, derived, connectome-inferred, simulation-predicted, and agent-hypothesized classes remain visible.

> This is the core of FlyLab. Seven Web M C P tools let an agent explore and run a transparent virtual neuroethology workflow, while every claim retains its source and a person retains control.

The video container ends at 2:15.821, 0.211 seconds after the final caption cue.

## Canonical prompts behind the captured state

The archived video does not show a live prompt-entry sequence and therefore cannot serve as WebMCP proof. The replacement must show the Browser's site-tool surface or equivalent real invocation evidence. These are the two prompts for reproducing the workflow.

**Prompt 1 — evidence through protocol**

> Find source-backed adult fruit-fly circuits associated with backward walking. Draft a falsifiable MDN activation hypothesis and design a controlled MDN-inspired model-drive experiment with baseline, model-sham, bilateral, left-only, and right-only comparisons. Use unitless model drive 0.65, onset 1000 ms, duration 2000 ms, trial duration 5000 ms, eight replicates per arm, and seed 73142. Stop before running anything so I can inspect and approve the protocol.

Expected tool sequence:

```text
inspect_flylab_state
→ find_fly_circuits
→ draft_fly_hypothesis
→ design_stimulation_trial
→ human approval required
```

After a person clicks **Approve experiment**, set the visible **Next-trial budget** to 5. This is a person-owned control and cannot be overridden by the agent. Then use the second prompt.

Call `inspect_flylab_state` again after approval before executing.

**Prompt 2 — approved execution through evidence**

> Run the exact approved experiment. Analyze backward distance, signed speed, response latency, heading change, and stance stability. Rank the conditions by backward distance using my visible next-trial budget, do not execute the proposed follow-up, and save the exact supporting evidence and comparison lineage.

Expected tool sequence:

```text
inspect_flylab_state
→ run_fly_simulation
→ analyze_fly_behavior
→ compare_fly_trials
→ save_fly_evidence
```

After the saved-bundle view, edit one protocol field and call `inspect_flylab_state` once more. The recording must show a new experiment ID, `waiting_for_human`, no callable next tool, and cleared downstream artifact IDs.

## Replacement pre-upload checks

- Generate new paths, duration, hash, chapters, captions, thumbnail, and gallery from the approved agent-first build; none of the archived v6 values above are reusable submission metadata.
- Confirm the replacement duration remains below `00:03:00`.
- Watch the replacement MP4 from beginning to end with audio on.
- Confirm every replacement segment is uncropped and readable.
- Confirm the replacement `.srt` matches the embedded English caption track.
- Confirm “model drive” and “model selection” are never described as measured neural activity.
- Confirm the BANC lines are described as real reconstruction geometry while the CNS shell remains labeled schematic.
- Confirm simulation and derived outputs retain their provenance labels.
- Confirm the follow-up is proposed but not executed.
- Confirm the video never claims FlyGym execution, whole-brain dynamics, direct connectome simulation, or new biological results.
- Confirm the public YouTube URL before replacing `[YOUTUBE_DEMO_URL]`.
- Confirm the public Devpost URL before replacing `[DEVPOST_ENTRY_URL]`.
- Confirm the public repository displays the owner-approved Apache-2.0 root `LICENSE` file.
- Confirm the replacement shows real WebMCP tool use, visible actor/tool/revision activity, and no guided-example state presented as agent evidence.
- Confirm the BANC CC BY 4.0 attribution and derivative-change notice appear in the public video description or credits.

See [YOUTUBE_DESCRIPTION.md](YOUTUBE_DESCRIPTION.md) for upload-ready title, description, chapters, tags, and asset pointers.
