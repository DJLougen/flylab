# Chrome 149+ native WebMCP protocol test

This is the direct Chrome protocol path for judges who want to inspect every request and response without a conversational agent. It uses Chrome's WebMCP debugging panel to call the same eight page-registered tools. It is a supported WebMCP execution surface, not a DOM or manifest fallback.

A [tracked automated Chrome 151 report](release-evidence/chrome-151-v24.json) records one successful local native-protocol run for the source revision named inside it. This manual sequence lets judges reproduce and inspect the calls themselves. The automated report is not a ChatGPT agent transcript, an identified-human approval record, or proof of the public deployment.

## Setup

1. Run FlyLab locally with `npm run dev`, or open a candidate deployment whose reachability you have verified separately.
2. Use Chrome 149 or newer.
3. Enable `chrome://flags/#enable-webmcp-testing` and `chrome://flags/#devtools-webmcp-support`, then relaunch Chrome.
4. Open FlyLab in a fresh tab.
5. Open **DevTools → Application → WebMCP**.
6. Confirm **Available Tools** contains exactly the eight names in [Judge testing instructions](JUDGE_TESTING.md#native-tool-inventory). Human approval must not appear as a ninth tool.
7. Before creating state, require a console-clean default 3D fly, then switch once to **3D brain** and back. If an older restored tab references a retired hashed visual module, open the current deployment in a fresh tab; do not reload a mutated page session without exporting it first.

### If the inventory is absent

Stop before using the visible walkthrough. An empty inventory does not test native WebMCP.

1. Open FlyLab's **Runtime diagnostic** and record the page session, capability fields, and visible recovery packet.
2. If `document.modelContext` is absent, confirm both WebMCP flags are enabled and fully quit and relaunch Chrome; reloading the tab alone cannot add a process-level browser API.
3. Open FlyLab in a new top-level tab and require all of these before proceeding: **Tools policy** is `yes`, **modelContext present** is `yes`, **registerTool type** is `function`, **Registration attempted** is `yes`, and **Registered now** is `8`.
4. If `document.modelContext` remains absent, record the run as a failed capability-precondition check. Do not represent `/agent`, static JSON, inline recovery state, or the manual walkthrough as a native Site Tool success.
5. If the API is present but registration fails, retain the named failed tool and exact registration exception shown by FlyLab; that is a separate contract/registration failure.

In an API-absent browser, a `no` Tools-policy observation is not by itself proof that the deployment header is wrong because the browser may not recognize the draft feature. If it remains `no` after the flags and full process relaunch, verify the top-level response includes `Permissions-Policy: tools=(self)` and that the tab is not embedded before retrying.

Every successful call returns `flylab.tool-result.v3`. In the examples below:

- replace `SESSION_ID` with the inspected `page_session_id`;
- replace `REVISION` with the latest successful `state_revision`;
- after every successful mutation, update `REVISION` before the next call;
- replace artifact placeholders with returned IDs exactly;
- keep each `operation_id` stable only for retries of that same logical run or save.

If any mutation returns `STALE_STATE`, stop, call `inspect_flylab_state` again, and rebuild the request from the current page session, revision, artifacts, and next action.

## Competition prompt represented by this sequence

> Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.

## 1. Inspect the fresh page

Call `inspect_flylab_state` with:

```json
{}
```

Confirm:

- `result_version` is `flylab.tool-result.v3`;
- `data.agent_context.schema_version` is `flylab.agent-context.v3`;
- `data.page_session_id` and the top-level `page_session_id` match;
- `data.agent_context.agent_status` is `ready`;
- `data.agent_context.next_tool` is `find_fly_circuits`.

Copy the session ID as `SESSION_ID` and the top-level revision as `REVISION`.

## 2. Discover the rapid-escape circuit

Call `find_fly_circuits`:

```json
{
  "page_session_id": "SESSION_ID",
  "expected_state_revision": "REVISION",
  "query": "Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment.",
  "behavior": "short_mode_escape",
  "evidence_labels": ["measured", "derived", "connectome_inferred"],
  "limit": 5
}
```

Use the numeric value for `expected_state_revision`; quotation marks around `REVISION` above only mark a placeholder.

Confirm:

- `data.selection_status` is `selected`;
- `data.selected_circuit_id` is `circuit_gf_adult`;
- `data.discovery_decision.id` is stable and its candidates, rejected alternatives, exclusions, and coverage warning are present;
- `data.candidate_circuit_records` contains the complete records for considered candidates;
- hypothesis eligibility remains distinct from contextual/model evidence.

Copy the returned revision.

## 3. Draft a falsifiable GF hypothesis

Call `draft_fly_hypothesis`:

```json
{
  "page_session_id": "SESSION_ID",
  "expected_state_revision": "REVISION",
  "circuit_id": "circuit_gf_adult",
  "claim": "In FlyLab, bilateral giant-fiber model drive will increase predicted short-mode escape relative to baseline and model-sham conditions.",
  "predicted_behavior": "short_mode_escape",
  "perturbation": "activate",
  "primary_outcome": "short_mode_escape_probability",
  "expected_direction": "increase",
  "controls": ["condition_baseline", "condition_sham"],
  "evidence_ids": ["E-GF-CAUSAL-010", "E-GF-PATH-011", "E-FANC-ESCAPE-012"],
  "evidence_limitations": [
    "The cited assays do not calibrate the reduced-order FlyLab effect size.",
    "The mapped brain-to-leg-and-wing controller is a model assumption rather than a measured transfer function."
  ],
  "falsification_criterion": "The model shows no increase in short-mode escape probability relative to both controls."
}
```

Copy `data.hypothesis.id` as `HYPOTHESIS_ID` and update `REVISION`. The output must remain `agent_hypothesized`; structural evidence cannot substitute for matching perturbation-effect evidence.

## 4. Design the bilateral controlled protocol

Call `design_stimulation_trial`:

```json
{
  "page_session_id": "SESSION_ID",
  "expected_state_revision": "REVISION",
  "hypothesis_id": "HYPOTHESIS_ID",
  "target_circuit_id": "circuit_gf_adult",
  "perturbation": "activate",
  "laterality": "bilateral",
  "activation_level": 0.75,
  "onset_ms": 500,
  "duration_ms": 900,
  "trial_duration_ms": 3000,
  "replicates": 8,
  "include_baseline": true,
  "include_sham_control": true,
  "seed": 91827
}
```

Copy `data.experiment.id` as `EXPERIMENT_ID` and update `REVISION`. The visible protocol must show exactly three GF arms: baseline, model-sham, and bilateral perturbation. GF unilateral routing is unsupported and must fail rather than inventing left/right arms.

Inspect again with `{}`. Confirm `waiting_for_human`, `blocked_by: human_approval`, `next_tool: null`, no approval artifact, and no batch.

An optional negative test may call `run_fly_simulation` with current session/revision, a new `operation_id`, `EXPERIMENT_ID`, and a syntactically valid but incorrect 64-hex SHA-256 string. Before approval it must return `APPROVAL_REQUIRED` and publish no batch.

## 5. Commit the person-owned approval

In the FlyLab page—not through WebMCP—review the complete visible protocol and click **Approve this exact experiment**. Approval is intentionally not a tool.

Call `inspect_flylab_state` again and copy:

- the new `REVISION`;
- `data.agent_context.artifacts.approved_protocol_hash` as `APPROVED_PROTOCOL_HASH`;
- `approved_seed_manifest_hash` and the approval timestamp for audit.

Confirm the approval experiment ID matches `EXPERIMENT_ID`, `approval_binding_complete` is true, and `next_action.input_refs.approved_protocol_hash` matches the copied hash.

The approval record commits a detached, deeply frozen protocol snapshot and the complete seed manifest. The timestamp is outside the hashes. This is visible authorization for the virtual experiment, not identity authentication or a wet-lab approval.

## 6. Run the exact approved simulation

Call `run_fly_simulation`:

```json
{
  "page_session_id": "SESSION_ID",
  "expected_state_revision": "REVISION",
  "experiment_id": "EXPERIMENT_ID",
  "approved_protocol_hash": "APPROVED_PROTOCOL_HASH",
  "operation_id": "judge-gf-run-91827"
}
```

Copy `data.id` as `BATCH_ID` and update `REVISION`. Confirm:

- the returned approval has matching protocol and seed-manifest hashes;
- every condition and run is `complete`;
- every run exposes its seed, effective motor drive, response probability, scalar outputs, trajectory ID, trajectory seed, trajectory role, and full trajectory;
- each condition's separate trajectory is labeled `illustrative_condition_replay` and explicitly excluded from metric calculation;
- `operation_id` is echoed and `idempotent_replay` is false on the first commit.

A wrong approval hash must return `EVIDENCE_MISMATCH` without changing state.

## 7. Analyze the complete GF metric panel

Call `analyze_fly_behavior`:

```json
{
  "page_session_id": "SESSION_ID",
  "expected_state_revision": "REVISION",
  "batch_id": "BATCH_ID",
  "metrics": [
    "short_mode_escape_probability",
    "response_latency_ms",
    "vertical_displacement_mm",
    "wing_recruitment",
    "leg_recruitment"
  ]
}
```

Copy `data.analysis.id` as `ANALYSIS_ID` and update `REVISION`. Confirm:

- `data.analysis.methodVersion` is `flylab.behavior-metrics.v4`;
- every requested entry in `data.metric_definitions` provides formula, unit, sign convention, aggregation, null rule, window semantics, method version, provenance, and boundary;
- `data.response_initiation_summary_definition` is separately declared;
- `data.per_run_results` enumerates every run and its trajectory audit fields;
- a condition with no responses has JSON `null` latency, never trial duration;
- the only supported analysis window is the full trial.

## 8. Compare conditions without executing a follow-up

Call `compare_fly_trials`:

```json
{
  "page_session_id": "SESSION_ID",
  "expected_state_revision": "REVISION",
  "analysis_ids": ["ANALYSIS_ID"],
  "objective_metric": "short_mode_escape_probability",
  "objective": "maximize"
}
```

Copy `data.comparison.id` as `COMPARISON_ID` and update `REVISION`. Confirm `data.execution_authorized` is false. The proposal may be inspected but must not run automatically.

## 9. Save the complete mission bundle

Call `save_fly_evidence`:

```json
{
  "page_session_id": "SESSION_ID",
  "expected_state_revision": "REVISION",
  "scope": "mission",
  "hypothesis_id": "HYPOTHESIS_ID",
  "experiment_id": "EXPERIMENT_ID",
  "batch_ids": ["BATCH_ID"],
  "analysis_ids": ["ANALYSIS_ID"],
  "comparison_id": "COMPARISON_ID",
  "operation_id": "judge-gf-save-91827"
}
```

Confirm:

- `data.bundle.scope` is `mission`;
- `data.evidence_export.schemaVersion` is `3`;
- `data.evidence_export.payload.format` is `flylab.mission-evidence-bundle.v3`;
- the display title is deterministic system metadata and `payload.annotation` is `null` because no person entered an administrative title or note;
- the mission section preserves the untrusted goal, discovery decision, all considered candidates, rejected alternatives, evidence/source context, and coverage boundary;
- the selected lineage contains the exact approval, batch, formal analysis, comparison, and non-authorized proposal;
- the bundle and integrity manifest hashes match the serialized payload checksum;
- browser-local storage is described as best-effort convenience, not the portable artifact.

An `experiment` scope call instead produces `flylab.experiment-evidence-bundle.v3` for the selected lineage without the broader mission decision record.

Inspect once more. Expected: `agent_status: complete`, `state.stage: saved`, `next_tool: null`, and `next_action.kind: complete`.

## 10. Verify operation-ID idempotency

Retry the completed run with the current inspected revision, the same page session, experiment ID, approval hash, and `operation_id: judge-gf-run-91827`. Retry the completed save with the current revision and the exact same logical save input plus `operation_id: judge-gf-save-91827`.

Each retry must return:

- `idempotent_replay: true`;
- the same `operation_id` and committed artifact identity;
- `previous_state_revision` equal to `state_revision`;
- an empty `created_artifact_ids` array;
- no additional simulation, save, activity item, or state mutation.

Reusing either operation ID with changed logical input must return `INVALID_INPUT` with `conflict: operation_id_input_mismatch` and leave state unchanged.

## 11. Verify recovery after a visible edit

Change one protocol field in the FlyLab page, then inspect again.

Expected:

- a new page revision and experiment ID;
- approval plus both approval hashes cleared;
- batch, analysis, comparison, and evidence-bundle references cleared;
- `waiting_for_human` with `next_tool: null`.

The WebMCP panel's invocation list should now show the complete native eight-tool chronology and the single visible non-tool approval boundary.
