# WebMCP release evidence

`chrome-151-model-v03.json` is the current local model-`0.3.0` report from FlyLab's automated, flag-enabled Chrome WebMCP protocol verifier. It binds the run to clean source commit `285d15718dcb6565fbc239fa54e4d55a9817ca39` and tree `5dfe90381b4230accee72dab2f62bea0abc9e2cc`. Chrome `151.0.7922.175` registered and invoked all eight tools, reloaded into a fresh eight-tool page session, and completed the GF hero workflow with three arms, 12 replicates per arm, and 36 seeded runs. The report verifies the approval-hash guard, operation replay and conflict behavior, edit invalidation, all five formal GF metrics, per-run auditability, a schema-valid mission v3 bundle, and the exact clean 15-frame capture contract.

`public-chrome-151-model-v03.json` is the current public model-`0.3.0` report for Sites version 29 at `https://flylab-neuroethology.d-lougen.chatgpt.site/`. It binds the public capture to clean source revision `8ff890e07af63028c25a5b2cdbdf1e742493fe8b` and tree `54956d5d6214e3da352add70633b412bfc21be5f`. The same Chrome build registered and invoked all eight tools, completed the primary five-condition/40-run MDN workflow, and completed an additional three-arm/36-run GF workflow. The public manifest, contracts, and v3 export schema each returned HTTP 200; the served schema compiled and validated the saved exports. The public report is not a 15-frame clean demo capture, which belongs only to the local report above.

These are reproducible automated protocol-client captures. They are **not** ChatGPT Sol/Terra agent transcripts or identity proof for the operator that activated the visible approval control. A ChatGPT Sol/Terra agent run remains a separate pending release gate.

Historical prior-release evidence is retained separately. `chrome-151-v24.json` binds the earlier local v24/`0.2.0` run to clean source commit `5f589a4361ba3ff1209e7fd64dc88bd6afe58839` and tree `abc24ce2749035762ae953f502709878effdeaa6`. `public-chrome-151-v24.json` binds that earlier public run to source revision `6b86d832580b463095234c90b09a3a056a019906`, the deployed Sites version 27 source. Both remain useful historical automated-protocol evidence but do not describe the current model.

[`agent-chrome-run-2-2026-08-27.md`](agent-chrome-run-2-2026-08-27.md) is a separate user-controlled Chrome retest. That browser did not expose `document.modelContext`, so the run correctly stopped at the native-capability gate with zero registered or invoked tools. It is retained as a failed capability-precondition report, not as workflow-success evidence. Its two product-polish findings—the contradictory nested callability signal and deprecated Three.js shadow-map setting—were corrected after the observed run; the report itself remains unchanged as the contemporaneous record.

[`agent-iab-run-3-2026-08-27.md`](agent-iab-run-3-2026-08-27.md) is a separate Codex in-app-browser retest in which the browser API remained absent. It confirms that the corrected recovery packet reports the logical workflow separately from effective browser callability, but it registered and invoked zero tools and created no scientific artifacts.

[`agent-chrome-run-4-2026-08-27.md`](agent-chrome-run-4-2026-08-27.md) is a separate external-Chrome-extension operator log. Chrome exposed the API and FlyLab accepted all eight registrations, while that Codex task exposed zero page tools and observed no callbacks. [Official OpenAI documentation](https://learn.chatgpt.com/docs/webmcp) scopes Site Tools discovery to the ChatGPT desktop app's built-in browser; external Chrome remains useful for browser control and manual DevTools WebMCP inspection. This run is therefore a page-registration pass and client-exposure non-success, not an agent workflow transcript. It also captured an older restored page graph requesting a retired hashed 3D chunk; fresh public HTML referenced the available current chunk, and the follow-up release keeps the default fly viewer in the initial page graph while containing optional-viewer failures.

[`agent-chrome-run-5-behavioral-realism-2026-08-27.md`](agent-chrome-run-5-behavioral-realism-2026-08-27.md) is the historical FlyLab `0.2.0` external-Chrome scientific-workflow and behavioral-model audit. It continued the same page session recorded in run 4. The page registered 8/8 tools while the Codex task exposed 0/8, so run 5 used FlyLab's visible Manual recovery walkthrough and must not be presented as native WebMCP invocation. It records the source-backed GF selection, an exact 24-run virtual protocol authorized through the visible operator approval control (without proving the operator's human identity), all five simulation metrics, per-run causal-consistency findings, and a prioritized improvement plan. The expected export was later found and independently validated as the retained [`evidence_06b9daf2e1c7d6a6404e4f81841549882f41b884018b04d731be0a27c52c5660.flylab-evidence.json`](evidence_06b9daf2e1c7d6a6404e4f81841549882f41b884018b04d731be0a27c52c5660.flylab-evidence.json): envelope SHA-256 `ba6662a5b5c4bd8d185238a47ec4e205f5b5a204f8b4b31959f672db05f55bb0`, with payload/manifest SHA-256 `567bc5246caab3c1027d378dcaa371bea0d6578e8c994ed360b12914ea4539a0`.

Current release status: Sites version 29/public model `0.3.0` is live, and the local and public Chrome 151 native-protocol gates above have passed for their separately recorded source revisions. These reports do not establish biological validation. ChatGPT Sol/Terra agent evidence, the final rights-cleared narration/video and upload, Devpost publication, and personal eligibility/ownership/conflict attestations remain pending.

Regenerate it from a running local release candidate with:

```bash
FLYLAB_URL=http://localhost:3000/ \
FLYLAB_VERIFY_WORKFLOW=1 \
FLYLAB_DEMO_CAPTURE=1 \
FLYLAB_CAPTURE_DIR=outputs/demo/candidate/frames \
FLYLAB_REPORT_FILE=docs/release-evidence/chrome-151-model-v03.json \
npm run verify:webmcp
```

Use the actual local port. Regenerate the public report after publishing executable changes:

```bash
FLYLAB_URL=https://flylab-neuroethology.d-lougen.chatgpt.site/ \
FLYLAB_VERIFY_WORKFLOW=1 \
FLYLAB_REPORT_FILE=docs/release-evidence/public-chrome-151-model-v03.json \
npm run verify:webmcp
```
