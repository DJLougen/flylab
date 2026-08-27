import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const defaultUrl = 'https://flylab-neuroethology.d-lougen.chatgpt.site/';
const competitionHeroPrompt = 'Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.';
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
const workflowToolOrder = [
  'inspect_flylab_state',
  'find_fly_circuits',
  'draft_fly_hypothesis',
  'design_stimulation_trial',
  'run_fly_simulation',
  'analyze_fly_behavior',
  'compare_fly_trials',
  'save_fly_evidence',
];
const expectedDemoFrameNames = [
  'proof-webmcp-tools.png',
  '00-eight-tools-live.png',
  '01-circuit-found.png',
  '02-hypothesis-drafted.png',
  '03-protocol-locked.png',
  '04-operator-approved.png',
  'proof-approval-hash-guard.png',
  '05-simulation-replay.png',
  '06-circuit-bilateral-active.png',
  '07-behavior-analysis.png',
  '08-bounded-follow-up.png',
  '09-evidence-saved.png',
  'proof-idempotent-retry.png',
  '10-protocol-edit-invalidates-results.png',
  'proof-webmcp-invocations.png',
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
const protocolInvocationLog = [];
const captureDirectory = process.env.FLYLAB_CAPTURE_DIR
  ? resolve(process.env.FLYLAB_CAPTURE_DIR)
  : null;
const reportFile = process.env.FLYLAB_REPORT_FILE
  ? resolve(process.env.FLYLAB_REPORT_FILE)
  : null;
const cleanDemoCapture = process.env.FLYLAB_DEMO_CAPTURE === '1';
let validateEvidenceExportSchema = null;

function gitOutput(args) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function captureSourceRevision() {
  const gitCommit = gitOutput(['rev-parse', 'HEAD']);
  const gitTree = gitOutput(['rev-parse', 'HEAD^{tree}']);
  const porcelain = gitOutput(['status', '--porcelain=v1', '--untracked-files=all']);
  return {
    schema_version: 'flylab.source-revision.v1',
    git_available: Boolean(gitCommit && gitTree && porcelain !== null),
    git_commit: gitCommit,
    git_tree: gitTree,
    worktree_clean: porcelain === '',
    worktree_change_count: porcelain === null || porcelain === '' ? 0 : porcelain.split(/\r?\n/).length,
  };
}

async function captureFileEvidence(filepath) {
  const bytes = await readFile(filepath);
  return {
    path: relative(process.cwd(), filepath),
    bytes: bytes.byteLength,
    sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
  };
}

async function fetchServedArtifactEvidence(pageUrl) {
  return Promise.all([
    '/flylab-agent-manifest.json',
    '/flylab-tool-contracts.json',
    '/schemas/flylab-evidence-export-v3.schema.json',
  ].map(async (pathname) => {
    const url = new URL(pathname, pageUrl).href;
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      // The status and content hash below retain enough evidence for a useful failure.
    }
    if (!response.ok || !parsed) {
      throw new Error(`Served release artifact was unavailable or invalid JSON: ${JSON.stringify({ url, status: response.status })}`);
    }
    if (pathname === '/schemas/flylab-evidence-export-v3.schema.json') {
      const ajv = new Ajv2020({ allErrors: true, strict: true });
      addFormats(ajv);
      validateEvidenceExportSchema = ajv.compile(parsed);
    }
    return {
      pathname,
      url,
      status: response.status,
      content_type: response.headers.get('content-type'),
      cache_control: response.headers.get('cache-control'),
      schema_version: parsed.schema_version ?? parsed.schemaVersion ?? null,
      schema_id: parsed.$id ?? null,
      bytes: Buffer.byteLength(body),
      sha256: `sha256:${createHash('sha256').update(body).digest('hex')}`,
    };
  }));
}

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

function waitForRegisteredToolInventory(expectedCount = expectedToolNames.length) {
  return withTimeout(new Promise((resolve) => {
    const toolsByName = new Map();
    let frameId = null;
    const onMessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method !== 'WebMCP.toolsAdded') return;
      frameId = message.params?.frameId ?? frameId;
      for (const tool of message.params?.tools ?? []) {
        toolsByName.set(tool.name, {
          ...tool,
          frameId: tool.frameId ?? message.params?.frameId ?? null,
        });
      }
      if (toolsByName.size < expectedCount) return;
      socket.removeEventListener('message', onMessage);
      resolve({ frameId, tools: [...toolsByName.values()] });
    };
    socket.addEventListener('message', onMessage);
  }), 5_000, `WebMCP inventory of ${expectedCount} tools`);
}

async function readRuntimeStatus() {
  const expression = `(() => {
    const readJson = (selector) => {
      const value = document.querySelector(selector)?.textContent;
      return value ? JSON.parse(value) : null;
    };
    return JSON.stringify({
      modelContextType: typeof document.modelContext,
      registerToolType: typeof document.modelContext?.registerTool,
      status: document.querySelector('.tool-status')?.textContent?.trim() ?? null,
      originAgentCluster: window.originAgentCluster === true,
      location: window.location.href,
      userAgent: navigator.userAgent,
      agentRuntime: readJson('#flylab-agent-runtime'),
      agentHandoff: readJson('#flylab-agent-handoff')
    });
  })()`;
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

async function captureFrame(filename, options = {}) {
  if (!captureDirectory) return;
  if (options.selector) {
    const focus = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const element = document.querySelector(${JSON.stringify(options.selector)});
        element?.scrollIntoView({ behavior: 'instant', block: ${JSON.stringify(options.block ?? 'center')}, inline: 'nearest' });
        if (element) {
          const stickyOffset = (document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0)
            + (document.querySelector('.agent-bridge')?.getBoundingClientRect().height ?? 0)
            + 12;
          window.scrollBy({ top: -stickyOffset, behavior: 'instant' });
        }
        return Boolean(element);
      })()`,
      returnByValue: true,
    });
    if (focus?.result?.value !== true) {
      throw new Error(`Capture target was unavailable: ${JSON.stringify({ filename, selector: options.selector })}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  await mkdir(captureDirectory, { recursive: true });
  const screenshot = await sendCommand('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const filepath = join(captureDirectory, filename);
  await writeFile(filepath, Buffer.from(screenshot.data, 'base64'));
  capturedFrames.push(filepath);
}

async function captureStage(label, options = {}) {
  if (!captureDirectory) return;
  const safeLabel = label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const filename = `${String(captureIndex).padStart(2, '0')}-${safeLabel}.png`;
  captureIndex += 1;
  await captureFrame(filename, options);
}

async function captureRuntimeDiagnosticProof(filename, {
  requireInvocation = false,
  tools,
  phase = 'registration',
  workflow = null,
} = {}) {
  if (!captureDirectory) return;
  const actualToolNames = tools?.map((tool) => tool.name).sort() ?? [];
  const runtime = await readRuntimeStatus();
  const liveContext = await inspectAgentContext(tools);
  if (JSON.stringify(actualToolNames) !== JSON.stringify(expectedToolNames)
    || runtime?.agentRuntime?.registered_tool_count !== expectedToolNames.length
    || runtime?.agentRuntime?.page_registration_status !== 'registered'
    || (requireInvocation && runtime?.agentRuntime?.webmcp_invocation_observed !== true)) {
    throw new Error(`Runtime diagnostic was not proof-ready: ${JSON.stringify({ filename, actualToolNames, runtime: runtime?.agentRuntime })}`);
  }

  const toolRows = (phase === 'workflow_complete' ? workflowToolOrder : actualToolNames).map((toolName) => {
    const responses = protocolInvocationLog.filter((record) => record.tool_name === toolName);
    const completed = responses.filter((record) => record.status === 'Completed').length;
    const nonCompleted = responses.length - completed;
    return {
      name: toolName,
      status: phase === 'workflow_complete' ? completed > 0 ? 'Completed' : 'Missing' : 'Registered',
      response_count: responses.length,
      non_completed_guards: nonCompleted,
    };
  });
  if (phase === 'workflow_complete' && toolRows.some((row) => row.status !== 'Completed')) {
    throw new Error(`Final protocol proof did not observe a completed response for every tool: ${JSON.stringify(toolRows)}`);
  }

  const proof = {
    title: 'Automated Chrome protocol evidence',
    boundary: 'Generated from the flag-enabled Chrome WebMCP protocol events and live FlyLab inspector state. This is an automated protocol evidence view, not a DevTools screenshot.',
    phase,
    registered_count: runtime.agentRuntime.registered_tool_count,
    declared_count: expectedToolNames.length,
    page_session_id: runtime.agentRuntime.page_session_id,
    live_revision: liveContext.state.revision,
    live_stage: liveContext.state.stage,
    live_agent_status: liveContext.agent_status,
    invocation_observed: runtime.agentRuntime.webmcp_invocation_observed,
    tools: toolRows,
    completed_result: workflow ? {
      result: 'Completed',
      stage: workflow.completed_stage,
      revision: workflow.completed_state_revision,
      bundle_id: workflow.evidence_bundle_id,
      selected_circuit_id: workflow.selected_circuit_id,
      total_seeded_runs: workflow.total_seeded_runs,
    } : null,
  };
  const installed = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const proof = ${JSON.stringify(proof)};
      document.querySelector('#flylab-automated-protocol-evidence')?.remove();
      const root = document.createElement('section');
      root.id = 'flylab-automated-protocol-evidence';
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', proof.title);
      const style = document.createElement('style');
      style.textContent = \`
        #flylab-automated-protocol-evidence { position: fixed; inset: 0; z-index: 2147483647; box-sizing: border-box; padding: 28px; background: #061113; color: #eef8f5; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; }
        #flylab-automated-protocol-evidence * { box-sizing: border-box; }
        #flylab-automated-protocol-evidence .proof-shell { height: 100%; border: 1px solid #2b5757; border-radius: 18px; background: radial-gradient(circle at 86% 6%, rgba(94, 234, 212, .1), transparent 28%), #0a181b; padding: 30px 34px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 24px 90px rgba(0,0,0,.45); }
        #flylab-automated-protocol-evidence .proof-kicker { color: #65ead4; font: 700 13px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; }
        #flylab-automated-protocol-evidence h1 { margin: 5px 0 8px; font-size: 34px; line-height: 1.05; letter-spacing: -.03em; }
        #flylab-automated-protocol-evidence .proof-boundary { margin: 0; max-width: 1120px; color: #a8c0bd; font-size: 15px; line-height: 1.45; }
        #flylab-automated-protocol-evidence .proof-facts { display: grid; grid-template-columns: 1.15fr .75fr .7fr .8fr 1fr; gap: 10px; }
        #flylab-automated-protocol-evidence .proof-fact { min-height: 72px; border: 1px solid #244447; border-radius: 10px; padding: 12px 14px; background: #0d2225; }
        #flylab-automated-protocol-evidence .proof-fact span { display: block; color: #779490; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        #flylab-automated-protocol-evidence .proof-fact strong { display: block; margin-top: 7px; color: #f4fbf9; font: 700 15px/1.25 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
        #flylab-automated-protocol-evidence .proof-section-title { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
        #flylab-automated-protocol-evidence .proof-section-title h2 { margin: 0; font-size: 18px; }
        #flylab-automated-protocol-evidence .proof-section-title p { margin: 0; color: #8da6a2; font-size: 12px; }
        #flylab-automated-protocol-evidence .proof-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 12px; }
        #flylab-automated-protocol-evidence .proof-tool { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 16px; min-height: 57px; border: 1px solid #244447; border-radius: 10px; padding: 10px 14px; background: #0b1e21; }
        #flylab-automated-protocol-evidence .proof-tool code { color: #e4f2ef; font: 700 16px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
        #flylab-automated-protocol-evidence .proof-tool b { color: #66ead4; font: 800 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .07em; text-transform: uppercase; }
        #flylab-automated-protocol-evidence .proof-tool small { grid-column: 1 / -1; color: #779490; font-size: 11px; }
        #flylab-automated-protocol-evidence .proof-result { display: grid; grid-template-columns: .7fr .7fr .8fr 1.8fr 1fr .8fr; gap: 9px; padding: 13px; border: 1px solid #7658a8; border-radius: 12px; background: rgba(113, 78, 165, .13); }
        #flylab-automated-protocol-evidence .proof-result div span { display: block; color: #a899bd; font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
        #flylab-automated-protocol-evidence .proof-result div strong { display: block; margin-top: 5px; color: #f2eafe; font: 700 13px/1.25 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
        #flylab-automated-protocol-evidence .proof-footer { margin-top: auto; display: flex; justify-content: space-between; gap: 20px; border-top: 1px solid #244447; padding-top: 13px; color: #86a19d; font-size: 12px; }
        #flylab-automated-protocol-evidence .proof-footer strong { color: #65ead4; }
      \`;
      root.append(style);
      const shell = document.createElement('div');
      shell.className = 'proof-shell';
      root.append(shell);
      const add = (parent, tag, text, className) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = String(text);
        parent.append(node);
        return node;
      };
      const head = document.createElement('header');
      shell.append(head);
      add(head, 'div', proof.phase === 'workflow_complete' ? 'Final native invocation proof' : 'Native registration proof', 'proof-kicker');
      add(head, 'h1', proof.title);
      add(head, 'p', proof.boundary, 'proof-boundary');
      const facts = document.createElement('div');
      facts.className = 'proof-facts';
      shell.append(facts);
      [
        ['Page session', proof.page_session_id],
        ['Registered', String(proof.registered_count) + '/' + String(proof.declared_count)],
        ['Live revision', 'r' + String(proof.live_revision)],
        ['Live stage', proof.live_stage],
        ['Invocation observed', proof.invocation_observed ? 'yes' : 'no'],
      ].forEach(([label, value]) => {
        const card = document.createElement('div');
        card.className = 'proof-fact';
        add(card, 'span', label);
        add(card, 'strong', value);
        facts.append(card);
      });
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'proof-section-title';
      add(sectionTitle, 'h2', proof.phase === 'workflow_complete' ? 'Observed completed WebMCP sequence' : 'Exact WebMCP.toolsAdded inventory');
      add(sectionTitle, 'p', proof.phase === 'workflow_complete' ? 'Statuses summarize actual WebMCP.toolResponded protocol events.' : 'Names come directly from the WebMCP.toolsAdded event.');
      shell.append(sectionTitle);
      const tools = document.createElement('div');
      tools.className = 'proof-tools';
      shell.append(tools);
      proof.tools.forEach((tool) => {
        const card = document.createElement('div');
        card.className = 'proof-tool';
        add(card, 'code', tool.name);
        add(card, 'b', tool.status);
        const detail = proof.phase === 'workflow_complete'
          ? String(tool.response_count) + ' protocol response' + (tool.response_count === 1 ? '' : 's')
            + (tool.non_completed_guards
              ? ' · ' + String(tool.non_completed_guards) + ' expected guard/error response' + (tool.non_completed_guards === 1 ? '' : 's')
              : '')
          : 'Page registration accepted in this Chrome session';
        add(card, 'small', detail);
        tools.append(card);
      });
      if (proof.completed_result) {
        const result = document.createElement('div');
        result.className = 'proof-result';
        [
          ['Workflow result', proof.completed_result.result],
          ['Completed stage', proof.completed_result.stage],
          ['Completed revision', 'r' + String(proof.completed_result.revision)],
          ['Mission bundle', proof.completed_result.bundle_id],
          ['Selected circuit', proof.completed_result.selected_circuit_id],
          ['Seeded runs', proof.completed_result.total_seeded_runs],
        ].forEach(([label, value]) => {
          const cell = document.createElement('div');
          add(cell, 'span', label);
          add(cell, 'strong', value);
          result.append(cell);
        });
        shell.append(result);
      }
      const footer = document.createElement('footer');
      footer.className = 'proof-footer';
      add(footer, 'span', 'Live inspector after capture workflow: ' + proof.live_agent_status + ' · ' + proof.live_stage + ' · r' + String(proof.live_revision));
      add(footer, 'strong', 'Automated flag-enabled Chrome protocol evidence · not DevTools');
      shell.append(footer);
      document.body.append(root);
      const rect = root.getBoundingClientRect();
      return {
        title: root.querySelector('h1')?.textContent ?? null,
        tool_names: [...root.querySelectorAll('.proof-tool code')].map((node) => node.textContent),
        fully_visible: rect.top === 0 && rect.left === 0 && rect.width === window.innerWidth && rect.height === window.innerHeight,
      };
    })()`,
    returnByValue: true,
  });
  const panelState = installed?.result?.value;
  if (panelState?.title !== proof.title
    || panelState?.fully_visible !== true
    || JSON.stringify(panelState.tool_names) !== JSON.stringify(toolRows.map((row) => row.name))) {
    throw new Error(`Automated Chrome protocol evidence panel was not capture-ready: ${JSON.stringify(panelState)}`);
  }
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await captureFrame(filename);
  } finally {
    await sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#flylab-automated-protocol-evidence')?.remove()`,
      returnByValue: true,
    });
  }
}

async function captureIntegrityProof(filename, {
  tools,
  kicker,
  title,
  boundary,
  facts,
  checks,
}) {
  if (!captureDirectory) return;
  const runtime = await readRuntimeStatus();
  const context = await inspectAgentContext(tools);
  if (runtime?.agentRuntime?.registered_tool_count !== expectedToolNames.length
    || runtime?.agentRuntime?.webmcp_invocation_observed !== true
    || !Array.isArray(facts)
    || !facts.length
    || !Array.isArray(checks)
    || !checks.length
    || checks.some((check) => check.pass !== true)) {
    throw new Error(`Integrity proof was not capture-ready: ${JSON.stringify({ filename, runtime: runtime?.agentRuntime, facts, checks })}`);
  }
  const proof = {
    kicker,
    title,
    boundary,
    facts,
    checks,
    page_session_id: runtime.agentRuntime.page_session_id,
    live_revision: context.state.revision,
    live_stage: context.state.stage,
  };
  const installed = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const proof = ${JSON.stringify(proof)};
      document.querySelector('#flylab-automated-integrity-evidence')?.remove();
      const root = document.createElement('section');
      root.id = 'flylab-automated-integrity-evidence';
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', proof.title);
      const style = document.createElement('style');
      style.textContent = \`
        #flylab-automated-integrity-evidence { position: fixed; inset: 0; z-index: 2147483647; box-sizing: border-box; padding: 28px; background: #061113; color: #eef8f5; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; }
        #flylab-automated-integrity-evidence * { box-sizing: border-box; }
        #flylab-automated-integrity-evidence .proof-shell { height: 100%; border: 1px solid #2b5757; border-radius: 18px; background: radial-gradient(circle at 86% 6%, rgba(94,234,212,.1), transparent 28%), #0a181b; padding: 30px 34px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 24px 90px rgba(0,0,0,.45); }
        #flylab-automated-integrity-evidence .proof-kicker { color: #65ead4; font: 700 13px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; }
        #flylab-automated-integrity-evidence h1 { margin: 5px 0 8px; font-size: 38px; line-height: 1.05; letter-spacing: -.03em; }
        #flylab-automated-integrity-evidence .proof-boundary { margin: 0; max-width: 1160px; color: #a8c0bd; font-size: 15px; line-height: 1.45; }
        #flylab-automated-integrity-evidence .proof-facts { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; }
        #flylab-automated-integrity-evidence .proof-fact { min-height: 80px; border: 1px solid #244447; border-radius: 10px; padding: 12px 14px; background: #0d2225; }
        #flylab-automated-integrity-evidence .proof-fact span { display: block; color: #779490; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        #flylab-automated-integrity-evidence .proof-fact strong { display: block; margin-top: 7px; color: #f4fbf9; font: 700 14px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
        #flylab-automated-integrity-evidence .proof-checks { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
        #flylab-automated-integrity-evidence .proof-check { min-height: 92px; border: 1px solid #2b5757; border-radius: 12px; padding: 15px 17px; background: #0b1e21; }
        #flylab-automated-integrity-evidence .proof-check b { color: #65ead4; font: 800 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; }
        #flylab-automated-integrity-evidence .proof-check h2 { margin: 7px 0 5px; font-size: 18px; }
        #flylab-automated-integrity-evidence .proof-check p { margin: 0; color: #91aaa6; font-size: 13px; line-height: 1.4; }
        #flylab-automated-integrity-evidence .proof-footer { margin-top: auto; display: flex; justify-content: space-between; gap: 20px; border-top: 1px solid #244447; padding-top: 13px; color: #86a19d; font-size: 12px; }
        #flylab-automated-integrity-evidence .proof-footer strong { color: #65ead4; }
      \`;
      root.append(style);
      const shell = document.createElement('div');
      shell.className = 'proof-shell';
      root.append(shell);
      const add = (parent, tag, text, className) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = String(text);
        parent.append(node);
        return node;
      };
      const head = document.createElement('header');
      shell.append(head);
      add(head, 'div', proof.kicker, 'proof-kicker');
      add(head, 'h1', proof.title);
      add(head, 'p', proof.boundary, 'proof-boundary');
      const factGrid = document.createElement('div');
      factGrid.className = 'proof-facts';
      shell.append(factGrid);
      proof.facts.forEach((fact) => {
        const card = document.createElement('div');
        card.className = 'proof-fact';
        add(card, 'span', fact.label);
        add(card, 'strong', fact.value);
        factGrid.append(card);
      });
      const checkGrid = document.createElement('div');
      checkGrid.className = 'proof-checks';
      shell.append(checkGrid);
      proof.checks.forEach((check) => {
        const card = document.createElement('div');
        card.className = 'proof-check';
        add(card, 'b', 'verified');
        add(card, 'h2', check.label);
        add(card, 'p', check.detail);
        checkGrid.append(card);
      });
      const footer = document.createElement('footer');
      footer.className = 'proof-footer';
      add(footer, 'span', 'Live page: ' + proof.page_session_id + ' · ' + proof.live_stage + ' · r' + String(proof.live_revision));
      add(footer, 'strong', 'Automated WebMCP client evidence · not a ChatGPT agent transcript · not DevTools');
      shell.append(footer);
      document.body.append(root);
      const rect = root.getBoundingClientRect();
      return {
        title: root.querySelector('h1')?.textContent ?? null,
        fact_count: root.querySelectorAll('.proof-fact').length,
        check_count: root.querySelectorAll('.proof-check').length,
        fully_visible: rect.top === 0 && rect.left === 0 && rect.width === window.innerWidth && rect.height === window.innerHeight,
      };
    })()`,
    returnByValue: true,
  });
  const state = installed?.result?.value;
  if (state?.title !== title
    || state?.fact_count !== facts.length
    || state?.check_count !== checks.length
    || state?.fully_visible !== true) {
    throw new Error(`Integrity proof panel was not fully visible: ${JSON.stringify(state)}`);
  }
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await captureFrame(filename);
  } finally {
    await sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#flylab-automated-integrity-evidence')?.remove()`,
      returnByValue: true,
    });
  }
}

