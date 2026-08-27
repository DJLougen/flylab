# YouTube upload metadata draft

## Publication status

Do not upload or describe the video as complete until the current `0.3.0` GF-first frames are approved, a fresh source-bound supported native WebMCP run is recorded locally and on the submitted deployment, rights-cleared narration exists, the delivery report passes, and signed-out playback is verified. Historical v24 reports verify the earlier `0.2.0` release only. Replace every bracketed value only from current retained evidence.

**Title**

FlyLab — Agent-Native Rapid-Escape Neuroethology with WebMCP

**Video file**

`[FINAL_VIDEO_FILE]`

**Runtime**

`[DELIVERY_REPORT_DURATION]` — must be below `00:03:00`

**Thumbnail**

`[FINAL_1280_X_720_THUMBNAIL]`

**Captions**

`[FINAL_SRT_FILE]` plus the embedded English caption stream

**Category**

Science & Technology

**Visibility**

Public, only after signed-out verification

**Audience setting**

Not made for kids

**Suggested tags**

`FlyLab, WebMCP, Drosophila, fruit fly, neuroethology, Giant Fiber, DNp01, rapid escape, human in the loop, reproducible simulation, scientific provenance, AI agent`

**License note**

Choose the YouTube video-license setting deliberately. It is separate from the repository's Apache-2.0 license. Use only narration and media the entrant owns or is expressly permitted to publish.

## Description

```text
FlyLab is an agent-operable, human-auditable virtual fruit-fly lab created for the 2026 WebMCP Challenge. It exposes one read-only state inspector and seven native scientific workflow actions inside the same page a person reviews.

Try FlyLab: [VERIFIED_PUBLIC_APP_URL]
Source repository: [VERIFIED_PUBLIC_SOURCE_URL]
Challenge entry: [DEVPOST_ENTRY_URL]

Competition prompt:
“Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.”

The agent begins by inspecting the current page-session ID and revision. Every mutation must echo both, so a stale tab or human edit fails closed. It ranks source-backed circuits, persists the discovery alternatives and coverage gaps, drafts a falsifiable Giant Fiber/DNp01 short-mode escape hypothesis, and prepares a bilateral three-arm virtual protocol.

Execution stops at a visible operator approval control that is not a WebMCP tool. Approval commits an immutable protocol snapshot and complete seed manifest with SHA-256 hashes. The simulation caller must echo the exact approved protocol hash. Run and evidence-save operations use caller-generated operation IDs, so identical retries replay without another mutation and conflicting reuse is rejected.

Each seeded run exposes its own ID, seed, drive derivation, threshold/censoring disposition, event timeline, trajectory ID, trajectory seed, and full simulated state trajectory. The Three.js arena renders the exact selected run, including state, contact, leg/wing expression, and pose. The legacy condition-level `illustrative_condition_replay` is compatibility-only and excluded from analysis and the primary visual audit. FlyLab behavior-metrics v5 derives condition summaries from the authoritative per-run trajectories and publishes the formula, unit, sign, aggregation, null rule, analysis window, provenance, and boundary for every GF metric, plus per-run audit rows.

The explicit state model uses stance → preparation → reverse walk → recovery for MDN and stance → preparation → jump → wing deployment → airborne → recovery for GF. Threshold crossings that occur too late to express the required body sequence are labeled censored and remain grounded with zero body output. The legacy FNV-1a runHash covers run/trajectory identities only; SHA-256 runContentHash covers the protocol, model, and complete condition runs and is bound into analysis.

The final mission v3 evidence bundle preserves the goal, discovery decision, considered and rejected circuits, exclusions, coverage gaps, exact operator approval record, simulation, formal analysis, comparison, and proposal. The proposal is not authorized or executed. The export checksum detects payload changes; it is not a digital signature. Portable exports use application/vnd.flylab.evidence+json and are documented by the deployed schema at https://flylab-neuroethology.d-lougen.chatgpt.site/schemas/flylab-evidence-export-v3.schema.json.

The Giant Fiber leg/wing path is a literature schematic, not a BANC or FANC reconstruction. FlyLab uses mapped-motor model 0.3.0, state-coherent controller v2, stateful environment v3, and behavior-metrics v5. GF event order and approximate intervals are literature-constrained, but response probabilities, body amplitudes, controller gains, recovery timing, and all MDN dynamics remain hand-authored and unfitted. It is not FlyGym, connectome execution, neural dynamics, biomechanics, aerodynamics, or a wet-lab result. Purple indicates selected model targets, never measured neural activity.

Supported demonstration runtime: [CHATGPT_DESKTOP_SOL_OR_TERRA_OR_CHROME_149_PLUS]
Verified target, client version, and timestamp: [RUNTIME_EVIDENCE]

Chapters:
[CHAPTERS_FROM_FINAL_DELIVERY]

#WebMCP #Neuroscience #Drosophila #HumanInTheLoop
```

## Publication verification

- Match runtime and chapters to the passing delivery report.
- Confirm the video shows the exact eight-tool inventory and native invocation history.
- Confirm session/revision guards, approval hashes, operation replay, explicit state/censoring, exact selected-run replay, identity/content hash scopes, formal v5 metrics, per-run inspection, and mission v3 schema URL are legible.
- Confirm the runtime line identifies the actually recorded supported client, version, URL, and timestamp.
- Upload the `.srt` and verify technical terms in both embedded and platform captions.
- Confirm public playback with audio in a signed-out browser.
- Confirm the app, source, scientific, and challenge-entry links work.
- Confirm no unauthorized music, voice, trademark, or protected media is present.
- Replace `[YOUTUBE_DEMO_URL]` in submission materials only after every check passes.
