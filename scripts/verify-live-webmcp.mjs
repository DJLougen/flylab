import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const defaultUrl = 'https://flylab-neuroethology.d-lougen.chatgpt.site/';
const expectedToolNames = [
  'analyze_fly_behavior',
  'compare_fly_trials',
  'design_stimulation_trial',
  'draft_fly_hypothesis',
  'find_fly_circuits',
  'inspect_flylab_state',
  'run_fly_simulation',
  'save_fly_evidence',
];
const chromeCandidates = process.platform === 'darwin'
  ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  : process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'];

const chromePath = process.env.CHROME_BIN ?? chromeCandidates.find(existsSync);
if (!chromePath || !existsSync(chromePath)) {
  throw new Error('Google Chrome was not found. Set CHROME_BIN to its executable path.');
}

const targetUrl = process.env.FLYLAB_URL ?? defaultUrl;
const profile = await mkdtemp(join(tmpdir(), 'flylab-webmcp-'));
const stderrLines = [];
let chrome;
let socket;
let captureIndex = 0;
const capturedFrames = [];
const captureDirectory = process.env.FLYLAB_CAPTURE_DIR
  ? resolve(process.env.FLYLAB_CAPTURE_DIR)
  : null;
const cleanDemoCapture = process.env.FLYLAB_DEMO_CAPTURE === '1';

function withTimeout(promise, milliseconds, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds} ms`)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function waitForDebuggerUrl(stream) {
  return withTimeout(new Promise((resolve, reject) => {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        stderrLines.push(line);
        if (stderrLines.length > 30) stderrLines.shift();
        const match = line.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) resolve(match[1]);
      }
    });
    stream.once('error', reject);
    chrome.once('exit', (code) => reject(new Error(`Chrome exited before DevTools started (${code}).`)));
  }), 15_000, 'Chrome startup');
}

async function fetchTargets(port) {
  return withTimeout((async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (response.ok) {
          const targets = await response.json();
          const page = targets.find((target) => target.type === 'page' && target.url.startsWith(targetUrl));
          if (page?.webSocketDebuggerUrl) return page;
        }
      } catch {
        // Chrome may not have opened the target page yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Chrome did not expose the FlyLab page target for ${targetUrl}.`);
  })(), 12_000, 'FlyLab page discovery');
}

function connectToPage(webSocketDebuggerUrl) {
  return withTimeout(new Promise((resolve, reject) => {
    const candidate = new WebSocket(webSocketDebuggerUrl);
    candidate.addEventListener('open', () => resolve(candidate), { once: true });
    candidate.addEventListener('error', reject, { once: true });
  }), 5_000, 'Chrome DevTools connection');
}

let commandId = 0;
function sendCommand(method, params) {
  const id = ++commandId;
  return withTimeout(new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== id) return;
      socket.removeEventListener('message', onMessage);
      if (message.error) reject(new Error(`${method} failed: ${message.error.message}`));
      else resolve(message.result);
    };
    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  }), 5_000, method);
}

function waitForEvent(method, predicate = () => true) {
  return withTimeout(new Promise((resolve) => {
    const onMessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method !== method || !predicate(message.params)) return;
      socket.removeEventListener('message', onMessage);
      resolve(message.params);
    };
    socket.addEventListener('message', onMessage);
  }), 5_000, method);
}

async function readRuntimeStatus() {
  const expression = `JSON.stringify({
    modelContextType: typeof document.modelContext,
    registerToolType: typeof document.modelContext?.registerTool,
    status: document.querySelector('.tool-status')?.textContent?.trim() ?? null,
    originAgentCluster: window.originAgentCluster === true,
    location: window.location.href,
    userAgent: navigator.userAgent
  })`;
  const response = await sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  const value = response?.result?.value;
  if (typeof value !== 'string') {
    throw new Error(`Could not read the FlyLab runtime status: ${JSON.stringify(response)}`);
  }
  return JSON.parse(value);
}

async function captureStage(label) {
  if (!captureDirectory) return;
  await mkdir(captureDirectory, { recursive: true });
  const screenshot = await sendCommand('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const safeLabel = label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const filename = `${String(captureIndex).padStart(2, '0')}-${safeLabel}.png`;
  const filepath = join(captureDirectory, filename);
  captureIndex += 1;
  await writeFile(filepath, Buffer.from(screenshot.data, 'base64'));
  capturedFrames.push(filepath);
}

async function clickButton({ text, ariaLabel, exact = false }) {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const text = ${JSON.stringify(text ?? null)};
      const ariaLabel = ${JSON.stringify(ariaLabel ?? null)};
      const exact = ${JSON.stringify(exact)};
      const button = [...document.querySelectorAll('button')].find((candidate) => {
        if (ariaLabel) return candidate.getAttribute('aria-label') === ariaLabel;
        const value = candidate.textContent?.trim() ?? '';
        return exact ? value === text : value.includes(text);
      });
      button?.click();
      return { clicked: Boolean(button), label: button?.textContent?.trim() ?? null };
    })()`,
    returnByValue: true,
  });
  if (response?.result?.value?.clicked !== true) {
    throw new Error(`Demo control was not available: ${JSON.stringify({ text, ariaLabel, response })}`);
  }
  return response.result.value;
}

async function waitForViewer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('.viewer-load.ready')?.textContent?.trim() ?? null`,
      returnByValue: true,
    });
    if (response?.result?.value === 'BANC v888 reconstructions') return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('The Three.js reconstruction viewer did not finish loading.');
}

