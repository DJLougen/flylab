# WebMCP Challenge submission

FlyLab is a public v24 release for the WebMCP Challenge. The source implements the v3 agent contract described below. Tracked Chrome 151 reports record the complete automated native-protocol workflow both locally and against the public no-login HTTPS deployment. A ChatGPT Sol/Terra agent run, the final video, and Devpost publication remain separate pending gates.

Submission deadline: **September 3, 2026 at 1:00 p.m. PDT**, as recorded in the challenge materials. Confirm the binding rules again before submission.

## Prepared submission copy

**Project name**

FlyLab

**Tagline**

Agent-operable, human-auditable neuroethology without blurring evidence, simulation, and hypothesis.

**One-sentence summary**

FlyLab gives agents eight native WebMCP tools that turn an adult fruit-fly rapid-escape question into a cited hypothesis, an immutable human-approved virtual protocol, per-run auditable analysis, a bounded follow-up, and a scoped v3 evidence bundle inside one shared page session.

**Submission description**

FlyLab is an agent-native virtual neuroethology lab built around a Giant Fiber/DNp01 rapid-escape vertical slice. The hero workflow traces literature-supported adult brain-to-middle-leg-and-wing pathways into a deterministic bilateral short-mode escape controller. A secondary MDN slice models six-leg reverse walking. Both are deliberately reduced-order and scientifically bounded.

Instead of making an agent infer a complex scientific interface from pixels, the page registers one read-only state inspector and seven workflow actions: discover circuits, draft a falsifiable hypothesis, design controls, run an approved simulation, analyze behavior, compare trials, and save evidence. The person and agent operate the same open-page state.

`flylab.agent-context.v3` gives the agent the current `page_session_id`, monotonic revision, artifact manifest, exact blocker, approval binding, and one next action. Every mutation must echo that page session and the latest inspected revision. A wrong session or stale revision publishes no mutation and directs the caller back to inspection.

Execution is locked behind a visible, non-tool human action. Approval creates a detached, deeply frozen record of the exact protocol and complete seed manifest, with separate SHA-256 commitments. The simulation caller must echo the current `approved_protocol_hash`; FlyLab recomputes both commitments against the live experiment before running. A protocol edit clears approval and all downstream work. This is visible authorization for a virtual experiment, not identity authentication or wet-lab approval.

Simulation and evidence saving additionally require caller-generated operation IDs. Retrying a completed logical operation with the same ID replays its committed result without another state mutation. Reusing the ID for different input fails closed.

Each simulation run exposes its exact seed, outputs, trajectory ID, trajectory seed, and full trajectory. The condition-level Three.js replay is a separately labeled illustration and is never used to compute cards. `flylab.behavior-metrics.v4` publishes each metric's formula, unit, sign convention, aggregation, null rule, window semantics, provenance, and interpretation boundary, plus per-run audit rows.

Evidence can be saved as `flylab.experiment-evidence-bundle.v3` for one exact lineage or `flylab.mission-evidence-bundle.v3` for that lineage plus the untrusted goal, discovery decision, considered and rejected alternatives, exclusions, and coverage gaps. The exact payload is returned in a schema-version-3 evidence-export envelope. Its checksum detects changes; it is not a signature or immutability guarantee.

FlyLab's mapped-motor model `0.2.0` is deterministic, hand-authored, and uncalibrated. It does not execute FlyGym, BANC/FANC/MANC, synapses, neural dynamics, muscles, aerodynamics, or a wet-lab experiment. The GF circuit view is literature-schematic and has no invented dataset neuron IDs. The separate MDN/LBL40 view contains six reconstruction-derived BANC v888 L2 skeletons. Purple marks model selection, never measured activity.

**Why WebMCP**

WebMCP keeps structured scientific actions in the page the person is already reviewing. The protocol, approval, revision, arena, results, and evidence ledger remain one shared instrument. The agent acts on exact domain contracts without brittle coordinate clicking, while visible person edits are immediately authoritative.

**Meaningful human-agent boundary**

- The agent handles evidence ranking, hypothesis structure, controlled design, seeded simulation, formal metric analysis, and lineage assembly.
- The person reviews and approves the exact virtual protocol; approval is not exposed as a tool.
- Editing invalidates approval and every dependent artifact.
- The agent may propose one budget-bounded follow-up but cannot execute it automatically.
- Mission export preserves rejected alternatives and coverage gaps, not only the selected result.

## Judging-criteria mapping

| Criterion | FlyLab evidence in the source contract |
|---|---|
| **WebMCP Leverage** | Eight page-native domain tools; v3 same-session/revision guards; structured recovery; operation replay; a deliberately non-tool human gate. |
| **Execution** | A coherent GF rapid-escape workflow, secondary MDN path, deterministic per-run trajectories, formal metrics, interactive Three.js views, and scoped evidence export. Runtime completion must still be proven on the submitted URL/client. |
| **Potential Impact** | Prevents agents from silently continuing on stale scientific state or upgrading measurements, connectome inference, model output, and hypotheses into one undifferentiated claim. |
| **Creativity & Ambition** | One shared browser instrument combines cited neuroethology, explicit brain-to-body mappings, immutable protocol approval, auditable simulation, and mission-level provenance. |

