# FlyLab WebMCP challenge demo plan

## Status and release gate

The agent-first application is public and the canonical 13 page-state captures have passed visual and workflow QA. The final challenge video has **not** been generated or uploaded. Build it only after the interface owner explicitly approves the UI.

Two headed-browser proof composites and 15 rights-cleared narration clips are still required. The builder fails closed when any source is missing, when narration rights are not explicitly confirmed, or when the finished video is three minutes or longer.

The [official challenge rules](https://webmcp.devpost.com/rules) require a public YouTube video under three minutes with audio that clearly shows the functioning project and explains how it uses WebMCP. The recording must not include unauthorized music, trademarks, or other protected media.

## Canonical visual sequence

The current sequence is designed for roughly 1:57, leaving ample room below the three-minute limit:

| Target time | Scene | Required proof |
| --- | --- | --- |
| 0:00–0:07 | Live WebMCP inventory | `proof-webmcp-tools.png`; all eight page-registered tools, with no approval tool |
| 0:07–0:15 | Shared control plane | `00-eight-tools-live.png`; revision, blocker, artifact IDs, and one next action |
| 0:15–0:22 | Circuit discovery | `01-circuit-found.png`; measured evidence and primary sources |
| 0:22–0:27 | Falsifiable hypothesis | `02-hypothesis-drafted.png`; `agent_hypothesized` label |
| 0:27–0:35 | Controlled protocol | `03-protocol-locked.png`; five arms and exact review parameters |
| 0:35–0:42 | Supervisor approval | `04-human-approved.png`; visible non-tool approval and post-approval state |
| 0:42–0:48 | Seeded replay | `05-simulation-replay.png`; reduced-order, `simulation_predicted` output |
| 0:48–1:01 | Bilateral circuit | `06-circuit-bilateral-active.png`; BANC skeletons and bilateral model targets |
| 1:01–1:11 | Left-only circuit | `07-circuit-left-active.png`; laterality and activity boundary |
| 1:11–1:18 | Behavior analysis | `08-behavior-analysis.png`; derived plus simulation-predicted metrics |
| 1:18–1:27 | Bounded follow-up | `09-bounded-follow-up.png`; proposal with no execution authority |
| 1:27–1:35 | Evidence bundle | `10-evidence-saved.png`; bundle ID and manifest hash |
| 1:35–1:42 | Provenance record | `11-evidence-ledger.png`; modal title, label, boundary, and source all visible |
| 1:42–1:50 | Human edit recovery | `12-protocol-edit-invalidates-results.png`; new revision and cleared lineage |
| 1:50–1:57 | Invocation proof | `proof-webmcp-invocations.png`; initial, post-approval, and post-edit inspections |

The two proof images must be tightly cropped and free of unrelated browser branding. The inventory proof must show all eight registered tool names. The invocation proof must make three `inspect_flylab_state` checkpoints legible: initial state, post-approval execution readiness, and post-edit recovery with cleared downstream IDs.

## Generate page-state captures

After UI approval, create the canonical captures directly from the public deployment:

```bash
FLYLAB_DEMO_CAPTURE=1 \
FLYLAB_VERIFY_WORKFLOW=1 \
FLYLAB_CAPTURE_DIR=outputs/demo/v7/frames \
npm run verify:webmcp
```

Clean capture mode uses the documented `0.65` unitless model drive. It omits negative cancellation tests and completed-lineage replay calls from the visible activity trail. The normal workflow verifier remains the authoritative QA path for those cases.

The headless verifier cannot capture browser debugging UI. Produce the two proof composites separately in a headed Chrome 149+ session with WebMCP testing and DevTools support enabled, using the same canonical protocol. Crop away browser logos and unrelated controls before placing them in `outputs/demo/v7/frames`.

## Narration rights and inputs

The builder intentionally does not synthesize or record a macOS System Voice. Supply 15 WAV clips in scene order:

```text
outputs/demo/v7/narration/00.wav
...
outputs/demo/v7/narration/14.wav
```

Use the entrant's own recording or a voice service whose terms expressly permit public and commercial publication. Do not include music unless the entrant owns it or has explicit permission to publish it. Keep documentation of the audio rights with the submission records.

The spoken script is the `narration` field for each segment in `scripts/build-demo-video.mjs`. Record one clip per segment without reading stage directions. The builder adds a short pause, derives caption timing from the actual clip duration, and normalizes the combined track to the validated loudness range.

Print the numbered clip plan without producing any media:

```bash
npm run demo:narration-plan
```

Check every UI, frame, narration, and rights gate without producing any media:

```bash
FLYLAB_UI_APPROVED=1 \
FLYLAB_NARRATION_RIGHTS_CONFIRMED=1 \
npm run demo:preflight
```

Until approval and all sources exist, the preflight exits nonzero and prints the exact missing frame and narration filenames as `flylab.demo-preflight.v1` JSON.

Build only after confirming the rights of every clip:

```bash
FLYLAB_NARRATION_DIR=outputs/demo/v7/narration \
FLYLAB_NARRATION_RIGHTS_CONFIRMED=1 \
npm run demo:video
```

The delivery report records the SHA-256 hash of every narration input without copying the raw clips into the promoted gallery.

## Scientific wording boundaries

- Call the BANC table entries **four directed structural edges and 153 putative contacts**, not four neural pathways or measured connections.
- “Real” refers only to the six pinned BANC v888 L2 reconstruction geometries.
- Purple is unitless model-target selection; cyan is connectome-inferred structure.
- Glow is not calcium, voltage, measured activity, or biological signal propagation.
- The CNS shell and procedural arena fly are schematic.
- Trajectories are deterministic reduced-order simulation predictions, not FlyGym execution, direct BANC simulation, whole-brain dynamics, or wet-lab measurements.
- Behavior cards are derived aggregates of simulation-generated per-run summaries.
- The `measured` label applies only to findings summarized from cited biological studies.
- The follow-up is proposed but never executed.

Credits must identify the BANC v888 static dataset, Harvard Dataverse version 3.0, <https://doi.org/10.7910/DVN/7WTH1N>, CC BY 4.0; the six simplified L2 SWC derivatives; and FlyLab's shared coordinate-transform and topology-preserving-simplification changes. See [Third-party notices](../THIRD_PARTY_NOTICES.md).

## Canonical prompts

**Prompt 1 — evidence through protocol**

> Find source-backed adult fruit-fly circuits associated with backward walking. Draft a falsifiable MDN activation hypothesis and design a controlled MDN-inspired model-drive experiment with baseline, model-sham, bilateral, left-only, and right-only comparisons. Use unitless model drive 0.65, onset 1000 ms, duration 2000 ms, trial duration 5000 ms, eight replicates per arm, and seed 73142. Stop before running anything so I can inspect and approve the protocol.

Expected sequence:

```text
inspect_flylab_state
→ find_fly_circuits
→ draft_fly_hypothesis
→ design_stimulation_trial
→ human approval required
```

After a person approves the exact visible protocol, set the visible next-trial budget to five and call `inspect_flylab_state` again.

**Prompt 2 — approved execution through evidence**

> Run the exact approved experiment. Analyze backward distance, signed speed, response latency, heading change, and stance stability. Rank the conditions by backward distance using my visible next-trial budget, do not execute the proposed follow-up, and save the exact supporting evidence and comparison lineage.

Expected sequence:

```text
inspect_flylab_state
→ run_fly_simulation
→ analyze_fly_behavior
→ compare_fly_trials
→ save_fly_evidence
```

After saving, edit one protocol field and inspect again. The recording must show a new experiment ID, `waiting_for_human`, no callable next tool, and cleared batch, analysis, comparison, and bundle IDs.

## Pre-upload verification

- Confirm the delivery report says `ok: true` and the duration is below `180` seconds.
- Watch the complete MP4 with audio on; verify every frame and caption is readable.
- Confirm H.264 video, AAC audio, embedded English captions, and the separate `.srt`.
- Confirm the narration-input hashes match the reviewed recordings.
- Confirm the social and scientific wording boundaries above.
- Confirm the proof frames demonstrate real WebMCP inventory and invocation state.
- Confirm the BANC attribution and derivative notice appear in the video description or credits.
- Confirm there is no unauthorized music, system voice, trademark, or other protected media.
- Upload to YouTube as a public video and verify it while signed out.
- Replace `[YOUTUBE_DEMO_URL]` only after public playback, audio, captions, chapters, links, and visibility all pass.
- Keep the public application free and unrestricted through September 21, 2026 at 5:00 p.m. PT.

See [YouTube metadata](YOUTUBE_DESCRIPTION.md) for the publication template.
