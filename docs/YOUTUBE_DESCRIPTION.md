# YouTube upload metadata draft

## Publication status

Do not upload until the agent-first UI is explicitly approved, the two real-WebMCP proof composites exist, the rights-cleared narration is recorded, and `scripts/build-demo-video.mjs` produces a passing delivery report. Fill every bracketed value from that report or the verified public URLs.

**Title**

FlyLab — Agent-Native Neuroethology with WebMCP

**Video file**

`outputs/demo/v7/FlyLab-WebMCP-Demo.mp4`

**Runtime**

`[DELIVERY_REPORT_DURATION]` — must be below `00:03:00`

**Thumbnail**

`outputs/demo/v7/FlyLab-Devpost-Thumbnail.png` — native 1280 × 720

**Captions**

`outputs/demo/v7/FlyLab-WebMCP-Demo.srt` plus the embedded English caption stream

**Category**

Science & Technology

**Visibility**

Public

**Audience setting**

Not made for kids

**Suggested tags**

`FlyLab, WebMCP, Drosophila, fruit fly, neuroethology, neuroscience, human in the loop, BANC connectome, Moonwalker descending neurons, MDN, Three.js, reproducible simulation, scientific provenance, AI agent`

**License note**

Choose the YouTube video-license setting deliberately. It is separate from the repository's Apache-2.0 license. Use only narration and media the entrant owns or is expressly permitted to publish.

## Description

```text
FlyLab is an agent-operable, human-auditable virtual fruit-fly lab created during the 2026 WebMCP Challenge for computational-neuroethology researchers, neuroscience educators, and agent-tool builders. It exposes one read-only WebMCP state inspector and seven browser-native scientific workflow actions.

Try FlyLab: https://flylab-neuroethology.d-lougen.chatgpt.site
Source repository: https://github.com/DJLougen/flylab
Challenge entry: [DEVPOST_ENTRY_URL]

The agent inspects the shared page revision, artifact IDs, blocker, and exact next action; finds cited adult Moonwalker descending-neuron evidence; drafts a falsifiable hypothesis; and prepares five controlled conditions. It must stop at a visible supervisor approval control that is absent from the WebMCP tool surface. After approval and re-inspection, it runs a seeded reduced-order simulation, analyzes the complete predefined behavior panel, proposes—but cannot execute—one bounded follow-up, and saves a manifest-hashed exact-lineage evidence bundle. A later protocol edit clears approval and downstream results, proving that visible human changes remain authoritative.

The Three.js circuit view displays six reconstruction-derived cells from the BANC v888 static dataset, Harvard Dataverse version 3.0 (https://doi.org/10.7910/DVN/7WTH1N), licensed CC BY 4.0: four MDNs and two LBL40 cells. FlyLab's six simplified L2 SWC derivatives use one shared coordinate transform and topology-preserving simplification; see THIRD_PARTY_NOTICES.md in the repository. Purple shows selected unitless model targets. Cyan shows four directed, connectome-inferred v3 rows totaling 153 predicted synaptic links after the released postsynapse-size ≥10-voxel filter. The counts are not physiology, and glow is model selection rather than measured neural activity. The CNS shell is schematic.

FlyLab's condition replay is a deterministic illustrative simulation prediction, not a raw replicate path, FlyGym execution, whole-brain dynamics, direct BANC simulation, or a wet-lab result. Metric cards aggregate separate simulation-generated per-run summaries and remain labeled derived plus simulation-predicted. Findings summarized from cited biological studies retain a separate measured-evidence label.

Chapters:
[CHAPTERS_FROM_FINAL_DELIVERY]

#WebMCP #Neuroscience #Drosophila #HumanInTheLoop
```

## Publication verification

- Match the runtime and chapter starts to the final delivery report; do not estimate them from the draft cue sheet.
- Upload the generated `.srt` and verify the embedded and platform captions both preserve MDN, LBL40, BANC, FlyGym, and WebMCP.
- Confirm public playback with audio in a signed-out browser.
- Confirm the app, source, DOI, and challenge-entry links work.
- Confirm the description includes the BANC CC BY 4.0 attribution and derivative changes.
- Confirm the video contains no unauthorized music, system voice, trademark, or protected media.
- Replace `[YOUTUBE_DEMO_URL]` in the submission record only after every check passes.
