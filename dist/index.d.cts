import { Signer, ExitMarker, ExitType } from 'cellar-door-exit';
export { ExitMarker, Signer as ExitSigner, ExitType } from 'cellar-door-exit';
import { ClaimStore, BuiltPolicy, AdmitResult } from 'cellar-door-entry';
export { ClaimStore as EntryStore } from 'cellar-door-entry';

/**
 * gt-plugin-passage -- Custom error class
 */
/**
 * Custom error class for gt-plugin-passage.
 * All errors thrown by this package use this class with a descriptive `code` field.
 */
declare class PassageError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}

/**
 * gt-plugin-passage -- Input validation utilities
 */
/**
 * Validate that a string is a safe identifier (alphanumeric, dots, hyphens, underscores).
 *
 * @throws {PassageError} if the value is empty or contains invalid characters
 */
declare function validateIdentifier(value: string, fieldName: string): void;
/**
 * Validate metadata tags: max {@link MAX_TAGS} tags, each at most {@link MAX_TAG_LENGTH} characters.
 *
 * @throws {PassageError} code `TAG_LIMIT_EXCEEDED` if too many tags
 * @throws {PassageError} code `TAG_TOO_LONG` if any tag exceeds the length limit
 */
declare function validateTags(tags: string[]): void;

/**
 * gt-plugin-passage -- Gas Town types for EXIT/ENTRY integration
 */

/**
 * Optional event callbacks for observability.
 *
 * Pass these to `polecatDepart()`, `crewTransfer()`, or `townEntry()`
 * to receive notifications about passage lifecycle events.
 */
