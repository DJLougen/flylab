import { buildFlyLabAgentContext } from './agent-context.js';

export type FlyLabWebMCPStatus = 'checking' | 'active' | 'unsupported' | 'failed';
export type FlyLabAgentContext = ReturnType<typeof buildFlyLabAgentContext>;

export type FlyLabWebMCPAvailabilityReason =
  | 'checking'
  | 'active'
  | 'document_model_context_absent'
  | 'register_tool_missing'
  | 'registration_failed';

export interface FlyLabWebMCPCapabilityDiagnostic {
  schema_version: 'flylab.webmcp-capability-diagnostic.v1';
  document_ready_state: string | null;
  secure_context: boolean | null;
  origin_agent_cluster: boolean | null;
  permissions_policy_tools_allowed: boolean | null;
  document_model_context_present: boolean | null;
  register_tool_type: string | null;
  registration_attempted: boolean;
  registrations_accepted_before_rollback: number;
  failed_tool_name: string | null;
  registration_error_name: string | null;
  registration_error: string | null;
  availability_reason: FlyLabWebMCPAvailabilityReason;
}

export const CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC: FlyLabWebMCPCapabilityDiagnostic = {
  schema_version: 'flylab.webmcp-capability-diagnostic.v1',
  document_ready_state: null,
  secure_context: null,
  origin_agent_cluster: null,
  permissions_policy_tools_allowed: null,
  document_model_context_present: null,
  register_tool_type: null,
  registration_attempted: false,
  registrations_accepted_before_rollback: 0,
  failed_tool_name: null,
  registration_error_name: null,
  registration_error: null,
  availability_reason: 'checking',
};

function fallbackDiagnosticForStatus(status: FlyLabWebMCPStatus): FlyLabWebMCPCapabilityDiagnostic {
  if (status === 'checking') return CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC;
  if (status === 'active') {
    return {
      ...CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC,
      document_model_context_present: true,
      register_tool_type: 'function',
      registration_attempted: true,
      registrations_accepted_before_rollback: 8,
      availability_reason: 'active',
    };
  }
  if (status === 'failed') {
    return {
      ...CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC,
      document_model_context_present: true,
      register_tool_type: 'function',
      registration_attempted: true,
      availability_reason: 'registration_failed',
      registration_error_name: 'Error',
      registration_error: 'WebMCP registration failed; inspect the page-provided runtime diagnostic for the exact exception.',
    };
  }
  return {
    ...CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC,
    document_model_context_present: false,
    register_tool_type: 'undefined',
    availability_reason: 'document_model_context_absent',
  };
}

export function buildFlyLabAgentHandoff(
  agentContext: FlyLabAgentContext,
  webmcpStatus: FlyLabWebMCPStatus,
  capabilityDiagnostic: FlyLabWebMCPCapabilityDiagnostic = fallbackDiagnosticForStatus(webmcpStatus),
  webmcpInvocationObserved = false,
  pageSessionId: string | null = null,
) {
  const pageRegistrationActive = webmcpStatus === 'active';
  const agentInvocationAvailable = pageRegistrationActive
    ? webmcpInvocationObserved
      ? true
      : null
    : false;
  const unavailableBlocker = webmcpStatus === 'checking'
    ? 'webmcp_availability_checking'
    : webmcpStatus === 'failed'
      ? 'webmcp_registration_failed'
      : 'webmcp_unavailable_in_this_browser';

  const transport = {
    schema_version: 'flylab.agent-runtime.v1',
    page_session_id: pageSessionId,
    api: 'document.modelContext.registerTool',
    status: webmcpStatus === 'failed' ? 'registration_failed' : webmcpStatus,
    page_registration_status: webmcpStatus === 'active'
      ? 'registered'
      : webmcpStatus === 'unsupported'
        ? 'api_unavailable'
        : webmcpStatus === 'failed'
          ? 'registration_failed'
          : 'checking',
    page_invocation_handler_available: pageRegistrationActive,
    webmcp_invocation_observed: webmcpInvocationObserved,
    webmcp_client_availability: pageRegistrationActive
      ? webmcpInvocationObserved
        ? 'invocation_observed_this_page_session'
        : 'unknown_to_page'
      : 'unavailable',
    declared_tool_count: 8,
    registered_tool_count: pageRegistrationActive ? 8 : webmcpStatus === 'checking' ? null : 0,
    agent_invocation_available: agentInvocationAvailable,
    workflow_next_tool: agentContext.next_tool,
    invocable_next_tool: pageRegistrationActive && webmcpInvocationObserved ? agentContext.next_tool : null,
    invocable_next_action: {
      callable: pageRegistrationActive && webmcpInvocationObserved && agentContext.next_action.callable,
      blocked_by: pageRegistrationActive && webmcpInvocationObserved
        ? agentContext.next_action.blocked_by
        : pageRegistrationActive
          ? 'webmcp_client_availability_unconfirmed'
          : unavailableBlocker,
    },
    fallback: {
      mode: 'read_only_same_tab_dom',
      mutation_available: false,
      browser_documentation_url: '/agent',
      manifest_url: '/flylab-agent-manifest.json',
      contract_url: '/flylab-tool-contracts.json',
      live_context_selector: '#flylab-agent-context',
      handoff_selector: '#flylab-agent-handoff',
      scope: 'same_open_page_only',
    },
    execution_note: pageRegistrationActive
      ? webmcpInvocationObserved
        ? 'A WebMCP tool callback has been observed in this page session. Call inspect_flylab_state before starting or resuming the workflow.'
        : 'The page registered its tools, but client, model, account, workspace, permission, and rollout availability are not observable from the page. Start with inspect_flylab_state when a compatible client exposes the tools.'
      : 'The JSON documents and inline state are read-only discovery aids, not a fallback transport. Use a compatible WebMCP runtime to call tools.',
    capability_diagnostic: capabilityDiagnostic,
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
