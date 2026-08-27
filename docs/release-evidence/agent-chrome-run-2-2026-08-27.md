# FlyLab WebMCP agent retest — Chrome run 2

## Outcome

**Status: BLOCKED at the native WebMCP capability gate.**

The updated FlyLab deployment loaded successfully in the user's external Chrome browser, and the original `/Use` link now reached the root workspace. The active Chrome page did not expose `document.modelContext`, so FlyLab could not attempt to register its eight Site Tools. No native Site Tool was invoked, no experiment reached the approval gate, and no simulation or evidence bundle was produced in this run.

This is a failed capability-precondition run, not a completed scientific workflow. It must not be represented as a WebMCP success. There is no simulated output from this run, and therefore nothing here is a biological measurement.

## Run identity

| Field | Value |
|---|---|
| Test date | 2026-08-27 |
| Capture window | Approximately 13:25–13:28 UTC / 09:25–09:28 EDT |
| Browser surface | User's external Chrome, controlled through the ChatGPT browser extension |
| Browser version | Not observable in this controlled session; do not infer it |
| Primary URL | `https://flylab-neuroethology.d-lougen.chatgpt.site/` |
| Original link retested | `https://flylab-neuroethology.d-lougen.chatgpt.site/Use` |
| Primary page session | `session_ededb0b93b4141f3` |
| Redirect-test page session | `session_82acbebcac914022` |
| FlyLab state | revision `1`, stage `discover`, agent status `ready` |
| Laboratory labels | Adult · BANC v888 · model 0.2.0 |
| Workspace HEAD | `256d1ed7f697a1f6b825c1fc120bdd33d14d5500` (`Record public FlyLab v24 verification`) |
| Workspace status before log | Clean |

The workspace commit is local context only. This run did not independently bind the public deployment to that commit.

## Mission presented to FlyLab

> Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.

## Chronology

1. Attached to the already-open FlyLab tab in external Chrome.
2. Reloaded the root deployment to start with fresh page state.
3. Inspected the visible FlyLab runtime and recovery packet.
4. Checked the agent's native tool inventory; no FlyLab Site Tool was callable.
5. Clicked **Retry Site Tool detection** once.
6. Re-inspected the page; the capability state was unchanged.
7. Opened the original `/Use` URL in a separate Chrome tab. It resolved to the root FlyLab workspace with the normal page title, fixing the first-run 404 behavior.
8. Stopped before any manual recovery walkthrough because that would not test native WebMCP and the page explicitly marks its fallback as read-only.

## Native capability evidence

| Diagnostic | Observed |
|---|---:|
| Document ready state | `complete` |
| Secure context | `true` |
| Origin-keyed cluster | `true` |
| Tools permissions-policy observation | `false` |
| `document.modelContext` present | `false` |
| `registerTool` type | `undefined` |
| Registration attempted | `false` |
| Declared tools | `8` |
| Registered tools | `0` |
| Accepted before rollback | `0` |
| Failed tool | none |
| Registration exception | not applicable; API unavailable before registration |
| WebMCP invocation observed | `false` |
| Agent invocation available | `false` |
| Availability reason | `document_model_context_absent` |
| Retry result | unchanged |

Transport state:

- schema: `flylab.agent-runtime.v1`
- status: `unsupported`
- page registration status: `api_unavailable`
- page invocation handler available: `false`
- WebMCP client availability: `unavailable`
- workflow recommendation: `find_fly_circuits`
- invocable next tool: `null`
- blocker: `webmcp_unavailable_in_this_browser`
- fallback mode: `read_only_same_tab_dom`
- fallback mutation available: `false`

The page declared the expected eight contracts, but none appeared as callable native Site Tools in the agent environment:

1. `inspect_flylab_state`
2. `find_fly_circuits`
3. `draft_fly_hypothesis`
4. `design_stimulation_trial`
5. `run_fly_simulation`
6. `analyze_fly_behavior`
7. `compare_fly_trials`
8. `save_fly_evidence`

### Diagnostic consistency issue

The transport packet correctly reports `invocable_next_tool: null` and `callable: false`, blocked by `webmcp_unavailable_in_this_browser`. The nested scientific `agent_context.next_action`, however, reports `find_fly_circuits` with `callable: true` and no blocker. A judge or agent reading only the nested context could infer that the call is available when it is not.

Recommended change: keep `next_action` as the logical workflow recommendation, but name that field accordingly or derive its effective `callable`/`blocked_by` values from the live transport capability. There should be one authoritative machine-readable answer to “can I call this now?”

### Browser console

The only captured console messages were two duplicate Three.js warnings:

> `THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.`

No FlyLab registration exception was logged. The Three.js warning appears unrelated to the WebMCP capability failure but should be cleaned up before a polished judge demo.

## Workflow artifact ledger

| Artifact | Run 2 result |
|---|---|
| Fresh-state inspection through Site Tools | Not callable |
| Discovery decision | Not created |
| Selected circuit | Not created |
| Evidence records selected | None |
| Falsifiable hypothesis | Not created |
| Exact experiment protocol | Not created |
| Human approval | Not applicable; no experiment existed |
| Protocol hash | None |
| Seed-manifest hash | None |
| Simulation batch | Not run |
| Behavioral analysis | Not run |
| Condition comparison | Not run |
| Follow-up proposal | Not created |
| Evidence bundle | Not saved |