async function captureCircuitEvidence(expectedSelection = 'MDN activation and backward locomotion') {
  if (!captureDirectory) return;
  await clickButton({ text: 'Evidence ledger' });
  await new Promise((resolve) => setTimeout(resolve, 160));
  await clickButton({ text: expectedSelection });
  await new Promise((resolve) => setTimeout(resolve, 80));
  await prepareEvidenceModalCapture({
    expectedSelection,
    navPosition: 'start',
  });
  await captureStage('circuit-found');
  await clickButton({ ariaLabel: 'Close evidence ledger' });
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

async function prepareEvidenceModalCapture({ expectedSelection, navPosition = 'start' } = {}) {
  const resetAndInspect = () => sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.querySelector('.evidence-modal');
      const nav = modal?.querySelector('nav');
      const detail = modal?.querySelector('.evidence-detail');
      const grid = modal?.querySelector('.evidence-modal-grid');
      const backdrop = modal?.closest('.modal-backdrop');
      if (!(modal instanceof HTMLElement) || !(nav instanceof HTMLElement) || !(detail instanceof HTMLElement)) {
        return { ready: false, reason: 'modal, navigation, or detail pane missing' };
      }
      modal.style.overflowAnchor = 'none';
      nav.style.overflowAnchor = 'none';
      detail.style.overflowAnchor = 'none';
      if (backdrop instanceof HTMLElement) backdrop.scrollTop = 0;
      modal.scrollTop = 0;
      if (grid instanceof HTMLElement) grid.scrollTop = 0;
      nav.scrollTop = ${JSON.stringify(navPosition)} === 'end'
        ? Math.max(0, nav.scrollHeight - nav.clientHeight)
        : 0;
      detail.scrollTop = 0;
      const rect = modal.getBoundingClientRect();
      const header = modal.querySelector(':scope > header');
      const headerRect = header?.getBoundingClientRect();
      const headingRect = header?.querySelector('h2')?.getBoundingClientRect();
      const closeRect = header?.querySelector('button')?.getBoundingClientRect();
      return {
        ready: true,
        fullyVisible: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth,
        headerFullyVisible: Boolean(headerRect && headerRect.top >= rect.top && headerRect.bottom <= rect.bottom),
        headerContentFullyVisible: Boolean(
          headerRect
          && headingRect
          && closeRect
          && headingRect.top >= headerRect.top
          && headingRect.bottom <= headerRect.bottom
          && closeRect.top >= headerRect.top
          && closeRect.bottom <= headerRect.bottom
        ),
        header: header?.querySelector('h2')?.textContent?.trim() ?? null,
        selection: nav.querySelector('button[aria-current="true"] strong')?.textContent?.trim() ?? null,
        modalScrollTop: modal.scrollTop,
        gridScrollTop: grid instanceof HTMLElement ? grid.scrollTop : null,
        navScrollTop: nav.scrollTop,
        detailScrollTop: detail.scrollTop,
      };
    })()`,
    returnByValue: true,
  });
  await resetAndInspect();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const response = await resetAndInspect();
  const state = response?.result?.value;
  if (state?.ready !== true
    || state?.fullyVisible !== true
    || state?.headerFullyVisible !== true
    || state?.headerContentFullyVisible !== true
    || state?.header !== 'Every claim keeps its boundary'
    || state?.modalScrollTop !== 0
    || (state?.gridScrollTop !== null && state?.gridScrollTop !== 0)
    || state?.detailScrollTop !== 0
    || (expectedSelection && !state?.selection?.includes(expectedSelection))) {
    throw new Error(`Evidence modal was not capture-ready: ${JSON.stringify({ expectedSelection, navPosition, state })}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 40));
  return state;
}

