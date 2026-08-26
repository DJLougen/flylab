import { FLYLAB_ERROR_CODES, flyLabToolContracts } from './webmcp.js';

export const flyLabAgentContractDocument = {
  schema_version: 'flylab.webmcp-contracts.v1',
  name: 'FlyLab WebMCP contracts',
  site: 'https://flylab-neuroethology.d-lougen.chatgpt.site/',
  transport: {
    api: 'document.modelContext.registerTool',
    required_first_call: 'inspect_flylab_state',
    scope: 'current_open_page',
    execution_note: 'This document describes the live site tools but is not a fallback transport. Tool calls require a browser and workspace where WebMCP site tools are available.',
  },
  discovery: {
    webmcp_standard_discovery: false,
    catalog_kind: 'FlyLab-specific read-only documentation',
    manifest_url: '/flylab-agent-manifest.json',
    contract_url: '/flylab-tool-contracts.json',
    inline_state_selector: '#flylab-agent-context',
    inline_runtime_selector: '#flylab-agent-runtime',
    inline_handoff_selector: '#flylab-agent-handoff',
    control_plane_selector: '[aria-label="WebMCP agent control plane"]',
  },
  result_contract: {
    schema_version: 'flylab.tool-result.v1',
    success_fields: ['ok', 'result_version', 'tool', 'summary', 'data', 'provenance', 'state_revision'],
    failure_fields: ['ok', 'result_version', 'tool', 'error'],
    failure_error_fields: ['code', 'message', 'retryable', 'details'],
    domain_error_codes: FLYLAB_ERROR_CODES,
    cancellation: 'A cancellation observed before commit rejects with AbortError and publishes no prepared batch or evidence bundle.',
    recovery: 'After any interruption, cancellation, stale-state response, or visible person edit, call inspect_flylab_state before choosing another action.',
  },
  supervisor_gate: {
    name: 'visible_supervisor_approval',
    webmcp_tool: false,
    blocks: 'run_fly_simulation',
    boundary: 'Approval is a visible page action and is intentionally absent from the WebMCP tool surface. It is not identity-authenticated against general browser automation.',
  },
  tools: flyLabToolContracts.map((contract) => ({
    name: contract.name,
    title: contract.title,
    description: contract.description,
    annotations: contract.annotations,
    input_schema: contract.inputSchema,
  })),
} as const;