The human gate correctly remained outside the tool surface and reported:

- gate: `approve_experiment`
- status: `not_applicable`
- blocks: `run_fly_simulation`
- agent can satisfy: `false`
- WebMCP tool can satisfy: `false`
- follow-up execution: `not_authorized`

## Improvements visible since the naïve run

1. **Original-link recovery:** `/Use` now reaches the root workspace instead of a visible 404.
2. **Goal-aware hero path:** the published mission explicitly asks for brain, leg, and wing coordination during rapid escape, and the workflow recommends source-backed circuit discovery first.
3. **Honest transport boundary:** absent WebMCP is labeled unsupported; the manifest, contracts, agent guide, inline context, and handoff packet are explicitly read-only and cannot be mistaken for a tool transport.
4. **Clear provenance policy:** reported empirical observations are `measured`; deterministic catalog/calculation records are `derived`; structural wiring is `connectome_inferred`; trajectories are `simulation_predicted`; hypotheses and proposals are `agent_hypothesized`.
5. **Stronger approval model:** the visible state reserves fields for the exact experiment ID, protocol hash, seed-manifest hash, approval timestamp, and approval-binding completeness. Approval is not exposed as a ninth tool.
6. **Clear scientific/UI boundary:** the page states that simulation is reduced-order, formal metrics aggregate simulation-generated per-run summaries, and the visible condition replay is illustrative and excluded from those metrics.
7. **Better recovery packet:** the session, revision, next action, blockers, artifact IDs, interpretation rules, and recovery endpoints are serialized in one visible handoff.

These are meaningful execution and honesty improvements, but the competition's native WebMCP leverage still could not be observed in this Chrome session.

## Comparison with run 1

| Area | Naïve run 1 | Chrome retest run 2 |
|---|---|---|
| `/Use` link | Visible 404; root opened manually | Resolves to root workspace |
| Native WebMCP | API absent, 0/8 | API absent, 0/8 after reload and one retry |
| Fallback behavior | Manual guided example was used | Manual fallback intentionally not used |
| Circuit exercised | MDN reverse-walking path | None; stopped at capability gate |
| Approval | Visible protocol approved | No protocol, so no approval |
| Simulation | 40 virtual trials | Not run |
| Evidence bundle | `evidence_4bb23528` was created by fallback | None |
| Scientific labeling | Simulation was kept distinct from biological measurement | No simulated output existed |

Run 1's fallback artifacts and metrics are not evidence that run 2 succeeded. They belong to a different page session and a non-native recovery path.

## Root-cause assessment

The strongest evidence points to the active Chrome runtime/profile failing to expose the WebMCP API before FlyLab registration code could run:

- `document.modelContext` was absent;
- `registerTool` was undefined;
- registration was never attempted;
- the retry was unchanged.

That pattern differs from a FlyLab registration/schema failure, which would normally show the API present, registration attempted, and then a named registration error or rollback.

The `permissions_policy_tools_allowed: false` observation is still important. It conflicts with FlyLab's documented successful contract. In a browser where the WebMCP feature is absent, it does not by itself prove a bad deployment header. If it remains false in a known flag-enabled Chrome runtime, investigate the exact response's `Permissions-Policy: tools=(self)`, top-level embedding, and deployed revision.

## Existing release evidence, kept separate

[`public-chrome-151-v24.json`](./public-chrome-151-v24.json) records a separate automated native-protocol pass against the same public URL at `2026-08-27T03:20:53.984Z`, using Chrome `151.0.7922.175` with WebMCP testing enabled. It observed all eight tools registered and invoked and reported policy/model-context support as active.

That file is useful evidence that the public target can work in a flag-enabled Chrome 151 verifier. It is **not** evidence that the current user-controlled Chrome session worked, and it is not a ChatGPT agent transcript or human-identity proof.

## Required rerun setup

Do not keep pressing the retry button in the current process. For the next agent-driven Chrome run:

1. Confirm Chrome is version 149 or newer.
2. Enable both `chrome://flags/#enable-webmcp-testing` and `chrome://flags/#devtools-webmcp-support`.
3. Fully relaunch Chrome so the process actually restarts.
4. Open FlyLab in a fresh top-level tab.
5. Before the scientific workflow, require this success gate:
   - tools policy: `true`
   - `document.modelContext`: present
   - `registerTool`: `function`
   - registration attempted: `true`
   - registered: `8/8`
6. Call `inspect_flylab_state` first and record the new page session/revision.
7. Continue through discovery, hypothesis, protocol design, visible approval, simulation, all metrics, comparison, and mission-scope evidence save.

If the known flag-enabled fresh browser still reports policy `false`, check the deployed header and exact build before another agent run. The repository's [`CHROME_MANUAL_TEST.md`](../CHROME_MANUAL_TEST.md) should also gain this failure/remediation branch so judges are not left at the absent-inventory step.

## Logging conclusion

This retest improved the launch path and demonstrated substantially better diagnostic and scientific-boundary design. It did **not** validate native Site Tool leverage in the user's current Chrome environment. The correct next move is an environment-corrected rerun, not a manual fallback replay.