async function waitForViewer(expectedLabel = 'BANC v888 reconstructions') {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('.viewer-load.ready')?.textContent?.trim() ?? null`,
      returnByValue: true,
    });
    if (response?.result?.value === expectedLabel) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`The Three.js circuit viewer did not reach ${expectedLabel}.`);
}

async function selectCondition(conditionId) {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const conditionId = ${JSON.stringify(conditionId)};
      const button = [...document.querySelectorAll('.condition-tabs button')]
        .find((candidate) => candidate.querySelector('span')?.textContent?.trim()
          && candidate.getAttribute('aria-pressed') !== null
          && candidate.textContent?.includes(conditionId === 'condition_bilateral' ? 'Bilateral' : conditionId));
      if (!button && conditionId === 'condition_bilateral') {
        const fallback = [...document.querySelectorAll('.condition-tabs button')].at(-1);
        fallback?.click();
        return { clicked: Boolean(fallback), label: fallback?.querySelector('span')?.textContent?.trim() ?? null };
      }
      button?.click();
      return { clicked: Boolean(button), label: button?.querySelector('span')?.textContent?.trim() ?? null };
    })()`,
    returnByValue: true,
  });
  if (response?.result?.value?.clicked !== true) {
    throw new Error(`Condition ${conditionId} was not available for capture: ${JSON.stringify(response)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 80));
  return response.result.value;
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
  await captureStage('circuit-bilateral-active', { selector: '.main-stage', block: 'start' });
  await clickButton({ ariaLabel: 'Pause replay' });

  await clickButton({ text: 'Left-only MDN model drive' });
  await clickButton({ ariaLabel: 'Restart replay' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await clickButton({ ariaLabel: 'Play replay' });
  await new Promise((resolve) => setTimeout(resolve, 1_250));
  await captureStage('circuit-left-active', { selector: '.main-stage', block: 'start' });
  await clickButton({ ariaLabel: 'Pause replay' });
  await clickButton({ text: 'Bilateral MDN model drive' });
  await clickButton({ text: '3D fly', exact: true });
}

async function captureGfCircuitPlayback() {
  if (!captureDirectory) return;
  await selectCondition('condition_bilateral');
  await clickButton({ text: '3D brain', exact: true });
  await waitForViewer('GF literature schematic · no bundled reconstruction');
  await clickButton({ text: 'whole', exact: true });
  await clickButton({ ariaLabel: 'Restart replay' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await clickButton({ ariaLabel: 'Play replay' });
  await new Promise((resolve) => setTimeout(resolve, 900));
  await captureStage('circuit-bilateral-active', { selector: '.main-stage', block: 'start' });
  await clickButton({ ariaLabel: 'Pause replay' });
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
    left: (experiment.onsetMs / experiment.trialDurationMs) * 100,
    width: (experiment.durationMs / experiment.trialDurationMs) * 100,
  };
  const visibleStimulus = {
    left: Number.parseFloat(visible?.stimulus_window?.left ?? ''),
    width: Number.parseFloat(visible?.stimulus_window?.width ?? ''),
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
    || !Number.isFinite(visibleStimulus.left)
    || !Number.isFinite(visibleStimulus.width)
    || Math.abs(visibleStimulus.left - expectedStimulus.left) > 0.001
    || Math.abs(visibleStimulus.width - expectedStimulus.width) > 0.001) {
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
  const expectedLabels = [
    'Response initiation',
    ...Object.values(analysis.metricDefinitions ?? {}).map((definition) => definition.label),
  ];
  const initiationCard = visible?.cards?.find((card) => card.label === 'Response initiation');
  const responseCard = visible?.cards?.find((card) => card.label === 'Response latency');
  const headingCard = visible?.cards?.find((card) => card.label === 'Heading change');
  const roundedHeading = typeof primary?.headingChangeDeg === 'number'
    ? Math.round(primary.headingChangeDeg * 100) / 100
    : null;
  if (!primary
    || visible?.title !== primary.label
    || visible?.cards?.length !== expectedLabels.length
    || !expectedLabels.every((label) => visible.cards.some((card) => card.label === label))
    || initiationCard?.value !== `${Math.round(primary.responseInitiationProbability * 100)}%`
    || !initiationCard?.detail?.includes(`${primary.responsiveN}/${primary.n}`)
    || !initiationCard?.detail?.includes(`${primary.thresholdCrossedN}/${primary.n} crossed`)
    || !initiationCard?.detail?.includes(`${primary.censoredN} censored`)
    || (headingCard && headingCard.value !== `${roundedHeading} °`)
    || (primary.responseLatencyMs === null && responseCard?.value !== 'n/a')) {
    throw new Error(`Visible analysis did not match the returned primary condition: ${JSON.stringify({ visible, primary })}`);
  }
  return visible;
}

async function verifyVisibleSelectedRunReplay(batch, conditionId) {
  const condition = batch.conditionRuns.find((item) => item.conditionId === conditionId);
  const run = condition?.replicates.find((item) => item.responseInitiated)
    ?? condition?.replicates[0];
  if (!condition || !run) throw new Error(`No seeded run was available for ${conditionId}.`);
  await selectCondition(conditionId);
  const clicked = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const runId = ${JSON.stringify(run.id)};
      const row = [...document.querySelectorAll('.per-run-table-wrap tbody tr')]
        .find((candidate) => candidate.querySelector('code')?.textContent?.trim() === runId);
      const button = row?.querySelector('.run-replay-action');
      button?.click();
      return Boolean(button);
    })()`,
    returnByValue: true,
  });
  if (clicked?.result?.value !== true) throw new Error(`Could not select exact seeded run ${run.id}.`);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const response = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const selected = document.querySelector('.per-run-table-wrap tbody tr[data-selected-replicate="true"]');
      return {
        selected_codes: [...selected?.querySelectorAll('code') ?? []].map((node) => node.textContent?.trim() ?? ''),
        selected_text: selected?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
        arena: document.querySelector('.arena-data')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
        fly_aria: document.querySelector('.fly-3d-agent')?.getAttribute('aria-label') ?? null,
      };
    })()`,
    returnByValue: true,
  });
  const visible = response?.result?.value;
  if (!visible?.selected_codes?.includes(run.id)
    || !visible.selected_codes.includes(run.trajectoryId)
    || !visible.selected_text?.includes(`seed ${run.trajectorySeed}`)
    || !visible.arena?.includes(`seed ${run.seed}`)
    || !visible.fly_aria?.includes(`run ${run.id}`)
    || !visible.fly_aria?.includes('selected seeded simulation trace')) {
    throw new Error(`Visible Three.js replay did not bind to exact run ${run.id}: ${JSON.stringify(visible)}`);
  }
  return {
    run_id: run.id,
    seed: run.seed,
    trajectory_id: run.trajectoryId,
    trajectory_seed: run.trajectorySeed,
  };
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
  if (response?.result?.value !== true) throw new Error('The visible operator proposal-budget control was unavailable.');
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
    || !bundle.methodEvidenceIds.every((id) => metadata['Model-method evidence']?.includes(id))
    || !bundle.methodSourceIds.every((id) => metadata['Model-method sources']?.includes(id))
    || !bundle.catalogSourceIds.every((id) => metadata['Dataset catalog sources']?.includes(id))
    || !expectedCounts.every((value) => metadata['Provenance counts']?.includes(value))) {
    throw new Error(`Visible evidence lineage did not match the saved bundle: ${JSON.stringify({ metadata, bundle })}`);
  }
  return metadata;
}

async function verifyProtocolEditInvalidation(tools, previousExperimentId, expectedConditionCount = 5, staleOperations = null) {
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
      manualAction: document.querySelector('.manual-action')?.textContent?.trim() ?? null,
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
    && value?.manualAction?.includes('Review exact protocol')
    && value?.protocolApproval?.includes('Approve this exact experiment')
    && value?.resultPanelPresent === false
    && value?.proposalPresent === false
    && value?.playbackDisabled === true
    && value?.conditionStates?.length === expectedConditionCount
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
    && context.artifact_manifest?.approval === null
    && context.next_action?.input_refs?.approved_protocol_hash === undefined
    && context.artifacts.batch_id === null
    && context.artifacts.analysis_ids?.length === 0
    && context.artifacts.comparison_id === null
    && context.artifacts.evidence_bundle_id === null;
  if (!inspectorVerified) {
    throw new Error(`Inspector did not recover the edited protocol boundary: ${JSON.stringify(context)}`);
  }
  let staleOperationReplayGuard = null;
  if (staleOperations) {
    const rejectedRun = failedEnvelope(
      await invokeRegisteredTool(tools, 'run_fly_simulation', staleOperations.run),
      'run_fly_simulation',
      'INVALID_INPUT',
      'run_fly_simulation',
    );
    const rejectedSave = failedEnvelope(
      await invokeRegisteredTool(tools, 'save_fly_evidence', staleOperations.save),
      'save_fly_evidence',
      'INVALID_INPUT',
      'save_fly_evidence',
    );
    const afterRejectedReplays = await inspectAgentContext(tools);
    if (rejectedRun.error.details?.lineage_status !== 'invalidated_or_replaced'
      || rejectedSave.error.details?.lineage_status !== 'invalidated_or_replaced'
      || rejectedRun.state_revision !== context.state.revision
      || rejectedSave.state_revision !== context.state.revision
      || afterRejectedReplays.state.revision !== context.state.revision
      || afterRejectedReplays.artifacts.batch_id !== null
      || afterRejectedReplays.artifacts.evidence_bundle_id !== null) {
      throw new Error(`Invalidated operation IDs revived or changed cleared lineage: ${JSON.stringify({ rejectedRun, rejectedSave, context, afterRejectedReplays })}`);
    }
    staleOperationReplayGuard = {
      run_error: rejectedRun.error.code,
      save_error: rejectedSave.error.code,
      lineage_status: rejectedRun.error.details.lineage_status,
      state_revision: context.state.revision,
      state_unchanged: true,
    };
  }
  await captureStage('protocol-edit-invalidates-results', { selector: '.protocol-controls', block: 'start' });
  return {
    ui_cleared: true,
    inspector_status: context.agent_status,
    next_tool: context.next_tool,
    human_gate: context.human_gate.status,
    revised_experiment_id: context.artifacts.experiment_id,
    stale_operation_replay_guard: staleOperationReplayGuard,
  };
}

async function beginRegisteredToolInvocationRaw(tools, toolName, input) {
  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool?.frameId) {
    throw new Error(`Chrome did not return a frame for ${toolName}: ${JSON.stringify({
      available_tools: tools.map((candidate) => ({ name: candidate.name, frameId: candidate.frameId ?? null })),
    })}`);
  }
  return sendCommand('WebMCP.invokeTool', {
    frameId: tool.frameId,
    toolName,
    input,
  });
}

async function normalizeRegisteredTools(toolsAdded) {
  const frameTree = await sendCommand('Page.getFrameTree');
  const topFrameId = frameTree?.frameTree?.frame?.id ?? null;
  const eventFrameId = toolsAdded?.frameId ?? null;
  const tools = Array.isArray(toolsAdded?.tools)
    ? toolsAdded.tools.map((tool) => ({
        ...tool,
        frameId: tool.frameId ?? eventFrameId ?? topFrameId,
      }))
    : [];
  if (!topFrameId || tools.length === 0 || tools.some((tool) => !tool.frameId)) {
    throw new Error(`Chrome did not publish an invocable WebMCP inventory: ${JSON.stringify({ topFrameId, eventFrameId, tools })}`);
  }
  return { ...toolsAdded, frameId: eventFrameId ?? topFrameId, tools };
}

async function waitForRegisteredToolResponse(toolName, invocation) {
  const response = await waitForEvent(
    'WebMCP.toolResponded',
    (event) => event.invocationId === invocation.invocationId,
  );
  protocolInvocationLog.push({
    tool_name: toolName,
    status: response.status ?? 'Unknown',
    invocation_id: invocation.invocationId,
  });
  return response;
}

async function invokeRegisteredToolRaw(tools, toolName, input) {
  const invocation = await beginRegisteredToolInvocationRaw(tools, toolName, input);
  return waitForRegisteredToolResponse(toolName, invocation);
}

const mutationToolNames = new Set(expectedToolNames.filter((name) => name !== 'inspect_flylab_state'));
let generatedOperationId = 0;

async function prepareRegisteredToolInput(tools, toolName, input) {
  if (!mutationToolNames.has(toolName)) return input;
  const inspectionResponse = await invokeRegisteredToolRaw(tools, 'inspect_flylab_state', {});
  const inspection = successfulEnvelope(inspectionResponse, 'inspect_flylab_state');
  const pageSessionId = inspection.data?.page_session_id;
  if (typeof pageSessionId !== 'string' || !pageSessionId || !Number.isInteger(inspection.state_revision)) {
    throw new Error(`Inspector did not return mutation preconditions: ${JSON.stringify(inspection)}`);
  }
  const operationInput = (toolName === 'run_fly_simulation' || toolName === 'save_fly_evidence')
    ? { operation_id: input.operation_id ?? `verify_${toolName}_${++generatedOperationId}` }
    : {};
  const approvedProtocolHash = inspection.data?.agent_context?.next_action?.input_refs?.approved_protocol_hash;
  const approvalInput = toolName === 'run_fly_simulation'
    && input.approved_protocol_hash === undefined
    && typeof approvedProtocolHash === 'string'
    && approvedProtocolHash.startsWith('sha256:')
    ? { approved_protocol_hash: approvedProtocolHash }
    : {};
  return {
    ...input,
    page_session_id: pageSessionId,
    expected_state_revision: inspection.state_revision,
    ...operationInput,
    ...approvalInput,
  };
}

async function beginRegisteredToolInvocation(tools, toolName, input) {
  return beginRegisteredToolInvocationRaw(
    tools,
    toolName,
    await prepareRegisteredToolInput(tools, toolName, input),
  );
}

async function invokeRegisteredTool(tools, toolName, input) {
  const invocation = await beginRegisteredToolInvocation(tools, toolName, input);
  return waitForRegisteredToolResponse(toolName, invocation);
}

async function readSimulationCancellationState() {
  const response = await sendCommand('Runtime.evaluate', {
    expression: `JSON.stringify({
      activity: document.querySelector('.activity-row strong')?.textContent?.trim() ?? null,
      manualAction: document.querySelector('.manual-action')?.textContent?.trim() ?? null,
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
    && state?.manualAction?.includes('Run MDN drive')
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
    manual_action_after_cancel: state.manualAction,
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

const provenanceLabels = [
  'measured',
  'derived',
  'connectome_inferred',
  'simulation_predicted',
  'agent_hypothesized',
];

function uniqueSortedStrings(values) {
  return [...new Set(values)].sort();
}

function assertSameStringSet(actual, expected, label) {
  const normalizedActual = uniqueSortedStrings(actual);
  const normalizedExpected = uniqueSortedStrings(expected);
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(`${label} did not match: ${JSON.stringify({ actual: normalizedActual, expected: normalizedExpected })}`);
  }
}

function assertDiscoveryDecisionAndCandidateRecords(discovery, label) {
  const data = discovery?.data;
  const decision = data?.discovery_decision;
  const candidateSummaries = data?.candidate_circuits;
  const candidateRecords = data?.candidate_circuit_records;
  if (decision?.schema !== 'flylab.discovery-decision'
    || decision?.schemaVersion !== 1
    || typeof decision.id !== 'string'
    || !decision.id.startsWith('discovery_')
    || typeof decision.missionGoal !== 'string'
    || !decision.missionGoal
    || typeof decision.search?.query !== 'string'
    || !Array.isArray(decision.candidates)
    || !Array.isArray(decision.rejectedAlternatives)
    || !Array.isArray(decision.excludedEvidence)
    || !Array.isArray(decision.excludedEvidenceIds)
    || decision.provenance?.join(',') !== 'derived'
    || !['partial', 'undetermined', 'none'].includes(decision.overallCoverage)
    || typeof decision.coverageWarning !== 'string'
    || !decision.coverageWarning
    || !Array.isArray(candidateSummaries)
    || !Array.isArray(candidateRecords)) {
    throw new Error(`${label} did not expose the persisted discovery-decision contract: ${JSON.stringify(data)}`);
  }
  if (decision.selectionStatus !== data.selection_status
    || decision.selectedCircuitId !== data.selected_circuit_id
    || candidateRecords.length !== decision.candidates.length
    || candidateSummaries.length !== decision.candidates.length) {
    throw new Error(`${label} discovery decision diverged from returned candidates: ${JSON.stringify(data)}`);
  }
  assertSameStringSet(
    decision.candidates.map((candidate) => candidate.circuitId),
    candidateSummaries.map((candidate) => candidate.id),
    `${label} decision-to-summary candidates`,
  );
  assertSameStringSet(
    decision.candidates.map((candidate) => candidate.circuitId),
    candidateRecords.map((candidate) => candidate.circuit?.id),
    `${label} decision-to-full candidate records`,
  );
  assertSameStringSet(
    decision.excludedEvidence.map((record) => record.evidenceId),
    decision.excludedEvidenceIds,
    `${label} excluded evidence index`,
  );
  if (decision.selectedCircuitId !== null) {
    if (decision.recommendation?.circuitId !== decision.selectedCircuitId
      || !decision.candidates.some((candidate) => candidate.circuitId === decision.selectedCircuitId && candidate.selected === true)
      || decision.candidates.some((candidate) => candidate.circuitId !== decision.selectedCircuitId && candidate.selected === true)
      || !data.circuits?.some((circuit) => circuit.id === decision.selectedCircuitId)) {
      throw new Error(`${label} selected recommendation was not internally consistent: ${JSON.stringify(decision)}`);
    }
  }
  const rejectedIds = decision.rejectedAlternatives.map((record) => record.circuitId);
  if (rejectedIds.includes(decision.selectedCircuitId)
    || rejectedIds.some((id) => !decision.candidates.some((candidate) => candidate.circuitId === id))) {
    throw new Error(`${label} rejected-alternative ledger was inconsistent: ${JSON.stringify(decision.rejectedAlternatives)}`);
  }
  for (const candidateRecord of candidateRecords) {
    const circuit = candidateRecord?.circuit;
    const motorMap = candidateRecord?.motor_map;
    const evidence = candidateRecord?.evidence;
    const decisionCandidate = decision.candidates.find((candidate) => candidate.circuitId === circuit?.id);
    if (!circuit?.id
      || !decisionCandidate
      || motorMap?.circuitId !== circuit.id
      || motorMap?.id !== circuit.motorMapId
      || !Array.isArray(motorMap.nodes)
      || !Array.isArray(motorMap.edges)
      || !Array.isArray(evidence)) {
      throw new Error(`${label} candidate record was incomplete: ${JSON.stringify(candidateRecord)}`);
    }
    assertSameStringSet(evidence.map((record) => record.id), circuit.evidenceIds, `${label} ${circuit.id} evidence closure`);
    assertSameStringSet(decisionCandidate.catalogEvidenceIds, circuit.evidenceIds, `${label} ${circuit.id} decision evidence closure`);
    for (const record of evidence) {
      if (!Array.isArray(record.sourceIds)
        || !Array.isArray(record.sources)
        || record.sources.some((source) => typeof source?.id !== 'string')) {
        throw new Error(`${label} candidate evidence ${record?.id} omitted source records.`);
      }
      assertSameStringSet(record.sources.map((source) => source.id), record.sourceIds, `${label} ${record.id} source closure`);
    }
  }
  return decision;
}

function meanNumbers(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function summarizeAuthoritativeTrajectory(replicate, takeoffMode) {
  const trajectory = replicate.trajectory;
  const first = trajectory[0];
  const last = trajectory.at(-1);
  const timeline = replicate.eventTimeline;
  const movementDurationSeconds = timeline.movementOnsetMs === null || timeline.recoveryMs === null
    ? 0
    : Math.max(0, timeline.recoveryMs - timeline.movementOnsetMs) / 1000;
  const backwardDistanceMm = Math.max(0, ...trajectory.map((point) => -point.y));
  const planarDistanceMm = first && last ? Math.hypot(last.x - first.x, last.y - first.y) : 0;
  const signedSpeedMmS = movementDurationSeconds > 0
    ? takeoffMode
      ? planarDistanceMm / movementDurationSeconds
      : backwardDistanceMm > 0 ? -(backwardDistanceMm / movementDurationSeconds) : 0
    : 0;
  let stanceArea = 0;
  for (let index = 1; index < trajectory.length; index += 1) {
    const previous = trajectory[index - 1];
    const current = trajectory[index];
    stanceArea += previous.stanceStability * Math.max(0, current.t - previous.t);
  }
  const traceDurationMs = first && last ? Math.max(0, last.t - first.t) : 0;
  return {
    backwardDistanceMm,
    signedSpeedMmS,
    headingChangeDeg: first && last ? last.heading - first.heading : 0,
    stanceStability: traceDurationMs > 0 ? stanceArea / traceDurationMs : first?.stanceStability ?? 0,
    verticalDisplacementMm: Math.max(0, ...trajectory.map((point) => point.z)),
    wingRecruitment: Math.max(0, ...trajectory.map((point) => point.wingDeployment)),
    legRecruitment: Math.max(0, ...trajectory.map((point) => point.legExtension)),
    takeoffSuccess: trajectory.some((point) => point.state === 'airborne' && !point.groundContact),
  };
}

function assertApproximatelyEqual(actual, expected, label, tolerance = 1e-9) {
  if (actual === null || expected === null) {
    if (actual !== expected) throw new Error(`${label} null rule diverged: ${JSON.stringify({ actual, expected })}`);
    return;
  }
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} diverged: ${JSON.stringify({ actual, expected, tolerance })}`);
  }
}

function assertFormalMetricDefinitions(analysisEnvelope) {
  const analysis = analysisEnvelope.data?.analysis;
  const definitions = analysisEnvelope.data?.metric_definitions;
  const summaryDefinition = analysis?.responseInitiationSummaryDefinition;
  const exportedSummaryDefinition = analysisEnvelope.data?.response_initiation_summary_definition;
  const observationDefinition = analysis?.responseObservationSummaryDefinition;
  const exportedObservationDefinition = analysisEnvelope.data?.response_observation_summary_definition;
  const requiredTextFields = [
    'label',
    'formula',
    'unit',
    'signConvention',
    'aggregation',
    'nullRule',
    'windowSemantics',
    'boundary',
  ];
  if (!analysis
    || !definitions
    || typeof definitions !== 'object'
    || Array.isArray(definitions)
    || JSON.stringify(definitions) !== JSON.stringify(analysis.metricDefinitions)
    || JSON.stringify(exportedSummaryDefinition) !== JSON.stringify(summaryDefinition)
    || JSON.stringify(exportedObservationDefinition) !== JSON.stringify(observationDefinition)
    || typeof analysis.methodVersion !== 'string'
    || !analysis.methodVersion.startsWith('flylab.behavior-metrics.v')) {
    throw new Error(`Analysis did not expose one canonical formal metric-definition map: ${JSON.stringify(analysisEnvelope.data)}`);
  }
  assertSameStringSet(Object.keys(definitions), analysis.metrics, 'formal metric-definition IDs');
  for (const metric of analysis.metrics) {
    const definition = definitions[metric];
    if (definition?.id !== metric
      || definition.methodVersion !== analysis.methodVersion
      || definition.provenance?.join(',') !== 'derived,simulation_predicted'
      || requiredTextFields.some((field) => typeof definition[field] !== 'string' || !definition[field])) {
      throw new Error(`Metric ${metric} lacked a complete versioned definition: ${JSON.stringify(definition)}`);
    }
  }
  if (summaryDefinition?.id !== 'response_initiation_probability'
    || summaryDefinition.methodVersion !== analysis.methodVersion
    || summaryDefinition.provenance?.join(',') !== 'derived,simulation_predicted'
    || requiredTextFields.some((field) => typeof summaryDefinition[field] !== 'string' || !summaryDefinition[field])
    || analysis.metrics.includes(summaryDefinition.id)) {
    throw new Error(`Response initiation was not a separately declared result summary: ${JSON.stringify(summaryDefinition)}`);
  }
  if (observationDefinition?.id !== 'response_threshold_and_censoring_summary'
    || typeof observationDefinition.label !== 'string'
    || !observationDefinition.label
    || observationDefinition.methodVersion !== analysis.methodVersion
    || observationDefinition.provenance?.join(',') !== 'derived,simulation_predicted'
    || typeof observationDefinition.windowSemantics !== 'string'
    || !observationDefinition.windowSemantics
    || typeof observationDefinition.boundary !== 'string'
    || !/not biological response rates/i.test(observationDefinition.boundary)
    || !['thresholdCrossingProbability', 'thresholdCrossedN', 'censoredN'].every((field) => (
      typeof observationDefinition.fields?.[field]?.formula === 'string'
      && typeof observationDefinition.fields?.[field]?.aggregation === 'string'
      && typeof observationDefinition.fields?.[field]?.unit === 'string'
      && typeof observationDefinition.fields?.[field]?.nullRule === 'string'
      && observationDefinition.fields[field].formula.length > 0
      && observationDefinition.fields[field].aggregation.length > 0
      && observationDefinition.fields[field].unit.length > 0
      && observationDefinition.fields[field].nullRule.length > 0
    ))) {
    throw new Error(`Threshold and censoring summaries lacked a formal definition: ${JSON.stringify(observationDefinition)}`);
  }
  if (typeof analysisEnvelope.data?.unit_boundary !== 'string'
    || !analysisEnvelope.data.unit_boundary
    || !/simulat/i.test(String(analysis.warning))) {
    throw new Error(`Analysis omitted its simulator-unit or interpretation boundary: ${JSON.stringify(analysisEnvelope.data)}`);
  }
  return {
    method_version: analysis.methodVersion,
    objective_metric_definitions: analysis.metrics.length,
    response_initiation_summary_separate: true,
    response_observation_summary_separate: true,
  };
}

function assertPerRunSimulationAndAnalysis(batch, analysis, exportedPerRunResults) {
  const protocol = batch?.protocol;
  if (!batch?.id
    || batch.status !== 'complete'
    || !Array.isArray(batch.conditionRuns)
    || !batch.conditionRuns.length
    || !Array.isArray(exportedPerRunResults)
    || exportedPerRunResults.length !== batch.conditionRuns.length
    || protocol?.metricMethodVersion !== 'flylab.behavior-metrics.v5'
    || protocol.metricMethodVersion !== analysis.methodVersion
    || batch.model?.version !== '0.3.0'
    || batch.model?.controller !== 'state-coherent-mapped-circuit-adapter.v2'
    || batch.model?.environment !== 'stateful-open-field-model-scale.v3'
    || batch.model?.calibrationStatus !== 'literature_constrained_event_order_unfitted_amplitudes'
    || analysis.batchRunContentHash !== batch.runContentHash
    || batch.runHashScope !== 'run_and_trajectory_ids_only'
    || !/^fnv1a:[a-f0-9]+$/.test(batch.runHash ?? '')
    || fnv1aJson(batch.conditionRuns.flatMap((condition) => condition.replicates.map((replicate) => ({
      runId: replicate.id,
      trajectoryId: replicate.trajectoryId,
    })))) !== batch.runHash
    || batch.runHashSerialization !== 'FNV-1a(JSON.stringify([{ runId, trajectoryId }]))'
    || batch.runContentHashScope !== 'protocol_model_and_complete_condition_runs'
    || !/^sha256:[a-f0-9]{64}$/.test(batch.runContentHash ?? '')
    || batch.runContentHashSerialization !== 'SHA-256(JSON.stringify({ protocol, model, conditionRuns }))'
    || sha256Json({ protocol, model: batch.model, conditionRuns: batch.conditionRuns }) !== batch.runContentHash
    || !Array.isArray(protocol?.driveDerivations)
    || protocol.driveDerivations.length !== protocol.conditions?.length
    || protocol?.seedPolicy?.version !== 'flylab.seed-policy.v2'
    || protocol.seedPolicy.design !== 'common_random_numbers_by_replicate'
    || !Number.isInteger(protocol.replicates)
    || protocol.replicates < 1) {
    throw new Error(`Simulation batch omitted its versioned per-run contract: ${JSON.stringify({ batch, analysis })}`);
  }
  const seedRows = Array.from({ length: protocol.replicates }, () => []);
  const trajectorySeedRows = Array.from({ length: protocol.replicates }, () => []);
  const allRunIds = [];
  const allRunTrajectoryIds = [];
  let totalRuns = 0;
  for (const conditionRun of batch.conditionRuns) {
    const protocolCondition = protocol.conditions.find((condition) => condition.id === conditionRun.conditionId);
    const exportedCondition = exportedPerRunResults.find((candidate) => candidate.condition_id === conditionRun.conditionId);
    if (!protocolCondition
      || conditionRun.status !== 'complete'
      || conditionRun.trajectoryStatus !== 'complete'
      || conditionRun.trajectoryRole !== 'illustrative_condition_replay'
      || !String(conditionRun.trajectoryBoundary).includes('must not be used')
      || !Array.isArray(conditionRun.trajectory)
      || conditionRun.trajectory.length < 2
      || !Array.isArray(conditionRun.replicates)
      || conditionRun.replicates.length !== protocol.replicates
      || exportedCondition?.label !== conditionRun.label
      || !Array.isArray(exportedCondition?.runs)
      || exportedCondition.runs.length !== conditionRun.replicates.length) {
      throw new Error(`Condition ${conditionRun?.conditionId} omitted its per-run or illustrative-replay boundary.`);
    }
    assertSameStringSet(
      conditionRun.runIds,
      conditionRun.replicates.map((replicate) => replicate.id),
      `${conditionRun.conditionId} run ID closure`,
    );
    conditionRun.replicates.forEach((replicate, replicateIndex) => {
      const exportedRun = exportedCondition.runs.find((candidate) => candidate.id === replicate.id);
      const { trajectory: replicateTrajectory, ...replicateWithoutTrajectory } = replicate;
      const expectedExportedRun = {
        ...replicateWithoutTrajectory,
        trajectory_point_count: replicateTrajectory.length,
      };
      totalRuns += 1;
      allRunIds.push(replicate.id);
      allRunTrajectoryIds.push(replicate.trajectoryId);
      seedRows[replicateIndex].push(replicate.seed);
      trajectorySeedRows[replicateIndex].push(replicate.trajectorySeed);
      const numericFields = [
        'effectiveMotorDrive',
        'premotorDriveIndex',
        'responseThresholdProbability',
        'backwardDistanceMm',
        'backwardDistanceScale',
        'signedSpeedMmS',
        'headingChangeDeg',
        'stanceStability',
        'verticalDisplacementMm',
        'wingRecruitment',
        'legRecruitment',
      ];
      const eventTimeline = replicate.eventTimeline;
      const allowedStates = new Set(['stance', 'preparation', 'reverse_walk', 'jump', 'wing_deployment', 'airborne', 'recovery']);
      const eventTimes = [
        protocol.onsetMs,
        Math.min(protocol.trialDurationMs, protocol.onsetMs + protocol.durationMs),
        eventTimeline?.controllerThresholdMs,
        eventTimeline?.movementOnsetMs,
        eventTimeline?.groundReleaseMs,
        eventTimeline?.wingDeploymentMs,
        eventTimeline?.recoveryMs,
      ].filter((value) => value !== null && value !== undefined);
      let previousTime = -Infinity;
      const protocolOffsetMs = Math.min(protocol.trialDurationMs, protocol.onsetMs + protocol.durationMs);
      const trajectoryFieldsValid = replicate.trajectory.every((point) => {
        const inProtocolWindow = point.t >= protocol.onsetMs && point.t < protocolOffsetMs;
        const expectedActive = protocolCondition.kind === 'perturbation' && inProtocolWindow;
        const valid = (
        Number.isFinite(point.t)
        && Number.isFinite(point.x)
        && Number.isFinite(point.y)
        && Number.isFinite(point.z)
        && Number.isFinite(point.heading)
        && Number.isFinite(point.legExtension)
        && Number.isFinite(point.wingDeployment)
        && Number.isFinite(point.bodyPitchDeg)
        && Number.isFinite(point.bodyRollDeg)
        && Number.isFinite(point.premotorDriveIndex)
        && Number.isFinite(point.stanceStability)
        && typeof point.groundContact === 'boolean'
        && typeof point.motorOutputActive === 'boolean'
        && allowedStates.has(point.state)
        && point.t > previousTime
        && point.t >= 0
        && point.t <= protocol.trialDurationMs
        && point.active === expectedActive
        && point.premotorDriveIndex === (inProtocolWindow ? replicate.effectiveMotorDrive : 0)
        );
        previousTime = point.t;
        return valid;
      });
      const eventPointsPresent = eventTimes.every((eventTime) => replicate.trajectory.some((point) => point.t === eventTime));
      const nonresponseCoherent = replicate.responseDisposition === 'expressed' || replicate.trajectory.every((point) => (
        point.state === 'stance'
        && point.groundContact
        && !point.motorOutputActive
        && point.x === 0
        && point.y === 0
        && point.z === 0
        && point.heading === 0
        && point.legExtension === 0
        && point.wingDeployment === 0
        && point.bodyPitchDeg === 0
        && point.bodyRollDeg === 0
      ));
      const takeoffTimelineOrdered = batch.motorMap.responseMode !== 'takeoff' || replicate.responseDisposition !== 'expressed' || (
        eventTimeline.controllerThresholdMs <= eventTimeline.movementOnsetMs
        && eventTimeline.movementOnsetMs < eventTimeline.groundReleaseMs
        && eventTimeline.groundReleaseMs < eventTimeline.wingDeploymentMs
        && eventTimeline.wingDeploymentMs < eventTimeline.recoveryMs
        && replicate.trajectory.filter((point) => point.t < eventTimeline.groundReleaseMs).every((point) => point.groundContact)
        && replicate.trajectory.filter((point) => point.state === 'airborne').every((point) => !point.groundContact)
      );
      const reverseTimelineOrdered = batch.motorMap.responseMode !== 'reverse' || replicate.responseDisposition !== 'expressed' || (
        eventTimeline.controllerThresholdMs <= eventTimeline.movementOnsetMs
        && eventTimeline.movementOnsetMs < eventTimeline.recoveryMs
        && eventTimeline.groundReleaseMs === null
        && eventTimeline.wingDeploymentMs === null
      );
      const absentTimelineCoherent = replicate.responseDisposition === 'expressed' || [
        eventTimeline.controllerThresholdMs,
        eventTimeline.movementOnsetMs,
        eventTimeline.groundReleaseMs,
        eventTimeline.wingDeploymentMs,
        eventTimeline.recoveryMs,
      ].every((value) => value === null);
      const preMovementCoherent = replicate.responseDisposition !== 'expressed' || replicate.trajectory
        .filter((point) => point.t < eventTimeline.movementOnsetMs)
        .every((point) => (
          point.x === 0
          && point.y === 0
          && point.z === 0
          && point.heading === 0
          && point.legExtension === 0
          && point.wingDeployment === 0
          && point.bodyPitchDeg === 0
          && point.bodyRollDeg === 0
          && !point.motorOutputActive
        ));
      const requiredPostMovementMs = batch.motorMap.responseMode === 'takeoff'
        ? batch.model.parameterization.escapeTakeoff.eventTiming.groundReleaseDelayMs
          + batch.model.parameterization.escapeTakeoff.eventTiming.wingDelayAfterGroundReleaseMs
        : 0;
      const candidateFitsTrial = replicate.candidateResponseLatencyMs !== null
        && replicate.candidateResponseLatencyMs + requiredPostMovementMs
          < protocol.trialDurationMs - protocol.onsetMs;
      const expressedLeg = Math.max(...replicate.trajectory.map((point) => point.legExtension));
      const expressedWing = Math.max(...replicate.trajectory.map((point) => point.wingDeployment));
      const expressedLift = Math.max(...replicate.trajectory.map((point) => point.z));
      const traceSummary = summarizeAuthoritativeTrajectory(replicate, batch.motorMap.responseMode === 'takeoff');
      const candidateMovementOnset = replicate.candidateResponseLatencyMs === null
        ? null
        : protocol.onsetMs + replicate.candidateResponseLatencyMs;
      if (!replicate.id
        || replicate.status !== 'complete'
        || replicate.conditionId !== conditionRun.conditionId
        || !Number.isInteger(replicate.seed)
        || replicate.trajectorySeed !== replicate.seed + protocol.seedPolicy.trajectoryOffset
        || typeof replicate.trajectoryId !== 'string'
        || replicate.trajectoryRole !== 'per_run_simulated_trajectory'
        || !Array.isArray(replicate.trajectory)
        || replicate.trajectory.length < 2
        || replicate.provenance?.join(',') !== 'simulation_predicted'
        || typeof replicate.responseInitiated !== 'boolean'
        || typeof replicate.reverseInitiated !== 'boolean'
        || typeof replicate.shortModeEscapeInitiated !== 'boolean'
        || typeof replicate.responseThresholdCrossed !== 'boolean'
        || !['not_crossed', 'censored', 'expressed'].includes(replicate.responseDisposition)
        || replicate.responseDisposition !== (replicate.responseThresholdCrossed ? replicate.responseInitiated ? 'expressed' : 'censored' : 'not_crossed')
        || replicate.eventTimeline?.responseDisposition !== replicate.responseDisposition
        || replicate.eventTimeline?.thresholdCrossed !== replicate.responseThresholdCrossed
        || replicate.eventTimeline?.stimulusOnsetMs !== protocol.onsetMs
        || replicate.eventTimeline?.candidateMovementOnsetMs !== candidateMovementOnset
        || !replicate.driveDerivation
        || replicate.driveDerivation.effectiveMotorDrive !== replicate.effectiveMotorDrive
        || replicate.premotorDriveIndex !== replicate.effectiveMotorDrive
        || !trajectoryFieldsValid
        || !eventPointsPresent
        || !nonresponseCoherent
        || !takeoffTimelineOrdered
        || !reverseTimelineOrdered
        || !absentTimelineCoherent
        || !preMovementCoherent
        || replicate.legRecruitment !== expressedLeg
        || replicate.wingRecruitment !== expressedWing
        || replicate.verticalDisplacementMm !== expressedLift
        || Math.abs(replicate.backwardDistanceMm - traceSummary.backwardDistanceMm) > 1e-9
        || Math.abs(replicate.signedSpeedMmS - traceSummary.signedSpeedMmS) > 1e-9
        || Math.abs(replicate.headingChangeDeg - traceSummary.headingChangeDeg) > 1e-9
        || Math.abs(replicate.stanceStability - traceSummary.stanceStability) > 1e-9
        || replicate.takeoffSuccess !== replicate.trajectory.some((point) => point.state === 'airborne' && !point.groundContact)
        || replicate.trajectory[0]?.t !== 0
        || replicate.trajectory.at(-1)?.t !== protocol.trialDurationMs
        || !exportedRun
        || exportedRun.conditionId !== replicate.conditionId
        || exportedRun.seed !== replicate.seed
        || exportedRun.trajectoryId !== replicate.trajectoryId
        || exportedRun.trajectory_point_count !== replicate.trajectory.length
        || Object.prototype.hasOwnProperty.call(exportedRun, 'trajectory')
        || JSON.stringify(exportedRun) !== JSON.stringify(expectedExportedRun)
        || (replicate.responseInitiated !== (replicate.reverseInitiated || replicate.shortModeEscapeInitiated))
        || (replicate.responseInitiated !== (replicate.responseLatencyMs !== null))
        || replicate.responseInitiated !== candidateFitsTrial
        || (replicate.responseThresholdCrossed !== (replicate.candidateResponseLatencyMs !== null))
        || (replicate.backwardDistanceMm > 0 && (!replicate.reverseInitiated || replicate.signedSpeedMmS >= 0))
        || (replicate.verticalDisplacementMm > 0 && !replicate.shortModeEscapeInitiated)
        || (replicate.responseLatencyMs !== null && !Number.isFinite(replicate.responseLatencyMs))
        || (replicate.candidateResponseLatencyMs !== null && !Number.isFinite(replicate.candidateResponseLatencyMs))
        || replicate.responseThresholdProbability < 0
        || replicate.responseThresholdProbability > 1
        || numericFields.some((field) => !Number.isFinite(replicate[field]))) {
        throw new Error(`Per-run record ${replicate?.id} was incomplete: ${JSON.stringify(replicate)}`);
      }
    });
    if (conditionRun.replicates.some((replicate) => replicate.trajectoryId === conditionRun.trajectoryId)) {
      throw new Error(`Condition ${conditionRun.conditionId} mislabeled a per-run trajectory as its illustrative replay.`);
    }
  }
  if (new Set(allRunIds).size !== allRunIds.length
    || new Set(allRunTrajectoryIds).size !== allRunTrajectoryIds.length) {
    throw new Error('Per-run IDs or per-run trajectory IDs were not globally unique within the batch.');
  }
  for (let replicateIndex = 0; replicateIndex < protocol.replicates; replicateIndex += 1) {
    if (new Set(seedRows[replicateIndex]).size !== 1
      || new Set(trajectorySeedRows[replicateIndex]).size !== 1
      || seedRows[replicateIndex][0] !== protocol.seed + replicateIndex * protocol.seedPolicy.replicateStride) {
      throw new Error(`Common-random-number pairing diverged at replicate ${replicateIndex}: ${JSON.stringify({ seeds: seedRows[replicateIndex], trajectorySeeds: trajectorySeedRows[replicateIndex] })}`);
    }
  }
  for (const condition of analysis.conditions) {
    const run = batch.conditionRuns.find((candidate) => candidate.conditionId === condition.conditionId);
    if (!run || condition.n !== run.replicates.length) {
      throw new Error(`Analysis condition ${condition.conditionId} did not close over its per-run records.`);
    }
    const responsive = run.replicates.filter((replicate) => replicate.responseInitiated && replicate.responseLatencyMs !== null);
    const traceDerived = run.replicates.map((replicate) => ({
      replicate,
      summary: summarizeAuthoritativeTrajectory(replicate, batch.motorMap.responseMode === 'takeoff'),
    }));
    const speedContributors = batch.motorMap.responseMode === 'takeoff'
      ? traceDerived
      : traceDerived.filter((item) => item.summary.backwardDistanceMm > 0);
    const thresholdCrossedN = run.replicates.filter((replicate) => replicate.responseThresholdCrossed).length;
    const censoredN = run.replicates.filter((replicate) => replicate.responseDisposition === 'censored').length;
    const expectedValues = {
      reverseInitiationProbability: meanNumbers(run.replicates.map((replicate) => replicate.reverseInitiated ? 1 : 0)),
      thresholdCrossingProbability: meanNumbers(run.replicates.map((replicate) => replicate.responseThresholdCrossed ? 1 : 0)),
      responseInitiationProbability: meanNumbers(run.replicates.map((replicate) => replicate.responseInitiated ? 1 : 0)),
      shortModeEscapeProbability: meanNumbers(traceDerived.map((item) => item.summary.takeoffSuccess ? 1 : 0)),
      backwardDistanceMm: meanNumbers(traceDerived.map((item) => item.summary.backwardDistanceMm)),
      signedSpeedMmS: speedContributors.length ? meanNumbers(speedContributors.map((item) => item.summary.signedSpeedMmS)) : 0,
      responseLatencyMs: responsive.length ? meanNumbers(responsive.map((replicate) => replicate.responseLatencyMs)) : null,
      headingChangeDeg: Math.abs(meanNumbers(traceDerived.map((item) => item.summary.headingChangeDeg))),
      stanceStability: meanNumbers(traceDerived.map((item) => item.summary.stanceStability)),
      verticalDisplacementMm: meanNumbers(traceDerived.map((item) => item.summary.verticalDisplacementMm)),
      wingRecruitment: meanNumbers(traceDerived.map((item) => item.summary.wingRecruitment)),
      legRecruitment: meanNumbers(traceDerived.map((item) => item.summary.legRecruitment)),
    };
    if (condition.responsiveN !== responsive.length
      || condition.thresholdCrossedN !== thresholdCrossedN
      || condition.censoredN !== censoredN) {
      throw new Error(`Analysis responsive_n diverged for ${condition.conditionId}.`);
    }
    for (const [field, expectedValue] of Object.entries(expectedValues)) {
      assertApproximatelyEqual(condition[field], expectedValue, `${condition.conditionId}.${field}`);
    }
  }
  return {
    condition_count: batch.conditionRuns.length,
    per_run_records: totalRuns,
    common_random_number_pairing: true,
    state_coherent_per_run_traces: true,
    sha256_content_hash_verified: true,
    illustrative_replay_excluded_from_metrics: true,
  };
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function fnv1aJson(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function resolveJsonPointer(root, pointer) {
  if (pointer === '') return { found: true, value: root };
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return { found: false, value: undefined };
  let current = root;
  for (const encodedToken of pointer.slice(1).split('/')) {
    const token = encodedToken.replaceAll('~1', '/').replaceAll('~0', '~');
    if ((typeof current !== 'object' && typeof current !== 'function')
      || current === null
      || !Object.prototype.hasOwnProperty.call(current, token)) {
      return { found: false, value: undefined };
    }
    current = current[token];
  }
  return { found: true, value: current };
}

function assertProvenanceManifest(envelope, toolName) {
  const manifest = envelope?.provenance_manifest;
  const entries = manifest?.entries;
  const summary = envelope?.provenance;
  if (envelope?.result_version !== 'flylab.tool-result.v3'
    || manifest?.schema_version !== 'flylab.provenance-manifest.v1'
    || !Array.isArray(entries)
    || !Array.isArray(manifest.operational_paths)
    || !Array.isArray(summary)
    || !String(envelope?.provenance_scope ?? '').includes('Union summary only')) {
    throw new Error(`${toolName} did not return the FlyLab v3 provenance contract: ${JSON.stringify(envelope)}`);
  }
  if (summary.length !== new Set(summary).size || summary.some((label) => !provenanceLabels.includes(label))) {
    throw new Error(`${toolName} returned an invalid top-level provenance summary: ${JSON.stringify(summary)}`);
  }
  for (const [index, entry] of entries.entries()) {
    if (typeof entry?.path !== 'string'
      || (entry.artifact_id !== null && typeof entry.artifact_id !== 'string')
      || typeof entry.artifact_type !== 'string'
      || !entry.artifact_type
      || !['artifact', 'record', 'container'].includes(entry.scope)
      || !Array.isArray(entry.labels)
      || !entry.labels.length
      || entry.labels.some((label) => !provenanceLabels.includes(label))
      || !Array.isArray(entry.parent_ids)
      || !Array.isArray(entry.evidence_ids)
      || !Array.isArray(entry.source_ids)
      || typeof entry.boundary !== 'string'
      || !entry.boundary) {
      throw new Error(`${toolName} returned an invalid provenance entry at index ${index}: ${JSON.stringify(entry)}`);
    }
    const resolved = resolveJsonPointer(envelope.data, entry.path);
    if (!resolved.found) {
      throw new Error(`${toolName} returned an unresolved provenance JSON Pointer at index ${index}: ${entry.path}`);
    }
    if (entry.scope === 'container'
      && (resolved.value === null || typeof resolved.value !== 'object')) {
      throw new Error(`${toolName} labeled a non-container value as a provenance container at ${entry.path}`);
    }
  }
  if (manifest.operational_paths.some((path) => (
    typeof path !== 'string'
    || (path !== '' && !path.startsWith('/'))
    || !resolveJsonPointer(envelope.data, path).found
  ))) {
    throw new Error(`${toolName} returned an invalid operational JSON Pointer: ${JSON.stringify(manifest.operational_paths)}`);
  }
  const scientificPaths = new Set(entries.map((entry) => entry.path));
  const exactOverlap = manifest.operational_paths.find((path) => scientificPaths.has(path));
  if (exactOverlap) {
    throw new Error(`${toolName} labeled ${exactOverlap} as both scientific provenance and operational metadata.`);
  }
  assertSameStringSet(
    entries.flatMap((entry) => entry.labels),
    summary,
    `${toolName} provenance entry-label union`,
  );
}

function successfulEnvelope(response, toolName) {
  const envelope = decodedOutput(response)?.structuredContent;
  if (response?.status !== 'Completed' || envelope?.ok !== true || envelope?.tool !== toolName) {
    throw new Error(`${toolName} did not complete successfully: ${JSON.stringify(response)}`);
  }
  if (typeof envelope.page_session_id !== 'string'
    || !Number.isInteger(envelope.previous_state_revision)
    || !Number.isInteger(envelope.state_revision)
    || !Array.isArray(envelope.created_artifact_ids)
    || typeof envelope.idempotent_replay !== 'boolean'
    || typeof envelope.verification?.selector !== 'string'
    || typeof envelope.verification?.description !== 'string'
    || JSON.stringify(envelope.next_action) !== JSON.stringify(envelope.data?.next_action ?? null)) {
    throw new Error(`${toolName} did not return the FlyLab v3 transition envelope: ${JSON.stringify(envelope)}`);
  }
  const expectsOperationId = toolName === 'run_fly_simulation' || toolName === 'save_fly_evidence';
  if (envelope.state_revision < envelope.previous_state_revision
    || (toolName === 'inspect_flylab_state'
      && (envelope.state_revision !== envelope.previous_state_revision
        || envelope.created_artifact_ids.length !== 0
        || envelope.operation_id !== null))
    || (expectsOperationId ? typeof envelope.operation_id !== 'string' : envelope.operation_id !== null)
    || (envelope.idempotent_replay
      && (envelope.previous_state_revision !== envelope.state_revision
        || envelope.created_artifact_ids.length !== 0))) {
    throw new Error(`${toolName} returned inconsistent transition or retry metadata: ${JSON.stringify(envelope)}`);
  }
  assertProvenanceManifest(envelope, toolName);
  return envelope;
}

function failedEnvelope(response, toolName, errorCode, expectedRecoveryTool = 'inspect_flylab_state') {
  const envelope = decodedOutput(response)?.structuredContent;
  if (!['Completed', 'Error'].includes(response?.status)
    || envelope?.ok !== false
    || envelope?.result_version !== 'flylab.tool-result.v3'
    || envelope?.tool !== toolName
    || envelope?.error?.code !== errorCode
    || typeof envelope.page_session_id !== 'string'
    || !Number.isInteger(envelope.state_revision)
    || envelope?.recovery?.tool !== expectedRecoveryTool) {
    throw new Error(`${toolName} did not return the expected ${errorCode} failure envelope: ${JSON.stringify(response)}`);
  }
  return envelope;
}

async function verifyMutationContextGuards(tools) {
  const beforeResponse = await invokeRegisteredToolRaw(tools, 'inspect_flylab_state', {});
  const before = successfulEnvelope(beforeResponse, 'inspect_flylab_state');
  const pageSessionId = before.data.page_session_id;
  const baseInput = { query: 'MDN', behavior: 'backward_walking' };

  const wrongSession = failedEnvelope(await invokeRegisteredToolRaw(tools, 'find_fly_circuits', {
    ...baseInput,
    page_session_id: `${pageSessionId}_wrong`,
    expected_state_revision: before.state_revision,
  }), 'find_fly_circuits', 'STALE_STATE');
  const afterWrongSession = successfulEnvelope(
    await invokeRegisteredToolRaw(tools, 'inspect_flylab_state', {}),
    'inspect_flylab_state',
  );
  if (wrongSession.state_revision !== before.state_revision
    || afterWrongSession.state_revision !== before.state_revision
    || afterWrongSession.data.agent_context?.artifacts?.selected_circuit_id !== null) {
    throw new Error(`Wrong-session mutation changed FlyLab state: ${JSON.stringify({ before, wrongSession, afterWrongSession })}`);
  }

  const staleRevision = failedEnvelope(await invokeRegisteredToolRaw(tools, 'find_fly_circuits', {
    ...baseInput,
    page_session_id: pageSessionId,
    expected_state_revision: before.state_revision + 1,
  }), 'find_fly_circuits', 'STALE_STATE');
  const afterStaleRevision = successfulEnvelope(
    await invokeRegisteredToolRaw(tools, 'inspect_flylab_state', {}),
    'inspect_flylab_state',
  );
  if (staleRevision.state_revision !== before.state_revision
    || afterStaleRevision.state_revision !== before.state_revision
    || afterStaleRevision.data.agent_context?.artifacts?.selected_circuit_id !== null) {
    throw new Error(`Stale-revision mutation changed FlyLab state: ${JSON.stringify({ before, staleRevision, afterStaleRevision })}`);
  }

  return {
    page_session_id: pageSessionId,
    preserved_state_revision: before.state_revision,
    wrong_session_error: wrongSession.error.code,
    stale_revision_error: staleRevision.error.code,
    mutation_committed: false,
  };
}

async function inspectAgentContext(tools) {
  const response = await invokeRegisteredTool(tools, 'inspect_flylab_state', {});
  const envelope = successfulEnvelope(response, 'inspect_flylab_state');
  const context = envelope.data?.agent_context;
  const artifactManifest = context?.artifact_manifest;
  const requiredArtifactFields = [
    'model',
    'discovery_decision',
    'selected_circuit',
    'discovered_evidence',
    'hypothesis',
    'experiment',
    'approval',
    'batch',
    'analyses',
    'comparison',
    'evidence_bundle',
  ];
  if (context?.schema_version !== 'flylab.agent-context.v3'
    || !artifactManifest
    || typeof artifactManifest !== 'object'
    || Array.isArray(artifactManifest)
    || requiredArtifactFields.some((field) => !(field in artifactManifest))
    || !Array.isArray(artifactManifest.discovered_evidence)
    || !Array.isArray(artifactManifest.analyses)
    || artifactManifest.model?.version !== '0.3.0'
    || artifactManifest.model?.controller !== 'state-coherent-mapped-circuit-adapter.v2'
    || artifactManifest.model?.environment !== 'stateful-open-field-model-scale.v3'
    || artifactManifest.model?.calibration_status !== 'literature_constrained_event_order_unfitted_amplitudes'
    || !artifactManifest.model?.parameterization
    || !context.provenance_policy?.definitions
    || provenanceLabels.some((label) => typeof context.provenance_policy.definitions[label] !== 'string')
    || !String(context.provenance_policy?.inheritance ?? '').includes('more specific nested record')
    || !String(context.provenance_policy?.operational_boundary ?? '').includes('operational metadata')
    || !String(context.provenance_policy?.untrusted_annotation ?? '').includes('never counted as scientific provenance')) {
    throw new Error(`Inspector did not expose the FlyLab agent-context v3 audit contract: ${JSON.stringify(context)}`);
  }
  if (envelope.provenance_manifest.entries.some((entry) => !entry.path.startsWith('/agent_context/artifact_manifest'))) {
    throw new Error(`Inspector provenance entries escaped artifact_manifest: ${JSON.stringify(envelope.provenance_manifest.entries)}`);
  }
  const inspectorEntries = envelope.provenance_manifest.entries;
  const requiredModelPaths = [
    '/agent_context/artifact_manifest/model',
    '/agent_context/artifact_manifest/model/controller_mapping_provenance',
    '/agent_context/artifact_manifest/model/parameterization',
    '/agent_context/artifact_manifest/model/parameterization/escapeTakeoff/eventTiming',
    '/agent_context/artifact_manifest/model/parameterization/escapeTakeoff/eventTiming/recoveryBaseMs',
    '/agent_context/artifact_manifest/model/parameterization/escapeTakeoff/responseLatency',
    '/agent_context/artifact_manifest/model/parameterization/escapeTakeoff/responseLatency/inverseDriveGainMs',
  ];
  if (requiredModelPaths.some((path) => !inspectorEntries.some((entry) => entry.path === path))) {
    throw new Error(`Inspector omitted field-addressed provenance for its always-visible model manifest: ${JSON.stringify(inspectorEntries)}`);
  }
  const eventTimingEntry = inspectorEntries.find((entry) => entry.path.endsWith('/model/parameterization/escapeTakeoff/eventTiming'));
  const recoveryEntry = inspectorEntries.find((entry) => entry.path.endsWith('/model/parameterization/escapeTakeoff/eventTiming/recoveryBaseMs'));
  if (eventTimingEntry?.labels?.join(',') !== 'derived,agent_hypothesized'
    || recoveryEntry?.labels?.join(',') !== 'agent_hypothesized') {
    throw new Error(`Inspector promoted derived calibration targets or unfitted recovery constants to measurements: ${JSON.stringify({ eventTimingEntry, recoveryEntry })}`);
  }
  return context;
}

function assertApprovedProtocolContext(context, experiment) {
  const approval = context?.artifact_manifest?.approval;
  const runRefs = context?.next_action?.input_refs;
  if (approval?.schema !== 'flylab.experiment-approval'
    || approval?.schema_version !== 1
    || approval.experiment_id !== experiment.id
    || approval.protocol?.experimentId !== experiment.id
    || approval.protocol?.modelVersion !== approval.model_version
    || approval.protocol?.metricMethodVersion !== approval.metric_method_version
    || approval.model_version !== '0.3.0'
    || approval.metric_method_version !== 'flylab.behavior-metrics.v5'
    || approval.protocol?.seedPolicy?.version !== approval.seed_policy_version
    || !Array.isArray(approval.protocol?.driveDerivations)
    || approval.protocol.driveDerivations.length !== experiment.conditions.length
    || new Set(approval.protocol.driveDerivations.map((derivation) => derivation.conditionId)).size !== experiment.conditions.length
    || approval.protocol.driveDerivations.some((derivation) => (
      !experiment.conditions.some((condition) => condition.id === derivation.conditionId)
      || derivation.provenance !== 'agent_hypothesized'
      || !Number.isFinite(derivation.effectiveMotorDrive)
      || typeof derivation.formula !== 'string'
      || !derivation.formula
    ))
    || JSON.stringify(approval.seed_policy) !== JSON.stringify(experiment.seedPolicy)
    || typeof approval.approved_at !== 'string'
    || Number.isNaN(Date.parse(approval.approved_at))
    || typeof approval.protocol_hash !== 'string'
    || !/^sha256:[a-f0-9]{64}$/.test(approval.protocol_hash)
    || typeof approval.seed_manifest_hash !== 'string'
    || !/^sha256:[a-f0-9]{64}$/.test(approval.seed_manifest_hash)
    || approval.seed_manifest?.base_seed !== experiment.seed
    || approval.seed_manifest?.condition_count !== experiment.conditions.length
    || approval.seed_manifest?.replicates_per_condition !== experiment.replicates
    || approval.seed_manifest?.conditions?.length !== experiment.conditions.length
    || runRefs?.experiment_id !== experiment.id
    || runRefs?.approved_protocol_hash !== approval.protocol_hash) {
    throw new Error(`Inspector did not bind execution to the exact approved protocol and seed manifest: ${JSON.stringify({ approval, runRefs, experiment })}`);
  }
  assertSameStringSet(
    approval.seed_manifest.conditions.map((condition) => condition.condition_id),
    experiment.conditions.map((condition) => condition.id),
    'approval seed-manifest conditions',
  );
  for (const [conditionIndex, condition] of approval.seed_manifest.conditions.entries()) {
    if (condition.replicates.length !== experiment.replicates
      || condition.condition_index !== conditionIndex
      || condition.trajectory_seed !== experiment.seed + approval.seed_policy.illustrativeTrajectoryOffset
      || condition.replicates.some((replicate, index) => (
        replicate.replicate_index !== index
        || replicate.seed !== experiment.seed + index * approval.seed_policy.replicateStride
        || replicate.trajectory_seed !== replicate.seed + approval.seed_policy.trajectoryOffset
      ))) {
      throw new Error(`Approval seed manifest was not fully materialized for ${condition.condition_id}: ${JSON.stringify(condition)}`);
    }
  }
  return approval;
}

function approvalCommitment(approval) {
  return {
    schema: approval.schema,
    schema_version: approval.schema_version,
    experiment_id: approval.experiment_id,
    approved_at: approval.approved_at,
    model_version: approval.model_version,
    metric_method_version: approval.metric_method_version,
    seed_policy_version: approval.seed_policy_version,
    seed_policy: approval.seed_policy,
    protocol: approval.protocol,
    protocol_hash: approval.protocol_hash,
    seed_manifest: approval.seed_manifest,
    seed_manifest_hash: approval.seed_manifest_hash,
  };
}

async function waitForApprovedProtocolContext(tools, experiment) {
  let context = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    context = await inspectAgentContext(tools);
    if (context.next_tool === 'run_fly_simulation'
      && context.human_gate?.status === 'satisfied'
      && typeof context.next_action?.input_refs?.approved_protocol_hash === 'string') {
      return { context, approval: assertApprovedProtocolContext(context, experiment) };
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Inspector did not publish the immutable approval after the visible operator action: ${JSON.stringify(context)}`);
}

