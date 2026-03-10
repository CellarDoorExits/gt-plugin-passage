/**
 * gt-plugin-passage -- Custom error class
 */

/**
 * Custom error class for gt-plugin-passage.
 * All errors thrown by this package use this class with a descriptive `code` field.
 */
export class PassageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PassageError";
    this.code = code;
  }
}
