/**
 * gt-plugin-passage -- Input validation utilities
 */

import { PassageError } from "./errors.js";
import { MAX_TAGS, MAX_TAG_LENGTH } from "./types.js";

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Validate that a string is a safe identifier (alphanumeric, dots, hyphens, underscores).
 *
 * @throws {PassageError} if the value is empty or contains invalid characters
 */
export function validateIdentifier(value: string, fieldName: string): void {
  if (!value || value.length === 0) {
    throw new PassageError(
      "INVALID_IDENTIFIER",
      `${fieldName} must not be empty`,
    );
  }
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new PassageError(
      "INVALID_IDENTIFIER",
      `${fieldName} contains invalid characters: must match ${IDENTIFIER_PATTERN} (got "${value}")`,
    );
  }
}

/**
 * Validate metadata tags: max {@link MAX_TAGS} tags, each at most {@link MAX_TAG_LENGTH} characters.
 *
 * @throws {PassageError} code `TAG_LIMIT_EXCEEDED` if too many tags
 * @throws {PassageError} code `TAG_TOO_LONG` if any tag exceeds the length limit
 */
export function validateTags(tags: string[]): void {
  if (tags.length > MAX_TAGS) {
    throw new PassageError(
      "TAG_LIMIT_EXCEEDED",
      `Too many metadata tags: ${tags.length} exceeds maximum of ${MAX_TAGS}`,
    );
  }
  for (const tag of tags) {
    if (tag.length > MAX_TAG_LENGTH) {
      throw new PassageError(
        "TAG_TOO_LONG",
        `Metadata tag exceeds ${MAX_TAG_LENGTH} characters (got ${tag.length})`,
      );
    }
  }
}