async function captureCircuitPlayback() {
  if (!captureDirectory) return;
  await clickButton({ text: '3D brain', exact: true });
  await waitForViewer();
  await clickButton({ text: 'whole', exact: true });
  await clickButton({ ariaLabel: 'Restart replay' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await clickButton({ ariaLabel: 'Play replay' });
  await new Promise((resolve) => setTimeout(resolve, 1_250));
  await captureStage('circuit-bilateral-active');
  await clickButton({ ariaLabel: 'Pause replay' });

  await clickButton({ text: 'Left-only MDN-inspired model drive' });
  await clickButton({ ariaLabel: 'Restart replay' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await clickButton({ ariaLabel: 'Play replay' });
  await new Promise((resolve) => setTimeout(resolve, 1_250));
  await captureStage('circuit-left-active');
  await clickButton({ ariaLabel: 'Pause replay' });
  await clickButton({ text: 'Bilateral MDN-inspired drive' });
  await clickButton({ text: '3D fly', exact: true });
}

async function verifyVisibleProtocol(experiment) {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const panel = document.querySelector('.protocol-controls');
      const metadata = Object.fromEntries([...panel?.querySelectorAll('dl div') ?? []].map((row) => [
        row.querySelector('dt')?.textContent?.trim() ?? '',
        row.querySelector('dd')?.textContent?.trim() ?? '',
      ]));
      return {
        metadata,
        slider_labels: [...panel?.querySelectorAll('label > span') ?? []].map((node) => node.textContent?.trim() ?? ''),
        ranges: [...panel?.querySelectorAll('input[type="range"]') ?? []].map((input) => ({ min: input.min, max: input.max, step: input.step, value: input.value })),
        stimulus_window: {
          left: document.querySelector('.stimulus-window')?.style.left ?? null,
          width: document.querySelector('.stimulus-window')?.style.width ?? null,
        },
        approval_text: panel?.querySelector('.protocol-approval-action')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
      };
    })()`,
    returnByValue: true,
  });
  const visible = response?.result?.value;
  const expectedMetadata = {
    'Experiment ID': experiment.id,
    'Hypothesis ID': experiment.hypothesisId,
    Target: experiment.targetCircuitId,
    Perturbation: experiment.perturbation,
    Laterality: experiment.primaryLaterality,
  };
  for (const [label, value] of Object.entries(expectedMetadata)) {
    if (visible?.metadata?.[label] !== value) {
      throw new Error(`Visible protocol ${label} did not match the design response: ${JSON.stringify(visible)}`);
    }
  }
  const expectedStimulus = {
    left: `${(experiment.onsetMs / experiment.trialDurationMs) * 100}%`,
    width: `${(experiment.durationMs / experiment.trialDurationMs) * 100}%`,
  };
  if (!visible?.metadata?.['Trial duration']?.includes(experiment.trialDurationMs.toLocaleString())
    || !visible?.metadata?.['Required controls']?.includes('baseline')
    || !visible?.metadata?.['Required controls']?.includes('model-sham')
    || !experiment.conditions.every((condition) => visible?.metadata?.Arms?.includes(condition.id))
    || !visible?.slider_labels?.some((label) => label.includes(String(experiment.activationLevel)))
    || !visible?.slider_labels?.some((label) => label.includes(`${experiment.durationMs} ms`))
    || !visible?.slider_labels?.some((label) => label.includes(String(experiment.replicates)))
    || !visible?.approval_text?.includes(experiment.id)
    || JSON.stringify(visible?.ranges?.map(({ min, max }) => [min, max])) !== JSON.stringify([['0', '1'], ['50', String(Math.min(5000, experiment.trialDurationMs - experiment.onsetMs))], ['1', '20']])
    || JSON.stringify(visible?.stimulus_window) !== JSON.stringify(expectedStimulus)) {
    throw new Error(`Visible exact protocol was incomplete: ${JSON.stringify(visible)}`);
  }
  return visible;
}

async function verifyVisibleAnalysis(analysis, primaryConditionId) {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      title: document.querySelector('.results-panel h2')?.textContent?.trim() ?? null,
      cards: [...document.querySelectorAll('.metric-grid article')].map((card) => ({
        label: card.querySelector('span')?.textContent?.trim() ?? '',
        value: card.querySelector('strong')?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
        detail: card.querySelector('small')?.textContent?.trim() ?? '',
      })),
    }))()`,
    returnByValue: true,
  });
  const visible = response?.result?.value;
  const primary = analysis.conditions.find((condition) => condition.conditionId === primaryConditionId);
  const expectedLabels = ['Reverse initiation', 'Backward distance', 'Signed speed', 'Response latency', 'Heading change', 'Stance stability'];
  const responseCard = visible?.cards?.find((card) => card.label === 'Response latency');
  if (!primary
    || visible?.title !== primary.label
    || visible?.cards?.length !== expectedLabels.length
    || !expectedLabels.every((label) => visible.cards.some((card) => card.label === label))
    || !responseCard?.detail?.includes(`${primary.responsiveN}/${primary.n}`)
    || (primary.responseLatencyMs === null && responseCard.value !== 'n/a')) {
    throw new Error(`Visible analysis did not match the returned primary condition: ${JSON.stringify({ visible, primary })}`);
  }
  return visible;
}

