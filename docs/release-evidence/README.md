# Local WebMCP release evidence

`chrome-151-v24.json` is the retained report from FlyLab's automated, flag-enabled Chrome WebMCP protocol verifier. It records the exact eight registered and invoked tools, browser version, mutation guards, GF workflow, approval-hash rejection, idempotent run/save replays, stale-operation invalidation, metric audit, and globally source-closed mission bundle.

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
