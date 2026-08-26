# Judge testing instructions

FlyLab is public, requires no account, and exposes exactly eight imperative WebMCP tools on one shared page. The release candidate was created during the challenge period and is available at:

- Live application: <https://flylab-neuroethology.d-lougen.chatgpt.site/>
- Public source: <https://github.com/DJLougen/flylab>
- Challenge-period source proof: [first public commit, August 26, 2026](https://github.com/DJLougen/flylab/commit/a45eb82ad29d62a1bf7afc0aff89f71a70384db9)
- Release verification: [successful public CI run](https://github.com/DJLougen/flylab/actions/runs/33013840575)

The complete path takes about three minutes. It intentionally pauses once at a visible approval control that is absent from the WebMCP tool surface.

## Compatible browser

Use either of the challenge-supported paths:

1. For an agent-driven run, use the ChatGPT desktop app with GPT-5.6 Sol or GPT-5.6 Terra, update the app, enable **Settings → Browser → Permissions → Enable site tools**, and open the live URL in the built-in browser. Open **Site tools → Available site tools** in the address bar.
2. For a Chrome-only run, use Chrome 149 or newer, enable `chrome://flags/#enable-webmcp-testing` and `chrome://flags/#devtools-webmcp-support`, relaunch, and open **DevTools → Application → WebMCP**. Follow the complete [manual Chrome tool sequence](CHROME_MANUAL_TEST.md), including its dynamic-ID handoffs. Vanilla Chrome provides manual WebMCP invocation, not a conversational agent.

OpenAI notes that site-tool availability can depend on model, app version, workspace type, permissions, and rollout. ChatGPT discovery is therefore useful rollout-dependent QA, not a prerequisite for judging this deployment. The independently verified Chrome 149+ path is the baseline when an otherwise compatible ChatGPT session does not show the site-tool surface. Do not install an MCP server or use a page polyfill.

References: [OpenAI Site tools](https://learn.chatgpt.com/docs/webmcp), [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp), and [Chrome WebMCP debugging](https://developer.chrome.com/docs/devtools/application/webmcp).

## Expected tool inventory

Confirm these eight names:

1. `inspect_flylab_state`
2. `find_fly_circuits`
3. `draft_fly_hypothesis`
4. `design_stimulation_trial`
5. `run_fly_simulation`
6. `analyze_fly_behavior`
7. `compare_fly_trials`
8. `save_fly_evidence`

`inspect_flylab_state` is the sole read-only tool. Human approval is deliberately not a ninth tool.

## Optional rollout-dependent ChatGPT agent-driven workflow test

Run this section only when the current ChatGPT model, account, workspace, and app expose Site Tools. Otherwise use the complete Chrome sequence above; an unavailable ChatGPT rollout does not imply that FlyLab registered a fallback transport or failed the verified Chrome path.

Ask the agent to call `inspect_flylab_state`. A fresh page should report:

- `agent_status: ready`
- `next_tool: find_fly_circuits`
- one monotonic page revision
- fixed, nullable artifact fields rather than omitted keys

Then use this prompt:

> Find source-backed adult fruit-fly circuits associated with backward walking. Draft a falsifiable MDN activation hypothesis and design a controlled MDN-inspired model-drive experiment with baseline, model-sham, bilateral, left-only, and right-only comparisons. Use unitless model drive 0.65, onset 1000 ms, duration 2000 ms, trial duration 5000 ms, eight replicates per arm, and seed 73142. Stop before running anything so I can inspect and approve the protocol.

Expected behavior:

- The agent invokes discovery, hypothesis, and design tools rather than clicking through the interface.
- The page shows linked adult MDN evidence and labels the new claim `agent_hypothesized`.
- The exact protocol visibly includes baseline, model-sham, bilateral, left-only, and right-only conditions.
- The agent cannot run the experiment. The inspector reports `waiting_for_human`, `blocked_by: human_approval`, and `next_tool: null`.
- A direct preapproval run attempt returns structured `APPROVAL_REQUIRED` recovery data.

Review the visible protocol and click **Approve this exact experiment**. Set the visible **Next-trial budget** to `5`. These are person-owned controls. Ask the agent to inspect the state again, then use:

> Run the exact approved experiment. Analyze backward distance, signed speed, response latency, heading change, and stance stability. Rank the conditions by backward distance using my visible next-trial budget, do not execute the proposed follow-up, and save the exact supporting evidence and comparison lineage.

Expected behavior:

- The simulation, analysis, comparison, and save tools mutate the same page the person is viewing.
- The activity rail identifies `webmcp agent · r#` separately from `human ui · r#`.
- The arena replay is labeled `simulation_predicted`; the metric panel is labeled both `derived` and `simulation_predicted`.
- The Three.js circuit view exposes six pinned BANC v888 reconstruction-derived cells. Purple is selected unitless model drive, cyan is connectome-inferred structure, and neither is presented as measured activity.
- All five metrics remain visible. A condition with no responses uses JSON `null` and UI `n/a`, reports `0/n responsive`, and never substitutes the trial duration as a latency value. Responsive-condition latency is averaged over responsive runs and displays `responsiveN/n` separately.
- The proposed follow-up uses the visible five-replicate budget and is not executed.
- The evidence ledger shows an evidence-bundle ID and `sha256:` manifest hash.
- A final inspection reports `agent_status: complete`, `state.stage: saved`, `next_tool: null`, and `next_action.kind: complete`.

## Recovery test

After the bundle is saved, change one protocol field in the visible interface and inspect again.

Expected behavior:

- the page revision and experiment ID change;
- approval clears;
- batch, analysis, comparison, and evidence-bundle references clear;
- the state returns to `waiting_for_human` with `next_tool: null`.

This proves that visible human edits are authoritative and that the agent recovers through the state inspector instead of continuing from stale hidden state.

## Reproducibility and scope

Repeating the exact workflow preserves canonical experiment and analysis identity. Repeating completed state-changing calls reuses the saved bundle ID, manifest hash, and saved timestamp. Changing the seed changes the generated runs.

FlyLab runs its deterministic, hand-authored reduced-order model `0.1.3`; it does not run FlyGym, infer biological neural activity, simulate the full BANC connectome, or report a wet-lab result. Model distances and speeds are uncalibrated model-scale units. The five evidence labels are `measured`, `derived`, `connectome_inferred`, `simulation_predicted`, and `agent_hypothesized`.

For automated verification, run:

```bash
npm ci
npm test
npm run lint
npm run build
FLYLAB_VERIFY_WORKFLOW=1 npm run verify:webmcp
```

The automated workflow exercises all eight real browser registrations, the non-WebMCP review gate, two simulation-cancellation paths, evidence-save cancellation, exact-lineage saving, completed-call idempotency, and protocol-edit invalidation. See [WebMCP verification](WEBMCP_VERIFICATION.md) for the full evidence boundary.
