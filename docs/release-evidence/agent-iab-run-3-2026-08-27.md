# FlyLab WebMCP agent retest — built-in browser run 3

## Outcome

**Status: BLOCKED at the native WebMCP capability gate.**

FlyLab was opened in the app's explicitly selected built-in browser, identified by the browser runtime as **Codex In-app Browser**. The page loaded normally, but the browser did not expose `document.modelContext`. FlyLab therefore did not attempt registration, no native Site Tools appeared in the agent inventory, and the scientific workflow could not begin.

No hypothesis, protocol, approval, simulation, analysis, comparison, or evidence bundle was created. There is no simulated output from this run and no biological measurement.

## Run identity

| Field | Value |
|---|---|
| Test date | 2026-08-27 |
| Capture completed | 2026-08-27T13:43:41Z / 09:43:41 EDT |
| Browser surface | Codex In-app Browser |
| URL | `https://flylab-neuroethology.d-lougen.chatgpt.site/` |
| Page session | `session_236c00e69da44d98` |
| State | revision `1`, stage `discover`, agent status `ready` |
| Laboratory labels | Adult · BANC v888 · model 0.2.0 |

The ambient user tab was not exposed as a claimable built-in-browser tab, so the test opened a fresh tab at the exact public URL.

## Actions performed

1. Explicitly selected the in-app browser rather than Chrome.
2. Opened FlyLab at the public root URL in a fresh built-in-browser tab.
3. Inspected the visible state and machine-readable recovery packet.
4. Checked the agent tool inventory for all eight FlyLab names; found zero.
5. Clicked **Retry Site Tool detection** once.
6. Re-read the transport and next-action state; no capability changed.
7. Stopped without entering the manual recovery walkthrough because it is not a native WebMCP transport.

## Capability evidence

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
| Registrations accepted | `0` |
| Failed tool | none |
| WebMCP invocation observed | `false` |
| Page invocation handler available | `false` |
| Agent invocation available | `false` |
| Availability reason | `document_model_context_absent` |
| Retry result | unchanged |
| FlyLab tools in agent inventory | `0` |

Effective transport state:

- status: `unsupported`
- page registration status: `api_unavailable`
- workflow recommendation: `find_fly_circuits`
- invocable next tool: `null`
- effective next action callable: `false`
- blocker: `webmcp_unavailable_in_this_browser`
- fallback: `read_only_same_tab_dom`
- fallback mutation available: `false`

## Artifact ledger

| Artifact | Result |
|---|---|
| Native state inspection | Not callable |
| Discovery decision | Not created |
| Circuit selection | Not created |
| Hypothesis | Not created |
| Experiment | Not created |
| Visible approval | Not applicable |
| Simulation batch | Not run |
| Metric analysis | Not run |
| Condition comparison | Not run |
| Evidence bundle | Not saved |

## Improvement observed after run 2

The callability inconsistency recorded in [`agent-chrome-run-2-2026-08-27.md`](./agent-chrome-run-2-2026-08-27.md) is fixed in this fresh page:

- transport: `invocable_next_tool: null`, `callable: false`;
- nested agent context: `next_action.callable: false`, `blocked_by: webmcp_unavailable_in_this_browser`;
- nested `next_tool: null`;
- logical recommendation preserved separately as `workflow_next_tool: find_fly_circuits`.

This is the right machine-readable distinction between “what the workflow would do next” and “what this browser can invoke now.”

## Diagnosis

The failure precedes FlyLab's registration logic. A tool/schema bug would normally require `document.modelContext.registerTool` to exist and registration to be attempted. Here the API itself is absent, so the current built-in browser surface cannot provide a native WebMCP transcript.

The runtime identifies this surface as **Codex In-app Browser**. FlyLab's documented agent-driven supported surface is an eligible ChatGPT desktop session with Site Tools enabled and a supported Sol/Terra model. This Codex browser run does not satisfy that prerequisite even though it is an in-app browser.

## Required next environment

To complete the requested agent-native run, open the public site from an eligible **ChatGPT desktop** task using GPT-5.6 Sol or Terra with Site Tools enabled. Before proceeding, require:

- FlyLab appears with exactly eight Site Tools;
- `document.modelContext` is present;
- `registerTool` is a function;
- registration was attempted;
- registered count is `8/8`;
- the first callable tool is `inspect_flylab_state`.

Only then should the agent execute discovery, hypothesis drafting, protocol design, visible approval, simulation, full metric analysis, comparison, and mission-scope evidence export.

## Conclusion

The site now fails honestly and communicates callability consistently, but the current Codex built-in browser still cannot exercise native Site Tools. Replaying the manual guided example would test the UI/model fallback, not WebMCP leverage, and would be misleading for the competition.
