# WebMCP verification

FlyLab registers eight site tools through `document.modelContext.registerTool(...)`: one read-only state inspector plus seven structured scientific workflow actions. The application keeps its full human interface available when that experimental browser API is absent.

## Automated contract checks

Run:

```bash
npm test
```

The current suite contains 52 tests. It supplies a compatible `modelContext`, verifies that exactly eight tools register, checks their closed schemas and current annotations, invokes registered tools through the shared handler, rejects unexpected inspector fields, and confirms that aborting the registration signal disposes all tools. Pure agent-context tests cover every artifact transition, the non-WebMCP review gate, simulation and evidence-save waiting states, exact comparison-lineage recovery, canonical stage derivation, completion, fixed null/array fields, causal-evidence recovery fields, and the one-next-action rule. The suite also covers mandatory controls, claim-compatible evidence gating, source-support closure, model-card parameter parity, onset-referenced/null response latency, canonical input ordering, exact protocol identity and bounds, functional suppression magnitude, stable proposal/bundle identity, the complete analysis panel, publication-safe narration inputs, and social-preview dimensions/provenance.

The cancellation regression test exercises the same prepare/check/commit helper used by `run_fly_simulation` and `save_fly_evidence`. It waits until preparation has started, aborts the invocation, then releases the prepared artifact. The promise rejects with `AbortError`, the commit callback is called zero times, and no prepared state is published. A companion success case proves that an active invocation commits exactly once. Another regression proves that a cancellation arriving only after a synchronous mutation committed cannot relabel that mutation as canceled. The stale-revision test proves that prepared work publishes nothing when the shared page revision changes before commit and returns `STALE_STATE` recovery data.

These checks prove the registration code and tool contracts. They do not prove that a particular browser account has received the WebMCP rollout.

## Automated live-browser check

With Chrome 149 or newer installed, run:

```bash
npm run verify:webmcp
```

The command creates an isolated temporary Chrome profile, enables Chrome's official `WebMCPTesting` feature for that process, loads the public deployment, and checks that the real page exposes `document.modelContext.registerTool`, is origin-keyed, and reaches **8 tools live**. It then uses Chrome's WebMCP debugging protocol to enumerate the exact eight tool names, invoke `inspect_flylab_state`, verify that the initial next tool is `find_fly_circuits`, and complete that discovery call. It closes the isolated browser and removes the temporary profile afterward. Set `CHROME_BIN` to override the Chrome executable or `FLYLAB_URL` to check another deployment.

For an end-to-end verification of all eight tools and the approval boundary, run `FLYLAB_VERIFY_WORKFLOW=1 npm run verify:webmcp`. This invokes all eight registered contracts through Chrome's real WebMCP protocol; it does not use the guided-example button. The isolated test verifies the inspector before discovery, at the blocked non-WebMCP review gate, after visible approval, after workflow completion, and again after the exact protocol is edited through the UI. It confirms that simulation is blocked with `APPROVAL_REQUIRED` and clicks the approval control colocated with the complete visible protocol through the DOM. This demonstrates the tool-surface boundary, not identity authentication against browser automation. Before the successful run, it exercises two post-start simulation-cancellation paths:

1. It invokes `run_fly_simulation`, waits until the visible activity is **Simulation batch running**, calls Chrome's `WebMCP.cancelInvocation`, requires protocol status `Canceled`, and verifies that the primary action returns to **Run MDN-inspired drive**, playback remains disabled, all five conditions remain `approved`, and no results panel or completed batch appears.
2. It starts another run, waits for the same visible running state, clicks **Cancel running simulation**, requires a non-completed invocation response, and verifies the same no-batch state.

After comparison, it starts `save_fly_evidence`, waits for the visible **Evidence bundle preparing** state, cancels it through Chrome's WebMCP protocol, requires status `Canceled`, and proves that no bundle, local-storage record, or ledger entry was created while the comparison remains intact and `next_tool` returns to `save_fly_evidence`.

The test then saves a complete evidence bundle and repeats all seven state-changing calls. It intentionally reverses hypothesis evidence and analysis metric order to verify canonical identity, requires every repeated response to retain a `complete` next action, and confirms that the inspector stays at `saved` with one analysis plus the same bundle ID, manifest hash, and saved timestamp. After recording the bundle, it edits the visible protocol and verifies a new experiment ID, `waiting_for_human`, `next_tool: null`, and cleared batch, analysis, comparison, and bundle references in both the UI and inspector.