async function verifyConditionTabAnalysisParity(analysis, primaryConditionId) {
  const alternate = analysis.conditions.find((condition) => condition.conditionId !== primaryConditionId);
  const primary = analysis.conditions.find((condition) => condition.conditionId === primaryConditionId);
  if (!alternate || !primary) throw new Error('Analysis did not contain both primary and alternate conditions.');
  const clickCondition = async (label) => sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const expected = ${JSON.stringify(label)};
      const button = [...document.querySelectorAll('.condition-tabs button')]
        .find((candidate) => candidate.querySelector('span')?.textContent?.trim() === expected);
      button?.click();
      return Boolean(button);
    })()`,
    returnByValue: true,
  });
  const alternateClick = await clickCondition(alternate.label);
  if (alternateClick?.result?.value !== true) throw new Error(`Could not select alternate condition ${alternate.label}.`);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const alternateTitle = await sendCommand('Runtime.evaluate', {
    expression: `document.querySelector('.results-panel h2')?.textContent?.trim() ?? null`,
    returnByValue: true,
  });
  if (alternateTitle?.result?.value !== alternate.label) {
    throw new Error(`Condition tab did not update visible analysis: ${JSON.stringify(alternateTitle)}`);
  }
  await clickCondition(primary.label);
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { alternate_condition: alternate.conditionId, restored_condition: primary.conditionId };
}

async function setHumanProposalBudget(tools, budget) {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const select = document.querySelector('.autonomy-card select');
      if (!(select instanceof HTMLSelectElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(select, ${JSON.stringify(String(budget))});
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  if (response?.result?.value !== true) throw new Error('The visible human proposal-budget control was unavailable.');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const context = await inspectAgentContext(tools);
  if (context.human_controls?.next_trial_budget !== budget) {
    throw new Error(`Inspector did not expose the human-selected proposal budget: ${JSON.stringify(context)}`);
  }
  return { budget, state_revision: context.state.revision };
}

async function verifyVisibleComparison(comparison) {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      heading: document.querySelector('.comparison-ranking > span')?.textContent?.trim() ?? null,
      rows: [...document.querySelectorAll('.comparison-ranking li')].map((row) => row.querySelector('strong')?.textContent?.trim() ?? ''),
    }))()`,
    returnByValue: true,
  });
  const visible = response?.result?.value;
  const expectedRows = comparison.rankedConditions.map((row) => row.label);
  if (!visible?.heading?.includes(comparison.objectiveMetric)
    || !visible?.heading?.includes(comparison.objective)
    || JSON.stringify(visible?.rows) !== JSON.stringify(expectedRows)) {
    throw new Error(`Visible ranking did not match the comparison response: ${JSON.stringify({ visible, expectedRows })}`);
  }
  return visible;
}

async function verifyVisibleBundle(bundle) {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      metadata: Object.fromEntries([...document.querySelectorAll('.bundle-detail dl > div')].map((row) => [
        row.querySelector('dt')?.textContent?.trim() ?? '',
        row.querySelector('dd')?.textContent?.trim() ?? '',
      ])),
    }))()`,
    returnByValue: true,
  });
  const metadata = response?.result?.value?.metadata;
  const expectedCounts = Object.entries(bundle.provenanceCounts)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind} ${count}`);
  if (!metadata
    || !bundle.supportingEvidenceIds.every((id) => metadata['Supporting evidence']?.includes(id))
    || !bundle.supportingSourceIds.every((id) => metadata['Supporting sources']?.includes(id))
    || !expectedCounts.every((value) => metadata['Provenance counts']?.includes(value))) {
    throw new Error(`Visible evidence lineage did not match the saved bundle: ${JSON.stringify({ metadata, bundle })}`);
  }
  return metadata;
}

