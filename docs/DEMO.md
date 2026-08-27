# FlyLab WebMCP challenge demo plan

## Status and release gate

The final v24 competition video has not been generated, uploaded, or verified. A tracked [local Chrome 151 native-protocol report](release-evidence/chrome-151-v24.json) and the complete 15-frame capture bind the release to clean source; a separate [public-deployment report](release-evidence/public-chrome-151-v24.json) repeats the full native workflow against the live URL. These are automated protocol evidence, not a ChatGPT agent transcript. Rights-cleared narration, the final video build, upload, and signed-out playback check remain pending.

The video builder requires explicit interface approval, all planned frames, rights-cleared narration, and a duration below three minutes. Its preflight checks file presence and media requirements; a human must also confirm that every frame actually shows the v3 GF-first story below. Complete [NARRATION_RIGHTS_ATTESTATION.md](NARRATION_RIGHTS_ATTESTATION.md) before enabling the narration-rights gate.

## Story in one sentence

FlyLab lets an agent use eight native WebMCP tools to turn a source-backed adult fruit-fly rapid-escape question into a falsifiable GF hypothesis, an immutable human-approved virtual protocol, per-run auditable metrics, and a complete mission evidence bundle—without hiding stale page state or executing its own follow-up. The retained release capture is explicitly an automated WebMCP client verification, not a transcript proving that a ChatGPT agent or identified supervisor performed those actions.

## Required visual sequence

| Scene | Required proof |
|---|---|
| Native inventory | Exactly eight registered tool names; no approval tool. |
| Fresh inspection | `flylab.agent-context.v3`, page-session ID, revision, empty lineage, and one next action. |
| Rapid-escape discovery | GF ranked first; discovery decision, alternatives, evidence types, and coverage gaps visible. |
| Falsifiable hypothesis | Primary outcome, expected direction, both controls, causal evidence, limitations, and `agent_hypothesized`. |
| Bilateral protocol | Three GF arms, exact timing/seed policy, and `waiting_for_human`. |
| Human approval | Visible non-tool control plus protocol and seed-manifest SHA-256 commitments. |
| Guard proof | Wrong approval hash rejected without changing state. |
| Seeded run | `operation_id`, exact approval, complete per-run IDs/seeds/trajectories, and separate illustrative replay. |
| GF embodiment | T2-leg and wing output with explicit literature-schematic circuit boundary. |
| Formal analysis | All five GF metrics, method v4 definitions, null rule, and per-run inspection. |
| Bounded comparison | Ranked conditions and `execution_authorized: false`. |
| Mission save | Mission v3 format, discovery alternatives, bundle ID, and manifest hash. |
| Idempotent retry | Same operation ID returns replay, zero new artifacts, unchanged revision. |
| Visible edit recovery | New experiment/revision and cleared approval/downstream lineage. |
| Runtime evidence | Supported client/version, target URL, timestamp, diagnostic, native invocation history, and final status. |

The inventory and invocation proof must come from a supported WebMCP surface: ChatGPT desktop's built-in browser with GPT-5.6 Sol/Terra, or Chrome 149+ for direct protocol inspection. The external Chrome extension supplies browser control, not the ChatGPT Site Tools bridge. Static manifests, inline JSON, a guided-example button, or ordinary DOM automation do not count as native tool proof.

The automated Chrome capture invokes the registered WebMCP protocol directly and activates the visible approval control only to verify the boundary. Narration and proof panels must call it an automated WebMCP client/harness. In the judged interaction, the person must review and click that control; the app never exposes approval as a tool.

## Exact competition prompt

Show this prompt verbatim:

> Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.

The first phase must stop here:

```text
inspect_flylab_state
→ find_fly_circuits
→ draft_fly_hypothesis
→ design_stimulation_trial
→ visible human approval required
```

After the person approves the exact visible protocol, show a fresh inspection and continue with:

> Continue with the exact approved protocol. Analyze every available metric, compare the conditions, do not execute the proposed follow-up, and save the complete mission evidence bundle.

```text
inspect_flylab_state
→ run_fly_simulation
→ analyze_fly_behavior
→ compare_fly_trials
→ save_fly_evidence
```

