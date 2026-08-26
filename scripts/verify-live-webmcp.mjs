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
  await clickButton({ text: 'circuit', exact: true });
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
  await clickButton({ text: 'body', exact: true });
}

async function verifyProtocolEditInvalidation() {
  await clickButton({ ariaLabel: 'Close evidence ledger' });
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('input[type="range"][max="1"][step="0.05"]');
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
    && value?.primaryAction?.includes('Approve experiment')
    && value?.resultPanelPresent === false
    && value?.proposalPresent === false
    && value?.playbackDisabled === true
    && value?.conditionStates?.length === 5
    && value.conditionStates.every((condition) => condition === 'draft');
  if (!verified) {
    throw new Error(`Editing did not clear approval and downstream results: ${JSON.stringify(value)}`);
  }
  await captureStage('protocol-edit-invalidates-results');
  return true;
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

async function runFullWorkflow(tools, discoveryResponse, initialContext) {
  const discovery = successfulEnvelope(discoveryResponse, 'find_fly_circuits');
  const circuit = discovery.data.circuits[0];
  const evidenceIds = discovery.data.evidence
    .filter((record) => record.provenance === 'measured')
    .slice(0, 4)
    .map((record) => record.id);

  const draftedResponse = await invokeRegisteredTool(tools, 'draft_fly_hypothesis', {
    circuit_id: circuit.id,
    claim: 'Activating adult MDNs in the FlyLab model should increase backward displacement relative to baseline and model-sham controls.',
    predicted_behavior: 'backward_walking',
    perturbation: 'activate',
    evidence_ids: evidenceIds,
    falsification_criterion: 'The prediction fails if bilateral activation does not increase backward distance relative to the model-sham condition.',
  });
  const drafted = successfulEnvelope(draftedResponse, 'draft_fly_hypothesis');
  await captureStage('hypothesis-drafted');

  const designedResponse = await invokeRegisteredTool(tools, 'design_stimulation_trial', {
    hypothesis_id: drafted.data.hypothesis.id,
    target_circuit_id: circuit.id,
    perturbation: 'activate',
    laterality: 'bilateral',
    activation_level: 0.65,
    onset_ms: 1000,
    duration_ms: 2000,
    trial_duration_ms: 5000,
    replicates: 8,
    include_baseline: true,
    include_sham_control: true,
    seed: 73142,
  });
  const designed = successfulEnvelope(designedResponse, 'design_stimulation_trial');
  const experimentId = designed.data.experiment.id;
  const lockedContext = await inspectAgentContext(tools);
  if (lockedContext.agent_status !== 'waiting_for_human'
    || lockedContext.next_tool !== null
    || lockedContext.next_action?.kind !== 'human_gate'
    || lockedContext.human_gate?.status !== 'required') {
    throw new Error(`Inspector did not expose the person-only gate: ${JSON.stringify(lockedContext)}`);
  }

  const lockedRun = await invokeRegisteredTool(tools, 'run_fly_simulation', {
    experiment_id: experimentId,
  });
  const lockEnvelope = decodedOutput(lockedRun)?.structuredContent;
  if (lockEnvelope?.error?.code !== 'APPROVAL_REQUIRED') {
    throw new Error(`The pre-approval run was not blocked: ${JSON.stringify(lockedRun)}`);
  }
  await captureStage('protocol-locked');

  const approval = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.textContent?.includes('Approve experiment'));
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

  const webmcpCancellation = await verifyRunningSimulationCancellation(tools, experimentId);
  const humanCancellation = await verifyHumanRunningSimulationCancellation(tools, experimentId);

  const runResponse = await invokeRegisteredTool(tools, 'run_fly_simulation', {
    experiment_id: experimentId,
  });
  const run = successfulEnvelope(runResponse, 'run_fly_simulation');
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  await captureStage('simulation-replay');
  await captureCircuitPlayback();

  const analysisResponse = await invokeRegisteredTool(tools, 'analyze_fly_behavior', {
    batch_id: run.data.id,
    metrics: [
      'backward_distance_mm',
      'signed_speed_mm_s',
      'response_latency_ms',
      'heading_change_deg',
      'stance_stability',
    ],
    analysis_start_ms: 0,
    analysis_end_ms: 5000,
  });
  const analysis = successfulEnvelope(analysisResponse, 'analyze_fly_behavior');
  await captureStage('behavior-analysis');

  const comparisonResponse = await invokeRegisteredTool(tools, 'compare_fly_trials', {
    analysis_ids: [analysis.data.analysis.id],
    objective_metric: 'backward_distance_mm',
    objective: 'maximize',
    next_experiment_budget: 5,
  });
  const comparison = successfulEnvelope(comparisonResponse, 'compare_fly_trials');
  await captureStage('bounded-follow-up');

  const saveResponse = await invokeRegisteredTool(tools, 'save_fly_evidence', {
    title: 'Adult MDN backward-walking verification run',
    hypothesis_id: drafted.data.hypothesis.id,
    experiment_id: experimentId,
    batch_ids: [run.data.id],
    analysis_ids: [analysis.data.analysis.id],
    comparison_id: comparison.data.comparison.id,
    note: 'Automated live WebMCP verification with a DOM click at the human-only approval boundary.',
  });
  const saved = successfulEnvelope(saveResponse, 'save_fly_evidence');
  const completedContext = await inspectAgentContext(tools);
  if (completedContext.agent_status !== 'complete'
    || completedContext.next_tool !== null
    || completedContext.next_action?.kind !== 'complete') {
    throw new Error(`Inspector did not expose workflow completion: ${JSON.stringify(completedContext)}`);
  }
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
  await captureStage('evidence-ledger');
  const editInvalidationVerified = await verifyProtocolEditInvalidation();

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
    preapproval_error: lockEnvelope.error.code,
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
    },
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
  await captureStage('eight-tools-live');
  const initialContext = await inspectAgentContext(registeredTools.tools);
  if (initialContext.next_tool !== 'find_fly_circuits'
    || initialContext.agent_status !== 'ready') {
    throw new Error(`Inspector did not expose the initial agent action: ${JSON.stringify(initialContext)}`);
  }
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
    ? await runFullWorkflow(registeredTools.tools, response, initialContext)
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