async function verifyProtocolEditInvalidation(tools, previousExperimentId) {
  await clickButton({ ariaLabel: 'Close evidence ledger' });
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.protocol-controls input[type="range"][min="0"][max="1"]');
      if (!(input instanceof HTMLInputElement)) return { edited: false, reason: 'activation slider missing' };
      const nextValue = input.value === '0.7' ? '0.75' : '0.7';
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, nextValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { edited: true, nextValue };
    })()`,
    returnByValue: true,
  });
  if (response?.result?.value?.edited !== true) {
    throw new Error(`The protocol could not be edited for invalidation QA: ${JSON.stringify(response)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));

  const state = await sendCommand('Runtime.evaluate', {
    expression: `JSON.stringify({
      approval: document.querySelector('.approval-chip')?.textContent?.trim() ?? null,
      primaryAction: document.querySelector('.primary-action')?.textContent?.trim() ?? null,
      protocolApproval: document.querySelector('.protocol-approval-action')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
      resultPanelPresent: Boolean(document.querySelector('.results-panel')),
      proposalPresent: Boolean(document.querySelector('.proposal')),
      playbackDisabled: document.querySelector('button.play-button')?.disabled ?? null,
      conditionStates: [...document.querySelectorAll('.condition-tabs small')].map((node) => node.textContent?.trim() ?? null),
    })`,
    returnByValue: true,
    awaitPromise: true,
  });
  const value = typeof state?.result?.value === 'string' ? JSON.parse(state.result.value) : null;
  const verified = value?.approval === 'Draft'
    && value?.primaryAction?.includes('Review exact protocol')
    && value?.protocolApproval?.includes('Approve this exact experiment')
    && value?.resultPanelPresent === false
    && value?.proposalPresent === false
    && value?.playbackDisabled === true
    && value?.conditionStates?.length === 5
    && value.conditionStates.every((condition) => condition === 'draft');
  if (!verified) {
    throw new Error(`Editing did not clear approval and downstream results: ${JSON.stringify(value)}`);
  }
  const context = await inspectAgentContext(tools);
  const inspectorVerified = context.agent_status === 'waiting_for_human'
    && context.next_tool === null
    && context.next_action?.kind === 'human_gate'
    && context.human_gate?.status === 'required'
    && context.artifacts?.experiment_id
    && context.artifacts.experiment_id !== previousExperimentId
    && context.artifacts.experiment_approved === false
    && context.artifacts.batch_id === null
    && context.artifacts.analysis_ids?.length === 0
    && context.artifacts.comparison_id === null
    && context.artifacts.evidence_bundle_id === null;
  if (!inspectorVerified) {
    throw new Error(`Inspector did not recover the edited protocol boundary: ${JSON.stringify(context)}`);
  }
  await captureStage('protocol-edit-invalidates-results');
  return {
    ui_cleared: true,
    inspector_status: context.agent_status,
    next_tool: context.next_tool,
    human_gate: context.human_gate.status,
    revised_experiment_id: context.artifacts.experiment_id,
  };
}

async function beginRegisteredToolInvocation(tools, toolName, input) {
  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool?.frameId) throw new Error(`Chrome did not return a frame for ${toolName}.`);
  return sendCommand('WebMCP.invokeTool', {
    frameId: tool.frameId,
    toolName,
    input,
  });
}

async function invokeRegisteredTool(tools, toolName, input) {
  const invocation = await beginRegisteredToolInvocation(tools, toolName, input);
  return waitForEvent(
    'WebMCP.toolResponded',
    (event) => event.invocationId === invocation.invocationId,
  );
}

async function readSimulationCancellationState() {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `JSON.stringify({
      activity: document.querySelector('.activity-row strong')?.textContent?.trim() ?? null,
      primaryAction: document.querySelector('.primary-action')?.textContent?.trim() ?? null,
      resultPanelPresent: Boolean(document.querySelector('.results-panel')),
      playbackDisabled: document.querySelector('button.play-button')?.disabled ?? null,
      conditionStates: [...document.querySelectorAll('.condition-tabs small')].map((node) => node.textContent?.trim() ?? null),
    })`,
    returnByValue: true,
    awaitPromise: true,
  });
  const value = response?.result?.value;
  return typeof value === 'string' ? JSON.parse(value) : null;
}

async function waitForSimulationToStart() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await readSimulationCancellationState();
    if (state?.activity === 'Simulation batch running') return state;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('The simulation action did not visibly enter its running phase.');
}

