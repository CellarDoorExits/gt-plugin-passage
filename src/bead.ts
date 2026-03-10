/**
 * gt-plugin-passage -- Bead attachment helpers
 *
 * Format EXIT markers as Bead-compatible attachments that can be stored
 * in Gas Town's git-backed issue tracking system.
 */

import { toJSON, fromJSON } from "cellar-door-exit";
import type { ExitMarker } from "cellar-door-exit";
import { PassageError } from "./errors.js";
import type { BeadAttachment } from "./types.js";

/**
 * Check if a version string is semver-compatible with 1.x.
 */
function isCompatibleVersion(version: string): boolean {
  const match = version.match(/^(\d+)\.(\d+)$/);
  if (!match) return false;
  return match[1] === "1";
}

/**
 * Convert an EXIT marker to a Bead-compatible attachment.
 *
 * Beads are Gas Town's git-backed work state tracking. This function
 * serializes an EXIT marker into a format that can be attached to a bead,
 * preserving the cryptographic integrity of the marker while making it
 * queryable by bead tooling.
 */
export function toBeadAttachment(marker: ExitMarker): BeadAttachment {
  return {
    type: "exit-marker",
    version: "1.0",
    markerId: marker.id,
    subject: marker.subject,
    origin: marker.origin,
    timestamp: marker.timestamp,
    exitType: marker.exitType,
    payload: toJSON(marker),
  };
}

/**
 * Reconstruct an EXIT marker from a Bead attachment.
 *
 * Deserializes the payload and validates that the attachment metadata
 * is consistent with the marker contents.
 *
 * @throws {PassageError} If the attachment type is not "exit-marker" or the payload is invalid
 */
export function fromBeadAttachment(attachment: BeadAttachment): ExitMarker {
  if (attachment.type !== "exit-marker") {
    throw new PassageError(
      "INVALID_ATTACHMENT_TYPE",
      `Invalid attachment type: expected "exit-marker", got "${attachment.type}"`,
    );
  }

  if (!isCompatibleVersion(attachment.version)) {
    throw new PassageError(
      "UNSUPPORTED_VERSION",
      `Unsupported attachment version: ${attachment.version} (expected 1.x)`,
    );
  }

  const marker = fromJSON(attachment.payload);

  // Validate consistency between attachment metadata and marker
  if (marker.id !== attachment.markerId) {
    throw new PassageError(
      "MARKER_ID_MISMATCH",
      `Marker ID mismatch: attachment says "${attachment.markerId}", marker says "${marker.id}"`,
    );
  }

  if (marker.subject !== attachment.subject) {
    throw new PassageError(
      "SUBJECT_MISMATCH",
      `Subject mismatch: attachment says "${attachment.subject}", marker says "${marker.subject}"`,
    );
  }

  if (marker.origin !== attachment.origin) {
    throw new PassageError(
      "ORIGIN_MISMATCH",
      `Origin mismatch: attachment says "${attachment.origin}", marker says "${marker.origin}"`,
    );
  }

  if (marker.timestamp !== attachment.timestamp) {
    throw new PassageError(
      "TIMESTAMP_MISMATCH",
      `Timestamp mismatch: attachment says "${attachment.timestamp}", marker says "${marker.timestamp}"`,
    );
  }

  if (marker.exitType !== attachment.exitType) {
    throw new PassageError(
      "EXIT_TYPE_MISMATCH",
      `ExitType mismatch: attachment says "${attachment.exitType}", marker says "${marker.exitType}"`,
    );
  }

  return marker;
}
