# Changelog

## v1.2.1 (2026-03-10)

- **fix:** P-256 double-hash bug — `signP256`/`verifyP256` were double-hashing (manual SHA-256 + noble `prehash`). Fixed by removing manual hash, passing raw data with `prehash: true`. **Breaking for any pre-existing P-256 signatures** (Ed25519 unaffected).
- **fix:** SQLite store `busy_timeout` added (prevents SQLITE_BUSY under concurrent access)

## v1.2.0 (2026-03-06)

- v1.2 spec implementation (NIST RFI submission baseline)
- P-256 co-default with Ed25519
- RFC 8785 JCS canonicalization
- GDPR three-tier erasure model
- Anti-retaliation provisions
- 480 tests passing