async function waitForSimulationCancellationToSettle() {
  let state = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    state = await readSimulationCancellationState();
    if (state?.activity === 'Simulation cancelled' || state?.activity === 'Simulation batch complete') {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return state;
}

function hasNoCompletedSimulationBatch(state) {
  return state?.activity === 'Simulation cancelled'
    && state?.primaryAction?.includes('Run MDN-inspired drive')
    && state?.resultPanelPresent === false
    && state?.playbackDisabled === true
    && state?.conditionStates?.length === 5
    && state.conditionStates.every((condition) => condition === 'approved');
}

async function verifyHumanRunningSimulationCancellation(tools, experimentId) {
  const invocation = await beginRegisteredToolInvocation(tools, 'run_fly_simulation', {
    experiment_id: experimentId,
  });
  await waitForSimulationToStart();

  const responsePending = waitForEvent(
    'WebMCP.toolResponded',
    (event) => event.invocationId === invocation.invocationId,
  );
  await clickButton({ text: 'Cancel running simulation' });
  const response = await responsePending;
  const state = await waitForSimulationCancellationToSettle();
  if (response.status === 'Completed' || !hasNoCompletedSimulationBatch(state)) {
    throw new Error(`Human cancellation committed a completed simulation batch: ${JSON.stringify({ response, state })}`);
  }
  if (process.env.FLYLAB_CAPTURE_CANCELLATION === '1') {
    await captureStage('human-cancelled-running-simulation-without-batch');
  }
  return {
    invocation_status: response.status,
    cancellation_phase: 'after_tool_invoked_and_running_before_commit',
    completed_batch_committed: false,
    control: 'visible Cancel running simulation button',
  };
}

async function verifyRunningSimulationCancellation(tools, experimentId) {
  const invocation = await beginRegisteredToolInvocation(tools, 'run_fly_simulation', {
    experiment_id: experimentId,
  });
  await waitForSimulationToStart();
  const responsePending = waitForEvent(
    'WebMCP.toolResponded',
    (event) => event.invocationId === invocation.invocationId,
  );
  await sendCommand('WebMCP.cancelInvocation', { invocationId: invocation.invocationId });
  const response = await responsePending;
  const state = await waitForSimulationCancellationToSettle();
  if (response.status !== 'Canceled' || !hasNoCompletedSimulationBatch(state)) {
    throw new Error(`Cancellation committed a completed simulation batch: ${JSON.stringify({ response, state })}`);
  }
  if (process.env.FLYLAB_CAPTURE_CANCELLATION === '1') {
    await captureStage('webmcp-cancelled-running-simulation-without-batch');
  }
  return {
    invocation_status: response.status,
    cancellation_phase: 'after_tool_invoked_and_running_before_commit',
    completed_batch_committed: false,
    primary_action_after_cancel: state.primaryAction,
    condition_states_after_cancel: state.conditionStates,
  };
}

async function readEvidenceSaveState() {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `JSON.stringify({
      activity: document.querySelector('.activity-row strong')?.textContent?.trim() ?? null,
      ledgerCount: document.querySelector('.topbar .quiet-button span')?.textContent?.trim() ?? null,
      bundleFooter: document.querySelector('.lab-footer > p:nth-child(2)')?.textContent?.trim() ?? null,
      localBundleKeys: Object.keys(localStorage).filter((key) => key.startsWith('flylab:')),
    })`,
    returnByValue: true,
    awaitPromise: true,
  });
  const value = response?.result?.value;
  return typeof value === 'string' ? JSON.parse(value) : null;
}

async function verifyEvidenceSaveCancellation(tools, input) {
  const before = await readEvidenceSaveState();
  const invocation = await beginRegisteredToolInvocation(tools, 'save_fly_evidence', input);
  const responsePending = waitForEvent(
    'WebMCP.toolResponded',
    (event) => event.invocationId === invocation.invocationId,
  );
  let running = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    running = await readEvidenceSaveState();
    if (running?.activity === 'Evidence bundle preparing') break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  if (running?.activity !== 'Evidence bundle preparing') {
    throw new Error(`Evidence save did not expose its cancellable preparation phase: ${JSON.stringify(running)}`);
  }
  await sendCommand('WebMCP.cancelInvocation', { invocationId: invocation.invocationId });
  const response = await responsePending;
  let settled = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    settled = await readEvidenceSaveState();
    if (settled?.activity === 'Evidence save cancelled' || settled?.activity === 'Evidence bundle saved') break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const context = await inspectAgentContext(tools);
  if (response.status !== 'Canceled'
    || settled?.activity !== 'Evidence save cancelled'
    || context.artifacts?.evidence_bundle_id !== null
    || context.artifacts?.comparison_id !== input.comparison_id
    || context.next_tool !== 'save_fly_evidence'
    || JSON.stringify(settled?.localBundleKeys) !== JSON.stringify(before?.localBundleKeys)
    || settled?.ledgerCount !== before?.ledgerCount) {
    throw new Error(`Canceled evidence save committed or regressed lineage: ${JSON.stringify({ response, before, running, settled, context })}`);
  }
  return {
    invocation_status: response.status,
    cancellation_phase: 'visible preparation before manifest commit',
    completed_bundle_committed: false,
    next_tool_after_cancel: context.next_tool,
  };
}

function decodedOutput(response) {
  if (typeof response?.output !== 'string') return response?.output;
  try {
    return JSON.parse(response.output);
  } catch {
    return response.output;
  }
}

function successfulEnvelope(response, toolName) {
  const envelope = decodedOutput(response)?.structuredContent;
  if (response?.status !== 'Completed' || envelope?.ok !== true || envelope?.tool !== toolName) {
    throw new Error(`${toolName} did not complete successfully: ${JSON.stringify(response)}`);
  }
  return envelope;
}

