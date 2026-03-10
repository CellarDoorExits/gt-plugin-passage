# Security Policy

## Threat Model

### What This Package Guarantees

`gt-plugin-passage` is **Layer 0 (L0) infrastructure** — foundational departure/arrival records for AI agent lifecycle management.

It guarantees:

- **Cryptographic proof that a key-holder created a departure record.** EXIT markers are signed with Ed25519 or P-256 keys via `cellar-door-exit`. Signatures can be verified independently.
- **Replay protection.** The `ClaimStore` prevents the same EXIT marker from being admitted twice at a given destination.
- **Policy-based admission control.** Five configurable policy presets govern whether an arriving marker is accepted.
- **Tamper detection.** Signed markers cannot be modified without invalidating the signature.

### What This Package Does NOT Guarantee

- **That a departure actually happened.** Markers are self-certified — an agent (or its operator) asserts it departed. This is analogous to a passport stamp: it proves processing occurred, not that the traveler is trustworthy.
- **That the agent is who they claim to be.** Identity verification, reputation scoring, and trust establishment are higher-layer concerns.
- **Byzantine fault tolerance.** This package does not defend against coordinated attacks by multiple compromised agents.
- **Sybil resistance.** Nothing prevents a single operator from creating many agents with many keys.
- **Collusion detection.** Detecting coordinated deceptive behavior between agents is an L2+ concern.
- **Key revocation or rotation registries.** Key lifecycle management is outside L0 scope.

### Self-Certification Is Intentional

EXIT markers are **self-reported departure records**. This is the correct model for L0:

- L0: Record-keeping (this package) — "Here is a signed record that departure was processed"
- L1: Verification — "Did the departure actually happen? Cross-reference with platform logs"
- L2: Reputation — "Is this agent trustworthy based on history?"
- L3: Governance — "Should this agent class be allowed in our network?"

Self-certification at L0 is like passport stamps in international travel: they prove you were processed at a border checkpoint, not that you're a good person. Trust decisions are made by immigration policy (L1+), background checks (L2), and international agreements (L3).

### Scope Boundaries

| Concern | Layer | Addressed Here? |
|---------|-------|----------------|
| Signed departure records | L0 | ✅ Yes |
| Replay protection | L0 | ✅ Yes |
| Policy-based admission | L0 | ✅ Yes |
| Departure verification | L1 | ❌ No |
| Identity registries | L1 | ❌ No |
| Key revocation | L1 | ❌ No |
| Reputation scoring | L2 | ❌ No |
| Collusion detection | L2 | ❌ No |
| Sybil resistance | L2 | ❌ No |
| Byzantine tolerance | L3 | ❌ No |
| Governance frameworks | L3 | ❌ No |

For the full security model, see the [Cellar Door EXIT Protocol specification](https://cellar-door.dev/specs/exit-protocol).

## InMemoryClaimStore Warning

⚠️ **`InMemoryClaimStore` is for testing and development only.**

It stores claims in process memory. All data is lost on restart. For production:

- Use `SqliteClaimStore` from `cellar-door-entry` for single-node deployments
- Implement the `ClaimStore` interface with Redis, PostgreSQL, or another persistent backend for distributed deployments
- Ensure proper locking semantics for concurrent admission processing

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email: security@cellar-door.dev

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Cryptographic Dependencies

This package delegates all cryptography to:
- `cellar-door-exit` (EXIT markers with Ed25519/P-256 signatures)
- `cellar-door-entry` (admission ceremonies, claim stores, policy evaluation)

Security concerns related to those libraries should be reported to their respective maintainers.

## Key Material

This package does not generate or store key material directly. It accepts `Signer` instances from `cellar-door-exit`. Ensure your signers follow best practices:
- Destroy signers after use (`signer.destroy()`)
- Do not log or serialize private keys
- Use hardware-backed signing for production deployments

## GDPR Considerations

Storing agent identity records (DIDs, departure history) in git or other persistent storage may have GDPR implications in jurisdictions that consider AI agent records as personal data. Consult legal counsel for your specific deployment context.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes (pre-release) |
