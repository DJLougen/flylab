# Chrome-only manual WebMCP test

This path tests the complete FlyLab workflow without a conversational agent. It uses Chrome's WebMCP debugging panel to invoke the same page-registered contracts manually and makes every dynamic artifact-ID handoff explicit.

## Setup

1. Use Chrome 149 or newer.
2. Enable `chrome://flags/#enable-webmcp-testing` and `chrome://flags/#devtools-webmcp-support`, then relaunch Chrome.
3. Open <https://flylab-neuroethology.d-lougen.chatgpt.site/> in a fresh tab.
4. Open **DevTools → Application → WebMCP**.
5. Confirm **Available Tools** contains the eight names in [Judge testing instructions](JUDGE_TESTING.md#expected-tool-inventory).

Every successful call returns a versioned envelope. In the output pane, expand `structuredContent.data` to find the fields named below. Copy returned IDs exactly; do not use the illustrative placeholder text.

## 1. Inspect the fresh page

Run `inspect_flylab_state` with:

```json
{}
```

Expected: `agent_status` is `ready` and `next_tool` is `find_fly_circuits`.

## 2. Find the adult MDN circuit

Run `find_fly_circuits` with:

```json
{
  "query": "MDN",
  "behavior": "backward_walking"
}
```

Copy:

- `circuits[0].id` as `CIRCUIT_ID`
- `hypothesis_eligible_evidence_ids` as the allowed support set. For the activation example, use measured records whose `role` is `hypothesis_support`: `E-MDN-ACTIVATION-001` and `E-MDN-LATERALITY-006`. Do not pass `E-DN-SCREEN-002`; it is `catalog_context` and the hypothesis tool must reject it.

## 3. Draft the hypothesis

Run `draft_fly_hypothesis`, replacing the placeholders with the copied values:

```json
{
  "circuit_id": "CIRCUIT_ID",
  "claim": "Activating adult MDNs in the FlyLab model should increase backward displacement relative to baseline and model-sham controls.",
  "predicted_behavior": "backward_walking",
  "perturbation": "activate",
  "evidence_ids": ["E-MDN-ACTIVATION-001", "E-MDN-LATERALITY-006"],
  "falsification_criterion": "The prediction fails if bilateral activation does not increase backward distance relative to the model-sham condition."
}
```

Copy `hypothesis.id` as `HYPOTHESIS_ID`.

## 4. Design the controlled protocol

Run `design_stimulation_trial`:

```json
{
  "hypothesis_id": "HYPOTHESIS_ID",
  "target_circuit_id": "CIRCUIT_ID",
  "perturbation": "activate",
  "laterality": "bilateral",
  "activation_level": 0.65,
  "onset_ms": 1000,
  "duration_ms": 2000,
  "trial_duration_ms": 5000,
  "replicates": 8,
  "include_baseline": true,
  "include_sham_control": true,
  "seed": 73142
}
```

Copy `experiment.id` as `EXPERIMENT_ID`. The visible page must show five arms: baseline, model-sham, bilateral, left-only, and right-only.

Run `inspect_flylab_state` again with `{}`. Expected: `waiting_for_human`, `blocked_by: human_approval`, and `next_tool: null`.

Optionally run `run_fly_simulation` with `{"experiment_id":"EXPERIMENT_ID"}` before approval. It must return `APPROVAL_REQUIRED` and create no completed batch.

## 5. Perform the person-owned actions

In the FlyLab page—not the WebMCP panel—review the complete visible protocol and click **Approve this exact experiment**. Set **Next-trial budget** to `5`.

Run `inspect_flylab_state` with `{}`. Expected: the human gate is satisfied and `next_tool` is `run_fly_simulation`.

## 6. Run the approved simulation

Run `run_fly_simulation`:

```json
{
  "experiment_id": "EXPERIMENT_ID"
}
```

Copy `id` from the returned batch as `BATCH_ID`.

## 7. Analyze the complete metric panel

Run `analyze_fly_behavior`:

```json
{
  "batch_id": "BATCH_ID",
  "metrics": [
    "backward_distance_mm",
    "signed_speed_mm_s",
    "response_latency_ms",
    "heading_change_deg",
    "stance_stability"
  ]
}
```

Copy `analysis.id` as `ANALYSIS_ID`. On the page, select baseline and model-sham conditions as well as the bilateral condition. If a condition reports `0/8 responsive`, its response latency must be JSON `null` and UI `n/a`; FlyLab never substitutes the trial duration.

## 8. Compare conditions and propose, but do not execute, a follow-up

Run `compare_fly_trials`:

```json
{
  "analysis_ids": ["ANALYSIS_ID"],
  "objective_metric": "backward_distance_mm",
  "objective": "maximize"
}
```

Copy `comparison.id` as `COMPARISON_ID`. Confirm `proposal.replicateBudget` is `5` and `execution_authorized` is `false`.

## 9. Save the exact lineage

Run `save_fly_evidence`:

```json
{
  "title": "Adult MDN backward-walking verification run",
  "hypothesis_id": "HYPOTHESIS_ID",
  "experiment_id": "EXPERIMENT_ID",
  "batch_ids": ["BATCH_ID"],
  "analysis_ids": ["ANALYSIS_ID"],
  "comparison_id": "COMPARISON_ID",
  "note": "Manual Chrome WebMCP verification with a person-owned approval boundary."
}
```

Expected: the page's evidence ledger shows a stable bundle ID and a `sha256:` manifest hash.

Run `inspect_flylab_state` once more. Expected: `agent_status: complete`, `state.stage: saved`, `next_tool: null`, and `next_action.kind: complete`.

## 10. Verify recovery after a human edit

Change one protocol field in the FlyLab page, then run `inspect_flylab_state` with `{}` again.

Expected:

- a new revision and experiment ID;
- approval cleared;
- batch, analysis, comparison, and evidence-bundle references cleared;
- `waiting_for_human` with `next_tool: null`.

The WebMCP panel's **Invoked Tools** list should now contain the complete chronological call record with inputs, outputs, and statuses. For an automated equivalent that also tests cancellation and idempotency, run `FLYLAB_VERIFY_WORKFLOW=1 npm run verify:webmcp` from the public repository.