async function inspectAgentContext(tools) {
  const response = await invokeRegisteredTool(tools, 'inspect_flylab_state', {});
  return successfulEnvelope(response, 'inspect_flylab_state').data.agent_context;
}

async function verifyCompletedLineageIdempotency(tools, inputs, savedBundle) {
  const calls = [
    ['find_fly_circuits', inputs.discovery],
    ['draft_fly_hypothesis', { ...inputs.hypothesis, evidence_ids: [...inputs.hypothesis.evidence_ids].reverse() }],
    ['design_stimulation_trial', inputs.design],
    ['run_fly_simulation', inputs.run],
    ['analyze_fly_behavior', { ...inputs.analysis, metrics: [...inputs.analysis.metrics].reverse() }],
    ['compare_fly_trials', inputs.comparison],
    ['save_fly_evidence', inputs.save],
  ];
  const verified = [];
  let repeatedBundle = null;
  for (const [toolName, input] of calls) {
    const response = await invokeRegisteredTool(tools, toolName, input);
    const envelope = successfulEnvelope(response, toolName);
    if (envelope.data?.next_action?.kind !== 'complete') {
      throw new Error(`${toolName} regressed a completed lineage: ${JSON.stringify(envelope.data?.next_action)}`);
    }
    if (toolName === 'design_stimulation_trial' && envelope.data.experiment?.approved !== true) {
      throw new Error(`Idempotent design lost human approval: ${JSON.stringify(envelope.data.experiment)}`);
    }
    if (toolName === 'save_fly_evidence') repeatedBundle = envelope.data.bundle;
    verified.push(toolName);
  }
  const context = await inspectAgentContext(tools);
  if (context.agent_status !== 'complete'
    || context.state?.stage !== 'saved'
    || context.artifacts?.evidence_bundle_id !== savedBundle.id
    || context.artifacts?.analysis_ids?.length !== 1
    || repeatedBundle?.id !== savedBundle.id
    || repeatedBundle?.manifestHash !== savedBundle.manifestHash
    || repeatedBundle?.savedAt !== savedBundle.savedAt) {
    throw new Error(`Idempotent calls changed the completed artifact lineage: ${JSON.stringify({ context, savedBundle, repeatedBundle })}`);
  }
  return {
    calls: verified,
    final_stage: context.state.stage,
    stable_bundle_id: repeatedBundle.id,
    stable_manifest_hash: repeatedBundle.manifestHash,
    stable_saved_at: repeatedBundle.savedAt,
  };
}

