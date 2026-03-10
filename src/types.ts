/**
 * gt-plugin-passage -- Gas Town types for EXIT/ENTRY integration
 */

import type { ExitMarker, Signer, ExitType } from "cellar-door-exit";
import type { ClaimStore, BuiltPolicy } from "cellar-door-entry";

// Re-export for convenience
export type { ExitMarker, Signer as ExitSigner, ExitType };
export type { ClaimStore as EntryStore, BuiltPolicy };

/**
 * Optional event callbacks for observability.
 *
 * Pass these to `polecatDepart()`, `crewTransfer()`, or `townEntry()`
 * to receive notifications about passage lifecycle events.
 */
export interface PassageEvents {
  onDepart?: (result: PolecatDepartureResult) => void;
  onTransfer?: (result: CrewTransferResult) => void;
  onEntry?: (marker: ExitMarker) => void;
  onRejected?: (reason: string, marker: ExitMarker) => void;
}

/** Reasons a Polecat departs Gas Town. */
export type DepartureReason =
  | "completed"
  | "crashed"
  | "timeout"
  | "witness-killed"
  | "manual";

/** Merge result after Refinery processing. */
export type MergeResult = "merged" | "rejected" | "pending";

/** Maximum number of metadata tags allowed per marker. */
export const MAX_TAGS = 50;

/** Maximum length (in characters) of a single metadata tag. */
export const MAX_TAG_LENGTH = 256;

/** Options for Polecat departure ceremony. */
export interface PolecatDepartureOptions {
  /** Agent bead ID (e.g. "gt-abc12"). */
  polecatId: string;
  /** Source rig name. */
  rigName: string;
  /** Town identifier. */
  townId: string;
  /** Reason for departure. */
  reason: DepartureReason;
  /** Hook reference (git worktree ref). */
  hookRef?: string;
  /** Bead IDs this Polecat worked on. */
  beadIds?: string[];
  /** Result from the Refinery merge. */
  mergeResult?: MergeResult;
  /** Signer for creating the EXIT marker. */
  signer: Signer;
  /** Optional event callbacks for observability. */
  events?: PassageEvents;
}

/** Result of a Polecat departure. */
export interface PolecatDepartureResult {
  marker: ExitMarker;
  attachment: BeadAttachment;
}

/** Options for crew member transfer between rigs. */
export interface CrewTransferOptions {
  /** Crew member name. */
  crewName: string;
  /** Source rig. */
  sourceRig: string;
  /** Target rig. */
  targetRig: string;
  /** Town identifier. */
  townId: string;
  /** Handoff work state context. */
  workState?: Record<string, unknown>;
  /** Signer for the EXIT marker. */
  signer: Signer;
  /** Optional event callbacks for observability. */
  events?: PassageEvents;
}

/** Result of a crew transfer. */
export interface CrewTransferResult {
  departureMarker: ExitMarker;
  transferToken: string;
}

/** Gas Town policy preset names. */
export type GasTownPolicyPreset =
  | "LOCKDOWN"
  | "CAUTIOUS"
  | "STANDARD"
  | "TRUSTED_TOWNS"
  | "OPEN_DOOR";

/** Options for cross-town entry. */
export interface TownEntryOptions {
  /** Departure marker from source town. */
  marker: ExitMarker;
  /** Target town identifier. */
  targetTownId: string;
  /** Target rig to enter. */
  targetRig?: string;
  /** Policy preset to apply. */
  policy?: GasTownPolicyPreset;
  /** Entry store for claim tracking. */
  store: ClaimStore;
  /** Optional event callbacks for observability. */
  events?: PassageEvents;
}

/** A single entry in an agent's passport chain. */
export interface PassportEntry {
  /** Agent identifier. */
  agentId: string;
  /** Town the agent departed from. */
  townId: string;
  /** Rig the agent was in. */
  rigName: string;
  /** When the departure happened. */
  timestamp: string;
  /** The EXIT marker for this departure. */
  marker: ExitMarker;
  /** Departure reason mapped from exit type. */
  reason: string;
}

/**
 * Bead-compatible attachment for storing EXIT markers in Gas Town's
 * git-backed issue tracking system.
 */
export interface BeadAttachment {
  /** Attachment type discriminant. */
  type: "exit-marker";
  /** Version of the attachment format (1.x compatible). */
  version: string;
  /** The EXIT marker ID. */
  markerId: string;
  /** Subject DID from the marker. */
  subject: string;
  /** Origin URI from the marker. */
  origin: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Exit type string. */
  exitType: string;
  /** Serialized EXIT marker JSON. */
  payload: string;
}
