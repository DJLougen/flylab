import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const defaultUrl = 'https://flylab-neuroethology.d-lougen.chatgpt.site/';
const expectedToolNames = [
  'analyze_fly_behavior',
  'compare_fly_trials',
  'design_stimulation_trial',
  'draft_fly_hypothesis',
  'find_fly_circuits',
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
    location: window.location.href
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

  let status;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    status = await readRuntimeStatus();
    if (status.status === '7 tools live') break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const toolsAdded = waitForEvent('WebMCP.toolsAdded');
  await sendCommand('WebMCP.enable');
  const registeredTools = await toolsAdded;
  const actualToolNames = registeredTools.tools.map((tool) => tool.name).sort();
  const discoveryTool = registeredTools.tools.find((tool) => tool.name === 'find_fly_circuits');
  if (!discoveryTool?.frameId) {
    throw new Error('Chrome did not return a frame for find_fly_circuits.');
  }

  const invocation = await sendCommand('WebMCP.invokeTool', {
    frameId: discoveryTool.frameId,
    toolName: 'find_fly_circuits',
    input: { query: 'MDN', behavior: 'backward_walking' },
  });
  const response = await waitForEvent(
    'WebMCP.toolResponded',
    (event) => event.invocationId === invocation.invocationId,
  );

  const verified = status?.modelContextType === 'object'
    && status?.registerToolType === 'function'
    && status?.status === '7 tools live'
    && status?.originAgentCluster === true
    && JSON.stringify(actualToolNames) === JSON.stringify(expectedToolNames)
    && response.status === 'Completed';

  if (!verified) {
    throw new Error(`WebMCP live verification failed: ${JSON.stringify({ status, actualToolNames, response })}`);
  }

  console.log(JSON.stringify({
    ok: true,
    url: status.location,
    browser_api: 'document.modelContext.registerTool',
    registered_tools: actualToolNames,
    invoked_tool: 'find_fly_circuits',
    invocation_status: response.status,
    origin_agent_cluster: true,
  }, null, 2));
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
