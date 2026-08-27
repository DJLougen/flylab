# WebMCP verification

FlyLab defines eight native site tools through `document.modelContext.registerTool(...)`: one read-only inspector plus seven scientific workflow mutations. This document distinguishes source-level checks, page registration, browser-mediated invocation, and a completed supported-runtime workflow. They are different evidence levels.

The repository retains a [local Chrome 151 report](release-evidence/chrome-151-v24.json) from the automated, flag-enabled native WebMCP protocol verifier and a separate [public-deployment report](release-evidence/public-chrome-151-v24.json). Together they record clean source binding, the exact browser version, eight registered and invoked tools, a fresh-session reload, the completed GF workflow, browser export parity, negative guards, and the evidence audit locally and on the public URL. They are not ChatGPT agent transcripts; a ChatGPT Sol/Terra claim requires separate retained evidence.

## Evidence levels

| Level | What it can establish | What it cannot establish |
|---|---|---|
| Source tests | Contract definitions, validation, deterministic state/model behavior, and diagnostic logic. | Browser support, deployment reachability, or client rollout. |
| Page registration | The current page accepted all eight `registerTool` calls. | That a compatible client can discover or invoke them. |
| Observed callback | A browser-mediated WebMCP tool callback occurred in this page session. | That the caller was a ChatGPT agent. |
| Completed supported-runtime workflow | The recorded target/runtime exercised the specified calls and assertions. | Other accounts, workspaces, deployments, or future builds. |

## Automated source checks

Run:

```bash
npm test
npm run lint
npm run build
```

The source suite covers, among other contracts:

- exactly eight closed tool schemas and synchronized output contracts;
- `flylab.tool-result.v3` and `flylab.agent-context.v3`;
- required `page_session_id` and `expected_state_revision` on every mutation;
- non-mutating `STALE_STATE` failures for wrong session/revision;
- exact protocol/seed-manifest approval hashing and current-experiment verification;
- `operation_id` replay for simulation/save and conflicting-input rejection;
- prepare/check/commit cancellation and stale-commit boundaries;
- ranked discovery decisions, candidate records, rejected alternatives, evidence filters, and coverage gaps;
- GF causal-evidence/laterality gates and the MDN secondary motor map;
- complete per-run trajectories, separate illustrative replays, and common-random-number seed policy;
- `flylab.behavior-metrics.v4` definitions and per-run analysis traceability;
- experiment/mission v3 bundle formats and evidence-export schema version 3;
- field-addressed provenance, source closure, and model/scientific interpretation boundaries;
- exact capability diagnostics when the API is absent, incomplete, or registration fails.

A passing source suite proves those local assertions. It does not prove a particular browser/account rollout or deployment.

## Native browser verifier

Use Chrome 149 or newer. Start FlyLab locally, then run the verifier against the exact printed URL:

```bash
FLYLAB_URL=http://localhost:3000/ npm run verify:webmcp
```

Use the actual port if it differs. The script creates an isolated temporary Chrome profile, enables WebMCP testing for that process, loads the supplied URL, and uses Chrome's WebMCP debugging protocol. On a successful basic exit it has asserted:

- the page exposes `document.modelContext.registerTool`;
- the page is not opted out of origin-keyed clustering;
- all eight exact tool names are registered;
- inline runtime/handoff packets report registration accurately;
- client availability remains `unknown_to_page` before a callback;
- `inspect_flylab_state` returns v3 session/revision data;
- a native discovery invocation is observed in this page session.

Run the full workflow with:

```bash
FLYLAB_URL=http://localhost:3000/ \
FLYLAB_VERIFY_WORKFLOW=1 \
npm run verify:webmcp
```

On successful exit, the full verifier is designed to assert all eight contracts, the visible non-tool approval boundary, cancellation behavior, post-edit invalidation, and both motor-map lifecycles. Its v3 checks include:

- wrong-session and wrong-revision failures that leave state unchanged;
- the inspector's persisted discovery-decision and approval references;
- an `APPROVAL_REQUIRED` preapproval failure;
- a visible approval click followed by valid SHA-256 protocol/seed-manifest commitments;
- rejection of a wrong `approved_protocol_hash`;
- exact approved protocol snapshots and complete seed manifests in simulation output;
- formal metric-definition fields and per-run result/trajectory audit parity;
- a complete mission-scope v3 export, including discovery alternatives and coverage gaps;
- mutation-free completed run/save replays under identical operation IDs;
- `operation_id_input_mismatch` on conflicting reuse;
- cancellation before commit publishing no batch/bundle;
- a visible protocol edit clearing approval and every downstream artifact.

The current verifier also covers the MDN reverse-walking slice and a separate GF short-mode lifecycle. The judge-facing competition prompt is GF-first; MDN remains a secondary implemented capability rather than the hero story.

Set `FLYLAB_CAPTURE_DIR` only when captures are required. A screenshot directory or command invocation is not itself proof of a pass; retain the exit report, Chrome version, target URL, timestamp, and relevant captures together.

## v3 result and mutation contract

Every success uses `flylab.tool-result.v3` and includes:

```text
page_session_id
previous_state_revision
state_revision
created_artifact_ids
operation_id
idempotent_replay
next_action
verification
provenance_manifest
data
```

