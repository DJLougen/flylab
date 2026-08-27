# FlyLab

[![CI](https://github.com/DJLougen/flylab/actions/workflows/ci.yml/badge.svg)](https://github.com/DJLougen/flylab/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

FlyLab is a WebMCP-enabled virtual neuroethology lab for investigating how an adult fruit-fly neural circuit could influence behavior. A person and an agent work in one visible page session while eight native site tools expose the current workflow state, exact next action, approval boundary, formal analysis methods, and evidence lineage.

The competition story leads with the adult Giant Fiber/DNp01 rapid-escape slice: a literature-supported, bilateral short-mode controller with middle-leg jump and wing-depressor output. FlyLab also includes an adult MDN reverse-walking slice. Both use the deterministic **FlyLab mapped-motor model** `0.2.0` and `mapped-circuit-to-body-adapter.v1`; neither executes a connectome, synapses, muscles, aerodynamics, FlyGym, neural dynamics, or a complete fly.

This repository contains the public v24 release and its verification tooling. A [local Chrome 151 report](docs/release-evidence/chrome-151-v24.json) binds the full native-protocol workflow and 15-frame capture to clean source, while a separate [public-deployment report](docs/release-evidence/public-chrome-151-v24.json) repeats the eight-tool workflow against the no-login HTTPS deployment. These are automated WebMCP protocol captures, not ChatGPT agent transcripts; a ChatGPT Sol/Terra run still requires its own retained evidence.

## Competition prompt

Use this exact rapid-escape prompt in a supported ChatGPT desktop session:

> Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.

The expected native path is:

```text
inspect_flylab_state
→ find_fly_circuits
→ draft_fly_hypothesis
→ design_stimulation_trial
→ visible human approval
→ inspect_flylab_state
→ run_fly_simulation
→ analyze_fly_behavior
→ compare_fly_trials
→ save_fly_evidence
```

Approval is deliberately absent from the tool inventory. The person reviews and approves the exact visible protocol; the agent then continues through the same eight-tool page surface.

## What the release candidate implements

- One read-only inspector plus seven state-changing scientific actions registered with `document.modelContext.registerTool(...)`.
- A persisted discovery decision that records ranked candidates, rejected alternatives, evidence eligibility, and motor-map coverage gaps.
- Hypotheses with a primary outcome, expected direction, mandatory baseline/model-sham controls, causal evidence compatibility, explicit evidence limitations, and a falsification criterion.
- Same-page mutation guards: every state-changing call must echo the inspected `page_session_id` and `expected_state_revision`.
- Caller-generated `operation_id` idempotency for simulation and evidence saving. An identical completed retry replays the committed result without another mutation; reusing the ID for different logical input fails closed.
- A non-tool approval record that binds the experiment to a detached, deeply frozen protocol snapshot and complete seed manifest. The caller must echo its cryptographic `approved_protocol_hash` to run.
- Common-random-number-paired deterministic trials with recorded policies, run seeds, trajectory seeds, per-run trajectories, separate illustrative condition replays, and stable IDs.
- `flylab.behavior-metrics.v4` analyses with machine-readable formula, unit, sign, aggregation, null, window, provenance, and boundary fields for every requested metric, plus exact per-run inspection records.
- Scoped evidence exports: `flylab.experiment-evidence-bundle.v3` for the selected lineage and `flylab.mission-evidence-bundle.v3` for that lineage plus the goal, discovery decision, candidates, exclusions, and coverage gaps. Both travel in a `flylab.evidence-export` schema-version-`3` envelope.
- Bounded autoresearch: comparison may propose one follow-up within the visible person-selected budget, but never authorizes or executes it.

## Quick start

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server.

Supported WebMCP execution surfaces for judging are:

- ChatGPT desktop's built-in browser with GPT-5.6 Sol or GPT-5.6 Terra, the current app, **Settings → Browser → Permissions → Enable site tools** enabled, and an eligible account/workspace rollout. The external Chrome extension is a browser-control surface, not the Site Tools bridge.
- Chrome 149 or newer with WebMCP testing and DevTools WebMCP support enabled.

An eligible product/version label is not proof that tools are available in the current page session. Check the visible runtime diagnostic and the client tool inventory. Do not substitute a static manifest, DOM packet, browser automation, or guided-example control for a WebMCP callback.

Local checks:

```bash
npm test
npm run lint
npm run build
FLYLAB_URL=http://localhost:3000/ npm run verify:webmcp
```

Use the actual local URL if the development server chose a different port. `npm run verify:webmcp` is the supported Chrome protocol verifier; it is not evidence of a successful run until it exits successfully and its report is retained.

## v3 page-session contract

Call `inspect_flylab_state` before the first mutation and again after navigation, interruption, cancellation, any visible edit, or whenever a structured failure directs you back to inspection. Other failures publish semantic recovery for the exact invalid field, visible approval gate, discovery retry, or replacement operation ID. The inspector returns `flylab.agent-context.v3`, including the page-session ID, monotonic revision, artifact manifest, approval binding, blocker, and exactly one next action.

Every mutation requires:

- `page_session_id`: the exact ID for the current open page;
- `expected_state_revision`: the most recently inspected or successfully returned revision.

A wrong session or revision returns non-retryable `STALE_STATE`, publishes no requested mutation, and points back to `inspect_flylab_state`. Successful `flylab.tool-result.v3` envelopes include `page_session_id`, `previous_state_revision`, `state_revision`, `created_artifact_ids`, `operation_id`, `idempotent_replay`, `next_action`, a visible verification target, and field-addressed provenance.

`run_fly_simulation` and `save_fly_evidence` additionally require a stable caller-generated `operation_id`. The cache key is scoped to this page session and tool. Retrying a completed operation with the same logical input returns `idempotent_replay: true`, no new artifacts, and no state advance. The inspected revision may be newer because revision is excluded from logical operation identity. The same ID with changed logical input returns `INVALID_INPUT` with `conflict: operation_id_input_mismatch`.

## Immutable approval binding

`design_stimulation_trial` always creates an unapproved protocol. A person reviews the exact visible experiment and clicks the approval control. FlyLab then creates a detached, deeply frozen `flylab.experiment-approval` record containing:

- the complete protocol snapshot, model version, metric-method version, and seed-policy version;
- every condition's illustrative trajectory seed;
- every replicate's run seed and trajectory seed;
- SHA-256 commitments at `protocol_hash` and `seed_manifest_hash`.

The approval timestamp is metadata outside the hashes. `run_fly_simulation` requires the exact `approved_protocol_hash` exposed by the inspector and verifies both stored commitments against the current experiment. A protocol, model, metric method, or seed-manifest mismatch fails closed. Editing a protocol field creates a revised experiment and clears approval, batch, analyses, comparison, and bundle. This is visible authorization for one virtual experiment, not identity-authenticated protection against general browser automation and not wet-lab approval.

## WebMCP tools

| Tool | Purpose | Boundary |
|---|---|---|
| `inspect_flylab_state` | Return current session, revision, artifacts, human gate, pipeline, and one next action. | Sole read-only tool. Human goal text is untrusted. |
| `find_fly_circuits` | Rank bounded circuit candidates and return a stable discovery decision, evidence closure, motor paths, and coverage. | Writes shared selection; source text is untrusted. |
| `draft_fly_hypothesis` | Create a falsifiable, metric-linked claim with compatible causal evidence and limitations. | Remains `agent_hypothesized`. |
| `design_stimulation_trial` | Create controls, timing, laterality, model settings, seed policy, and conditions. | Writes an unapproved virtual protocol. |
| `run_fly_simulation` | Execute the current approved protocol and expose exact per-run results and trajectories. | Requires session/revision, approval hash, and operation ID; output is `simulation_predicted`. |
| `analyze_fly_behavior` | Compute the complete motor-map metric panel and return formal definitions plus per-run audit rows. | Full-trial `flylab.behavior-metrics.v4`; derived from simulation only. |
| `compare_fly_trials` | Rank compatible analyses and propose one bounded next experiment. | Proposal is not execution authority. |
| `save_fly_evidence` | Save an `experiment` or `mission` v3 bundle and return its exact portable envelope. | Requires operation ID; browser-local storage is convenience only. |

## Runtime diagnostics and read-only recovery

The page exposes a `flylab.webmcp-capability-diagnostic.v1` record with secure-context, origin-cluster, permissions-policy, `document.modelContext`, `registerTool`, registration-attempt, accepted-count-before-rollback, failed-tool, and sanitized exception fields. It distinguishes:

- API absent;
- `registerTool` missing;
- registration failed and rolled back;
- all eight page registrations accepted;
- a WebMCP callback observed in this page session.

Registration alone cannot establish client, model, account, workspace, permission, rollout, or agent identity. An observed callback proves invocation through the browser surface, not that the caller was a ChatGPT agent.

When WebMCP is unavailable, `/agent`, `/flylab-agent-manifest.json`, `/flylab-tool-contracts.json`, and the inline context/runtime/handoff packets remain read-only diagnostics. They do not register, emulate, or polyfill WebMCP; `invocable_next_tool` remains unavailable. The ordinary human interface can still be used, but that is not a successful site-tool run.

## Metrics, trajectories, and evidence exports

The GF panel is short-mode escape probability, response latency, vertical displacement, wing recruitment, and leg recruitment. The MDN panel is backward distance, signed speed, response latency, heading change, and stance stability. Each analysis returns its complete five-metric panel, formal method definitions, the always-present response-initiation summary definition, and per-run rows linked to run and trajectory IDs.

Every replicate has its own simulation-generated trajectory. The condition-level Three.js replay is a separate `illustrative_condition_replay` and is never used to calculate metric cards. No-response latency is JSON `null`, never trial duration. All distances, speeds, lift, recruitment, and probabilities remain uncalibrated model outputs rather than animal measurements or biological confidence intervals.

The evidence-export manifest hash detects payload changes; it is not a signature, authorship proof, or immutability guarantee. That checksum is distinct from the immutable in-memory approval snapshot and its protocol/seed-manifest commitments.

## Scientific provenance

FlyLab uses five labels:

| Label | Meaning |
|---|---|
| `measured` | A biological observation reported under the cited experiment's conditions. |
| `derived` | A deterministic transformation or summary. |
| `connectome_inferred` | A structural pathway inference; wiring is not activity or behavior. |
| `simulation_predicted` | Output conditional on FlyLab's versioned model and seeds. |
| `agent_hypothesized` | An untested claim or proposal requiring human judgment. |

Discovery remains source-closed under evidence filtering. A hypothesis must cite at least one discovered `role=hypothesis_support`, `kind=perturbation_effect` record matching its perturbation and behavior; structural, inventory, and motor-context records are supplemental only. The local model card defines the method. FlyGym remains a pinned embodiment reference and is not executed.

The Three.js circuit viewer uses six reconstruction-derived BANC v888 L2 skeletons for the MDN/LBL40 slice. Its GF→TTMn/TTM and GF→PSI→DLMn/DLM paths are explicitly literature-schematic and have no invented reconstruction or dataset neuron ID. Purple indicates a selected model target, never measured neural activity. The procedural arena fly is also schematic rather than a scan or biomechanical reconstruction.

See [Scientific boundaries](docs/SCIENTIFIC_BOUNDARIES.md), the [mapped-motor model card](docs/MODEL_CARD.md), [source verification](docs/SOURCE_VERIFICATION.md), and [BANC slice reproducibility](docs/BANC_SLICE_REPRODUCIBILITY.md). Third-party attribution and modification notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Judge and project guides

- [Judge testing instructions](docs/JUDGE_TESTING.md)
- [Chrome 149+ native WebMCP protocol test](docs/CHROME_MANUAL_TEST.md)
- [WebMCP verification](docs/WEBMCP_VERIFICATION.md)
- [Challenge demo plan](docs/DEMO.md)
- [Challenge submission copy](docs/CHALLENGE_SUBMISSION.md)
- [YouTube metadata draft](docs/YOUTUBE_DESCRIPTION.md)
- `lib/agent-context.ts` — `flylab.agent-context.v3` state, approval references, and next-action contract
- `lib/experiment-approval.ts` — immutable protocol and seed-manifest approval commitments
- `lib/discovery-decision.ts` — stable ranked-discovery decisions and exclusions
- `lib/flylab.ts` — evidence records, seed policy, simulation, formal metric definitions, and comparison
- `lib/evidence-export.ts` — experiment/mission v3 portable envelope
- `lib/webmcp.ts` — eight tool contracts, validation, v3 results, diagnostics, and registration lifecycle
- `app/page.tsx` — shared human-agent laboratory state and visible approval boundary

## Responsible interpretation

FlyLab is a hypothesis and simulation sandbox. It does not perform a wet-lab experiment, prescribe an animal protocol, establish necessity or sufficiency beyond cited conditions, infer natural neural activity, or generate new biological evidence. Its purpose is to make assumptions, controls, predictions, and source lineage inspectable while a person remains in control.
