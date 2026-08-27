# WebMCP release evidence

`chrome-151-v24.json` is the retained report from FlyLab's automated, flag-enabled Chrome WebMCP protocol verifier. It binds the run to clean source commit `5f589a4361ba3ff1209e7fd64dc88bd6afe58839` and tree `abc24ce2749035762ae953f502709878effdeaa6`. It records the exact eight registered and invoked tools, Chrome 151 version, a reload into a fresh eight-tool page session, mutation guards, the 36-run GF workflow, approval-hash rejection, idempotent run/save replays, stale-operation invalidation, metric audit, and a globally source-closed mission bundle.

The same report hashes both served v3 contract artifacts and all 15 exact demo frames. Its browser-export audit clicks the download and copy controls, verifies the exact filename and downloaded JSON envelope, and confirms that the clipboard and visible manual fallback serialize the same bytes. Those checks bind the evidence to observable release behavior rather than an expected-only inventory.

`public-chrome-151-v24.json` repeats the full verifier against `https://flylab-neuroethology.d-lougen.chatgpt.site/`. It records an anonymous HTTPS target, both served v3 artifacts, eight registered and invoked tools, a fresh page session after reload, exact browser download/copy parity for the MDN and GF workflows, and source revision `6b86d832580b463095234c90b09a3a056a019906`, which was the deployed Sites version 27 source.

These are reproducible automated protocol captures. They are **not** ChatGPT agent transcripts or identity proof for the person operating the approval control.

[`agent-chrome-run-2-2026-08-27.md`](agent-chrome-run-2-2026-08-27.md) is a separate user-controlled Chrome retest. That browser did not expose `document.modelContext`, so the run correctly stopped at the native-capability gate with zero registered or invoked tools. It is retained as a failed capability-precondition report, not as workflow-success evidence. Its two product-polish findings—the contradictory nested callability signal and deprecated Three.js shadow-map setting—were corrected after the observed run; the report itself remains unchanged as the contemporaneous record.

[`agent-iab-run-3-2026-08-27.md`](agent-iab-run-3-2026-08-27.md) is a separate Codex in-app-browser retest in which the browser API remained absent. It confirms that the corrected recovery packet reports the logical workflow separately from effective browser callability, but it registered and invoked zero tools and created no scientific artifacts.

[`agent-chrome-run-4-2026-08-27.md`](agent-chrome-run-4-2026-08-27.md) is a separate external-Chrome-extension operator log. Chrome exposed the API and FlyLab accepted all eight registrations, while that Codex task exposed zero page tools and observed no callbacks. [Official OpenAI documentation](https://learn.chatgpt.com/docs/webmcp) scopes Site Tools discovery to the ChatGPT desktop app's built-in browser; external Chrome remains useful for browser control and manual DevTools WebMCP inspection. This run is therefore a page-registration pass and client-exposure non-success, not an agent workflow transcript. It also captured an older restored page graph requesting a retired hashed 3D chunk; fresh public HTML referenced the available current chunk, and the follow-up release keeps the default fly viewer in the initial page graph while containing optional-viewer failures.

Regenerate it from a running local release candidate with:

```bash
FLYLAB_URL=http://localhost:3000/ \
FLYLAB_VERIFY_WORKFLOW=1 \
FLYLAB_DEMO_CAPTURE=1 \
FLYLAB_CAPTURE_DIR=outputs/demo/v24/frames \
FLYLAB_REPORT_FILE=docs/release-evidence/chrome-151-v24.json \
npm run verify:webmcp
```

Use the actual local port. Regenerate the public report after publishing executable changes:

```bash
FLYLAB_URL=https://flylab-neuroethology.d-lougen.chatgpt.site/ \
FLYLAB_VERIFY_WORKFLOW=1 \
FLYLAB_REPORT_FILE=docs/release-evidence/public-chrome-151-v24.json \
npm run verify:webmcp
```