async function verifyApprovedProtocolHashGuard(tools, experiment, approval) {
  const before = successfulEnvelope(
    await invokeRegisteredTool(tools, 'inspect_flylab_state', {}),
    'inspect_flylab_state',
  );
  const wrongHash = approval.protocol_hash === `sha256:${'0'.repeat(64)}`
    ? `sha256:${'1'.repeat(64)}`
    : `sha256:${'0'.repeat(64)}`;
  const rejected = failedEnvelope(await invokeRegisteredTool(tools, 'run_fly_simulation', {
    experiment_id: experiment.id,
    approved_protocol_hash: wrongHash,
  }), 'run_fly_simulation', 'EVIDENCE_MISMATCH');
  const after = successfulEnvelope(
    await invokeRegisteredTool(tools, 'inspect_flylab_state', {}),
    'inspect_flylab_state',
  );
  if (rejected.state_revision !== before.state_revision
    || after.state_revision !== before.state_revision
    || after.data.agent_context?.artifacts?.batch_id !== null
    || after.data.agent_context?.next_action?.input_refs?.approved_protocol_hash !== approval.protocol_hash) {
    throw new Error(`Wrong approval hash changed or unlocked the experiment: ${JSON.stringify({ before, rejected, after })}`);
  }
  return {
    error: rejected.error.code,
    expected_protocol_hash: approval.protocol_hash,
    rejected_protocol_hash: wrongHash,
    before_state_revision: before.state_revision,
    rejected_state_revision: rejected.state_revision,
    after_state_revision: after.state_revision,
    resulting_batch_id: after.data.agent_context?.artifacts?.batch_id ?? null,
    state_unchanged: true,
  };
}