Set `FLYLAB_CAPTURE_DIR` alongside the workflow flag to save ordered public-site captures, including bilateral and left-only Three.js circuit states plus the final protocol-edit invalidation state. Cancellation captures are excluded from that canonical sequence; opt into the two extra negative-state captures with `FLYLAB_CAPTURE_CANCELLATION=1`.

## Cancellation architecture and Chrome 151 compatibility

Registration lifetime and invocation lifetime are separate. The signal passed to `registerTool(..., { signal })` owns tool registration. Simulation and evidence-save invocations each combine the invocation signal with their own page-owned controller using `AbortSignal.any(...)`. Work is prepared without publishing it, the combined signal and captured page revision are checked, and the artifact is committed synchronously. Because JavaScript does not yield between that final check and the synchronous commit, cancellation or a stale revision observed before the boundary cannot publish a completed artifact.

The current WebMCP draft and [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api) describe an invocation `AbortSignal` in the execute callback's second argument. Chrome 151's checked implementation predates that path for browser-driven calls: it invokes the JavaScript tool with the input alone and dispatches a synchronous `toolcancel` event from `CancelTool`. FlyLab handles `toolcancel` for `run_fly_simulation` and `save_fly_evidence`, also listens for the draft's future `toolcanceled` spelling, and removes both listeners on unmount. The Chrome 151 fallback records the cancellation request synchronously, then defers its page-owned abort by one browser task so Chrome can finish removing its pending invocation without re-entrant promise settlement changing the protocol response. Both the synchronous request flag and the future native execution signal feed the same tested commit boundary, so a fast preparation cannot commit in the deferral window. Chrome 151 exposes only the tool name on this compatibility event; FlyLab therefore disallows overlapping work for each long-running tool and conservatively targets that tool's sole active controller. See the [Chrome 151 ModelContext implementation](https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/7922/third_party/blink/renderer/core/script_tools/model_context.cc) and [DevTools WebMCP protocol](https://chromedevtools.github.io/devtools-protocol/tot/WebMCP/).

## Live discovery check

Open the [public FlyLab deployment](https://flylab-neuroethology.d-lougen.chatgpt.site) in the ChatGPT desktop app's built-in browser, then:

1. Use GPT-5.6 Sol or GPT-5.6 Terra and update the desktop app to the latest version.
2. Confirm **Enable site tools** is on under **Settings → Browser → Permissions**.
3. Select **Site tools** in the browser address bar.
4. Open **Available site tools** and confirm these eight names:
   - `inspect_flylab_state`
   - `find_fly_circuits`
   - `draft_fly_hypothesis`
   - `design_stimulation_trial`
   - `run_fly_simulation`
   - `analyze_fly_behavior`
   - `compare_fly_trials`
   - `save_fly_evidence`
5. Call `inspect_flylab_state` before discovery and again after approval, a person edit, or any interruption. Run the two prompts in [DEMO.md](DEMO.md) and inspect **Recently used** after the calls.

OpenAI notes that site tools are unavailable with GPT-5.6 Luna and in Enterprise or Edu workspaces, and that availability can also depend on rollout. Therefore an absent `document.modelContext` in an otherwise compatible page is recorded as an environment limitation, not replaced with a browser polyfill.

References: [OpenAI Site tools documentation](https://learn.chatgpt.com/docs/webmcp) and [Chrome's WebMCP developer guide](https://developer.chrome.com/docs/ai/webmcp).

## Deployment checks

The public response must remain HTTPS, must not opt out of origin-keyed agent clustering with `Origin-Agent-Cluster: ?0`, and must return:

```text
Permissions-Policy: tools=(self)
Referrer-Policy: strict-origin-when-cross-origin
```

FlyLab requests `Origin-Agent-Cluster: ?1` in its application and local-development configuration. A hosting edge may omit that redundant opt-in header; the disabling value `?0` must not be present.

The registration code performs a feature check before calling the API, so unsupported browsers continue to receive the ordinary laboratory interface without an error.
