import type { Metadata } from 'next';
import Link from 'next/link';

import { flyLabAgentContractDocument } from '@/lib/agent-contract-document';
import agentManifest from '@/public/flylab-agent-manifest.json';

export const metadata: Metadata = {
  title: 'FlyLab agent guide',
  description: 'Browser-readable FlyLab WebMCP contracts, compatibility guidance, and recovery documentation.',
};

export default function FlyLabAgentGuide() {
  const manifestText = JSON.stringify(agentManifest, null, 2);
  const contractText = JSON.stringify(flyLabAgentContractDocument, null, 2);

  return (
    <main className="agent-guide-shell">
      <header>
        <p className="eyebrow">Browser-readable recovery surface</p>
        <h1>FlyLab agent guide</h1>
        <p>
          This HTML page mirrors FlyLab&apos;s static agent documentation because some in-app browsers block top-level navigation to JSON resources. It does not create a fallback transport or make Site Tools callable.
        </p>
        <p>
          Keep the live laboratory open in its original tab. FlyLab&apos;s revision and artifacts belong to that page session; this static guide does not retain them.
        </p>
        <Link className="agent-guide-return" href="/">Return to the live laboratory</Link>
      </header>

      <section className="agent-guide-summary" aria-labelledby="compatibility-title">
        <h2 id="compatibility-title">Compatibility check</h2>
        <ol>
          <li>Use the latest ChatGPT desktop app&apos;s built-in browser with GPT-5.6 Sol or Terra, or Chrome 149+ with WebMCP testing enabled.</li>
          <li>In ChatGPT, turn on <strong>Enable site tools</strong> under <strong>Settings → Browser → Permissions</strong>.</li>
          <li>Do not use GPT-5.6 Luna; Site Tools are also unavailable in Enterprise and Edu workspaces, and access can remain rollout-dependent.</li>
          <li>Open the laboratory in a browser that exposes <code>document.modelContext.registerTool</code>.</li>
          <li>Use the laboratory&apos;s visible <strong>Runtime diagnostic</strong> to distinguish an absent API from a rejected registration.</li>
          <li>When tools are available, call <code>inspect_flylab_state</code> first and after every interruption or visible edit.</li>
          <li>Protocol authorization remains a visible operator action and is intentionally not a Site Tool.</li>
        </ol>
        <p>
          The page can detect its own API and registration results, but it cannot detect the selected model, account eligibility, workspace policy, Site Tools setting, or rollout. See the <a href="https://learn.chatgpt.com/docs/webmcp" target="_blank" rel="noreferrer">official Site Tools guidance</a>.
        </p>
        <p>
          The raw machine endpoints remain <code>/flylab-agent-manifest.json</code> and <code>/flylab-tool-contracts.json</code>. Portable v3 exports are documented by the <a href="/schemas/flylab-evidence-export-v3.schema.json">deployed evidence-export JSON Schema</a>. The current page-session state is embedded only on the open laboratory page at <code>#flylab-agent-handoff</code> and is also exposed there in a visible, selectable recovery packet.
        </p>
      </section>

      <section className="agent-guide-tools" aria-labelledby="tool-list-title">
        <h2 id="tool-list-title">Declared Site Tools</h2>
        <ol>
          {flyLabAgentContractDocument.tools.map((tool) => (
            <li key={tool.name}>
              <code>{tool.name}</code>
              <span>{tool.description}</span>
            </li>
          ))}
        </ol>
      </section>

      <details className="agent-guide-json" id="manifest" open>
        <summary>Agent manifest</summary>
        <pre>{manifestText}</pre>
      </details>

      <details className="agent-guide-json" id="contracts">
        <summary>Exact tool contracts</summary>
        <pre>{contractText}</pre>
      </details>
    </main>
  );
}