## Native WebMCP implementation

1. `inspect_flylab_state`
2. `find_fly_circuits`
3. `draft_fly_hypothesis`
4. `design_stimulation_trial`
5. `run_fly_simulation`
6. `analyze_fly_behavior`
7. `compare_fly_trials`
8. `save_fly_evidence`

All seven mutations require `page_session_id` and `expected_state_revision`. Run/save require `operation_id`; run also requires `approved_protocol_hash`. Successful calls use `flylab.tool-result.v3` and include prior/current revisions, created IDs, operation/replay status, exact next action, a visible verification target, and field-addressed provenance.

The native sequence is:

```text
inspect
→ discover
→ hypothesize
→ design
→ visible human approval
→ inspect
→ run
→ analyze
→ compare/propose only
→ save mission evidence
```

## Exact competition prompt

> Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.

After the person approves the exact visible protocol, use:

> Continue with the exact approved protocol. Analyze every available metric, compare the conditions, do not execute the proposed follow-up, and save the complete mission evidence bundle.

## Supported judging paths

- ChatGPT desktop with GPT-5.6 Sol or GPT-5.6 Terra, current app, Site Tools enabled, and an eligible account/workspace rollout.
- Chrome 149 or newer with WebMCP testing and DevTools WebMCP support enabled.

Neither product label proves the current task passed. Confirm the exact eight-tool inventory, retain the runtime diagnostic, and record a successful native workflow. Static manifests, DOM packets, and guided examples are read-only/helpful UI surfaces, not substitute transports.

Current protocol evidence: [`chrome-151-v24.json`](release-evidence/chrome-151-v24.json) records the clean local release and exact 15-frame capture; [`public-chrome-151-v24.json`](release-evidence/public-chrome-151-v24.json) repeats the full workflow against the deployed URL. Both record Chrome 151, eight registered and invoked tools, fresh-session reload, browser export parity, approval-hash rejection, operation replay/conflict behavior, edit invalidation, and global source closure. They are automated WebMCP client captures, not ChatGPT agent transcripts.

## Scientific scope

**Implemented**

- Adult GF/DNp01 short-mode rapid-escape evidence and bilateral leg/wing motor map
- Adult MDN reverse-walk evidence and bilateral/left/right motor map
- Mandatory baseline and model-sham controls
- Stable discovery decisions and causal-evidence compatibility gates
- Immutable approval snapshot and complete seed manifest
- Common-random-number paired deterministic trials and per-run trajectories
- Formal five-metric panels plus response-initiation summary
- Five-class field-addressed provenance
- Experiment and mission v3 evidence bundles
- Bounded, non-authorized follow-up proposal

**Not claimed**

- Whole-brain neural dynamics or connectome execution
- Actual FlyGym/NeuroMechFly execution
- Muscle mechanics, aerodynamics, or calibrated biological effect sizes
- New wet-lab evidence or autonomous biological experimentation
- A ChatGPT Sol/Terra agent run or an identified-human approval record

## Submission status

| Item | Honest current status |
|---|---|
| Source contract | Implemented; local tests/build/security gates must remain green on the final commit. |
| Candidate app URL | Public v24 deployment verified no-login over HTTPS with the required routes, headers, v3 artifacts, and native workflow. |
| Candidate source URL | Final release source is public with Apache-2.0 metadata and retained verification reports. |
| ChatGPT Sol/Terra run | Supported path; no success claim without retained current-session evidence. |
| Chrome 149+ run | Local and public-URL Chrome 151 native-protocol workflows passed; both reports are linked above. |
| Demo video | Pending final capture, rights-cleared narration, build, upload, and signed-out playback verification. |
| Devpost entry | Pending authenticated publication and link verification. |

## Final submission checklist

- [x] Run `npm test`, `npm run lint`, and `npm run build` on the release source commit.
- [x] Verify the submitted source URL is public and contains that release.
- [x] Verify the submitted app URL is public, no-login, HTTPS, and serves the required headers.
- [x] Complete and retain supported native WebMCP workflow reports with the exact eight-tool inventory locally and on the public URL.
- [ ] Demonstrate session/revision guards, approval-hash rejection, operation replay/conflict, and post-edit invalidation.
- [ ] Demonstrate formal GF metrics with per-run traceability and a mission v3 bundle.
- [ ] Record rights-cleared narration and build a passing under-three-minute demo.
- [ ] Verify public video playback, audio, captions, links, and visibility while signed out.
- [ ] Replace `[YOUTUBE_DEMO_URL]` and `[DEVPOST_ENTRY_URL]` only after verification.
- [ ] Complete entrant eligibility, ownership, licensing, and conflict attestations personally.

## Submission links

- Candidate application: <https://flylab-neuroethology.d-lougen.chatgpt.site/>
- Candidate source: <https://github.com/DJLougen/flylab>
- Demo video: `[YOUTUBE_DEMO_URL]` — pending verification
- Challenge entry: `[DEVPOST_ENTRY_URL]` — pending verification

See [Judge testing](JUDGE_TESTING.md), [WebMCP verification](WEBMCP_VERIFICATION.md), [demo plan](DEMO.md), and [scientific boundaries](SCIENTIFIC_BOUNDARIES.md).
