# YouTube upload metadata

## Publication status

This is upload-ready copy for the local v6 demo package. The YouTube video, Devpost entry, and owner-approved repository license are not yet complete. Keep bracketed placeholders until their public destinations have been opened and verified.

## Recommended upload fields

**Title**

FlyLab — Human-in-the-Loop Neuroethology with WebMCP

**Video file**

`outputs/demo/v6/FlyLab-WebMCP-Demo.mp4`

**Runtime**

2:15.821

**Thumbnail**

`outputs/demo/v6/FlyLab-Devpost-Thumbnail.png` (1200 × 800; preview YouTube's 16:9 crop before publishing)

**Caption file**

`outputs/demo/v6/FlyLab-WebMCP-Demo.srt`

**Language**

English

**Category**

Science & Technology

**Visibility**

Public, after the upload has passed the private/unlisted verification checks below

**Audience setting**

Not made for kids

**Suggested tags**

`FlyLab, WebMCP, Drosophila, fruit fly, neuroethology, neuroscience, human in the loop, BANC connectome, Moonwalker descending neurons, MDN, Three.js, reproducible simulation, scientific provenance, AI agent`

**License note**

Choose the YouTube video-license setting deliberately during upload. That setting is separate from repository licensing. Do not describe the repository as open source until an owner-approved root `LICENSE` file exists.

## Description

```text
FlyLab is a source-aware virtual fruit-fly lab where a person and an agent design a controlled MDN backward-walking experiment together using seven browser-native WebMCP tools.

Try FlyLab: https://flylab-neuroethology.d-lougen.chatgpt.site
Source repository: https://github.com/DJLougen/flylab
Challenge entry: [DEVPOST_ENTRY_URL] (pending publication)

In this 2:16 demo, the agent finds cited adult Moonwalker descending-neuron evidence, drafts a falsifiable hypothesis, prepares five controlled conditions, stops for human approval, runs a seeded reduced-order simulation, analyzes preregistered behavior metrics, proposes one non-authorized follow-up, and saves a manifest-hashed evidence bundle.

The Three.js circuit view displays six real BANC v888 L2 skeleton reconstructions—four MDNs and two LBL40 cells. Purple shows the selected unitless model-drive targets; cyan shows bundled connectome-inferred structural paths. Glow is model selection, not measured neural activity. The CNS shell is schematic.

FlyLab's trajectories are deterministic simulation predictions, not FlyGym execution, whole-brain dynamics, direct BANC simulation, or wet-lab results. Metrics calculated from those trajectories remain labeled both derived and simulation-predicted. Findings summarized from cited biological studies retain a separate measured-evidence label.

Chapters:
00:00 Evidence boundaries in one shared lab
00:10 Cited adult MDN circuit evidence
00:29 Hypothesis, controls, and human approval
00:47 Seeded reduced-order simulation replay
00:57 Real BANC reconstructions in Three.js
01:29 Derived behavior analysis and bounded follow-up
01:51 Manifest-hashed evidence bundle
02:04 Evidence ledger and human control

#WebMCP #Neuroscience #Drosophila #HumanInTheLoop
```

The grouped chapter markers above keep every chapter at least ten seconds long. The millisecond-level start and end times for all 12 frames are in [DEMO.md](DEMO.md).

## Upload verification

- Use `2:15.821` in any precise duration field; `2:16` is the reader-friendly description value.
- Upload the separate English `.srt` even though the MP4 also contains an embedded caption stream.
- Check that automatic caption processing has not replaced scientific terms such as BANC, MDN, LBL40, FlyGym, or WebMCP.
- Preview the 1200 × 800 thumbnail in YouTube's 16:9 crop, confirm its text and circuit remain legible at small size, and confirm it does not imply measured neural activity.
- Make the YouTube video public before adding its URL to the challenge entry.
- Open the published video in a signed-out browser and verify playback, audio, captions, chapters, description links, and visibility.
- Replace `[YOUTUBE_DEMO_URL]` in the submission docs only after that verification.
- Replace `[DEVPOST_ENTRY_URL]` only after the challenge entry is published and publicly accessible.