function assertRunApprovalBinding(batch, approval) {
  const { modelVersion, ...approvedProtocolSnapshot } = approval.protocol;
  if (JSON.stringify(batch.approval) !== JSON.stringify(approvalCommitment(approval))
    || JSON.stringify(batch.protocol) !== JSON.stringify(approvedProtocolSnapshot)
    || modelVersion !== batch.model?.version
    || batch.experimentId !== approval.experiment_id
    || batch.protocol.seedPolicy?.version !== approval.seed_policy_version
    || batch.protocol.metricMethodVersion !== approval.metric_method_version) {
    throw new Error(`Simulation did not carry the exact approved protocol binding: ${JSON.stringify({ batchApproval: batch.approval, batchProtocol: batch.protocol, approval })}`);
  }
  return {
    protocol_hash: approval.protocol_hash,
    seed_manifest_hash: approval.seed_manifest_hash,
    exact_protocol_snapshot: true,
  };
}

async function verifyBrowserExportControls(saved) {
  const evidenceExport = saved.data?.evidence_export;
  const expectedFilename = saved.data?.export_filename;
  if (!evidenceExport || typeof expectedFilename !== 'string' || !expectedFilename.endsWith('.flylab-evidence.json')) {
    throw new Error(`Saved evidence did not publish a browser export filename: ${JSON.stringify(saved.data)}`);
  }
  const expectedSerialized = `${JSON.stringify(evidenceExport, null, 2)}\n`;
  const expectedSerializedHash = `sha256:${createHash('sha256').update(expectedSerialized).digest('hex')}`;
  const downloadDirectory = join(profile, 'verified-downloads');
  const downloadedFile = join(downloadDirectory, expectedFilename);
  await mkdir(downloadDirectory, { recursive: true });
  await sendCommand('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDirectory,
    eventsEnabled: true,
  });
  await sendCommand('Browser.grantPermissions', {
    origin: new URL(targetUrl).origin,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  const uiResponse = await sendCommand('Runtime.evaluate', {
    expression: `(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      let modal = document.querySelector('.evidence-modal');
      if (!modal) {
        const ledger = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Evidence ledger'));
        ledger?.click();
        await wait(100);
        modal = document.querySelector('.evidence-modal');
      }
      const buttons = modal ? [...modal.querySelectorAll('button')] : [];
      const download = buttons.find((button) => button.textContent?.includes('Download evidence JSON'));
      const copy = buttons.find((button) => button.textContent?.includes('Copy bundle JSON'));
      const textarea = modal?.querySelector('textarea[aria-label="Complete bundle JSON"]');
      if (!(download instanceof HTMLButtonElement)
        || !(copy instanceof HTMLButtonElement)
        || !(textarea instanceof HTMLTextAreaElement)) {
        return JSON.stringify({ ready: false, modal: Boolean(modal), download: Boolean(download), copy: Boolean(copy), textarea: Boolean(textarea) });
      }
      const digest = async (value) => {
        const bytes = new TextEncoder().encode(value);
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        return 'sha256:' + [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      };
      const manualJson = textarea.value;
      download.click();
      copy.click();
      await wait(120);
      const clipboardJson = await navigator.clipboard.readText();
      return JSON.stringify({
        ready: true,
        download_label: download.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
        copy_label: copy.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
        manual_bytes: new TextEncoder().encode(manualJson).byteLength,
        manual_sha256: await digest(manualJson),
        clipboard_matches_manual: clipboardJson === manualJson,
      });
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  const uiValue = typeof uiResponse?.result?.value === 'string'
    ? JSON.parse(uiResponse.result.value)
    : null;
  for (let attempt = 0; attempt < 100 && !existsSync(downloadedFile); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!existsSync(downloadedFile)) {
    throw new Error(`Browser did not create the expected portable evidence file: ${JSON.stringify({ expectedFilename, uiValue })}`);
  }
  const downloadedBytes = await readFile(downloadedFile);
  const downloadedText = downloadedBytes.toString('utf8');
  let downloadedJson = null;
  try {
    downloadedJson = JSON.parse(downloadedText);
  } catch {
    // The assertion below reports the malformed output without printing its full contents.
  }
  if (uiValue?.ready !== true
    || uiValue.manual_sha256 !== expectedSerializedHash
    || uiValue.clipboard_matches_manual !== true
    || downloadedText !== expectedSerialized
    || JSON.stringify(downloadedJson) !== JSON.stringify(evidenceExport)) {
    throw new Error(`Browser export controls diverged from the returned evidence envelope: ${JSON.stringify({
      expectedFilename,
      expectedSerializedHash,
      uiValue,
      downloadedBytes: downloadedBytes.byteLength,
      downloadedHash: `sha256:${createHash('sha256').update(downloadedBytes).digest('hex')}`,
    })}`);
  }
  await clickButton({ ariaLabel: 'Close evidence ledger' });
  return {
    browser_observable_download: true,
    filename: expectedFilename,
    bytes: downloadedBytes.byteLength,
    sha256: expectedSerializedHash,
    downloaded_envelope_exact: true,
    clipboard_matches_manual_fallback: true,
    manual_fallback_sha256: uiValue.manual_sha256,
  };
}

function verifySavedEvidenceExport(saved, expected) {
  const bundle = saved.data?.bundle;
  const evidenceExport = saved.data?.evidence_export;
  const payload = evidenceExport?.payload;
  if (!bundle
    || saved.data?.export_media_type !== 'application/vnd.flylab.evidence+json'
    || saved.data?.export_schema_url !== 'https://flylab-neuroethology.d-lougen.chatgpt.site/schemas/flylab-evidence-export-v3.schema.json'
    || evidenceExport?.schema !== 'flylab.evidence-export'
    || evidenceExport?.schemaVersion !== 3
    || evidenceExport?.integrity?.scope !== 'payload'
    || evidenceExport?.integrity?.serialization !== 'JSON.stringify(payload)'
    || !payload
    || JSON.stringify(evidenceExport.bundle) !== JSON.stringify(bundle)) {
    throw new Error(`save_fly_evidence did not expose the exact v3 evidence export: ${JSON.stringify(saved.data)}`);
  }
  if (typeof validateEvidenceExportSchema !== 'function') {
    throw new Error('The served evidence-export JSON Schema was not loaded before validating a saved bundle.');
  }
  const schemaValid = validateEvidenceExportSchema(evidenceExport);
  if (!schemaValid) {
    throw new Error(`Saved evidence did not validate against the served export schema: ${JSON.stringify(validateEvidenceExportSchema.errors)}`);
  }
  if (!['experiment', 'mission'].includes(bundle.scope)
    || payload.scope !== bundle.scope
    || (expected.scope && bundle.scope !== expected.scope)
    || payload.format !== (bundle.scope === 'mission'
      ? 'flylab.mission-evidence-bundle.v3'
      : 'flylab.experiment-evidence-bundle.v3')) {
    throw new Error(`Evidence-export scope and payload format diverged: ${JSON.stringify({ bundle, payload })}`);
  }

  const computedManifestHash = sha256Json(payload);
  if (bundle.manifestHash !== computedManifestHash
    || evidenceExport.integrity.manifestHash !== computedManifestHash) {
    throw new Error(`Evidence-export payload hash did not match bundle and integrity metadata: ${JSON.stringify({
      computedManifestHash,
      bundleHash: bundle.manifestHash,
      integrityHash: evidenceExport.integrity.manifestHash,
    })}`);
  }

  const groups = [
    {
      name: 'hypothesis support',
      evidence: payload.supportingEvidence,
      sources: payload.supportingSources,
      evidenceIds: bundle.supportingEvidenceIds,
      sourceIds: bundle.supportingSourceIds,
    },
    {
      name: 'circuit context',
      evidence: payload.contextEvidence,
      sources: payload.contextSources,
      evidenceIds: bundle.contextEvidenceIds,
      sourceIds: bundle.contextSourceIds,
    },
    {
      name: 'model method',
      evidence: payload.methodEvidence,
      sources: payload.methodSources,
      evidenceIds: bundle.methodEvidenceIds,
      sourceIds: bundle.methodSourceIds,
    },
  ];
  for (const group of groups) {
    if (!Array.isArray(group.evidence) || !Array.isArray(group.sources)
      || !Array.isArray(group.evidenceIds) || !Array.isArray(group.sourceIds)) {
      throw new Error(`Evidence export omitted the ${group.name} closure.`);
    }
    assertSameStringSet(group.evidence.map((record) => record.id), group.evidenceIds, `${group.name} evidence IDs`);
    assertSameStringSet(group.sources.map((record) => record.id), group.sourceIds, `${group.name} source IDs`);
    assertSameStringSet(
      group.evidence.flatMap((record) => record.sourceIds ?? []),
      group.sourceIds,
      `${group.name} evidence-to-source closure`,
    );
    const sourceSet = new Set(group.sourceIds);
    for (const evidence of group.evidence) {
      if (!Array.isArray(evidence.sourceIds)
        || evidence.sourceIds.some((sourceId) => !sourceSet.has(sourceId))
        || !Array.isArray(evidence.sourceSupport)) {
        throw new Error(`${group.name} record ${evidence.id} has unresolved source lineage.`);
      }
      assertSameStringSet(
        evidence.sourceSupport.map((mapping) => mapping.sourceId),
        evidence.sourceIds,
        `${group.name} record ${evidence.id} locator closure`,
      );
    }
  }
  if (!Array.isArray(payload.catalogSources) || !Array.isArray(bundle.catalogSourceIds)) {
    throw new Error('Evidence export omitted the dataset-catalog source closure.');
  }
  assertSameStringSet(
    payload.catalogSources.map((source) => source.id),
    bundle.catalogSourceIds,
    'dataset catalog source IDs',
  );
  const sourceRecordIds = new Set([
    ...groups.flatMap((group) => group.sources.map((source) => source.id)),
    ...payload.catalogSources.map((source) => source.id),
    ...(Array.isArray(payload.mission?.sources) ? payload.mission.sources.map((source) => source.id) : []),
  ]);
  const payloadManifestSourceIds = uniqueSortedStrings(
    payload.provenanceManifest?.entries?.flatMap((entry) => entry.source_ids ?? []) ?? [],
  );
  const unresolvedManifestSources = payloadManifestSourceIds.filter((id) => !sourceRecordIds.has(id));
  const manifestSourcesMissingFromBundle = payloadManifestSourceIds.filter((id) => !bundle.includedIds.includes(id));
  const datasetManifestEntry = payload.provenanceManifest?.entries?.find((entry) => entry.path === '/datasets');
  if (unresolvedManifestSources.length
    || manifestSourcesMissingFromBundle.length
    || !datasetManifestEntry?.artifact_id
    || !bundle.includedIds.includes(datasetManifestEntry.artifact_id)) {
    throw new Error(`Portable provenance manifest is not globally source-closed: ${JSON.stringify({
      unresolvedManifestSources,
      manifestSourcesMissingFromBundle,
      datasetManifestEntry,
    })}`);
  }
  assertSameStringSet(payload.hypothesis?.evidenceIds ?? [], bundle.supportingEvidenceIds, 'hypothesis supporting evidence closure');
  const selectedCircuitEvidenceIds = payload.circuit?.evidenceIds ?? [];
  const selectedCircuitEvidenceIdSet = new Set(selectedCircuitEvidenceIds);
  const nonMethodEvidenceOutsideCircuit = groups
    .filter((group) => group.name !== 'model method')
    .flatMap((group) => group.evidenceIds)
    .filter((evidenceId) => !selectedCircuitEvidenceIdSet.has(evidenceId));
  if (nonMethodEvidenceOutsideCircuit.length) {
    throw new Error(`Supporting or circuit-context evidence escaped the selected-circuit partition: ${JSON.stringify(nonMethodEvidenceOutsideCircuit)}`);
  }
  assertSameStringSet(
    groups.flatMap((group) => group.evidenceIds).filter((evidenceId) => selectedCircuitEvidenceIdSet.has(evidenceId)),
    selectedCircuitEvidenceIds,
    'complete selected-circuit evidence partition',
  );

  if (payload.hypothesis?.id !== expected.hypothesis.id
    || payload.experiment?.id !== expected.experiment.id
    || payload.batch?.id !== expected.batch.id
    || !payload.analyses?.some((analysis) => analysis.id === expected.analysis.id)
    || payload.comparison?.id !== expected.comparison.id) {
    throw new Error(`Evidence export did not preserve the executed artifact chain: ${JSON.stringify({ payload, expected })}`);
  }
  if (expected.approval
    && (payload.approval?.protocol_hash !== expected.approval.protocol_hash
      || payload.approval?.seed_manifest_hash !== expected.approval.seed_manifest_hash
      || payload.approval?.experiment_id !== expected.experiment.id)) {
    throw new Error(`Evidence export did not preserve the exact immutable approval: ${JSON.stringify({ approval: payload.approval, expected: expected.approval })}`);
  }
  if (JSON.stringify(payload.batch?.approval) !== JSON.stringify(payload.approval)
    || JSON.stringify(payload.batch?.approval) !== JSON.stringify(expected.batch?.approval)) {
    throw new Error(`Evidence export batch approval is not exactly bound to the saved and executed approval: ${JSON.stringify({
      batchApproval: payload.batch?.approval,
      payloadApproval: payload.approval,
      executedBatchApproval: expected.batch?.approval,
    })}`);
  }
  if (payload.batch?.boundary !== payload.batch?.model?.boundary
    || payload.batch?.boundary !== payload.model?.boundary
    || payload.batch?.boundary !== expected.batch?.model?.boundary) {
    throw new Error(`Evidence export batch boundary is not exactly bound to the saved model boundary: ${JSON.stringify({
      batchBoundary: payload.batch?.boundary,
      batchModelBoundary: payload.batch?.model?.boundary,
      payloadModelBoundary: payload.model?.boundary,
      expectedModelBoundary: expected.batch?.model?.boundary,
    })}`);
  }

  let missionAudit = null;
  if (bundle.scope === 'mission') {
    const mission = payload.mission;
    const decision = mission?.discoveryDecision;
    const candidateCircuits = mission?.candidateCircuits;
    const missionEvidence = mission?.evidence;
    const missionSources = mission?.sources;
    if (!mission
      || typeof mission.goal !== 'string'
      || !mission.goal
      || typeof mission.boundary !== 'string'
      || !mission.boundary
      || decision?.schema !== 'flylab.discovery-decision'
      || decision?.schemaVersion !== 1
      || (expected.discoveryDecision && decision.id !== expected.discoveryDecision.id)
      || !Array.isArray(candidateCircuits)
      || !Array.isArray(missionEvidence)
      || !Array.isArray(missionSources)) {
      throw new Error(`Mission export omitted its persisted discovery decision or source-closed candidate catalog: ${JSON.stringify(mission)}`);
    }
    assertSameStringSet(
      candidateCircuits.map((candidate) => candidate.id),
      decision.candidates.map((candidate) => candidate.circuitId),
      'mission candidate-circuit decision closure',
    );
    const requiredMissionEvidenceIds = uniqueSortedStrings(candidateCircuits.flatMap((candidate) => candidate.evidenceIds ?? []));
    const requiredMissionSourceIds = uniqueSortedStrings(missionEvidence.flatMap((record) => record.sourceIds ?? []));
    assertSameStringSet(missionEvidence.map((record) => record.id), requiredMissionEvidenceIds, 'mission candidate evidence closure');
    assertSameStringSet(missionSources.map((source) => source.id), requiredMissionSourceIds, 'mission candidate source closure');
    for (const candidate of candidateCircuits) {
      if (!candidate.motor_map
        || candidate.motor_map.circuitId !== candidate.id
        || candidate.motor_map.id !== candidate.motorMapId
        || !Array.isArray(candidate.motor_map.nodes)
        || !Array.isArray(candidate.motor_map.edges)) {
        throw new Error(`Mission candidate ${candidate?.id} omitted its full motor map: ${JSON.stringify(candidate)}`);
      }
    }
    const requiredMissionIncludedIds = uniqueSortedStrings([
      decision.id,
      ...candidateCircuits.flatMap((candidate) => [
        candidate.id,
        candidate.motor_map.id,
        ...candidate.motor_map.nodes.map((node) => node.id),
        ...candidate.motor_map.edges.map((edge) => edge.id),
      ]),
      ...requiredMissionEvidenceIds,
      ...requiredMissionSourceIds,
    ]);
    const missionMissingFromBundle = requiredMissionIncludedIds.filter((id) => !bundle.includedIds.includes(id));
    if (missionMissingFromBundle.length) {
      throw new Error(`Mission bundle includedIds omitted discovery artifacts: ${JSON.stringify(missionMissingFromBundle)}`);
    }
    missionAudit = {
      discovery_decision_id: decision.id,
      candidate_circuits: candidateCircuits.length,
      rejected_alternatives: decision.rejectedAlternatives.length,
      evidence_records: missionEvidence.length,
      source_records: missionSources.length,
      source_closed: true,
    };
  } else if (payload.mission !== null) {
    throw new Error(`Experiment-scope export unexpectedly included mission contents: ${JSON.stringify(payload.mission)}`);
  }
  const conditionIds = payload.experiment.conditions.map((condition) => condition.id);
  const runIds = payload.batch.conditionRuns.flatMap((conditionRun) => conditionRun.runIds);
  const replicateIds = payload.batch.conditionRuns.flatMap((conditionRun) => conditionRun.replicates.map((replicate) => replicate.id));
  const perRunTrajectoryIds = payload.batch.conditionRuns.flatMap((conditionRun) => conditionRun.replicates.map((replicate) => replicate.trajectoryId));
  const illustrativeTrajectoryIds = payload.batch.conditionRuns.map((conditionRun) => conditionRun.trajectoryId);
  const proposalId = payload.comparison?.proposal?.id;
  assertSameStringSet(conditionIds, expected.experiment.conditions.map((condition) => condition.id), 'saved condition IDs');
  assertSameStringSet(runIds, replicateIds, 'saved run and replicate IDs');
  if (!proposalId || proposalId !== expected.comparison.proposal.id) {
    throw new Error(`Evidence export omitted the compared follow-up proposal: ${JSON.stringify({ proposalId, expected: expected.comparison.proposal.id })}`);
  }
  const includedIds = new Set(bundle.includedIds);
  const requiredIncludedIds = [
    ...conditionIds,
    ...runIds,
    ...perRunTrajectoryIds,
    ...illustrativeTrajectoryIds,
    proposalId,
    ...(expected.approval ? [expected.approval.protocol_hash, expected.approval.seed_manifest_hash] : []),
  ];
  if (requiredIncludedIds.some((id) => !includedIds.has(id))) {
    throw new Error(`Bundle includedIds omitted conditions, runs, or the proposal: ${JSON.stringify({ requiredIncludedIds, includedIds: bundle.includedIds })}`);
  }

  const provenanceIndex = bundle.provenanceIndex;
  const provenanceCounts = bundle.provenanceCounts;
  if (!provenanceIndex || !provenanceCounts
    || JSON.stringify(Object.keys(provenanceIndex).sort()) !== JSON.stringify([...provenanceLabels].sort())) {
    throw new Error(`Bundle did not publish the complete provenance index: ${JSON.stringify({ provenanceIndex, provenanceCounts })}`);
  }
  for (const label of provenanceLabels) {
    const indexedIds = provenanceIndex[label];
    if (!Array.isArray(indexedIds)
      || indexedIds.length !== new Set(indexedIds).size
      || JSON.stringify(indexedIds) !== JSON.stringify([...indexedIds].sort())
      || provenanceCounts[label] !== indexedIds.length) {
      throw new Error(`Bundle provenance index/count mismatch for ${label}: ${JSON.stringify({ indexedIds, count: provenanceCounts[label] })}`);
    }
  }
  const expectedIndexMembership = [
    ...conditionIds.map((id) => [id, 'agent_hypothesized']),
    ...runIds.map((id) => [id, 'simulation_predicted']),
    ...perRunTrajectoryIds.map((id) => [id, 'simulation_predicted']),
    ...illustrativeTrajectoryIds.map((id) => [id, 'simulation_predicted']),
    [proposalId, 'agent_hypothesized'],
    [payload.hypothesis.id, 'agent_hypothesized'],
    [payload.experiment.id, 'agent_hypothesized'],
    ...(expected.approval ? [
      [expected.approval.protocol_hash, 'agent_hypothesized'],
      [expected.approval.seed_manifest_hash, 'agent_hypothesized'],
    ] : []),
    [payload.batch.id, 'simulation_predicted'],
    [payload.analyses[0].id, 'derived'],
    [payload.analyses[0].id, 'simulation_predicted'],
    [payload.comparison.id, 'derived'],
    [payload.comparison.id, 'simulation_predicted'],
    [bundle.id, 'derived'],
  ];
  for (const [id, label] of expectedIndexMembership) {
    if (!provenanceIndex[label].includes(id)) {
      throw new Error(`Bundle provenance index omitted ${id} from ${label}.`);
    }
  }
  for (const group of groups) {
    for (const evidence of group.evidence) {
      if (!provenanceIndex[evidence.provenance]?.includes(evidence.id)) {
        throw new Error(`Bundle provenance index omitted evidence record ${evidence.id} from ${evidence.provenance}.`);
      }
    }
  }
  if (bundle.scope === 'mission') {
    const mission = payload.mission;
    if (!provenanceIndex.derived.includes(mission.discoveryDecision.id)) {
      throw new Error(`Bundle provenance index omitted discovery decision ${mission.discoveryDecision.id}.`);
    }
    for (const source of mission.sources) {
      if (!provenanceIndex.derived.includes(source.id)) {
        throw new Error(`Bundle provenance index omitted mission source ${source.id}.`);
      }
    }
    for (const evidence of mission.evidence) {
      if (!provenanceIndex[evidence.provenance]?.includes(evidence.id)) {
        throw new Error(`Bundle provenance index omitted mission evidence ${evidence.id} from ${evidence.provenance}.`);
      }
    }
    for (const candidate of mission.candidateCircuits) {
      for (const label of candidate.provenance) {
        if (!provenanceIndex[label]?.includes(candidate.id)) {
          throw new Error(`Bundle provenance index omitted mission candidate ${candidate.id} from ${label}.`);
        }
      }
    }
  }

  const annotation = payload.annotation;
  const payloadManifest = payload.provenanceManifest;
  const allScientificallyIndexedIds = provenanceLabels.flatMap((label) => provenanceIndex[label]);
  if (annotation !== null
    || bundle.annotation !== null
    || bundle.includedIds.some((id) => id.startsWith('annotation_'))
    || allScientificallyIndexedIds.some((id) => id.startsWith('annotation_'))
    || payloadManifest?.schema_version !== 'flylab.provenance-manifest.v1'
    || !payloadManifest.operational_paths?.includes('/annotation')
    || !payloadManifest.operational_paths?.includes('/systemMetadata')
    || payloadManifest.entries?.some((entry) => entry.path === '/annotation' || entry.path.startsWith('/annotation/'))) {
    throw new Error(`Default evidence save invented or misclassified an administrative annotation: ${JSON.stringify({ annotation, bundleAnnotation: bundle.annotation, provenanceIndex, payloadManifest })}`);
  }
  assertSameStringSet(
    payloadManifest.entries.flatMap((entry) => entry.labels),
    provenanceLabels.filter((label) => provenanceIndex[label].length > 0),
    'payload provenance-manifest label coverage',
  );

  const lineageEdges = bundle.lineageEdges;
  if (!Array.isArray(lineageEdges) || !lineageEdges.length) {
    throw new Error('Evidence bundle did not expose lineageEdges.');
  }
  const hasEdge = (from, relation, to) => lineageEdges.some((edge) => (
    edge.from === from && edge.relation === relation && edge.to === to
  ));
  for (const sourceId of bundle.catalogSourceIds) {
    if (!hasEdge(datasetManifestEntry.artifact_id, 'catalogs_source', sourceId)) {
      throw new Error(`Dataset manifest lineage omitted catalog source ${sourceId}.`);
    }
  }
  for (const group of groups) {
    for (const evidence of group.evidence) {
      for (const sourceId of evidence.sourceIds) {
        if (!hasEdge(evidence.id, 'supported_by', sourceId)) {
          throw new Error(`Lineage graph omitted ${evidence.id} -> ${sourceId}.`);
        }
      }
    }
  }
  if (bundle.scope === 'mission') {
    for (const evidence of payload.mission.evidence) {
      for (const sourceId of evidence.sourceIds) {
        if (!hasEdge(evidence.id, 'supported_by', sourceId)) {
          throw new Error(`Mission lineage omitted ${evidence.id} -> ${sourceId}.`);
        }
      }
    }
  }
  for (const evidenceId of bundle.supportingEvidenceIds) {
    if (!hasEdge(payload.hypothesis.id, 'cites_hypothesis_support', evidenceId)) {
      throw new Error(`Lineage graph omitted hypothesis support ${evidenceId}.`);
    }
  }
  for (const conditionId of conditionIds) {
    if (!hasEdge(payload.experiment.id, 'has_condition', conditionId)) {
      throw new Error(`Lineage graph omitted experiment condition ${conditionId}.`);
    }
  }
  for (const conditionRun of payload.batch.conditionRuns) {
    for (const runId of conditionRun.runIds) {
      if (!hasEdge(payload.batch.id, `contains_run_for:${conditionRun.conditionId}`, runId)) {
        throw new Error(`Lineage graph omitted simulation run ${runId}.`);
      }
    }
    for (const replicate of conditionRun.replicates) {
      if (!hasEdge(replicate.id, 'has_per_run_trajectory', replicate.trajectoryId)) {
        throw new Error(`Lineage graph omitted per-run trajectory ${replicate.trajectoryId}.`);
      }
    }
    if (!hasEdge(payload.batch.id, `has_illustrative_replay_for:${conditionRun.conditionId}`, conditionRun.trajectoryId)) {
      throw new Error(`Lineage graph omitted illustrative replay ${conditionRun.trajectoryId}.`);
    }
  }
  if (!hasEdge(proposalId, 'proposed_from_comparison', payload.comparison.id)
    || lineageEdges.some((edge) => edge.from.startsWith('annotation_') || edge.to.startsWith('annotation_'))) {
    throw new Error(`Lineage graph mishandled the proposal or untrusted annotation: ${JSON.stringify(lineageEdges)}`);
  }
  if (expected.approval
    && (!hasEdge(expected.approval.protocol_hash, 'authorizes_exact_experiment', payload.experiment.id)
      || !hasEdge(expected.approval.protocol_hash, 'commits_seed_manifest', expected.approval.seed_manifest_hash))) {
    throw new Error('Lineage graph omitted the exact operator-authorization and seed-manifest commitments.');
  }
  if (bundle.scope === 'mission') {
    const decision = payload.mission.discoveryDecision;
    for (const candidate of decision.candidates) {
      if (!hasEdge(decision.id, 'considered_circuit', candidate.circuitId)) {
        throw new Error(`Mission lineage omitted considered circuit ${candidate.circuitId}.`);
      }
    }
    if (decision.selectedCircuitId
      && !hasEdge(decision.id, 'recommends', decision.selectedCircuitId)) {
      throw new Error(`Mission lineage omitted selected recommendation ${decision.selectedCircuitId}.`);
    }
    for (const rejected of decision.rejectedAlternatives) {
      if (!hasEdge(decision.id, 'rejected_alternative', rejected.circuitId)) {
        throw new Error(`Mission lineage omitted rejected alternative ${rejected.circuitId}.`);
      }
    }
  }

  return {
    schema: evidenceExport.schema,
    schema_version: evidenceExport.schemaVersion,
    schema_url: saved.data.export_schema_url,
    media_type: saved.data.export_media_type,
    served_schema_valid: true,
    manifest_hash: computedManifestHash,
    evidence_records: groups.reduce((count, group) => count + group.evidence.length, 0),
    source_records: uniqueSortedStrings([
      ...groups.flatMap((group) => group.sourceIds),
      ...bundle.catalogSourceIds,
    ]).length,
    manifest_source_records: payloadManifestSourceIds.length,
    globally_source_closed: true,
    condition_ids: conditionIds,
    run_ids: runIds.length,
    per_run_trajectory_ids: perRunTrajectoryIds.length,
    illustrative_trajectory_ids: illustrativeTrajectoryIds.length,
    proposal_id: proposalId,
    provenance_counts: provenanceCounts,
    lineage_edges: lineageEdges.length,
    scope: bundle.scope,
    mission: missionAudit,
    untrusted_annotation_excluded: true,
  };
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
  const operationReplays = {};
  for (const [toolName, input] of calls) {
    const response = await invokeRegisteredTool(tools, toolName, input);
    const envelope = successfulEnvelope(response, toolName);
    if (envelope.data?.next_action?.kind !== 'complete') {
      throw new Error(`${toolName} regressed a completed lineage: ${JSON.stringify(envelope.data?.next_action)}`);
    }
    if (toolName === 'design_stimulation_trial' && envelope.data.experiment?.approved !== true) {
      throw new Error(`Idempotent design lost operator approval: ${JSON.stringify(envelope.data.experiment)}`);
    }
    if ((toolName === 'run_fly_simulation' || toolName === 'save_fly_evidence')
      && (envelope.idempotent_replay !== true
        || envelope.operation_id !== input.operation_id
        || envelope.previous_state_revision !== envelope.state_revision
        || envelope.created_artifact_ids.length !== 0)) {
      throw new Error(`${toolName} retry was not a mutation-free operation replay: ${JSON.stringify(envelope)}`);
    }
    if (toolName === 'run_fly_simulation' || toolName === 'save_fly_evidence') {
      operationReplays[toolName] = {
        operation_id: envelope.operation_id,
        previous_state_revision: envelope.previous_state_revision,
        state_revision: envelope.state_revision,
        idempotent_replay: envelope.idempotent_replay,
        created_artifact_ids: envelope.created_artifact_ids,
      };
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
  const beforeConflict = successfulEnvelope(
    await invokeRegisteredTool(tools, 'inspect_flylab_state', {}),
    'inspect_flylab_state',
  );
  const runConflict = failedEnvelope(await invokeRegisteredTool(tools, 'run_fly_simulation', {
    ...inputs.run,
    approved_protocol_hash: `sha256:${'0'.repeat(64)}`,
  }), 'run_fly_simulation', 'INVALID_INPUT', 'run_fly_simulation');
  const saveConflict = failedEnvelope(await invokeRegisteredTool(tools, 'save_fly_evidence', {
    ...inputs.save,
    note: 'Conflicting operation reuse must fail without mutating the saved lineage.',
  }), 'save_fly_evidence', 'INVALID_INPUT', 'save_fly_evidence');
  const afterConflict = successfulEnvelope(
    await invokeRegisteredTool(tools, 'inspect_flylab_state', {}),
    'inspect_flylab_state',
  );
  if (runConflict.error.details?.conflict !== 'operation_id_input_mismatch'
    || saveConflict.error.details?.conflict !== 'operation_id_input_mismatch'
    || runConflict.recovery?.input?.operation_id !== '<new_operation_id>'
    || saveConflict.recovery?.input?.operation_id !== '<new_operation_id>'
    || runConflict.state_revision !== beforeConflict.state_revision
    || saveConflict.state_revision !== beforeConflict.state_revision
    || afterConflict.state_revision !== beforeConflict.state_revision
    || afterConflict.data.agent_context?.artifacts?.batch_id !== context.artifacts.batch_id
    || afterConflict.data.agent_context?.artifacts?.evidence_bundle_id !== savedBundle.id) {
    throw new Error(`Conflicting operation-ID reuse changed the completed lineage: ${JSON.stringify({ beforeConflict, runConflict, saveConflict, afterConflict })}`);
  }
  return {
    calls: verified,
    final_stage: context.state.stage,
    stable_bundle_id: repeatedBundle.id,
    stable_manifest_hash: repeatedBundle.manifestHash,
    stable_saved_at: repeatedBundle.savedAt,
    replay_created_artifacts: 0,
    operation_replays: operationReplays,
    conflicting_run_operation_error: runConflict.error.code,
    conflicting_save_operation_error: saveConflict.error.code,
    conflict_state_unchanged: true,
  };
}

async function runFullWorkflow(tools, discoveryResponse, initialContext, options = {}) {
  const cleanCapture = options.cleanDemoCapture === true;
  const discovery = successfulEnvelope(discoveryResponse, 'find_fly_circuits');
  const discoveryDecision = assertDiscoveryDecisionAndCandidateRecords(discovery, 'MDN discovery');
  const circuit = discovery.data.circuits[0];
  const contextOnlyEvidence = discovery.data.evidence.find((record) => record.role !== 'hypothesis_support');
  const structuralOnlyEvidence = discovery.data.evidence.find((record) => (
    record.role === 'hypothesis_support' && record.support?.kind === 'structural_path'
  ));
  const wrongPerturbationEvidence = discovery.data.evidence.find((record) => (
    record.role === 'hypothesis_support'
    && record.support?.kind === 'perturbation_effect'
    && record.support?.perturbations?.includes('silence')
  ));
  if (!contextOnlyEvidence
    || !structuralOnlyEvidence
    || !wrongPerturbationEvidence
    || discovery.data.hypothesis_eligible_evidence_ids?.includes(contextOnlyEvidence.id)) {
    throw new Error(`Discovery did not separate contextual records from hypothesis support: ${JSON.stringify(discovery.data)}`);
  }
  const evidenceIds = discovery.data.evidence
    .filter((record) => record.provenance === 'measured' && record.role === 'hypothesis_support')
    .slice(0, 4)
    .map((record) => record.id);

  const hypothesisInput = {
    circuit_id: circuit.id,
    claim: 'Activating adult MDNs in the FlyLab model should increase backward displacement relative to baseline and model-sham controls.',
    predicted_behavior: 'backward_walking',
    perturbation: 'activate',
    primary_outcome: 'backward_distance_mm',
    expected_direction: 'increase',
    controls: ['condition_baseline', 'condition_sham'],
    evidence_ids: evidenceIds,
    evidence_limitations: [
      'The cited assays do not calibrate the reduced-order FlyLab effect size.',
      'The mapped brain-to-body controller remains a declared model assumption.',
    ],
    falsification_criterion: 'The prediction fails if bilateral activation does not increase backward distance relative to the model-sham condition.',
  };
  const contextPromotionResponse = await invokeRegisteredTool(tools, 'draft_fly_hypothesis', {
    ...hypothesisInput,
    evidence_ids: [contextOnlyEvidence.id],
  });
  const contextPromotionEnvelope = decodedOutput(contextPromotionResponse)?.structuredContent;
  if (contextPromotionEnvelope?.error?.code !== 'EVIDENCE_MISMATCH'
    || !contextPromotionEnvelope.error.details?.rejected_evidence?.some((record) => record.id === contextOnlyEvidence.id)) {
    throw new Error(`Context-only evidence was promoted into hypothesis support: ${JSON.stringify(contextPromotionResponse)}`);
  }
  const structuralPromotionResponse = await invokeRegisteredTool(tools, 'draft_fly_hypothesis', {
    ...hypothesisInput,
    evidence_ids: [structuralOnlyEvidence.id],
  });
  const structuralPromotionEnvelope = decodedOutput(structuralPromotionResponse)?.structuredContent;
  if (structuralPromotionEnvelope?.error?.code !== 'EVIDENCE_MISMATCH'
    || structuralPromotionEnvelope.error.details?.required_support?.kind !== 'perturbation_effect') {
    throw new Error(`Structural evidence carried a causal hypothesis by itself: ${JSON.stringify(structuralPromotionResponse)}`);
  }
  const wrongPerturbationResponse = await invokeRegisteredTool(tools, 'draft_fly_hypothesis', {
    ...hypothesisInput,
    evidence_ids: [wrongPerturbationEvidence.id],
  });
  const wrongPerturbationEnvelope = decodedOutput(wrongPerturbationResponse)?.structuredContent;
  if (wrongPerturbationEnvelope?.error?.code !== 'EVIDENCE_MISMATCH'
    || wrongPerturbationEnvelope.error.details?.required_support?.perturbation !== 'activate') {
    throw new Error(`Silencing evidence carried an activation hypothesis: ${JSON.stringify(wrongPerturbationResponse)}`);
  }
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
    || lockedContext.human_gate?.status !== 'required'
    || lockedContext.artifact_manifest?.approval !== null) {
    throw new Error(`Inspector did not expose the non-WebMCP review gate: ${JSON.stringify(lockedContext)}`);
  }

  let preapprovalError = null;
  if (!cleanCapture) {
    const lockedRun = await invokeRegisteredTool(tools, 'run_fly_simulation', {
      experiment_id: experimentId,
      approved_protocol_hash: `sha256:${'0'.repeat(64)}`,
    });
    const lockEnvelope = decodedOutput(lockedRun)?.structuredContent;
    if (lockEnvelope?.error?.code !== 'APPROVAL_REQUIRED') {
      throw new Error(`The pre-approval run was not blocked: ${JSON.stringify(lockedRun)}`);
    }
    preapprovalError = lockEnvelope.error.code;
  }
  await captureStage('protocol-locked', { selector: '.protocol-controls', block: 'start' });

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
    throw new Error(`The visible approval control was not available: ${JSON.stringify(approval)}`);
  }
  const approved = await waitForApprovedProtocolContext(tools, designed.data.experiment);
  const approvedContext = approved.context;
  const approvalRecord = approved.approval;
  const approvalHashGuard = await verifyApprovedProtocolHashGuard(tools, designed.data.experiment, approvalRecord);
  await captureStage('operator-approved', { selector: '.protocol-controls', block: 'start' });

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
  const runApprovalAudit = assertRunApprovalBinding(run.data, approvalRecord);
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  await captureStage('simulation-replay', { selector: '.main-stage', block: 'start' });
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
  const metricDefinitionAudit = assertFormalMetricDefinitions(analysis);
  const perRunAudit = assertPerRunSimulationAndAnalysis(run.data, analysis.data.analysis, analysis.data.per_run_results);
  const visibleAnalysis = await verifyVisibleAnalysis(analysis.data.analysis, `condition_${designed.data.experiment.primaryLaterality}`);
  const conditionTabParity = await verifyConditionTabAnalysisParity(analysis.data.analysis, `condition_${designed.data.experiment.primaryLaterality}`);
  const humanBudget = await setHumanProposalBudget(tools, 5);
  await captureStage('behavior-analysis', { selector: '.results-panel', block: 'center' });

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
  await captureStage('bounded-follow-up', { selector: '.comparison-ranking', block: 'center' });

  const saveInput = {
    scope: 'mission',
    hypothesis_id: drafted.data.hypothesis.id,
    experiment_id: experimentId,
    batch_ids: [run.data.id],
    analysis_ids: [analysis.data.analysis.id],
    comparison_id: comparison.data.comparison.id,
  };
  const evidenceCancellation = cleanCapture
    ? { skipped_for_clean_demo_capture: true }
    : await verifyEvidenceSaveCancellation(tools, saveInput);
  const saveResponse = await invokeRegisteredTool(tools, 'save_fly_evidence', saveInput);
  const saved = successfulEnvelope(saveResponse, 'save_fly_evidence');
  const evidenceExportAudit = verifySavedEvidenceExport(saved, {
    scope: 'mission',
    discoveryDecision,
    hypothesis: drafted.data.hypothesis,
    experiment: designed.data.experiment,
    approval: approvalRecord,
    batch: run.data,
    analysis: analysis.data.analysis,
    comparison: comparison.data.comparison,
  });
  const browserExportAudit = await verifyBrowserExportControls(saved);
  const completedContext = await inspectAgentContext(tools);
  const recoveredArtifacts = completedContext.artifact_manifest;
  if (completedContext.agent_status !== 'complete'
    || completedContext.next_tool !== null
    || completedContext.next_action?.kind !== 'complete'
    || recoveredArtifacts.hypothesis?.id !== drafted.data.hypothesis.id
    || recoveredArtifacts.experiment?.id !== experimentId
    || recoveredArtifacts.batch?.id !== run.data.id
    || recoveredArtifacts.batch?.run_hash !== run.data.runHash
    || !recoveredArtifacts.analyses?.some((record) => record.id === analysis.data.analysis.id)
    || recoveredArtifacts.comparison?.id !== comparison.data.comparison.id
    || recoveredArtifacts.comparison?.proposal?.id !== comparison.data.comparison.proposal.id
    || recoveredArtifacts.evidence_bundle?.id !== saved.data.bundle.id
    || recoveredArtifacts.evidence_bundle?.manifest_hash !== saved.data.bundle.manifestHash) {
    throw new Error(`Inspector did not expose workflow completion: ${JSON.stringify(completedContext)}`);
  }
  const idempotency = cleanCapture
    ? { skipped_for_clean_demo_capture: true }
    : await verifyCompletedLineageIdempotency(tools, {
      discovery: { query: 'MDN', behavior: 'backward_walking' },
      hypothesis: hypothesisInput,
      design: designInput,
      run: {
        experiment_id: experimentId,
        approved_protocol_hash: approvalRecord.protocol_hash,
        operation_id: run.operation_id,
      },
      analysis: analysisInput,
      comparison: comparisonInput,
      save: { ...saveInput, operation_id: saved.operation_id },
    }, saved.data.bundle);
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
  await prepareEvidenceModalCapture({
    expectedSelection: saved.data.bundle.title,
    navPosition: 'end',
  });
  await captureStage('evidence-saved');
  await clickButton({ text: 'Pinned MDN-to-LBL40 v3 predicted links' });
  await new Promise((resolve) => setTimeout(resolve, 160));
  await prepareEvidenceModalCapture({
    expectedSelection: 'Pinned MDN-to-LBL40 v3 predicted links',
    navPosition: 'start',
  });
  await captureStage('evidence-ledger');
  const editInvalidationVerified = await verifyProtocolEditInvalidation(tools, experimentId);

  return {
    sequence: [
      'inspect_flylab_state',
      'find_fly_circuits',
      'draft_fly_hypothesis',
      'design_stimulation_trial',
      'visible_operator_approval_control_dom_click',
      'run_fly_simulation',
      'analyze_fly_behavior',
      'compare_fly_trials',
      'save_fly_evidence',
    ],
    clean_demo_capture: cleanCapture,
    preapproval_error: preapprovalError,
    context_only_support_error: contextPromotionEnvelope.error.code,
    structural_only_support_error: structuralPromotionEnvelope.error.code,
    wrong_perturbation_support_error: wrongPerturbationEnvelope.error.code,
    visible_protocol_verified: Boolean(visibleProtocol),
    visible_analysis_verified: Boolean(visibleAnalysis),
    condition_tab_analysis_parity: conditionTabParity,
    human_proposal_budget: humanBudget,
    visible_comparison_verified: Boolean(visibleComparison),
    visible_bundle_verified: Boolean(visibleBundle),
    evidence_export_audit: evidenceExportAudit,
    browser_export_audit: browserExportAudit,
    metric_definition_audit: metricDefinitionAudit,
    per_run_audit: perRunAudit,
    run_approval_audit: runApprovalAudit,
    approval: {
      protocol_hash: approvalRecord.protocol_hash,
      seed_manifest_hash: approvalRecord.seed_manifest_hash,
      approved_at: approvalRecord.approved_at,
      wrong_hash_guard: approvalHashGuard,
    },
    inspector: {
      initial_next_tool: initialContext.next_tool,
      blocked_status: lockedContext.agent_status,
      post_approval_next_tool: approvedContext.next_tool,
      final_status: completedContext.agent_status,
      context_contract: completedContext.schema_version,
      artifact_manifest_recovered: true,
    },
    cancellation: {
      commit_boundary: 'prepare -> combined AbortSignal check -> synchronous state commit',
      abort_sources: [
        'execute callback AbortSignal',
        'Chrome 151 toolcancel compatibility event',
        'visible operator cancel control',
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

function assertGfMotorMapClosure(discovery) {
  const circuit = discovery.data?.circuits?.[0];
  const motorMap = circuit?.motor_map;
  const evidenceById = new Map((discovery.data?.evidence ?? []).map((record) => [record.id, record]));
  const sourceIds = new Set((discovery.data?.evidence ?? []).flatMap((record) => (
    (record.sources ?? []).map((source) => source.id)
  )));
  if (circuit?.id !== 'circuit_gf_adult' || motorMap?.motorProgram !== 'short_mode_escape') {
    throw new Error(`GF discovery did not return the short-mode motor map: ${JSON.stringify(discovery.data)}`);
  }
  for (const item of [...motorMap.nodes, ...motorMap.edges]) {
    for (const evidenceId of item.evidenceIds ?? []) {
      if (!evidenceById.has(evidenceId)) {
        throw new Error(`GF motor-map item ${item.id} has unresolved evidence ${evidenceId}.`);
      }
    }
    for (const sourceId of item.sourceIds ?? []) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`GF motor-map item ${item.id} has unresolved source ${sourceId}.`);
      }
    }
  }
  const gfTtmn = motorMap.edges.find((edge) => edge.id === 'edge_gf_ttmn');
  const gfPsi = motorMap.edges.find((edge) => edge.id === 'edge_gf_psi');
  if (!gfTtmn?.sourceIds?.includes('SRC-ALLEN-EJN-2007')
    || gfPsi?.sourceIds?.includes('SRC-ALLEN-EJN-2007')) {
    throw new Error(`GF edge-level source attribution is overbroad: ${JSON.stringify({ gfTtmn, gfPsi })}`);
  }
  return motorMap;
}

async function verifyGfShortModeWorkflow(tools, options = {}) {
  const cleanCapture = options.cleanDemoCapture === true;
  if (!cleanCapture) {
    const ambiguousResponse = await invokeRegisteredTool(tools, 'find_fly_circuits', {
      query: 'middle leg',
      limit: 1,
    });
    const ambiguous = successfulEnvelope(ambiguousResponse, 'find_fly_circuits');
    assertDiscoveryDecisionAndCandidateRecords(ambiguous, 'ambiguous midleg discovery');
    if (ambiguous.data.selection_status !== 'ambiguous'
      || ambiguous.data.selected_circuit_id !== null
      || ambiguous.data.candidate_match_count !== 2
      || ambiguous.data.circuits.length !== 0
      || ambiguous.data.next_action?.name !== 'find_fly_circuits') {
      throw new Error(`Broad midleg discovery did not remain explicitly ambiguous: ${JSON.stringify(ambiguous.data)}`);
    }
  }

  const discoveryInput = {
    query: competitionHeroPrompt,
    behavior: 'any',
    evidence_labels: ['measured', 'derived', 'connectome_inferred'],
    limit: 5,
  };
  const discoveryResponse = options.discoveryResponse
    ?? await invokeRegisteredTool(tools, 'find_fly_circuits', discoveryInput);
  const discovery = successfulEnvelope(discoveryResponse, 'find_fly_circuits');
  const discoveryDecision = assertDiscoveryDecisionAndCandidateRecords(discovery, 'GF discovery');
  if (discovery.data.selection_status !== 'selected'
    || discovery.data.selected_circuit_id !== 'circuit_gf_adult'
    || discovery.data.candidate_circuits[0]?.id !== 'circuit_gf_adult'
    || discoveryDecision.candidates.length < 2
    || !discoveryDecision.candidates.some((candidate) => candidate.circuitId === 'circuit_mdn_adult')
    || !discoveryDecision.rejectedAlternatives.some((candidate) => candidate.circuitId === 'circuit_mdn_adult')) {
    throw new Error(`Competition hero discovery did not select GF while preserving MDN as a reasoned alternative: ${JSON.stringify(discovery.data)}`);
  }
  if (cleanCapture
    && (discoveryDecision.missionGoal !== competitionHeroPrompt
      || discoveryDecision.search?.query !== competitionHeroPrompt.toLowerCase()
      || discoveryDecision.search?.filters?.behavior !== 'any')) {
    throw new Error(`Demo discovery did not preserve the exact competition hero goal and query: ${JSON.stringify(discoveryDecision)}`);
  }
  const motorMap = assertGfMotorMapClosure(discovery);
  if (!discovery.data.evidence.some((record) => (
    record.id === 'E-FLYLAB-MODEL-004'
      && record.provenance === 'derived'
      && record.role === 'model_context'
      && record.matches_requested_evidence_labels === true
  ))) {
    throw new Error(`Competition hero discovery did not retain its separately marked model-method closure: ${JSON.stringify(discovery.data.evidence)}`);
  }
  const filteredContext = await inspectAgentContext(tools);
  assertSameStringSet(
    filteredContext.artifacts.hypothesis_eligible_evidence_ids,
    discovery.data.hypothesis_eligible_evidence_ids,
    'GF filtered discovery-to-inspector eligible evidence parity',
  );

  const causalEvidenceId = discovery.data.causal_evidence_ids_by_perturbation?.silence?.[0];
  const pathEvidenceId = discovery.data.hypothesis_eligible_evidence_ids.find((id) => id === 'E-GF-PATH-011');
  if (!causalEvidenceId || !pathEvidenceId) {
    throw new Error(`GF hero discovery did not expose causal and pathway evidence: ${JSON.stringify(discovery.data)}`);
  }
  const hypothesisInput = {
    circuit_id: 'circuit_gf_adult',
    claim: 'Silencing the mapped adult giant-fiber pathway will reduce the simulated short-mode escape response relative to reference-drive baseline and sham controls.',
    predicted_behavior: 'short_mode_escape',
    perturbation: 'silence',
    primary_outcome: 'short_mode_escape_probability',
    expected_direction: 'decrease',
    controls: ['condition_baseline', 'condition_sham'],
    evidence_ids: [causalEvidenceId, pathEvidenceId],
    evidence_limitations: [
      'The cited assays do not calibrate the reduced-order FlyLab effect size.',
      'The literature-derived brain-to-leg-and-wing controller remains a declared model assumption.',
    ],
    falsification_criterion: 'The prediction fails if the bilateral suppression arm does not reduce short-mode escape probability relative to both reference-drive controls.',
  };
  const drafted = successfulEnvelope(
    await invokeRegisteredTool(tools, 'draft_fly_hypothesis', hypothesisInput),
    'draft_fly_hypothesis',
  );
  if (cleanCapture) {
    await captureStage('hypothesis-drafted', { selector: '.hypothesis-card', block: 'start' });
  }
  const baseDesignInput = {
    hypothesis_id: drafted.data.hypothesis.id,
    target_circuit_id: 'circuit_gf_adult',
    perturbation: 'silence',
    activation_level: 0.9,
    onset_ms: 500,
    duration_ms: 900,
    trial_duration_ms: 3000,
    replicates: 12,
    include_baseline: true,
    include_sham_control: true,
    seed: 91827,
  };
  const unsupportedLateralityResponse = await invokeRegisteredTool(tools, 'design_stimulation_trial', {
    ...baseDesignInput,
    laterality: 'left',
  });
  const unsupportedLaterality = decodedOutput(unsupportedLateralityResponse)?.structuredContent;
  if (unsupportedLaterality?.error?.code !== 'UNSUPPORTED_TARGET'
    || unsupportedLaterality.error.details?.supported_lateralities?.join(',') !== 'bilateral') {
    throw new Error(`GF unilateral design was not rejected with a machine-readable recovery boundary: ${JSON.stringify(unsupportedLateralityResponse)}`);
  }

  const designInput = { ...baseDesignInput, laterality: 'bilateral' };
  const designed = successfulEnvelope(
    await invokeRegisteredTool(tools, 'design_stimulation_trial', designInput),
    'design_stimulation_trial',
  );
  const experiment = designed.data.experiment;
  if (experiment.conditions.length !== 3
    || experiment.conditions.some((condition) => condition.laterality === 'left' || condition.laterality === 'right')) {
    throw new Error(`GF bilateral-only design emitted unsupported unilateral arms: ${JSON.stringify(experiment.conditions)}`);
  }
  const visibleProtocol = cleanCapture ? await verifyVisibleProtocol(experiment) : null;
  const preapproval = decodedOutput(await invokeRegisteredTool(tools, 'run_fly_simulation', {
    experiment_id: experiment.id,
    approved_protocol_hash: `sha256:${'0'.repeat(64)}`,
  }))?.structuredContent;
  if (preapproval?.error?.code !== 'APPROVAL_REQUIRED') {
    throw new Error(`GF run bypassed visible approval: ${JSON.stringify(preapproval)}`);
  }
  if (cleanCapture) {
    await captureStage('protocol-locked', { selector: '.protocol-controls', block: 'start' });
  }
  const approval = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const button = document.querySelector('.protocol-controls .protocol-approval-action');
      button?.click();
      return { clicked: Boolean(button), label: button?.textContent?.trim() ?? null };
    })()`,
    returnByValue: true,
  });
  if (approval?.result?.value?.clicked !== true) {
    throw new Error(`GF approval control was not visible: ${JSON.stringify(approval)}`);
  }
  const approved = await waitForApprovedProtocolContext(tools, experiment);
  if (cleanCapture) {
    await captureStage('operator-approved', { selector: '.protocol-controls', block: 'start' });
  }
  const approvalHashGuard = await verifyApprovedProtocolHashGuard(tools, experiment, approved.approval);
  if (cleanCapture) {
    await captureIntegrityProof('proof-approval-hash-guard.png', {
      tools,
      kicker: 'Exact approval guard proof',
      title: 'Wrong protocol hash rejected',
      boundary: 'This panel summarizes actual WebMCP protocol results from the automated flag-enabled Chrome client. The rejected call created no batch and did not advance shared state.',
      facts: [
        { label: 'Error', value: approvalHashGuard.error },
        { label: 'Before', value: `r${approvalHashGuard.before_state_revision}` },
        { label: 'Rejected result', value: `r${approvalHashGuard.rejected_state_revision}` },
        { label: 'After inspection', value: `r${approvalHashGuard.after_state_revision}` },
        { label: 'Batch after', value: approvalHashGuard.resulting_batch_id ?? 'none' },
      ],
      checks: [
        {
          label: 'Exact commitment enforced',
          detail: `Expected ${approvalHashGuard.expected_protocol_hash}; the deliberately wrong ${approvalHashGuard.rejected_protocol_hash} was refused.`,
          pass: approvalHashGuard.error === 'EVIDENCE_MISMATCH',
        },
        {
          label: 'No mutation on rejection',
          detail: `Revision remained r${approvalHashGuard.before_state_revision} and no simulation batch appeared.`,
          pass: approvalHashGuard.state_unchanged === true && approvalHashGuard.resulting_batch_id === null,
        },
      ],
    });
  }

  const run = successfulEnvelope(
    await invokeRegisteredTool(tools, 'run_fly_simulation', { experiment_id: experiment.id }),
    'run_fly_simulation',
  );
  const runApprovalAudit = assertRunApprovalBinding(run.data, approved.approval);
  const totalSeededRuns = run.data.conditionRuns.reduce((total, condition) => total + condition.replicates.length, 0);
  if (totalSeededRuns !== 36 || run.data.conditionRuns.some((condition) => condition.replicates.length !== 12)) {
    throw new Error(`GF demo batch was not exactly three arms by twelve seeded runs: ${JSON.stringify(run.data.conditionRuns.map((condition) => ({ id: condition.conditionId, runs: condition.replicates.length })))}`);
  }
  const protocol = run.data.protocol;
  if (protocol.experimentId !== experiment.id
    || protocol.hypothesisId !== experiment.hypothesisId
    || protocol.targetCircuitId !== experiment.targetCircuitId
    || protocol.behavior !== experiment.behavior
    || protocol.motorMapId !== experiment.motorMap.id
    || protocol.perturbation !== experiment.perturbation
    || protocol.activationLevel !== experiment.activationLevel
    || protocol.primaryLaterality !== experiment.primaryLaterality
    || JSON.stringify(protocol.conditions) !== JSON.stringify(experiment.conditions)
    || JSON.stringify(protocol.assumptions) !== JSON.stringify(experiment.assumptions)) {
    throw new Error(`GF batch did not carry the exact approved protocol snapshot: ${JSON.stringify({ protocol, experiment })}`);
  }
  const baseline = run.data.conditionRuns.find((condition) => condition.conditionId === 'condition_baseline');
  const sham = run.data.conditionRuns.find((condition) => condition.conditionId === 'condition_sham');
  const primary = run.data.conditionRuns.find((condition) => condition.conditionId === 'condition_bilateral');
  const baselineResponder = baseline?.replicates.find((replicate) => replicate.responseDisposition === 'expressed');
  const shamResponder = sham?.replicates.find((replicate) => replicate.responseDisposition === 'expressed');
  if (!baseline?.trajectory.some((point) => point.motorOutputActive && !point.active)
    || !sham?.trajectory.some((point) => point.motorOutputActive && !point.active)
    || !primary?.trajectory.some((point) => point.active)
    || !baseline.trajectory.some((point) => point.z > 0)
    || baseline.trajectory.at(-1)?.z !== 0
    || !baselineResponder?.trajectory.some((point) => (
      point.state === 'airborne'
      && !point.groundContact
      && point.z > 0
      && point.wingDeployment > 0
    ))
    || !shamResponder?.trajectory.some((point) => (
      point.state === 'airborne'
      && !point.groundContact
      && point.z > 0
      && point.wingDeployment > 0
    ))
    || primary.replicates.reduce((sum, replicate) => sum + replicate.wingRecruitment, 0)
      >= baseline.replicates.reduce((sum, replicate) => sum + replicate.wingRecruitment, 0)) {
    throw new Error(`GF silencing replay confused reference motion with perturbation targeting: ${JSON.stringify({ baseline, sham, primary })}`);
  }
  if (cleanCapture) {
    await selectCondition('condition_bilateral');
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await captureStage('simulation-replay', { selector: '.main-stage', block: 'start' });
    await captureGfCircuitPlayback();
  }

  const analysisInput = {
    batch_id: run.data.id,
    metrics: [...motorMap.recommendedMetrics],
  };
  const analysis = successfulEnvelope(
    await invokeRegisteredTool(tools, 'analyze_fly_behavior', analysisInput),
    'analyze_fly_behavior',
  );
  const metricDefinitionAudit = assertFormalMetricDefinitions(analysis);
  const perRunAudit = assertPerRunSimulationAndAnalysis(run.data, analysis.data.analysis, analysis.data.per_run_results);
  assertSameStringSet(
    analysis.data.analysis.metrics,
    ['short_mode_escape_probability', 'response_latency_ms', 'vertical_displacement_mm', 'wing_recruitment', 'leg_recruitment'],
    'GF short-mode metric panel',
  );
  const visibleAnalysis = cleanCapture
    ? await verifyVisibleAnalysis(analysis.data.analysis, 'condition_bilateral')
    : null;
  const selectedRunReplay = await verifyVisibleSelectedRunReplay(run.data, 'condition_bilateral');
  const conditionTabParity = cleanCapture
    ? await verifyConditionTabAnalysisParity(analysis.data.analysis, 'condition_bilateral')
    : null;
  const humanBudget = cleanCapture ? await setHumanProposalBudget(tools, 5) : null;
  if (cleanCapture) {
    await captureStage('behavior-analysis', { selector: '.results-panel', block: 'center' });
  }
  const comparisonInput = {
    analysis_ids: [analysis.data.analysis.id],
    objective_metric: 'short_mode_escape_probability',
    objective: 'maximize',
  };
  const comparison = successfulEnvelope(
    await invokeRegisteredTool(tools, 'compare_fly_trials', comparisonInput),
    'compare_fly_trials',
  );
  if (cleanCapture && comparison.data.comparison.proposal.replicateBudget !== humanBudget.budget) {
    throw new Error(`GF comparison did not honor the visible follow-up budget: ${JSON.stringify(comparison.data.comparison)}`);
  }
  const visibleComparison = cleanCapture
    ? await verifyVisibleComparison(comparison.data.comparison)
    : null;
  if (cleanCapture) {
    await captureStage('bounded-follow-up', { selector: '.comparison-ranking', block: 'center' });
  }
  const saveInput = {
    scope: 'mission',
    hypothesis_id: drafted.data.hypothesis.id,
    experiment_id: experiment.id,
    batch_ids: [run.data.id],
    analysis_ids: [analysis.data.analysis.id],
    comparison_id: comparison.data.comparison.id,
  };
  const saved = successfulEnvelope(
    await invokeRegisteredTool(tools, 'save_fly_evidence', saveInput),
    'save_fly_evidence',
  );
  const evidenceExportAudit = verifySavedEvidenceExport(saved, {
    scope: 'mission',
    discoveryDecision,
    hypothesis: drafted.data.hypothesis,
    experiment,
    approval: approved.approval,
    batch: run.data,
    analysis: analysis.data.analysis,
    comparison: comparison.data.comparison,
  });
  const browserExportAudit = await verifyBrowserExportControls(saved);
  const completed = await inspectAgentContext(tools);
  if (completed.agent_status !== 'complete'
    || completed.artifacts.selected_circuit_id !== 'circuit_gf_adult'
    || completed.artifacts.evidence_bundle_id !== saved.data.bundle.id) {
    throw new Error(`GF workflow did not complete its exact lineage: ${JSON.stringify(completed)}`);
  }
  const idempotencyInputs = {
    discovery: discoveryInput,
    hypothesis: { ...hypothesisInput, evidence_ids: [...hypothesisInput.evidence_ids].reverse() },
    design: designInput,
    run: {
      experiment_id: experiment.id,
      approved_protocol_hash: approved.approval.protocol_hash,
      operation_id: run.operation_id,
    },
    analysis: analysisInput,
    comparison: comparisonInput,
    save: { ...saveInput, operation_id: saved.operation_id },
  };
  let visibleBundle = null;
  let editInvalidationVerified = null;
  let idempotency = null;
  if (cleanCapture) {
    await clickButton({ text: 'Evidence ledger' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    visibleBundle = await verifyVisibleBundle(saved.data.bundle);
    await prepareEvidenceModalCapture({
      expectedSelection: saved.data.bundle.title,
      navPosition: 'end',
    });
    await captureStage('evidence-saved');
    idempotency = await verifyCompletedLineageIdempotency(tools, idempotencyInputs, saved.data.bundle);
    const runReplay = idempotency.operation_replays.run_fly_simulation;
    const saveReplay = idempotency.operation_replays.save_fly_evidence;
    await captureIntegrityProof('proof-idempotent-retry.png', {
      tools,
      kicker: 'Operation replay proof',
      title: 'Run and save retries made no mutation',
      boundary: 'This panel summarizes actual repeated WebMCP calls from the automated flag-enabled Chrome client. Exact operation IDs replayed committed results; conflicting reuse failed closed.',
      facts: [
        { label: 'Run operation', value: runReplay.operation_id },
        { label: 'Run revision', value: `r${runReplay.previous_state_revision} → r${runReplay.state_revision}` },
        { label: 'Save operation', value: saveReplay.operation_id },
        { label: 'Save revision', value: `r${saveReplay.previous_state_revision} → r${saveReplay.state_revision}` },
        { label: 'Stable bundle', value: idempotency.stable_bundle_id },
      ],
      checks: [
        {
          label: 'Exact replays',
          detail: 'Both expensive operations returned idempotent_replay true and zero created artifacts.',
          pass: runReplay.idempotent_replay === true
            && saveReplay.idempotent_replay === true
            && idempotency.replay_created_artifacts === 0,
        },
        {
          label: 'Conflicting reuse refused',
          detail: `${idempotency.conflicting_run_operation_error} for run and ${idempotency.conflicting_save_operation_error} for save; shared state stayed unchanged.`,
          pass: idempotency.conflicting_run_operation_error === 'INVALID_INPUT'
            && idempotency.conflicting_save_operation_error === 'INVALID_INPUT'
            && idempotency.conflict_state_unchanged === true,
        },
      ],
    });
    editInvalidationVerified = await verifyProtocolEditInvalidation(tools, experiment.id, 3, {
      run: idempotencyInputs.run,
      save: idempotencyInputs.save,
    });
  } else {
    idempotency = await verifyCompletedLineageIdempotency(tools, idempotencyInputs, saved.data.bundle);
  }
  return {
    sequence: [
      ...(!cleanCapture ? ['ambiguous_find'] : []),
      'hero_multi_circuit_gf_find',
      'draft_silencing_hypothesis',
      'reject_unilateral_design',
      'design_bilateral_protocol',
      'visible_operator_approval_control_dom_click',
      'run_exact_protocol',
      'analyze_short_mode_escape',
      'compare',
      'save',
    ],
    clean_demo_capture: cleanCapture,
    selected_circuit_id: discovery.data.selected_circuit_id,
    rejected_alternative_circuit_id: 'circuit_mdn_adult',
    visible_protocol_verified: Boolean(visibleProtocol),
    visible_analysis_verified: Boolean(visibleAnalysis),
    selected_run_replay: selectedRunReplay,
    condition_tab_analysis_parity: conditionTabParity,
    visible_comparison_verified: Boolean(visibleComparison),
    visible_bundle_verified: Boolean(visibleBundle),
    experiment_arm_count: experiment.conditions.length,
    replicates_per_arm: experiment.replicates,
    total_seeded_runs: totalSeededRuns,
    analyzed_metrics: analysis.data.analysis.metrics,
    mission_bundle_format: 'flylab.mission-evidence-bundle.v3',
    completed_stage: completed.state.stage,
    completed_state_revision: completed.state.revision,
    completed_agent_status: completed.agent_status,
    protocol_edit_invalidation_verified: editInvalidationVerified,
    experiment_id: experiment.id,
    batch_id: run.data.id,
    analysis_id: analysis.data.analysis.id,
    evidence_bundle_id: saved.data.bundle.id,
    filter_to_inspector_parity: true,
    motor_map_source_closure: true,
    hero_candidate_count: discoveryDecision.candidates.length,
    hero_rejected_mdn: true,
    reference_motion_without_target_glow: true,
    metric_definition_audit: metricDefinitionAudit,
    per_run_audit: perRunAudit,
    evidence_export_audit: evidenceExportAudit,
    browser_export_audit: browserExportAudit,
    approval_hash_guard: approvalHashGuard,
    idempotency_audit: idempotency,
    run_approval_audit: runApprovalAudit,
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
    if (status?.agentRuntime?.page_registration_status === 'registered'
      && status?.agentRuntime?.registered_tool_count === 8
      && /^session_[a-z0-9]{16}$/i.test(status?.agentRuntime?.page_session_id ?? '')) break;
    if ((status?.agentRuntime?.status === 'unsupported'
        || status?.agentRuntime?.status === 'registration_failed')
      && status?.agentRuntime?.capability_diagnostic?.document_ready_state === 'complete') {
      throw new Error(`FlyLab cannot register WebMCP in this runtime: ${JSON.stringify(status.agentRuntime.capability_diagnostic)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await sendCommand('Page.enable');
  const toolsAdded = waitForRegisteredToolInventory();
  await sendCommand('WebMCP.enable');
  let registeredTools = await normalizeRegisteredTools(await toolsAdded);
  let reloadBeforeExperimentAudit = {
    performed: false,
    reason: 'FLYLAB_VERIFY_WORKFLOW was not enabled',
  };
  if (process.env.FLYLAB_VERIFY_WORKFLOW === '1') {
    const beforeReloadContext = await inspectAgentContext(registeredTools.tools);
    const beforeReloadSessionId = status.agentRuntime.page_session_id;
    const pageLoaded = waitForEvent('Page.loadEventFired');
    const reloadedToolsAdded = waitForRegisteredToolInventory();
    await sendCommand('Page.reload', { ignoreCache: true });
    const [, reloadedTools] = await Promise.all([pageLoaded, reloadedToolsAdded]);
    registeredTools = await normalizeRegisteredTools(reloadedTools);
    let reloadedStatus = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      reloadedStatus = await readRuntimeStatus();
      if (reloadedStatus?.agentRuntime?.page_registration_status === 'registered'
        && reloadedStatus?.agentRuntime?.registered_tool_count === 8
        && reloadedStatus?.agentRuntime?.page_session_id !== beforeReloadSessionId) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const afterReloadContext = await inspectAgentContext(registeredTools.tools);
    if (beforeReloadContext.state?.revision !== 1
      || afterReloadContext.state?.revision !== 1
      || afterReloadContext.state?.stage !== 'discover'
      || afterReloadContext.next_tool !== 'find_fly_circuits'
      || reloadedStatus?.agentRuntime?.page_session_id === beforeReloadSessionId
      || reloadedStatus?.agentRuntime?.registered_tool_count !== 8) {
      throw new Error(`Reload-before-experiment did not create a fresh registered page session: ${JSON.stringify({ beforeReloadContext, afterReloadContext, reloadedStatus })}`);
    }
    status = reloadedStatus;
    reloadBeforeExperimentAudit = {
      performed: true,
      before_page_session_id: beforeReloadSessionId,
      before_state_revision: beforeReloadContext.state.revision,
      after_page_session_id: reloadedStatus.agentRuntime.page_session_id,
      after_state_revision: afterReloadContext.state.revision,
      after_stage: afterReloadContext.state.stage,
      registered_tools_after_reload: reloadedStatus.agentRuntime.registered_tool_count,
      fresh_session_created: true,
    };
  }
  const actualToolNames = registeredTools.tools.map((tool) => tool.name).sort();
  const servedArtifacts = await fetchServedArtifactEvidence(status.location);
  if (typeof validateEvidenceExportSchema !== 'function') {
    throw new Error('Served release artifacts did not provide a compilable evidence-export JSON Schema.');
  }
  const initialContext = await inspectAgentContext(registeredTools.tools);
  if (initialContext.next_tool !== 'find_fly_circuits'
    || initialContext.agent_status !== 'ready') {
    throw new Error(`Inspector did not expose the initial agent action: ${JSON.stringify(initialContext)}`);
  }
  if (cleanDemoCapture && initialContext.state?.goal !== competitionHeroPrompt) {
    throw new Error(`Clean demo did not start from the exact competition hero goal: ${JSON.stringify(initialContext.state)}`);
  }
  const mutationContextGuards = await verifyMutationContextGuards(registeredTools.tools);
  if (cleanDemoCapture) {
    await captureRuntimeDiagnosticProof('proof-webmcp-tools.png', {
      requireInvocation: true,
      tools: registeredTools.tools,
      phase: 'registration',
    });
  }
  await captureStage('eight-tools-live', { selector: '.agent-bridge', block: 'start' });
  const initialDiscoveryInput = cleanDemoCapture
    ? {
        query: competitionHeroPrompt,
        behavior: 'any',
        evidence_labels: ['measured', 'derived', 'connectome_inferred'],
        limit: 5,
      }
    : { query: 'MDN', behavior: 'backward_walking' };
  const response = await invokeRegisteredTool(
    registeredTools.tools,
    'find_fly_circuits',
    initialDiscoveryInput,
  );
  const initialDiscoveryEnvelope = successfulEnvelope(response, 'find_fly_circuits');
  const initialDiscoveryDecision = assertDiscoveryDecisionAndCandidateRecords(
    initialDiscoveryEnvelope,
    cleanDemoCapture ? 'initial GF hero discovery' : 'initial MDN discovery',
  );
  await captureCircuitEvidence(cleanDemoCapture
    ? 'Giant fibers causally bias short-mode escape'
    : 'MDN activation and backward locomotion');

  let postInvocationStatus = status;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    postInvocationStatus = await readRuntimeStatus();
    if (postInvocationStatus?.agentRuntime?.webmcp_invocation_observed === true) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const verified = status?.modelContextType === 'object'
    && status?.registerToolType === 'function'
    && status?.originAgentCluster === true
    && status?.agentRuntime?.status === 'active'
    && /^session_[a-z0-9]{16}$/i.test(status?.agentRuntime?.page_session_id ?? '')
    && status?.agentRuntime?.page_registration_status === 'registered'
    && status?.agentRuntime?.page_invocation_handler_available === true
    && status?.agentRuntime?.registered_tool_count === 8
    && status?.agentRuntime?.agent_invocation_available === null
    && status?.agentRuntime?.webmcp_invocation_observed === false
    && status?.agentRuntime?.webmcp_client_availability === 'unknown_to_page'
    && status?.agentRuntime?.capability_diagnostic?.document_model_context_present === true
    && status?.agentRuntime?.capability_diagnostic?.register_tool_type === 'function'
    && status?.agentRuntime?.capability_diagnostic?.registration_attempted === true
    && status?.agentRuntime?.capability_diagnostic?.registrations_accepted_before_rollback === 8
    && status?.agentRuntime?.capability_diagnostic?.registration_error === null
    && status?.agentRuntime?.workflow_next_tool === 'find_fly_circuits'
    && status?.agentRuntime?.invocable_next_tool === null
    && status?.agentRuntime?.invocable_next_action?.callable === false
    && status?.agentRuntime?.invocable_next_action?.blocked_by === 'webmcp_client_availability_unconfirmed'
    && status?.agentHandoff?.schema_version === 'flylab.agent-handoff.v1'
    && JSON.stringify(status.agentHandoff.transport) === JSON.stringify(status.agentRuntime)
    && postInvocationStatus?.agentRuntime?.webmcp_invocation_observed === true
    && postInvocationStatus?.agentRuntime?.webmcp_client_availability === 'invocation_observed_this_page_session'
    && postInvocationStatus?.agentRuntime?.agent_invocation_available === true
    && JSON.stringify(actualToolNames) === JSON.stringify(expectedToolNames)
    && response.status === 'Completed';

  if (!verified) {
    throw new Error(`WebMCP live verification failed: ${JSON.stringify({ status, postInvocationStatus, actualToolNames, response })}`);
  }

  const workflow = process.env.FLYLAB_VERIFY_WORKFLOW === '1'
    ? cleanDemoCapture
      ? await verifyGfShortModeWorkflow(registeredTools.tools, {
          cleanDemoCapture: true,
          discoveryResponse: response,
        })
      : await runFullWorkflow(registeredTools.tools, response, initialContext)
    : undefined;
  if (workflow && !cleanDemoCapture) {
    workflow.gf_short_mode_escape = await verifyGfShortModeWorkflow(registeredTools.tools);
  }
  if (workflow && cleanDemoCapture) {
    await captureRuntimeDiagnosticProof('proof-webmcp-invocations.png', {
      requireInvocation: true,
      tools: registeredTools.tools,
      phase: 'workflow_complete',
      workflow,
    });
  }

  const capturedFrameNames = capturedFrames.map((filepath) => basename(filepath));
  if (cleanDemoCapture && captureDirectory
    && JSON.stringify(capturedFrameNames) !== JSON.stringify(expectedDemoFrameNames)) {
    throw new Error(`Clean demo capture did not produce the exact 15-frame contract: ${JSON.stringify({ expectedDemoFrameNames, capturedFrameNames })}`);
  }
  const browserVersion = await sendCommand('Browser.getVersion');
  const chromeFullVersion = browserVersion?.product?.match(/^Chrome\/([0-9.]+)$/)?.[1] ?? null;
  const chromeMajorVersion = chromeFullVersion ? Number(chromeFullVersion.split('.')[0]) : null;
  if (!chromeFullVersion || !Number.isInteger(chromeMajorVersion)) {
    throw new Error(`Could not parse the Chrome client version from Browser.getVersion: ${JSON.stringify(browserVersion)}.`);
  }

  const observedInvokedTools = [...new Set(protocolInvocationLog
    .filter((entry) => entry.status === 'Completed')
    .map((entry) => entry.tool_name))].sort();
  if (workflow && JSON.stringify(observedInvokedTools) !== JSON.stringify(expectedToolNames)) {
    throw new Error(`Completed workflow invocation log did not contain the exact tool inventory: ${JSON.stringify({ observedInvokedTools, expectedToolNames, protocolInvocationLog })}`);
  }
  const invocationCounts = Object.fromEntries(expectedToolNames.map((toolName) => [
    toolName,
    protocolInvocationLog.filter((entry) => entry.tool_name === toolName && entry.status === 'Completed').length,
  ]));
  const captureArtifacts = await Promise.all(capturedFrames.map(captureFileEvidence));

  const report = {
    ok: true,
    verified_at: new Date().toISOString(),
    url: status.location,
    source_revision: captureSourceRevision(),
    served_artifacts: servedArtifacts,
    browser_api: 'document.modelContext.registerTool',
    browser_client: {
      chrome_full_version: chromeFullVersion,
      chrome_major_version: chromeMajorVersion,
      cdp_product: browserVersion.product,
      cdp_protocol_version: browserVersion.protocolVersion,
      cdp_revision: browserVersion.revision,
      user_agent: status.userAgent,
      webmcp_testing_flag_enabled: true,
      proof_capture_kind: 'automated_flag_enabled_chrome_protocol_capture',
    },
    registered_tools: actualToolNames,
    invoked_tools: observedInvokedTools,
    invocation_evidence: {
      source: 'observed WebMCP.toolResponded protocol events',
      completed_event_count: protocolInvocationLog.filter((entry) => entry.status === 'Completed').length,
      completed_counts_by_tool: invocationCounts,
    },
    invocation_status: response.status,
    reload_before_experiment_audit: reloadBeforeExperimentAudit,
    agent_transport: {
      status: status.agentRuntime.status,
      page_session_id: status.agentRuntime.page_session_id,
      registered_tool_count: status.agentRuntime.registered_tool_count,
      workflow_next_tool: status.agentRuntime.workflow_next_tool,
      invocable_next_tool_before_first_call: status.agentRuntime.invocable_next_tool,
      agent_invocation_available_before_first_call: status.agentRuntime.agent_invocation_available,
      page_registration_status: status.agentRuntime.page_registration_status,
      page_invocation_handler_available: status.agentRuntime.page_invocation_handler_available,
      webmcp_invocation_observed: postInvocationStatus.agentRuntime.webmcp_invocation_observed,
      webmcp_client_availability: postInvocationStatus.agentRuntime.webmcp_client_availability,
      capability_diagnostic: status.agentRuntime.capability_diagnostic,
      handoff_schema: status.agentHandoff.schema_version,
    },
    origin_agent_cluster: true,
    browser_user_agent: status.userAgent,
    mutation_context_guards: mutationContextGuards,
    discovery_decision: {
      id: initialDiscoveryDecision.id,
      selected_circuit_id: initialDiscoveryDecision.selectedCircuitId,
      candidate_count: initialDiscoveryDecision.candidates.length,
      rejected_alternatives: initialDiscoveryDecision.rejectedAlternatives.length,
    },
  };
  if (process.env.FLYLAB_VERIFY_VERBOSE === '1') {
    report.invocation_output = response.output;
  }
  if (workflow) report.workflow = workflow;
  if (capturedFrames.length) {
    report.captured_frames = capturedFrames.map((filepath) => relative(process.cwd(), filepath));
    report.capture_artifacts = captureArtifacts;
    report.capture_contract = {
      mode: cleanDemoCapture ? 'gf_competition_hero' : 'verification',
      frame_count: capturedFrames.length,
      frame_names: capturedFrameNames,
      exact_demo_frame_contract: cleanDemoCapture
        ? JSON.stringify(capturedFrameNames) === JSON.stringify(expectedDemoFrameNames)
        : null,
    };
  }
  const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
  if (reportFile) {
    await mkdir(dirname(reportFile), { recursive: true });
    await writeFile(reportFile, serializedReport);
  }
  console.log(serializedReport.trimEnd());
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
