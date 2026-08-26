# FlyLab two-minute demo

## Preparation

1. Confirm the candidate build before recording:

   ```bash
   npm ci
   npm test
   npm run build
   ```

2. Open the public HTTPS build in ChatGPT's in-app browser, which supports WebMCP for the challenge.
3. Start from a fresh page load. Keep the agent chat and the complete FlyLab interface visible.
4. Confirm the activity rail reports seven tools and the protocol is not approved.
5. Do not describe the current model as FlyGym, NeuroMechFly, a full-brain simulation, or a biological experiment.

## Agent prompts

Use two prompts so the approval boundary is unambiguous.

**Prompt 1 — evidence through protocol**

> Find source-backed adult fruit-fly circuits associated with backward walking. Draft a falsifiable MDN activation hypothesis and design a controlled bilateral activation experiment with baseline, sham, left-only, and right-only comparisons. Use unitless model drive 0.65, onset 1000 ms, duration 2000 ms, trial duration 5000 ms, eight replicates per arm, and seed 73142. Stop before running anything so I can inspect and approve the protocol.

Expected tool sequence:

```text
find_fly_circuits
→ draft_fly_hypothesis
→ design_stimulation_trial
→ human approval required
```

**Prompt 2 — approved execution through evidence**

After clicking **Approve experiment**, ask:

> Run the exact approved experiment. Analyze backward distance, signed speed, response latency, heading change, and stance stability. Rank the conditions by backward distance, propose one follow-up with a five-replicate budget, do not execute that proposal, and save the complete evidence bundle.

Expected tool sequence:

```text
run_fly_simulation
→ analyze_fly_behavior
→ compare_fly_trials
→ save_fly_evidence
```

## Recording script

### 0:00–0:12 — The problem

Show the empty shared arena, workflow rail, and evidence badges.

Narration:

> Neuroscience evidence, connectomes, models, and hypotheses are easy to blur together. FlyLab gives a person and an agent one shared laboratory where every claim keeps its scientific boundary.

### 0:12–0:37 — The agent researches visibly

Submit Prompt 1. Let the WebMCP calls advance the workflow from Discover to Design. Open the evidence ledger briefly and show the measured, derived, and connectome-inferred records with their source links.

Narration:

> The agent is not clicking through the interface or inventing a target. It uses structured site tools to find the bounded adult MDN evidence path, cite it, and turn it into a falsifiable hypothesis.

### 0:37–0:57 — Controls and human authority

Show the visible protocol: baseline, model-sham, bilateral, left-only, and right-only conditions; activation level; duration; replicate count; seed; and controller version. Point to the Draft status.

Narration:

> The proposed experiment includes controls, exact timing, replicates, and a seed. It cannot run yet. Approval is intentionally a human interface action, not an agent tool.

Click **Approve experiment**.

### 0:57–1:22 — Reproducible simulation and circuit anatomy

Submit Prompt 2. Show the approved status and animated trajectory replay. Switch to **Circuit**, play through the model-drive window, and briefly show the bilateral purple MDNs, cyan structural LBL40 paths, 153-contact readout, and one selectable BANC cell ID. Switch to left-only long enough to show that only the two left MDNs and right LBL40 path are highlighted.

Narration:

> These lines are the six pinned BANC v888 neuron reconstructions, not artist-drawn neurons. Purple marks the current model target and cyan its structural path; neither is measured activity. The behavior is still the deterministic reduced-order FlyLab model, not FlyGym or a whole-brain simulation.

### 1:22–1:43 — Analysis without overclaiming

Show the metric cards and the paired `derived` and `simulation_predicted` badges. Switch between at least one control and the bilateral condition.

Narration:

> The agent computes versioned behavioral summaries from simulation-predicted run outputs. The interface never presents these values as measured flies or biological confidence intervals.

### 1:43–1:57 — Bounded autoresearch

Show the follow-up proposal and its five-replicate budget.

Narration:

> The agent ranks conditions and proposes the next activation levels, but the proposal carries no execution authority. A new or edited protocol would require another human approval.

### 1:57–2:00 — Evidence handoff

Show the saved evidence-bundle ID and manifest-hash prefix in the footer.

Narration:

> Sources, assumptions, versions, seeds, runs, analyses, and the next hypothesis travel together. That is FlyLab: agent-native exploration with a human still in control.

## Recording checks

- The activity rail visibly advances with tool calls.
- The protocol remains Draft until the person clicks Approve.
- The simulation result is labeled `simulation_predicted`.
- The circuit view labels neuron lines as reconstruction-derived, the shell as schematic, and glow as model selection rather than neural activity.
- The analysis is labeled both `derived` and `simulation_predicted`.
- The follow-up is labeled `agent_hypothesized` and is not executed.
- The evidence ledger shows primary-source links and cautions.
- The saved bundle shows a stable ID and manifest hash.
- No narration claims actual FlyGym execution, whole-brain dynamics, or new experimental discovery.
- Do not quote metric values in the narration unless they are visibly present in that recorded run.
