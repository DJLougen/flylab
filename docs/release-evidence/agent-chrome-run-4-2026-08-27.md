# FlyLab WebMCP retest — Chrome run 4

## Outcome

**Page registration: PASS. Agent invocation: BLOCKED. Scientific workflow: NOT RUN.**

After Chrome was relaunched, FlyLab successfully detected the native WebMCP API and registered all eight page tools. This is the first interactive retest in this session to pass the browser-side registration gate.

The Codex agent did not receive any of the eight registered tools in its callable or deferred tool inventory, including in a separate fresh model-cycle probe. Consequently `inspect_flylab_state({})` could not be invoked and the source-backed experiment workflow could not begin.

No hypothesis, experiment, approval, simulation, behavioral analysis, comparison, or evidence bundle was produced. There is no simulated output from this run and no biological measurement.

## Run identity

| Field | Value |
|---|---|
| Test date | 2026-08-27 |
| Capture completed | 2026-08-27T13:53:05Z / 09:53:05 EDT |
| Browser | Relaunched external Chrome with ChatGPT/Codex browser extension |
| URL | `https://flylab-neuroethology.d-lougen.chatgpt.site/` |
| FlyLab page session | `session_fd2776cb8bb44735` |
| State | revision `1`, stage `discover` |
| Laboratory labels | Adult · BANC v888 · model 0.2.0 |

## Browser-side WebMCP result

| Diagnostic | Observed |
|---|---:|
| Runtime banner | `Site Tools connected · 8/8 · r1` |
| Document ready state | `complete` |
| Secure context | `true` |
| Origin-keyed cluster | `true` |
| Tools permissions policy | `true` |
| `document.modelContext` present | `true` |
| `registerTool` type | `function` |
| Registration attempted | `true` |
| Declared tools | `8` |
| Registered tools | `8` |
| Accepted before rollback | `8` |
| Failed tool | none |
| Availability reason | `active` |
| Page invocation handler | available |
| WebMCP callback observed | `false` |
| Client availability from page | `unknown_to_page` |

The exact expected tool inventory registered on the page:

1. `inspect_flylab_state`
2. `find_fly_circuits`
3. `draft_fly_hypothesis`
4. `design_stimulation_trial`
5. `run_fly_simulation`
6. `analyze_fly_behavior`
7. `compare_fly_trials`
8. `save_fly_evidence`

## Agent-side invocation result

The Codex callable/deferred tool inventory was searched for:

- each of the eight exact names;
- `FlyLab`;
- `WebMCP`;
- `Site Tools`;
- page-registered and model-context tool descriptors.

Result: **zero matches**.

A separate fresh sub-agent/model cycle repeated that inventory check after registration was already active. It also found zero matches and could not call `inspect_flylab_state({})`.

This isolates the current failure to the page-to-agent invocation bridge, not FlyLab's browser registration:

```text
FlyLab page -> document.modelContext.registerTool -> 8/8 accepted
Codex agent -> callable Site Tools inventory       -> 0/8 exposed
```

The runtime packet reports this distinction correctly:

- `status: active`
- `page_registration_status: registered`
- `webmcp_invocation_observed: false`
- `agent_invocation_available: null`
- `invocable_next_tool: null`
- `blocked_by: webmcp_client_availability_unconfirmed`
- logical workflow recommendation: `find_fly_circuits`

## Scientific artifact ledger

| Artifact | Run 4 result |
|---|---|
| Native state inspection | Not exposed to agent |
| Discovery decision | Not created |
| Circuit selection | Not created |
| Evidence selection | None |
| Falsifiable hypothesis | Not created |
| Controlled protocol | Not created |
| Visible approval | Not applicable |
| Simulation batch | Not run |
| Behavioral metrics | Not calculated |
| Condition comparison | Not created |
| Evidence bundle | Not saved |

## Console regression

Chrome recorded a failed dynamic import for the optional 3D arena module:

```text
TypeError: Failed to fetch dynamically imported module:
https://flylab-neuroethology.d-lougen.chatgpt.site/_next/static/chunks/FlyArena3D-Ca9hlDIt.js
```

React also logged the resulting component error rooted at the lazy `FlyArena3D` load. The core workspace and WebMCP registration remained visible and active, so this did not cause the 8/8 registration result. It can break the optional visual audit and should be treated as a deployment/cache-integrity regression.

Recommended fix/check:

1. Confirm the referenced chunk exists in the deployed asset set.
2. Verify HTML/app chunks and lazy-module chunks were published atomically.
3. Purge stale CDN/browser references after deployment.
4. Reload from a fresh tab and require a console-clean arena load.

## Browser-control incident

On the first claim attempt, the automation indexed the unfiltered Chrome tab list and briefly claimed/reloaded the user's X home tab instead of FlyLab. It did not post, type, navigate elsewhere, or mutate account data. The run immediately corrected this by selecting the exact FlyLab object using title and URL before any FlyLab test action.

Future runs must always bind the exact object returned by the filtered title/URL match and never reuse a positional index from the unfiltered tab list.

## Interpretation

Chrome is now correctly configured for WebMCP protocol support. FlyLab's native registration layer also works in the live public deployment. The remaining limitation is that this Codex task/browser extension is not acting as a WebMCP Site Tools client and does not surface page-registered tools to the model.

This run therefore improves the diagnosis materially:

- Runs 2–3: browser API absent; registration impossible.
- Run 4: browser API active; FlyLab registration succeeds 8/8.
- Run 4 remaining blocker: registered tools are not bridged into the Codex agent.

## Valid next execution surfaces

To complete the agent-native competition transcript, use an eligible ChatGPT desktop task with Site Tools enabled and GPT-5.6 Sol or Terra, then confirm the eight FlyLab tools appear in that model's tool inventory.

For manual native-protocol inspection in this already configured Chrome, use **DevTools → Application → WebMCP** and the exact requests in [`CHROME_MANUAL_TEST.md`](../CHROME_MANUAL_TEST.md). That would be a native Chrome protocol test, but it must be labeled as manual DevTools execution rather than a ChatGPT agent transcript.

Do not use the manual recovery walkthrough as a substitute for either surface. It is intentionally read-only and does not prove WebMCP invocation.

## Conclusion

Chrome and FlyLab now pass the native registration gate. The current Codex agent cannot invoke the registered tools, so the correct competition claim for this run is **8/8 page registration observed, 0/8 agent tools exposed, zero callbacks, no scientific workflow executed**.
