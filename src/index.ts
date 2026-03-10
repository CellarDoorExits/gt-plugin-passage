/**
 * gt-plugin-passage
 *
 * Passport stamps for Gas Town agents -- departure records and admission
 * policies for cross-town migration.
 *
 * Integrates the Cellar Door EXIT/ENTRY Protocol with Gas Town's
 * agent lifecycle (Polecats, Crew Members, Rigs, Towns).
 */

// Custom error class
export { PassageError } from "./errors.js";

// Input validation
export { validateIdentifier, validateTags } from "./validation.js";

// Departure ceremonies
export { polecatDepart, crewTransfer, mapReasonToExitType, buildOrigin } from "./depart.js";

// Cross-town entry
export {
  townEntry,
  getPolicy,
  createTrustedTownsPolicy,
  GT_LOCKDOWN,
  GT_CAUTIOUS,
  GT_STANDARD,
  GT_OPEN_DOOR,
} from "./entry.js";

// Passport chain
export {
  getPassportChain,
  getPassportChainFromStore,
  markerToPassportEntry,
  extractGasTownContext,
} from "./passport.js";

// Bead attachment helpers
export { toBeadAttachment, fromBeadAttachment } from "./bead.js";

// Types
export type {
  PolecatDepartureOptions,
  PolecatDepartureResult,
  CrewTransferOptions,
  CrewTransferResult,
  TownEntryOptions,
  GasTownPolicyPreset,
  PassportEntry,
  BeadAttachment,
  DepartureReason,
  MergeResult,
  ExitMarker,
  ExitSigner,
  ExitType,
  EntryStore,
  PassageEvents,
} from "./types.js";

export { MAX_TAGS, MAX_TAG_LENGTH } from "./types.js";