Every failure includes the current page session/revision when available plus a semantic recovery action. Stale session/revision and uncertain lineage failures direct the caller to `inspect_flylab_state`; validation, discovery, approval, and operation-ID conflicts instead identify the exact field, visible gate, new operation ID, or tool call needed next.

All seven mutations require the inspected `page_session_id` and `expected_state_revision`. The two expensive commit operations have an additional contract:

- `run_fly_simulation`: exact `approved_protocol_hash` plus `operation_id`;
- `save_fly_evidence`: explicit `experiment | mission` scope plus `operation_id`.

An identical completed operation retry may use the newer inspected revision because the expected revision is excluded from logical operation identity. It must return `idempotent_replay: true`, no created artifacts, and no state advance. The same operation ID with different logical input fails closed.

## Approval verification

Visible approval creates a detached, deeply frozen `flylab.experiment-approval` record. Its SHA-256 `protocol_hash` binds the complete experiment protocol, model version, seed policy, and metric method. Its separate `seed_manifest_hash` binds every condition, illustrative trajectory seed, replicate seed, and per-run trajectory seed. The timestamp is metadata outside both hashes.

The run caller must echo the protocol hash. Before simulation, FlyLab recomputes and compares both stored commitments with the current experiment. Any protocol, model, method, or seed change invalidates authorization. Approval is deliberately absent from WebMCP and requires the visible page control; it is not an identity-authentication claim against general browser automation.

## Metric and bundle verification

`analyze_fly_behavior` must return `flylab.behavior-metrics.v4`. For each metric, verify formula, unit, sign convention, aggregation, null rule, full-trial window semantics, method version, provenance, and boundary. Verify the separate response-initiation summary definition and the `per_run_results` mapping. The run response contains full per-run trajectories; the analysis response carries their IDs, seeds, roles, status, and point counts. The illustrative condition replay must never be treated as a raw run trace.

`save_fly_evidence` must return the exact portable `flylab.evidence-export` schema-version-`3` envelope:

- `scope: experiment` → `flylab.experiment-evidence-bundle.v3`;
- `scope: mission` → `flylab.mission-evidence-bundle.v3`, including goal, discovery decision, considered/rejected alternatives, exclusions, and coverage gaps.

The payload checksum detects change. It is not a digital signature, proof of authorship, or guarantee of immutability. Browser-local storage is best-effort convenience only.

## Honest capability diagnostics

The page exposes `flylab.webmcp-capability-diagnostic.v1` with:

- document ready state and secure-context status;
- origin-agent-cluster and tools permissions-policy observations when available;
- `document.modelContext` presence and `registerTool` type;
- whether registration was attempted;
- registrations accepted before rollback;
- failed tool name;
- sanitized exception name/message;
- an explicit availability reason.

The runtime packet separately records page registration and whether a callback was observed in this page session. Interpret it literally:

- no `document.modelContext` or no callable `registerTool` means no WebMCP invocation;
- a registration failure rolls back accepted registrations;
- eight accepted registrations still leave client availability unknown until a callback;
- a callback does not identify its caller as ChatGPT.

When WebMCP is unavailable, `/agent`, `/flylab-agent-manifest.json`, `/flylab-tool-contracts.json`, and inline `#flylab-agent-context`, `#flylab-agent-runtime`, and `#flylab-agent-handoff` remain read-only diagnostic/recovery surfaces. They do not emulate WebMCP, mutate laboratory state, or make a tool callable.

## Supported client inspection

For agent-driven judging, use ChatGPT desktop's built-in browser with GPT-5.6 Sol or GPT-5.6 Terra, the current app, Site Tools enabled, and an eligible account/workspace rollout. The external Chrome extension is a browser-control surface and does not provide the ChatGPT Site Tools bridge. For direct protocol inspection, use Chrome 149+ as described above. In both cases, first confirm the exact eight-tool inventory and call `inspect_flylab_state`.

The supported label is a prerequisite, not a verification result. If a compatible-looking session lacks Site Tools or `document.modelContext`, record the diagnostic rather than claiming registration or silently switching to a non-WebMCP transport.

## Cancellation compatibility

Registration lifetime and invocation lifetime are separate. The registration signal owns all eight registrations. Simulation and evidence-save preparation combine the invocation signal with a page-owned controller, check cancellation and the captured revision immediately before one synchronous commit, and publish nothing when cancellation or staleness is observed before that boundary.

The code accepts the draft callback `AbortSignal` and Chrome's `toolcancel` compatibility event (plus the evolving `toolcanceled` spelling). This compatibility handling feeds the same tested commit boundary; it is not a substitute transport.

## Deployment checks before making a public claim

For any candidate deployment, verify and retain evidence that:

- the target is reachable over HTTPS without private-site authentication;
- `Permissions-Policy: tools=(self)` and `Referrer-Policy: strict-origin-when-cross-origin` are present;
- `Origin-Agent-Cluster: ?0` is absent;
- the exact release being described is deployed;
- the native eight-tool inventory and required workflow pass on a supported runtime.

For v24, those checks are retained in `public-chrome-151-v24.json`. Repeat them after any deployment that changes executable source before describing the newer build as verified.
