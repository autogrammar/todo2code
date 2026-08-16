import type { ParticipantIdentityEntry } from '../communication/identity.js';

export type CommunicationRole = 'human' | 'agent' | 'unknown';
export type CommunicationType = 'request' | 'plan' | 'decision' | 'message' | 'report' | 'result' | 'claim';

export interface CommunicationExtractionOptions {
  root: string;
  projectDir?: string;
  ticket?: string | null;
}

export interface CommunicationEnvelope {
  body: string;
  bodyStartLine: number;
  metadata: Record<string, string>;
  malformed: boolean;
}

export interface InferredCommunicationIdentity {
  role: string | null;
  participant: string | null;
  type: string | null;
  governanceParticipantFile: boolean;
}

export interface CommunicationSegment {
  text: string;
  line: number;
  type: CommunicationType;
}

export interface CommunicationCandidate {
  file: string;
  relativeToProject: string;
  pathTicket: string;
  envelope: CommunicationEnvelope;
  inferred: InferredCommunicationIdentity;
}

export interface CommunicationAttribution {
  declaredParticipantId: string | null;
  entry: ParticipantIdentityEntry | null;
  participant: string;
  role: CommunicationRole;
  displayName: string;
  explicitMessageType: string | null;
  messageType: CommunicationType;
  ticket: string;
  recipient: string | null;
  rawTimestamp: string | null;
  timestamp: string | null;
  declaredGitAuthors: string[];
  gitAuthors: string[];
  declaredA2aAgentId: string | null;
  explicitPaths: string[];
  explicitSymbols: string[];
}
