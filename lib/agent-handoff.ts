import { buildFlyLabAgentContext } from './agent-context.js';

export type FlyLabWebMCPStatus = 'checking' | 'active' | 'unsupported' | 'failed';
export type FlyLabAgentContext = ReturnType<typeof buildFlyLabAgentContext>;

export function buildFlyLabAgentHandoff(
  agentContext: FlyLabAgentContext,
  webmcpStatus: FlyLabWebMCPStatus,
) {
  const agentInvocationAvailable = webmcpStatus === 'active';
  const unavailableBlocker = webmcpStatus === 'checking'
    ? 'webmcp_availability_checking'
    : webmcpStatus === 'failed'
      ? 'webmcp_registration_failed'
      : 'webmcp_unavailable_in_this_browser';

  const transport = {
    schema_version: 'flylab.agent-runtime.v1',
    api: 'document.modelContext.registerTool',
    status: webmcpStatus === 'failed' ? 'registration_failed' : webmcpStatus,
    declared_tool_count: 8,
    registered_tool_count: agentInvocationAvailable ? 8 : webmcpStatus === 'checking' ? null : 0,
    agent_invocation_available: agentInvocationAvailable,
    workflow_next_tool: agentContext.next_tool,
    invocable_next_tool: agentInvocationAvailable ? agentContext.next_tool : null,
    invocable_next_action: {
      callable: agentInvocationAvailable && agentContext.next_action.callable,
      blocked_by: agentInvocationAvailable ? agentContext.next_action.blocked_by : unavailableBlocker,
    },
    fallback: {
      mode: 'read_only_same_tab_dom',
      mutation_available: false,
      manifest_url: '/flylab-agent-manifest.json',
      contract_url: '/flylab-tool-contracts.json',
      live_context_selector: '#flylab-agent-context',
      handoff_selector: '#flylab-agent-handoff',
      scope: 'same_open_page_only',
    },
    execution_note: agentInvocationAvailable
      ? 'Call inspect_flylab_state before starting or resuming the workflow.'
      : 'The JSON documents and inline state are read-only discovery aids, not a fallback transport. Use a compatible WebMCP runtime to call tools.',
  } as const;

  return {
    schema_version: 'flylab.agent-handoff.v1',
    transport,
    workflow_recommendation: {
      tool: agentContext.next_tool,
      kind: agentContext.next_action.kind,
      input_refs: agentContext.next_action.input_refs,
      reason: agentContext.next_action.reason,
    },
    agent_context: agentContext,
    trust: {
      untrusted_human_fields: ['agent_context.state.goal'],
      authority: 'Re-inspect this same open page after interruption, visible edits, cancellation, or navigation. Artifact IDs are page-session scoped.',
    },
  } as const;
}