async function runFullWorkflow(tools, discoveryResponse, initialContext, options = {}) {
  const cleanCapture = options.cleanDemoCapture === true;
  const discovery = successfulEnvelope(discoveryResponse, 'find_fly_circuits');
  const circuit = discovery.data.circuits[0];
  const evidenceIds = discovery.data.evidence
    .filter((record) => record.provenance === 'measured')
    .slice(0, 4)
    .map((record) => record.id);

  const hypothesisInput = {
    circuit_id: circuit.id,
    claim: 'Activating adult MDNs in the FlyLab model should increase backward displacement relative to baseline and model-sham controls.',
    predicted_behavior: 'backward_walking',
    perturbation: 'activate',
    evidence_ids: evidenceIds,
    falsification_criterion: 'The prediction fails if bilateral activation does not increase backward distance relative to the model-sham condition.',
  };
  const draftedResponse = await invokeRegisteredTool(tools, 'draft_fly_hypothesis', hypothesisInput);
  const drafted = successfulEnvelope(draftedResponse, 'draft_fly_hypothesis');
  await captureStage('hypothesis-drafted');

  const designInput = {
    hypothesis_id: drafted.data.hypothesis.id,
    target_circuit_id: circuit.id,
    perturbation: 'activate',
    laterality: 'bilateral',
    activation_level: cleanCapture ? 0.65 : 0.654321,
    onset_ms: 1000,
    duration_ms: 2000,
    trial_duration_ms: 5000,
    replicates: 8,
    include_baseline: true,
    include_sham_control: true,
    seed: 73142,
  };
  const designedResponse = await invokeRegisteredTool(tools, 'design_stimulation_trial', designInput);
  const designed = successfulEnvelope(designedResponse, 'design_stimulation_trial');
  const experimentId = designed.data.experiment.id;
  const visibleProtocol = await verifyVisibleProtocol(designed.data.experiment);
  const lockedContext = await inspectAgentContext(tools);
  if (lockedContext.agent_status !== 'waiting_for_human'
    || lockedContext.next_tool !== null
    || lockedContext.next_action?.kind !== 'human_gate'
    || lockedContext.human_gate?.status !== 'required') {
    throw new Error(`Inspector did not expose the person-only gate: ${JSON.stringify(lockedContext)}`);
  }

  let preapprovalError = null;
  if (!cleanCapture) {
    const lockedRun = await invokeRegisteredTool(tools, 'run_fly_simulation', {
      experiment_id: experimentId,
    });
    const lockEnvelope = decodedOutput(lockedRun)?.structuredContent;
    if (lockEnvelope?.error?.code !== 'APPROVAL_REQUIRED') {
      throw new Error(`The pre-approval run was not blocked: ${JSON.stringify(lockedRun)}`);
    }
    preapprovalError = lockEnvelope.error.code;
  }
  await captureStage('protocol-locked');

  const approval = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const button = document.querySelector('.protocol-controls .protocol-approval-action');
      const label = button?.textContent?.trim() ?? null;
      button?.click();
      return { clicked: Boolean(button), label };
    })()`,
    returnByValue: true,
  });
  if (approval?.result?.value?.clicked !== true) {
    throw new Error(`The human-only approval control was not available: ${JSON.stringify(approval)}`);
  }
  const approvedContext = await inspectAgentContext(tools);
  if (approvedContext.next_tool !== 'run_fly_simulation'
    || approvedContext.human_gate?.status !== 'satisfied') {
    throw new Error(`Inspector did not expose the approved run transition: ${JSON.stringify(approvedContext)}`);
  }
  await captureStage('human-approved');

  const webmcpCancellation = cleanCapture
    ? { skipped_for_clean_demo_capture: true }
    : await verifyRunningSimulationCancellation(tools, experimentId);
  const humanCancellation = cleanCapture
    ? { skipped_for_clean_demo_capture: true }
    : await verifyHumanRunningSimulationCancellation(tools, experimentId);

  const runResponse = await invokeRegisteredTool(tools, 'run_fly_simulation', {
    experiment_id: experimentId,
  });
  const run = successfulEnvelope(runResponse, 'run_fly_simulation');
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  await captureStage('simulation-replay');
  await captureCircuitPlayback();

  const analysisInput = {
    batch_id: run.data.id,
    metrics: [
      'backward_distance_mm',
      'signed_speed_mm_s',
      'response_latency_ms',
      'heading_change_deg',
      'stance_stability',
    ],
  };
  const analysisResponse = await invokeRegisteredTool(tools, 'analyze_fly_behavior', analysisInput);
  const analysis = successfulEnvelope(analysisResponse, 'analyze_fly_behavior');
  const visibleAnalysis = await verifyVisibleAnalysis(analysis.data.analysis, `condition_${designed.data.experiment.primaryLaterality}`);
  const conditionTabParity = await verifyConditionTabAnalysisParity(analysis.data.analysis, `condition_${designed.data.experiment.primaryLaterality}`);
  const humanBudget = await setHumanProposalBudget(tools, 5);
  await captureStage('behavior-analysis');

  const comparisonInput = {
    analysis_ids: [analysis.data.analysis.id],
    objective_metric: 'backward_distance_mm',
    objective: 'maximize',
  };
  const comparisonResponse = await invokeRegisteredTool(tools, 'compare_fly_trials', comparisonInput);
  const comparison = successfulEnvelope(comparisonResponse, 'compare_fly_trials');
  if (comparison.data.comparison.proposal.replicateBudget !== humanBudget.budget) {
    throw new Error(`Comparison did not honor the human-selected proposal budget: ${JSON.stringify(comparison.data.comparison)}`);
  }
  const visibleComparison = await verifyVisibleComparison(comparison.data.comparison);
  await captureStage('bounded-follow-up');

  const saveInput = {
    title: 'Adult MDN backward-walking verification run',
    hypothesis_id: drafted.data.hypothesis.id,
    experiment_id: experimentId,
    batch_ids: [run.data.id],
    analysis_ids: [analysis.data.analysis.id],
    comparison_id: comparison.data.comparison.id,
    note: 'Automated live WebMCP verification with a DOM click at the human-only approval boundary.',
  };
  const evidenceCancellation = cleanCapture
    ? { skipped_for_clean_demo_capture: true }
    : await verifyEvidenceSaveCancellation(tools, saveInput);
  const saveResponse = await invokeRegisteredTool(tools, 'save_fly_evidence', saveInput);
  const saved = successfulEnvelope(saveResponse, 'save_fly_evidence');
  const completedContext = await inspectAgentContext(tools);
  if (completedContext.agent_status !== 'complete'
    || completedContext.next_tool !== null
    || completedContext.next_action?.kind !== 'complete') {
    throw new Error(`Inspector did not expose workflow completion: ${JSON.stringify(completedContext)}`);
  }
  const idempotency = cleanCapture
    ? { skipped_for_clean_demo_capture: true }
    : await verifyCompletedLineageIdempotency(tools, {
      discovery: { query: 'MDN', behavior: 'backward_walking' },
      hypothesis: hypothesisInput,
      design: designInput,
      run: { experiment_id: experimentId },
      analysis: analysisInput,
      comparison: comparisonInput,
      save: saveInput,
    }, saved.data.bundle);
  await captureStage('evidence-saved');

  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.textContent?.includes('Evidence ledger'));
      button?.click();
      return Boolean(button);
    })()`,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  const visibleBundle = await verifyVisibleBundle(saved.data.bundle);
  await captureStage('evidence-ledger');
  const editInvalidationVerified = await verifyProtocolEditInvalidation(tools, experimentId);

  return {
    sequence: [
      'inspect_flylab_state',
      'find_fly_circuits',
      'draft_fly_hypothesis',
      'design_stimulation_trial',
      'human_approval_dom_click',
      'run_fly_simulation',
      'analyze_fly_behavior',
      'compare_fly_trials',
      'save_fly_evidence',
    ],
    clean_demo_capture: cleanCapture,
    preapproval_error: preapprovalError,
    visible_protocol_verified: Boolean(visibleProtocol),
    visible_analysis_verified: Boolean(visibleAnalysis),
    condition_tab_analysis_parity: conditionTabParity,
    human_proposal_budget: humanBudget,
    visible_comparison_verified: Boolean(visibleComparison),
    visible_bundle_verified: Boolean(visibleBundle),
    inspector: {
      initial_next_tool: initialContext.next_tool,
      blocked_status: lockedContext.agent_status,
      post_approval_next_tool: approvedContext.next_tool,
      final_status: completedContext.agent_status,
    },
    cancellation: {
      commit_boundary: 'prepare -> combined AbortSignal check -> synchronous state commit',
      abort_sources: [
        'execute callback AbortSignal',
        'Chrome 151 toolcancel compatibility event',
        'visible human cancel control',
      ],
      human_control: humanCancellation,
      webmcp_protocol: webmcpCancellation,
      evidence_save: evidenceCancellation,
    },
    completed_lineage_idempotency: idempotency,
    experiment_id: experimentId,
    batch_id: run.data.id,
    analysis_id: analysis.data.analysis.id,
    comparison_id: comparison.data.comparison.id,
    evidence_bundle_id: saved.data.bundle.id,
    manifest_hash: saved.data.bundle.manifestHash,
    follow_up_execution_authorized: comparison.data.execution_authorized,
    protocol_edit_invalidation_verified: editInvalidationVerified,
  };
}

