# Local WebMCP release evidence

`chrome-151-v24.json` is the retained report from FlyLab's automated, flag-enabled Chrome WebMCP protocol verifier. It binds the run to clean source commit `5f589a4361ba3ff1209e7fd64dc88bd6afe58839` and tree `abc24ce2749035762ae953f502709878effdeaa6`. It records the exact eight registered and invoked tools, Chrome 151 version, a reload into a fresh eight-tool page session, mutation guards, the 36-run GF workflow, approval-hash rejection, idempotent run/save replays, stale-operation invalidation, metric audit, and a globally source-closed mission bundle.

The same report hashes both served v3 contract artifacts and all 15 exact demo frames. Its browser-export audit clicks the download and copy controls, verifies the exact filename and downloaded JSON envelope, and confirms that the clipboard and visible manual fallback serialize the same bytes. Those checks bind the evidence to observable release behavior rather than an expected-only inventory.

This is reproducible local protocol evidence. It is **not** a ChatGPT agent transcript, identity proof for the person operating the approval control, or proof that the undeployed public URL serves this commit.

Regenerate it from a running local release candidate with:

```bash
FLYLAB_URL=http://localhost:3000/ \
FLYLAB_VERIFY_WORKFLOW=1 \
FLYLAB_DEMO_CAPTURE=1 \
FLYLAB_CAPTURE_DIR=outputs/demo/v24/frames \
FLYLAB_REPORT_FILE=docs/release-evidence/chrome-151-v24.json \
npm run verify:webmcp
```

Use the actual local port. Public-release verification must be run again against the deployed URL and retained separately.
