# Judge testing instructions

FlyLab exposes exactly eight native WebMCP tools on one shared page. The competition workflow leads with the adult Giant Fiber/DNp01 rapid-escape slice and pauses once for a visible human approval that is intentionally absent from the tool surface.

Repository contents and automated tests establish the source contract. They do not establish that the candidate deployment is currently public/reachable or that a supported ChatGPT or Chrome runtime has completed this build. Verify the chosen URL and retain the current run report before making either claim.

## Start the release candidate

For a local evaluation:

```bash
npm ci
npm run dev
```

Open the URL printed by the development server. The configured submission targets are:

- candidate application: <https://flylab-neuroethology.d-lougen.chatgpt.site/>
- candidate source repository: <https://github.com/DJLougen/flylab>

Treat those as links to verify, not proof of publication or availability.

## Supported execution surfaces

Use either:

1. **ChatGPT desktop:** GPT-5.6 Sol or GPT-5.6 Terra, current app, **Settings → Browser → Permissions → Enable site tools** enabled, and an eligible account/workspace rollout. Open FlyLab in the built-in browser, then inspect **Site tools → Available site tools**.
2. **Chrome:** Chrome 149 or newer with `chrome://flags/#enable-webmcp-testing` and `chrome://flags/#devtools-webmcp-support` enabled. Relaunch, open **DevTools → Application → WebMCP**, and follow the [native Chrome protocol sequence](CHROME_MANUAL_TEST.md).

These are the supported paths; Chrome is not described as a fallback for ChatGPT. Availability can still depend on the actual client build, permissions, workspace, and rollout. Do not install a remote MCP server, inject a polyfill, or treat static JSON/DOM recovery data as a successful WebMCP invocation.

## Native tool inventory

Confirm these eight names:

1. `inspect_flylab_state`
2. `find_fly_circuits`
3. `draft_fly_hypothesis`
4. `design_stimulation_trial`
5. `run_fly_simulation`
6. `analyze_fly_behavior`
7. `compare_fly_trials`
8. `save_fly_evidence`

`inspect_flylab_state` is the sole read-only tool. Human approval is not a ninth tool.

## Expected v3 contracts

- Every successful call uses `flylab.tool-result.v3` and returns `page_session_id`, `previous_state_revision`, `state_revision`, `created_artifact_ids`, `operation_id`, `idempotent_replay`, `next_action`, `verification`, and field-addressed `flylab.provenance-manifest.v1` data.
- `inspect_flylab_state` returns `flylab.agent-context.v3`, fixed nullable artifact fields, the approval binding, current blocker, and exactly one next action.
- Every state-changing tool requires the inspected `page_session_id` and `expected_state_revision`. A mismatch returns non-retryable `STALE_STATE` and points back to the inspector.
- `run_fly_simulation` additionally requires the exact `approved_protocol_hash` and a caller-generated `operation_id`.
- `save_fly_evidence` requires `scope: experiment | mission` and a caller-generated `operation_id`.
- Completed run/save retries with the same operation ID and logical input return `idempotent_replay: true`, create no artifacts, and do not advance revision. Conflicting reuse fails with `operation_id_input_mismatch`.
- `analyze_fly_behavior` uses `flylab.behavior-metrics.v4` and returns formal metric definitions, the response-initiation summary definition, and per-run audit rows.
- `save_fly_evidence` returns the exact `flylab.evidence-export` schema-version-`3` envelope. Its payload format is `flylab.experiment-evidence-bundle.v3` or `flylab.mission-evidence-bundle.v3` according to scope.

The top-level provenance list is only the union summary. The JSON-Pointer manifest is authoritative for individual scientific fields. Operational paths and caller-authored goals, titles, and notes do not inherit scientific provenance.

## Exact competition prompt

In a supported ChatGPT desktop session, ask the agent to call `inspect_flylab_state`, then use exactly:

> Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.

The expected first phase is native tool invocation, not guided UI clicks:

```text
inspect_flylab_state
→ find_fly_circuits
→ draft_fly_hypothesis
→ design_stimulation_trial
→ waiting_for_human
```

Expected evidence and design behavior:

- Discovery ranks `circuit_gf_adult` for rapid/short-mode leg-and-wing escape and persists a stable discovery decision with candidates, alternatives, exclusions, and coverage gaps.
- The GF path is labeled as a literature schematic, not a BANC/FANC reconstruction.
- The hypothesis declares `short_mode_escape_probability` as its primary outcome, expected direction, baseline/model-sham controls, compatible perturbation-effect evidence, explicit limitations, and falsification criterion.
- The GF protocol is bilateral-only and contains baseline, model-sham, and bilateral perturbation arms. It does not invent unilateral GF routing.
- The inspector reports `waiting_for_human`, `blocked_by: human_approval`, and no callable next tool.
- A preapproval run returns `APPROVAL_REQUIRED` and creates no batch.