try {
  chrome = spawn(chromePath, [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--enable-features=WebMCPTesting',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    targetUrl,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const browserDebuggerUrl = await waitForDebuggerUrl(chrome.stderr);
  const port = new URL(browserDebuggerUrl).port;
  const page = await fetchTargets(port);
  socket = await connectToPage(page.webSocketDebuggerUrl);
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  let status;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    status = await readRuntimeStatus();
    if (status.status === '8 tools live') break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const toolsAdded = waitForEvent('WebMCP.toolsAdded');
  await sendCommand('WebMCP.enable');
  const registeredTools = await toolsAdded;
  const actualToolNames = registeredTools.tools.map((tool) => tool.name).sort();
  const initialContext = await inspectAgentContext(registeredTools.tools);
  if (initialContext.next_tool !== 'find_fly_circuits'
    || initialContext.agent_status !== 'ready') {
    throw new Error(`Inspector did not expose the initial agent action: ${JSON.stringify(initialContext)}`);
  }
  await captureStage('eight-tools-live');
  const response = await invokeRegisteredTool(
    registeredTools.tools,
    'find_fly_circuits',
    { query: 'MDN', behavior: 'backward_walking' },
  );
  await captureStage('circuit-found');

  const verified = status?.modelContextType === 'object'
    && status?.registerToolType === 'function'
    && status?.status === '8 tools live'
    && status?.originAgentCluster === true
    && JSON.stringify(actualToolNames) === JSON.stringify(expectedToolNames)
    && response.status === 'Completed';

  if (!verified) {
    throw new Error(`WebMCP live verification failed: ${JSON.stringify({ status, actualToolNames, response })}`);
  }

  const workflow = process.env.FLYLAB_VERIFY_WORKFLOW === '1'
    ? await runFullWorkflow(registeredTools.tools, response, initialContext, { cleanDemoCapture })
    : undefined;

  const report = {
    ok: true,
    url: status.location,
    browser_api: 'document.modelContext.registerTool',
    registered_tools: actualToolNames,
    invoked_tools: ['inspect_flylab_state', 'find_fly_circuits'],
    invocation_status: response.status,
    origin_agent_cluster: true,
    browser_user_agent: status.userAgent,
  };
  if (process.env.FLYLAB_VERIFY_VERBOSE === '1') {
    report.invocation_output = response.output;
  }
  if (workflow) report.workflow = workflow;
  if (capturedFrames.length) report.captured_frames = capturedFrames;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (stderrLines.length) console.error(stderrLines.join('\n'));
  throw error;
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => chrome.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  if (basename(profile).startsWith('flylab-webmcp-')) {
    await rm(profile, { recursive: true, force: true });
  }
}