interface PassageEvents {
    onDepart?: (result: PolecatDepartureResult) => void;
    onTransfer?: (result: CrewTransferResult) => void;
    onEntry?: (marker: ExitMarker) => void;
    onRejected?: (reason: string, marker: ExitMarker) => void;
}
/** Reasons a Polecat departs Gas Town. */
type DepartureReason = "completed" | "crashed" | "timeout" | "witness-killed" | "manual";
/** Merge result after Refinery processing. */
type MergeResult = "merged" | "rejected" | "pending";
/** Maximum number of metadata tags allowed per marker. */
declare const MAX_TAGS = 50;
/** Maximum length (in characters) of a single metadata tag. */
declare const MAX_TAG_LENGTH = 256;
/** Options for Polecat departure ceremony. */
interface PolecatDepartureOptions {
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
interface PolecatDepartureResult {
    marker: ExitMarker;
    attachment: BeadAttachment;
}
/** Options for crew member transfer between rigs. */
interface CrewTransferOptions {
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
interface CrewTransferResult {
    departureMarker: ExitMarker;
    transferToken: string;
}
/** Gas Town policy preset names. */
type GasTownPolicyPreset = "LOCKDOWN" | "CAUTIOUS" | "STANDARD" | "TRUSTED_TOWNS" | "OPEN_DOOR";
/** Options for cross-town entry. */
interface TownEntryOptions {
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
interface PassportEntry {
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
interface BeadAttachment {
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

/**
 * gt-plugin-passage -- Departure ceremonies for Gas Town agents
 */

/**
 * Map a Gas Town departure reason + merge result to an EXIT ceremony type.
 *
 * Mappings:
 *   completed + merged    -> ExitType.Voluntary (cooperative exit)
 *   completed + rejected  -> ExitType.Voluntary (cooperative exit)
 *   completed + pending   -> ExitType.Voluntary (cooperative exit)
 *   witness-killed        -> ExitType.Directed (unilateral exit)
 *   timeout               -> ExitType.Directed (unilateral exit)
 *   crashed               -> ExitType.Emergency (emergency exit)
 *   manual                -> ExitType.Voluntary (cooperative exit)
 */
declare function mapReasonToExitType(reason: DepartureReason, _mergeResult?: MergeResult): ExitType;
/**
 * Build the origin URI for a Gas Town agent.
 */
declare function buildOrigin(townId: string, rigName: string): string;
/**
 * Decommission a Polecat with a proper EXIT ceremony.
 *
 * Called after the Refinery has merged (or rejected) the Polecat's work.
 * Creates a signed EXIT marker with Gas Town metadata attached.
 */
declare function polecatDepart(options: PolecatDepartureOptions): Promise<PolecatDepartureResult>;
/**
 * Transfer a crew member between rigs.
 *
 * Creates a signed EXIT marker for the source rig with transfer metadata.
 */
declare function crewTransfer(options: CrewTransferOptions): Promise<CrewTransferResult>;

/**
 * gt-plugin-passage -- Cross-town entry and policy presets
 */

/**
 * Gas Town policy preset mapping.
 *
 * | Gas Town Preset  | Behavior                              |
 * |-----------------|---------------------------------------|
 * | LOCKDOWN        | Reject all cross-town agents          |
 * | CAUTIOUS        | Verify + quarantine new agents        |
 * | STANDARD        | Verify EXIT marker, accept if valid   |
 * | TRUSTED_TOWNS   | Whitelist specific towns              |
 * | OPEN_DOOR       | Accept any valid marker               |
 */
/** LOCKDOWN: reject all cross-town agents. */
declare const GT_LOCKDOWN: BuiltPolicy;
/** CAUTIOUS: verify + quarantine new agents. */
declare const GT_CAUTIOUS: BuiltPolicy;
/** STANDARD: verify EXIT marker, accept if valid. */
declare const GT_STANDARD: BuiltPolicy;
/** TRUSTED_TOWNS: whitelist specific towns. Uses STANDARD as base. */
declare function createTrustedTownsPolicy(trustedTownIds: string[]): BuiltPolicy;
/** OPEN_DOOR: accept any valid marker. */
declare const GT_OPEN_DOOR: BuiltPolicy;
/**
 * Get a built policy for a Gas Town preset name.
 *
 * @throws {PassageError} if TRUSTED_TOWNS is passed (use createTrustedTownsPolicy instead)
 */
declare function getPolicy(preset: GasTownPolicyPreset): BuiltPolicy;
/**
 * Process a cross-town entry.
 *
 * When an agent arrives from another Town, this function:
 * 1. Looks up the appropriate policy preset
 * 2. Runs the admission ceremony via cellar-door-entry
 * 3. Returns the admission result
 */
declare function townEntry(options: TownEntryOptions): Promise<AdmitResult>;

/**
 * gt-plugin-passage -- Passport chain: an agent's departure history
 */

/**
 * Extract Gas Town context from an EXIT marker's metadata tags.
 */
declare function extractGasTownContext(marker: ExitMarker): {
    townId: string;
    rigName: string;
    reason: string;
};
/**
 * Build a passport entry from an EXIT marker.
 */
declare function markerToPassportEntry(agentId: string, marker: ExitMarker): PassportEntry;
/**
 * Get an agent's passport chain: their full EXIT history ("passport stamps").
 *
 * Collects all EXIT markers associated with the given agent ID and
 * assembles them into a chronologically sorted passport chain.
 *
 * Matching is done strictly via metadata tags (`polecat:<agentId>` or `crew:<agentId>`).
 *
 * @param agentId - The agent identifier (Polecat ID or crew name)
 * @param markers - Array of EXIT markers to search through
 * @param options - Optional settings
 * @param options.verify - When true, only include markers whose cryptographic signature is valid.
 *   Default false for backward compatibility.
 * @returns Chronologically sorted array of passport entries
 */
declare function getPassportChain(agentId: string, markers: ExitMarker[], options?: {
    verify?: boolean;
}): PassportEntry[];
/**
 * Get passport chain from a claim store.
 *
 * @throws {PassageError} always -- ClaimStore does not support marker queries.
 * Use getPassportChain() with a marker array instead.
 */
declare function getPassportChainFromStore(_agentId: string, _options: {
    store: ClaimStore;
}): Promise<PassportEntry[]>;

/**
 * gt-plugin-passage -- Bead attachment helpers
 *
 * Format EXIT markers as Bead-compatible attachments that can be stored
 * in Gas Town's git-backed issue tracking system.
 */

/**
 * Convert an EXIT marker to a Bead-compatible attachment.
 *
 * Beads are Gas Town's git-backed work state tracking. This function
 * serializes an EXIT marker into a format that can be attached to a bead,
 * preserving the cryptographic integrity of the marker while making it
 * queryable by bead tooling.
 */
declare function toBeadAttachment(marker: ExitMarker): BeadAttachment;
/**
 * Reconstruct an EXIT marker from a Bead attachment.
 *
 * Deserializes the payload and validates that the attachment metadata
 * is consistent with the marker contents.
 *
 * @throws {PassageError} If the attachment type is not "exit-marker" or the payload is invalid
 */
declare function fromBeadAttachment(attachment: BeadAttachment): ExitMarker;

export { type BeadAttachment, type CrewTransferOptions, type CrewTransferResult, type DepartureReason, GT_CAUTIOUS, GT_LOCKDOWN, GT_OPEN_DOOR, GT_STANDARD, type GasTownPolicyPreset, MAX_TAGS, MAX_TAG_LENGTH, type MergeResult, PassageError, type PassageEvents, type PassportEntry, type PolecatDepartureOptions, type PolecatDepartureResult, type TownEntryOptions, buildOrigin, createTrustedTownsPolicy, crewTransfer, extractGasTownContext, fromBeadAttachment, getPassportChain, getPassportChainFromStore, getPolicy, mapReasonToExitType, markerToPassportEntry, polecatDepart, toBeadAttachment, townEntry, validateIdentifier, validateTags };
