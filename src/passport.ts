/**
 * gt-plugin-passage -- Passport chain: an agent's departure history
 */

import type { ExitMarker } from "cellar-door-exit";
import { verifyMarker } from "cellar-door-exit";
import type { ClaimStore } from "cellar-door-entry";
import { PassageError } from "./errors.js";
import type { PassportEntry } from "./types.js";

/**
 * Extract Gas Town context from an EXIT marker's metadata tags.
 */
export function extractGasTownContext(marker: ExitMarker): {
  townId: string;
  rigName: string;
  reason: string;
} {
  const tags = marker.metadata?.tags ?? [];
  let townId = "unknown";
  let rigName = "unknown";
  let reason = "unknown";

  for (const tag of tags) {
    if (tag.startsWith("town:")) townId = tag.slice(5);
    else if (tag.startsWith("rig:")) rigName = tag.slice(4);
    else if (tag.startsWith("reason:")) reason = tag.slice(7);
  }

  // Also try to parse from origin URI: gastown://townId/rigName
  if (townId === "unknown" && marker.origin.startsWith("gastown://")) {
    const parts = marker.origin.slice("gastown://".length).split("/");
    if (parts[0]) townId = parts[0];
    if (parts[1]) rigName = parts[1];
  }

  return { townId, rigName, reason };
}

/**
 * Build a passport entry from an EXIT marker.
 */
export function markerToPassportEntry(
  agentId: string,
  marker: ExitMarker,
): PassportEntry {
  const { townId, rigName, reason } = extractGasTownContext(marker);

  return {
    agentId,
    townId,
    rigName,
    timestamp: marker.timestamp,
    marker,
    reason,
  };
}

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
export function getPassportChain(
  agentId: string,
  markers: ExitMarker[],
  options?: { verify?: boolean },
): PassportEntry[] {
  const entries: PassportEntry[] = [];

  const shouldVerify = options?.verify === true;

  for (const marker of markers) {
    const tags = marker.metadata?.tags ?? [];
    const isMatch = tags.some(
      (t) => t === `polecat:${agentId}` || t === `crew:${agentId}`,
    );

    if (isMatch) {
      if (shouldVerify) {
        const verification = verifyMarker(marker);
        if (!verification.valid) continue;
      }
      entries.push(markerToPassportEntry(agentId, marker));
    }
  }

  // Sort chronologically
  entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return entries;
}

/**
 * Get passport chain from a claim store.
 *
 * @throws {PassageError} always -- ClaimStore does not support marker queries.
 * Use getPassportChain() with a marker array instead.
 */
export async function getPassportChainFromStore(
  _agentId: string,
  _options: { store: ClaimStore },
): Promise<PassportEntry[]> {
  throw new PassageError(
    "NOT_IMPLEMENTED",
    "Not implemented -- use getPassportChain() with a marker array",
  );
}