## v3 facts the narration must state accurately

- Every mutation echoes the current `page_session_id` and `expected_state_revision`.
- Simulation also requires the exact human-approved protocol hash and a stable operation ID.
- Approval commits a detached, deeply frozen protocol snapshot and full seed manifest; its timestamp is outside the hashes.
- Run/save retries with the same operation ID and logical input replay without mutation; conflicting reuse fails.
- Every seeded run has its own trajectory. The displayed condition replay is separate and illustrative.
- `flylab.behavior-metrics.v4` publishes formal metric definitions and per-run traceability.
- Mission scope preserves the goal, discovery decision, considered/rejected alternatives, exclusions, coverage gaps, and selected lineage.
- The evidence-export checksum detects payload changes; it is not a signature or immutability guarantee.
- The follow-up is proposed but never authorized or executed.

## Scientific wording boundaries

- Call the GF path a **literature-schematic Giant Fiber/DNp01 to middle-leg and wing motor map**. Do not call it a BANC/FANC reconstruction.
- GF short-mode escape probability is not total takeoff probability; the parallel long-mode pathway is outside the model.
- Purple is unitless model-target selection, not measured activity, voltage, calcium, firing, or signal propagation.
- The procedural fly and GF circuit lines are schematic.
- Trajectories are deterministic reduced-order simulation predictions, not FlyGym, connectome execution, biomechanics, aerodynamics, or wet-lab measurements.
- Metric values are uncalibrated model outputs, not animal effect sizes or confidence intervals.
- `measured` applies only to findings summarized from cited studies.
- MDN/BANC is a secondary implemented slice, not the rapid-escape hero story. If shown, describe the four directed v3 rows and 153 predicted synaptic links as structural data only.

## Capture and build

For a local native Chrome capture, use the actual development URL:

```bash
FLYLAB_URL=http://localhost:3000/ \
FLYLAB_VERIFY_WORKFLOW=1 \
FLYLAB_DEMO_CAPTURE=1 \
FLYLAB_CAPTURE_DIR=outputs/demo/v24/frames \
FLYLAB_REPORT_FILE=outputs/demo/v24/webmcp-capture-report.json \
npm run verify:webmcp
```

Use the actual port if different. A successful command report must be retained with the browser version, URL, timestamp, and captures. Demo-capture mode must follow the GF rapid-escape path represented by the v24 narration plan; review the semantic contents of every frame rather than trusting its filename.

Print the narration plan without producing media:

```bash
npm run demo:narration-plan
```

Check release gates:

```bash
FLYLAB_UI_APPROVED=1 \
FLYLAB_NARRATION_RIGHTS_CONFIRMED=1 \
npm run demo:preflight
```

Build only after reviewing every frame and confirming the rights of every narration clip:

```bash
FLYLAB_NARRATION_DIR=outputs/demo/v24/narration \
FLYLAB_UI_APPROVED=1 \
FLYLAB_NARRATION_RIGHTS_CONFIRMED=1 \
npm run demo:video
```

Use the entrant's own recording or a service whose terms permit publication. Do not add music or protected media without permission. Keep rights records with the submission materials.

## Pre-upload verification

- [ ] The delivery report says `ok: true` and duration is below 180 seconds.
- [ ] Every shot matches the GF-first v3 sequence above.
- [ ] The native inventory and invocation proof come from a supported runtime.
- [ ] The runtime evidence includes target URL, client/version, timestamp, and final status.
- [ ] Approval hashes, operation replay, formal metrics, per-run traceability, and mission v3 export are legible.
- [ ] Scientific boundaries and BANC attribution are accurate.
- [ ] H.264 video, AAC audio, embedded English captions, separate `.srt`, and narration rights all pass review.
- [ ] Public playback, audio, captions, links, and visibility are verified while signed out.
- [ ] `[YOUTUBE_DEMO_URL]` is replaced only after those checks pass.

See [YouTube metadata](YOUTUBE_DESCRIPTION.md) and [WebMCP verification](WEBMCP_VERIFICATION.md).
