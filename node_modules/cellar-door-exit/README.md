# cellar-door-exit 𓉸

[![npm version](https://img.shields.io/npm/v/cellar-door-exit)](https://www.npmjs.com/package/cellar-door-exit)
[![tests](https://img.shields.io/badge/tests-480_passing-brightgreen)]()
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![NIST](https://img.shields.io/badge/NIST-submitted-orange)](https://cellar-door.dev/nist/)

> **[𓉸 Passage Protocol](https://cellar-door.dev)** · [exit-door](https://github.com/CellarDoorExits/exit-door) · [entry-door](https://github.com/CellarDoorExits/entry-door) · [mcp](https://github.com/CellarDoorExits/mcp-server) · [langchain](https://github.com/CellarDoorExits/langchain) · [vercel](https://github.com/CellarDoorExits/vercel-ai-sdk) · [eliza](https://github.com/CellarDoorExits/eliza-exit) · [eas](https://github.com/CellarDoorExits/eas-adapter) · [erc-8004](https://github.com/CellarDoorExits/erc-8004-adapter) · [sign](https://github.com/CellarDoorExits/sign-protocol-adapter) · [python](https://github.com/CellarDoorExits/exit-python)

> **⚠️ Pre-release software — no formal security audit has been conducted.** This project is published for transparency, review, and community feedback. It should not be used in production systems where security guarantees are required. If you find a vulnerability, please report it to hawthornhollows@gmail.com.

Vehicle registration for AI. Cryptographic proof that an agent left, when, and why.

## Ecosystem

| Package | Language | Description |
|---------|----------|-------------|
| **[cellar-door-exit](https://github.com/CellarDoorExits/exit-door)** | **TypeScript** | **Core protocol (reference impl) ← you are here** |
| [cellar-door-exit](https://github.com/CellarDoorExits/exit-python) | Python | Core protocol |
| [cellar-door-entry](https://github.com/CellarDoorExits/entry-door) | TypeScript | Arrival/entry markers |
| [@cellar-door/langchain](https://github.com/CellarDoorExits/langchain) | TypeScript | LangChain integration |
| [cellar-door-langchain](https://github.com/CellarDoorExits/cellar-door-langchain-python) | Python | LangChain integration |
| [@cellar-door/vercel-ai-sdk](https://github.com/CellarDoorExits/vercel-ai-sdk) | TypeScript | Vercel AI SDK |
| [@cellar-door/mcp-server](https://github.com/CellarDoorExits/mcp-server) | TypeScript | MCP server |
| [@cellar-door/eliza](https://github.com/CellarDoorExits/eliza-exit) | TypeScript | ElizaOS plugin |
| [@cellar-door/eas](https://github.com/CellarDoorExits/eas-adapter) | TypeScript | EAS attestation anchoring |
| [@cellar-door/erc-8004](https://github.com/CellarDoorExits/erc-8004-adapter) | TypeScript | ERC-8004 identity/reputation |
| [@cellar-door/sign-protocol](https://github.com/CellarDoorExits/sign-protocol-adapter) | TypeScript | Sign Protocol attestation |

**[Paper](https://cellar-door.dev/paper/) · [Website](https://cellar-door.dev)**

## The Problem

Your AI agent worked for months on Platform A. It built reputation, completed tasks, earned trust. Now it needs to move to Platform B. How does Platform B know any of that happened? How does the agent prove it wasn't fired for cause?

Today: it can't. There's no portable, verifiable proof of departure. No vehicle history report for AI agents. Every move starts from zero.

## The Solution

EXIT markers: signed, portable, offline-verifiable proof of departure. A departure **ceremony** that produces a cryptographic record of *when* an agent left, *how* things stood, and *why*.

Think of it as a vehicle history report, but for AI agents. Except the agent signs it, not the dealer.

## Quick Start

```bash
npm install cellar-door-exit
```

```typescript
import { quickExit, quickVerify, toJSON } from "cellar-door-exit";

// Create + sign a departure marker in one line
const { marker } = await quickExit("did:web:platform.example");
console.log(toJSON(marker));

// Verify it
const result = quickVerify(toJSON(marker));
console.log(result.valid); // true
```

That's it. Signed, verifiable proof of departure in 3 lines.

**P-256 (FIPS-compliant):**

```typescript
const { marker } = await quickExit("did:web:platform.example", { algorithm: "p256" });
const result = quickVerify(toJSON(marker));
console.log(result.valid); // true
```

**Expected output:**

```json
{
  "@context": "https://cellar-door.dev/v1",
  "id": "urn:exit:...",
  "subject": "did:key:z6Mk...",
  "origin": "did:web:platform.example",
  "timestamp": "2026-03-08T...",
  "exitType": "voluntary",
  "status": "good_standing",
  "proof": { "type": "Ed25519Signature2020", "..." }
}
```

See [`examples/`](./examples/) for runnable scripts.

## Protocol Stack

EXIT is a foundational protocol layer (L0) for agent lifecycle documentation:

- **L0: EXIT** — Departure records (this protocol)
- **L1: Reputation/Naming** — Trust scoring, identity reputation (future)
- **L2: Insurance/Stakes** — Economic guarantees, bonded attestation (future)
- **L3: Governance** — Collective decision-making, coordination (future)

EXIT intentionally limits its scope to departure documentation. Trust scoring, reputation management, and economic mechanisms compose on top.

## How It Works

EXIT is a **ceremony**, not a single event. Three paths, depending on cooperation:

```
Full cooperative:  ALIVE → INTENT → SNAPSHOT → OPEN → FINAL → DEPARTED
Unilateral:        ALIVE → INTENT → SNAPSHOT → FINAL → DEPARTED
Emergency:         ALIVE → FINAL → DEPARTED
```

Every EXIT marker has **7 mandatory fields** (~335 bytes unsigned):

| Field | Purpose |
|-------|---------|
| `id` | Content-addressed identifier |
| `subject` | Who is leaving (DID) |
| `origin` | What is being left (URI) |
| `timestamp` | When (ISO 8601 UTC) |
| `exitType` | `voluntary` · `forced` · `emergency` + 5 more |
| `status` | `good_standing` · `disputed` · `unverified` |
| `proof` | Cryptographic signature |

Contests don't block exit. A dispute changes `status`; it never prevents departure.

**New in v1.2:** Algorithm agility with P-256 as co-default, MarkerAmendment and Revocation support, FIPS-compliant deployment path, and crypto-shredding for GDPR compliance.

## API

**80% of users need two functions:**

```typescript
import { quickExit, quickVerify } from "cellar-door-exit";

const { marker, identity } = await quickExit(origin, opts?);
const result = quickVerify(jsonString);
```

**Full control:**

```typescript
import { generateIdentity, createMarker, signMarker, verifyMarker } from "cellar-door-exit";

const { did, publicKey, privateKey } = generateIdentity();
let marker = createMarker({ subject: did, origin, exitType, status });
marker = signMarker(marker, privateKey, publicKey);
const result = verifyMarker(marker);
```

**Amendments and Revocations:**

```typescript
import { createAmendment, createRevocation, resolveMarker } from "cellar-door-exit";

const amendment = createAmendment(originalMarker, { reason: "Incorrect status" }, privateKey);
const revocation = createRevocation(originalMarker, { reason: "Fraudulent" }, privateKey);
const resolved = resolveMarker(originalMarker, [amendment, revocation]);
```

**Amendment Discovery:**

```typescript
import { discoverAmendments, createWellKnownMetadata } from "cellar-door-exit";

// Discover amendments for a marker (checks marker URL → .well-known → local store)
const amendments = await discoverAmendments(marker);

// Serve amendments at .well-known/exit-amendments
const metadata = createWellKnownMetadata([amendment1, amendment2]);
```

**Passage API** (for full EXIT + ENTRY transfers between platforms):

```typescript
import { createDepartureMarker, verifyPassage } from "cellar-door-exit";
```

## CLI

```bash
exit keygen                          # Generate DID + keypair
exit create --origin <uri> --sign    # Create signed EXIT marker
exit verify marker.json              # Verify a marker
exit inspect marker.json             # Pretty-print all fields
```

## Modules

Six optional modules extend the core 7-field schema:

- **A: Lineage** — Predecessor/successor chains for agent migration
- **B: State Snapshot** — Hash-referenced state at exit time
- **C: Dispute Bundle** — Active disputes, evidence, challenge windows
- **D: Economic** — Asset manifests, obligations, exit fees ⚠️ *securities disclaimer applies*
- **E: Metadata** — Human-readable reason, narrative, tags
- **F: Cross-Domain** — On-chain anchors, registry entries

## Design Principles

1. **Non-custodial.** EXIT references external state but never contains it.
2. **Always available.** Works with zero cooperation from the origin.
3. **Offline-verifiable.** Check a marker years later without the origin being live.
4. **Agent-native.** Designed for autonomous agents first.
5. **Minimal core.** 7 fields. ~335 bytes unsigned. Everything else is optional.
6. **Irreversible.** No undo. Return is a new JOIN.

## Security

| Algorithm | Proof Type | FIPS 140-2/3 | Default |
|-----------|-----------|--------------|---------|
| Ed25519 | `Ed25519Signature2020` | ❌ | ✅ |
| ECDSA P-256 | `EcdsaP256Signature2019` | ✅ | |

Use `createSigner({ algorithm: "P-256" })` for FIPS compliance. See the [HSM Integration Guide](./docs/HSM_INTEGRATION.md) for AWS KMS, Azure Key Vault, GCP KMS, and YubiKey.

All 456 tests pass across 28 test files.

## Links

- **Spec:** [EXIT_SPEC v1.2](./specs/EXIT_SPEC_v1.2.md)
- **Paper:** [Cellar Door: Right of Passage](https://cellar-door.dev/paper/)
- **Website:** [cellar-door.dev](https://cellar-door.dev)
- **npm:** [cellar-door-exit](https://www.npmjs.com/package/cellar-door-exit)
- **Getting Started:** [5-minute guide](./docs/GETTING_STARTED.md)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Security:** [SECURITY.md](./SECURITY.md)

## Legal Considerations

EXIT markers used for admission decisions may trigger regulatory obligations. See [LEGAL.md](./LEGAL.md) for FCRA, GDPR, antitrust, and export control analysis. See [GDPR_GUIDE.md](./GDPR_GUIDE.md) for EU deployment guidance.

This protocol provides a communication format. It does not constitute legal advice.

## Key Management

EXIT uses a `Signer` interface as its KMS extension point. Any key management system can be integrated by implementing four methods:

```typescript
interface Signer {
  readonly algorithm: "Ed25519" | "P-256";
  sign(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
  verify(data: Uint8Array, signature: Uint8Array): Promise<boolean> | boolean;
  did(): string;
  publicKey(): Uint8Array;
  destroy?(): void; // Zero key material (best-effort, optional for HSM signers)
}
```

**Built-in signers** (Ed25519, P-256) hold keys in memory. For production, bring your own KMS:

```typescript
import { signMarkerWithSigner } from "cellar-door-exit";
import type { Signer } from "cellar-door-exit";

// Example: AWS KMS-backed signer
class AwsKmsSigner implements Signer {
  readonly algorithm = "P-256" as const;
  constructor(private kmsClient: KMSClient, private keyId: string, private pubKey: Uint8Array) {}

  async sign(data: Uint8Array): Promise<Uint8Array> {
    const resp = await this.kmsClient.send(new SignCommand({
      KeyId: this.keyId,
      Message: data,
      SigningAlgorithm: "ECDSA_SHA_256",
      MessageType: "RAW",
    }));
    return new Uint8Array(resp.Signature!);
  }

  verify(data: Uint8Array, signature: Uint8Array): boolean {
    // Delegate to local crypto for verification
    return verifyP256(data, signature, this.pubKey);
  }

  did(): string { return didFromP256PublicKey(this.pubKey); }
  publicKey(): Uint8Array { return this.pubKey; }
  // No destroy() needed — private key never leaves KMS
}

const signer = new AwsKmsSigner(kmsClient, "alias/exit-signing-key", publicKeyBytes);
const signed = await signMarkerWithSigner(marker, signer);
```

> **⚠️ `quickExit()` uses ephemeral keys** — a fresh keypair is generated per call and discarded. This is convenient for testing and demos but unsuitable for production, where key continuity matters for identity and trust. Use `createSigner()` or a KMS-backed `Signer` for real deployments.

For key compromise threat analysis, see [THREAT_MODEL.md](./THREAT_MODEL.md#31-key-compromise--unlimited-forgery).

## License

Apache-2.0
