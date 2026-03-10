# gt-plugin-passage

**Passport stamps for Gas Town agents -- departure records and admission policies for cross-town migration.**

> **Pre-release.** This package is under active development. APIs may change before 1.0.

[![Cellar Door EXIT](https://img.shields.io/badge/cellar--door--exit-v0.2.3-blue)](https://www.npmjs.com/package/cellar-door-exit)
[![Cellar Door ENTRY](https://img.shields.io/badge/cellar--door--entry-v0.2.0-blue)](https://www.npmjs.com/package/cellar-door-entry)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

---

## Scope & Trust Model

gt-plugin-passage is **Layer 0 (L0) infrastructure** — it creates and verifies departure/arrival records for AI agents moving between Gas Town instances.

**Key points:**

- Markers are **cryptographically signed but self-reported**. An EXIT marker proves a key-holder created a departure record, not that the departure actually happened.
- **Trust decisions, reputation scoring, identity verification, and collusion detection** are higher-layer concerns not addressed by this package.
- Think of it like **passport stamps**: they prove you were processed at a border, not that you're trustworthy.
- Self-certification is intentional at L0. Independent verification, reputation, and Sybil resistance are L1-L3 problems.

For the full threat model, see [SECURITY.md](./SECURITY.md).

> **Framework note:** While this package targets Gas Town, the underlying EXIT/ENTRY protocol (via `cellar-door-exit` and `cellar-door-entry`) is framework-agnostic. The Gas Town types here are a thin adapter layer. Any multi-agent platform can implement the same protocol.

## What is this?

When Gas Town agents (Polecats, Crew Members) are decommissioned, transferred, or migrate between Towns, `gt-plugin-passage` creates cryptographically signed EXIT markers that serve as portable departure records.

Think of it as a passport stamp system for AI agents.

```
Cellar Door Ecosystem
---------------------

  cellar-door-exit    cellar-door-entry    gt-plugin-passage
  (EXIT markers)      (admission)          (Gas Town glue)
       |                   |                     |
       |    EXIT + ENTRY = PASSAGE               |
       +-------------------------------------------+
                           |
                    Gas Town Agent Lifecycle
                    (Polecats, Crews, Rigs, Towns)
```

## Quick Start

```bash
npm install gt-plugin-passage
```

### Polecat Departure

When a Polecat finishes its work and the Refinery merges the changes:

```typescript
import { polecatDepart } from "gt-plugin-passage";
import { createSigner } from "cellar-door-exit";

const signer = createSigner();

const { marker, attachment } = await polecatDepart({
  polecatId: "gt-abc12",
  rigName: "my-project",
  townId: "town-alpha",
  reason: "completed",
  mergeResult: "merged",
  hookRef: "refs/hooks/gt-abc12",
  beadIds: ["bead-42", "bead-43"],
  signer,
});

// marker is a signed ExitMarker
// attachment is a BeadAttachment ready for git storage
console.log(marker.exitType); // "voluntary"
console.log(attachment.type); // "exit-marker"
```

### Crew Transfer Between Rigs

```typescript
import { crewTransfer } from "gt-plugin-passage";
import { createSigner } from "cellar-door-exit";

const signer = createSigner();

const { departureMarker, transferToken } = await crewTransfer({
  crewName: "alice",
  sourceRig: "frontend",
  targetRig: "backend",
  townId: "town-alpha",
  workState: { currentTask: "api-refactor", progress: 0.6 },
  signer,
});

// transferToken can be used to verify the transfer on the receiving end
console.log(transferToken); // "xfer-..."
```

### Cross-Town Entry

When an agent arrives from another Town:

```typescript
import { townEntry } from "gt-plugin-passage";
import { InMemoryClaimStore } from "cellar-door-entry";

// ⚠️ InMemoryClaimStore is for TESTING ONLY — data is lost on restart.
// For production, use SqliteClaimStore or implement ClaimStore with a persistent backend.
const store = new InMemoryClaimStore();

const result = await townEntry({
  marker: incomingExitMarker,
  targetTownId: "town-beta",
  targetRig: "shared-rig",
  policy: "CAUTIOUS",
  store,
});

if (result.admission.admitted) {
  console.log("Agent admitted!");
} else {
  console.log("Rejected:", result.admission.reasonCodes);
}
```

### Passport Chain

Read an agent's full departure history:

```typescript
import { getPassportChain } from "gt-plugin-passage";

const chain = getPassportChain("gt-abc12", allMarkers);

for (const entry of chain) {
  console.log(`${entry.timestamp}: Left ${entry.rigName} in ${entry.townId} (${entry.reason})`);
}
```

### Bead Attachments

Store EXIT markers in Gas Town's git-backed bead system:

```typescript
import { toBeadAttachment, fromBeadAttachment } from "gt-plugin-passage";

// Serialize for git storage
const attachment = toBeadAttachment(marker);
// attachment.payload is JSON, ready for git

// Deserialize back
const recovered = fromBeadAttachment(attachment);
// recovered is a full ExitMarker with crypto proof intact
```

## Departure Reason Mappings

Gas Town departure reasons map to EXIT ceremony types:

| Gas Town Reason | Merge Result | EXIT Type | Ceremony Path |
|----------------|-------------|-----------|---------------|
| `completed` | `merged` | `voluntary` | Cooperative exit |
| `completed` | `rejected` | `voluntary` | Cooperative exit |
| `completed` | `pending` | `voluntary` | Cooperative exit |
| `manual` | any | `voluntary` | Cooperative exit |
| `witness-killed` | any | `directed` | Unilateral exit |
| `timeout` | any | `directed` | Unilateral exit |
| `crashed` | any | `emergency` | Emergency exit |

## Policy Presets

Five policy presets for controlling cross-town agent admission:

| Preset | Behavior | Use Case |
|--------|----------|----------|
| `LOCKDOWN` | Reject all cross-town agents | Security incidents, isolated work |
| `CAUTIOUS` | Verify + quarantine new agents | Default for production Towns |
| `STANDARD` | Verify EXIT marker, accept if valid | Standard inter-town traffic |
| `TRUSTED_TOWNS` | Whitelist specific towns | Known partner Towns |
| `OPEN_DOOR` | Accept any valid marker | Development, testing |

```typescript
import { getPolicy, createTrustedTownsPolicy } from "gt-plugin-passage";

// Use a preset
const policy = getPolicy("CAUTIOUS");

// Or create a trusted towns whitelist
const trustedPolicy = createTrustedTownsPolicy(["town-alpha", "town-beta"]);
```

## Cross-Town Flow

```
Town Alpha                                    Town Beta
----------                                    ---------

1. Polecat gt-abc12 completes work
2. Refinery merges changes
3. polecatDepart() creates EXIT marker
   - Signed with agent's key
   - Gas Town metadata in tags
   - State snapshot references hooks/beads

4. Marker travels to Town Beta ------>

                                    5. townEntry() receives marker
                                    6. Policy evaluation (CAUTIOUS)
                                    7. Signature verification
                                    8. Admission decision
                                    9. Agent begins work in new Town
```

## Why Not Just Use Beads?

Beads and EXIT markers serve different purposes:

| | Beads | EXIT Markers |
|---|-------|-------------|
| **What** | Work state (issues, tasks) | Lifecycle state (departures) |
| **Scope** | Within a Town | Across Towns |
| **Verification** | Git history | Ed25519/P-256 signatures |
| **Portability** | Tied to a rig's git repo | Self-contained, portable |
| **Purpose** | "What work was done" | "Where the agent has been" |

Beads track *what* an agent did. EXIT markers track *where* an agent has been and *how* they left. They are complementary: `toBeadAttachment()` lets you store EXIT markers *inside* the bead system for complete traceability.

## Architecture

gt-plugin-passage sits beside MEOW (Molecular Expression of Work), not inside it:

```
Gas Town
├── Mayor (coordinator)
├── MEOW (work decomposition)
├── Refinery (merge engine)
├── Witness (agent monitor)
├── gt-plugin-passage (departure/entry protocol)   <-- here
│   ├── polecatDepart()     Exit ceremony
│   ├── crewTransfer()      Rig-to-rig transfer
│   ├── townEntry()         Cross-town admission
│   ├── getPassportChain()  Departure history
│   └── toBeadAttachment()  Git storage adapter
└── Beads (work state tracking)
```

## Ecosystem

gt-plugin-passage is part of the Cellar Door protocol family:

| Package | Description |
|---------|-------------|
| [`cellar-door-exit`](https://www.npmjs.com/package/cellar-door-exit) | EXIT markers -- the core departure primitive |
| [`cellar-door-entry`](https://www.npmjs.com/package/cellar-door-entry) | ENTRY protocol -- admission ceremonies and policies |
| `gt-plugin-passage` | Gas Town integration (this package) |

Protocol spec: [cellar-door.dev](https://cellar-door.dev)

## API Reference

### `polecatDepart(options)`

Create a signed EXIT marker when a Polecat is decommissioned.

### `crewTransfer(options)`

Create a signed EXIT marker when a crew member moves between rigs.

### `townEntry(options)`

Process a cross-town agent entry with policy evaluation.

### `getPassportChain(agentId, markers)`

Assemble an agent's chronological departure history.

### `toBeadAttachment(marker)` / `fromBeadAttachment(attachment)`

Serialize/deserialize EXIT markers for Git-backed bead storage.

### `getPolicy(preset)` / `createTrustedTownsPolicy(townIds)`

Get or create admission policies for cross-town entry.

### Policy Constants

`GT_LOCKDOWN`, `GT_CAUTIOUS`, `GT_STANDARD`, `GT_OPEN_DOOR`

## Error Codes

All errors thrown by this package are `PassageError` instances with a `code` field:

| Code | Thrown By | Description |
|------|-----------|-------------|
| `UNKNOWN_REASON` | `mapReasonToExitType()` | Unrecognized departure reason |
| `INVALID_IDENTIFIER` | `validateIdentifier()` | Empty or invalid characters in an identifier field |
| `TAG_LIMIT_EXCEEDED` | `validateTags()` | More than 50 metadata tags |
| `TAG_TOO_LONG` | `validateTags()` | A single tag exceeds 256 characters |
| `INVALID_ATTACHMENT_TYPE` | `fromBeadAttachment()` | Attachment type is not `"exit-marker"` |
| `UNSUPPORTED_VERSION` | `fromBeadAttachment()` | Attachment version is not 1.x |
| `MARKER_ID_MISMATCH` | `fromBeadAttachment()` | Attachment markerId doesn't match payload |
| `SUBJECT_MISMATCH` | `fromBeadAttachment()` | Attachment subject doesn't match payload |
| `ORIGIN_MISMATCH` | `fromBeadAttachment()` | Attachment origin doesn't match payload |
| `TIMESTAMP_MISMATCH` | `fromBeadAttachment()` | Attachment timestamp doesn't match payload |
| `EXIT_TYPE_MISMATCH` | `fromBeadAttachment()` | Attachment exitType doesn't match payload |
| `TRUSTED_TOWNS_REQUIRES_CONFIG` | `getPolicy()` | `TRUSTED_TOWNS` preset needs explicit town IDs |
| `NOT_IMPLEMENTED` | `getPassportChainFromStore()` | Store-based passport chain not yet implemented |

## GDPR Considerations

Storing agent identity records (DIDs, departure history) in git or other persistent storage may have GDPR implications in jurisdictions that consider AI agent records as personal data. Consult legal counsel for your specific deployment context.

## License

Apache-2.0. See [LICENSE](./LICENSE).
