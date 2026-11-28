/**
 * Internal receptionist contracts.
 *
 * Provider payloads are untrusted. These types describe the VELLARA-normalized
 * boundary only; they do not authenticate provider webhooks or authorize tenant access.
 */

export type ReceptionistChannel = "voice" | "whatsapp";
export type ReceptionistProvider = "retell" | "meta";
export type ConversationControlMode =
  | "ai_active"
  | "handoff_requested"
  | "human_active"
  | "handoff_failed"
  | "closed";

export type InboundContent =
  | { kind: "text"; text: string }
  | { kind: "audio_transcript"; text: string; language?: string }
  | { kind: "media_reference"; mediaType: string; opaqueReference: string }
  | { kind: "call_control"; action: string };

export interface ProviderEventCandidate {
  provider: ReceptionistProvider;
  channel: ReceptionistChannel;
  providerEventId: string;
  providerConnectionId: string;
  providerConversationId: string;
  providerMessageId?: string;
  occurredAt: string;
  direction: "inbound" | "outbound" | "system";
  participant: {
    addressE164?: string;
    displayName?: string;
    providerParticipantId?: string;
  };
  content: InboundContent;
}

/**
 * Created only after webhook authenticity has been checked and the provider
 * connection has been resolved from VELLARA's server-owned connection registry.
 */
export interface ReceptionistEvent extends ProviderEventCandidate {
  eventId: string;
  organizationId: string;
  receivedAt: string;
  correlationId: string;
}

export interface ActiveChannelConnection {
  id: string;
  organizationId: string;
  provider: ReceptionistProvider;
  channel: ReceptionistChannel;
  providerConnectionId: string;
  active: boolean;
  verified: boolean;
  suspended: boolean;
}

export interface ConversationContext {
  id: string;
  organizationId: string;
  channel: ReceptionistChannel;
  controlMode: ConversationControlMode;
  version: number;
  providerConversationId: string;
}

export interface ReceptionistToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresCustomerConfirmation: boolean;
}

export interface ProposedToolCall {
  callId: string;
  name: string;
  arguments: unknown;
}

export type ToolExecutionStatus =
  | "accepted"
  | "pending"
  | "succeeded"
  | "failed"
  | "requires_confirmation";

export interface ToolExecutionResult {
  callId: string;
  name: string;
  status: ToolExecutionStatus;
  safeMessage?: string;
  resultReference?: string;
}

export interface OrchestrationRequest {
  event: ReceptionistEvent;
  conversation: ConversationContext;
  businessContext: Record<string, unknown>;
  toolDefinitions: ReceptionistToolDefinition[];
}

export interface OrchestrationResponse {
  replyText: string;
  proposedToolCalls: ProposedToolCall[];
  requiresHumanTakeover: boolean;
}

export interface ProviderAdapter<TSendInput = unknown, TSendResult = unknown> {
  readonly provider: ReceptionistProvider;
  send(input: TSendInput): Promise<TSendResult>;
}