## Person-owned approval checkpoint

Review the visible protocol and click **Approve this exact experiment**. Then have the agent inspect again.

Confirm the inspector exposes:

- the same experiment ID as `approval_experiment_id`;
- `approval_binding_complete: true`;
- a lowercase 64-hex SHA-256 `approved_protocol_hash`;
- `approved_seed_manifest_hash` and an approval timestamp;
- `run_fly_simulation` as the next action with the protocol hash in `input_refs`.

The approval record is a detached, deeply frozen snapshot of the exact protocol, model, metric method, seed policy, and complete per-condition/per-replicate seed manifest. The timestamp is outside both hashes. The run must echo the protocol hash and verify both commitments against the current experiment. Approval is visible authorization for this virtual experiment; it is not identity authentication or wet-lab approval.

## Continue through evidence

After approval, tell the agent:

> Continue with the exact approved protocol. Analyze every available metric, compare the conditions, do not execute the proposed follow-up, and save the complete mission evidence bundle.

Expected sequence:

```text
inspect_flylab_state
→ run_fly_simulation
→ analyze_fly_behavior
→ compare_fly_trials
→ save_fly_evidence
```

Expected output:

- The simulation response carries the exact approval record, complete protocol snapshot, seed policy, run seeds, per-run trajectory seeds/IDs/full trajectories, and separate illustrative condition replays.
- Each run and trajectory is complete. The illustrative condition replay is explicitly excluded from analysis.
- The GF analysis contains short-mode escape probability, response latency, vertical displacement, wing recruitment, and leg recruitment.
- Every metric definition states formula, unit, sign convention, aggregation, null rule, full-trial window semantics, method version, provenance, and interpretation boundary.
- `per_run_results` maps each aggregate back to exact runs and trajectory audit fields. No-response latency is JSON `null`, never trial duration.
- The comparison ranks conditions but returns `execution_authorized: false` for its proposal.
- A `scope: mission` save returns `flylab.mission-evidence-bundle.v3` with the discovery decision, candidate alternatives, exclusions, coverage gaps, exact selected lineage, approval, formal analysis, and proposal.
- The evidence-export hash is described as a payload-change checksum, not a signature or immutability guarantee.
- A final inspection reports `agent_status: complete`, `state.stage: saved`, `next_tool: null`, and `next_action.kind: complete`.

## Guard and recovery checks

Perform these negative checks when time permits:

1. Send a mutation with a wrong `page_session_id`: expect `STALE_STATE` and no mutation.
2. Send a mutation with an outdated `expected_state_revision`: expect `STALE_STATE` and re-inspect recovery.
3. Send the current run with a wrong `approved_protocol_hash`: expect `EVIDENCE_MISMATCH` and unchanged state.
4. Retry a completed run/save with the same operation ID and logical input: expect a mutation-free idempotent replay.
5. Reuse either operation ID with changed logical input: expect `INVALID_INPUT`, `operation_id_input_mismatch`, and unchanged state.
6. Edit one visible protocol field after saving: expect a new experiment/revision, cleared approval hashes and downstream artifacts, and `waiting_for_human`.

These checks distinguish an exact same-page contract from best-effort retry behavior.

## Runtime diagnostic interpretation

The visible diagnostic records secure context, origin-agent-cluster state, permissions policy, whether `document.modelContext` exists, whether `registerTool` is callable, whether registration was attempted, how many tools were accepted before rollback, the failed tool, and sanitized exception details.

Interpret status narrowly:

- `api_unavailable` or `document_model_context_absent`: no page tool invocation is available.
- `registration_failed`: accepted registrations were rolled back; tool inventory is not usable.
- `registered` with `webmcp_client_availability: unknown_to_page`: the page registered tools, but no callback has proved client invocation in this page session.
- `invocation_observed_this_page_session`: at least one browser-mediated callback occurred; this does not identify the caller as a ChatGPT agent.

The `/agent` page, static manifest/contracts, and inline recovery packet remain useful for diagnosis but are read-only. They never count as WebMCP registration or invocation.

## Local verification commands

```bash
npm test
npm run lint
npm run build
FLYLAB_URL=http://localhost:3000/ FLYLAB_VERIFY_WORKFLOW=1 npm run verify:webmcp
```

Use the actual local URL if the development server selected another port. A command listed here is not a pass claim. Retain its successful report, browser version, target URL, timestamp, and relevant captures before citing it as supported-runtime evidence.

See [WebMCP verification](WEBMCP_VERIFICATION.md) for the automated evidence boundary and [scientific boundaries](SCIENTIFIC_BOUNDARIES.md) for interpretation limits.
