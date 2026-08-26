# WebMCP verification

FlyLab registers seven site tools through `document.modelContext.registerTool(...)`. The application keeps its full human interface available when that experimental browser API is absent.

## Automated contract checks

Run:

```bash
npm test
```

The WebMCP test suite supplies a compatible `modelContext`, verifies that exactly seven tools register, checks their closed schemas and current annotations, invokes a registered tool through its shared handler, and confirms that aborting the registration signal disposes all tools.

These checks prove the registration code and tool contracts. They do not prove that a particular browser account has received the WebMCP rollout.

## Automated live-browser check

With Chrome 149 or newer installed, run:

```bash
npm run verify:webmcp
```

The command creates an isolated temporary Chrome profile, enables Chrome's official `WebMCPTesting` feature for that process, loads the public deployment, and checks that the real page exposes `document.modelContext.registerTool`, is origin-keyed, and reaches **7 tools live**. It then uses Chrome's WebMCP debugging protocol to enumerate the exact seven tool names and complete a live `find_fly_circuits` invocation. It closes the isolated browser and removes the temporary profile afterward. Set `CHROME_BIN` to override the Chrome executable or `FLYLAB_URL` to check another deployment.

For an end-to-end verification of all seven tools and the approval boundary, run `FLYLAB_VERIFY_WORKFLOW=1 npm run verify:webmcp`. The isolated test first confirms that simulation is blocked with `APPROVAL_REQUIRED`, clicks the visible human-only approval control through the DOM, then runs, analyzes, compares, and saves a complete evidence bundle. After recording the bundle, it edits the visible protocol and verifies that approval, playback, analysis results, condition status, and the follow-up proposal are invalidated.

Set `FLYLAB_CAPTURE_DIR` alongside the workflow flag to save ordered public-site captures, including bilateral and left-only Three.js circuit states plus the final protocol-edit invalidation state.

## Live discovery check

Open the [public FlyLab deployment](https://flylab-neuroethology.d-lougen.chatgpt.site) in the ChatGPT desktop app's built-in browser, then:

1. Use GPT-5.6 Sol or GPT-5.6 Terra and update the desktop app to the latest version.
2. Confirm **Enable site tools** is on under **Settings → Browser → Permissions**.
3. Select **Site tools** in the browser address bar.
4. Open **Available site tools** and confirm these seven names:
   - `find_fly_circuits`
   - `draft_fly_hypothesis`
   - `design_stimulation_trial`
   - `run_fly_simulation`
   - `analyze_fly_behavior`
   - `compare_fly_trials`
   - `save_fly_evidence`
5. Run the two prompts in [DEMO.md](DEMO.md) and inspect **Recently used** after the calls.

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
