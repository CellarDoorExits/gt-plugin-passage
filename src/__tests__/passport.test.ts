import { describe, it, expect } from "vitest";
import {
  createSigner,
  createMarker,
  signMarkerWithSigner,
  addModule,
  ExitType,
} from "cellar-door-exit";
import type { ExitMarker } from "cellar-door-exit";
import {
  getPassportChain,
  getPassportChainFromStore,
  markerToPassportEntry,
  PassageError,
} from "../index.js";
import { InMemoryClaimStore } from "cellar-door-entry";

async function makeMarker(opts: {
  polecatId: string;
  rigName: string;
  townId: string;
  reason: string;
  timestamp?: string;
}): Promise<ExitMarker> {
  const signer = createSigner();
  let marker = createMarker({
    subject: signer.did(),
    origin: `gastown://${opts.townId}/${opts.rigName}`,
    exitType: ExitType.Voluntary,
    timestamp: opts.timestamp,
  });
  marker = addModule(marker, "metadata", {
    reason: `Polecat ${opts.polecatId} departure`,
    tags: [
      `polecat:${opts.polecatId}`,
      `rig:${opts.rigName}`,
      `town:${opts.townId}`,
      `reason:${opts.reason}`,
    ],
  });
  return signMarkerWithSigner(marker, signer);
}

describe("markerToPassportEntry", () => {
  it("extracts Gas Town context from metadata tags", async () => {
    const marker = await makeMarker({
      polecatId: "gt-abc12",
      rigName: "my-rig",
      townId: "town-001",
      reason: "completed",
    });

    const entry = markerToPassportEntry("gt-abc12", marker);

    expect(entry.agentId).toBe("gt-abc12");
    expect(entry.townId).toBe("town-001");
    expect(entry.rigName).toBe("my-rig");
    expect(entry.reason).toBe("completed");
    expect(entry.marker).toBe(marker);
  });

  it("falls back to parsing origin URI when tags are missing", () => {
    const marker = createMarker({
      subject: "did:key:z6MkTest",
      origin: "gastown://fallback-town/fallback-rig",
      exitType: ExitType.Voluntary,
    });

    const entry = markerToPassportEntry("agent-1", marker);

    expect(entry.townId).toBe("fallback-town");
    expect(entry.rigName).toBe("fallback-rig");
    expect(entry.reason).toBe("unknown");
  });

  it("handles markers with no Gas Town metadata", () => {
    const marker = createMarker({
      subject: "did:key:z6MkTest",
      origin: "https://other-platform.com",
      exitType: ExitType.Voluntary,
    });

    const entry = markerToPassportEntry("agent-x", marker);

    expect(entry.townId).toBe("unknown");
    expect(entry.rigName).toBe("unknown");
  });
});

describe("getPassportChain", () => {
  it("returns empty chain when no markers match", async () => {
    const marker = await makeMarker({
      polecatId: "gt-other",
      rigName: "rig-a",
      townId: "town-001",
      reason: "completed",
    });

    const chain = getPassportChain("gt-abc12", [marker]);
    expect(chain).toHaveLength(0);
  });

  it("finds markers by polecat ID tag", async () => {
    const marker = await makeMarker({
      polecatId: "gt-abc12",
      rigName: "rig-a",
      townId: "town-001",
      reason: "completed",
    });

    const chain = getPassportChain("gt-abc12", [marker]);
    expect(chain).toHaveLength(1);
    expect(chain[0].agentId).toBe("gt-abc12");
  });

  it("sorts entries chronologically", async () => {
    const m1 = await makeMarker({
      polecatId: "gt-abc12",
      rigName: "rig-a",
      townId: "town-001",
      reason: "completed",
      timestamp: "2026-01-01T00:00:00Z",
    });
    const m2 = await makeMarker({
      polecatId: "gt-abc12",
      rigName: "rig-b",
      townId: "town-001",
      reason: "completed",
      timestamp: "2026-01-02T00:00:00Z",
    });
    const m3 = await makeMarker({
      polecatId: "gt-abc12",
      rigName: "rig-c",
      townId: "town-002",
      reason: "manual",
      timestamp: "2026-01-03T00:00:00Z",
    });

    // Pass in reverse order
    const chain = getPassportChain("gt-abc12", [m3, m1, m2]);
    expect(chain).toHaveLength(3);
    expect(chain[0].rigName).toBe("rig-a");
    expect(chain[1].rigName).toBe("rig-b");
    expect(chain[2].rigName).toBe("rig-c");
  });

  it("filters to only matching agent", async () => {
    const m1 = await makeMarker({
      polecatId: "gt-abc12",
      rigName: "rig-a",
      townId: "town-001",
      reason: "completed",
    });
    const m2 = await makeMarker({
      polecatId: "gt-other",
      rigName: "rig-b",
      townId: "town-001",
      reason: "completed",
    });

    const chain = getPassportChain("gt-abc12", [m1, m2]);
    expect(chain).toHaveLength(1);
  });

  it("matches crew members by crew tag", async () => {
    const signer = createSigner();
    let marker = createMarker({
      subject: signer.did(),
      origin: "gastown://town-001/rig-a",
      exitType: ExitType.Voluntary,
    });
    marker = addModule(marker, "metadata", {
      tags: ["crew:alice", "rig:rig-a", "town:town-001", "reason:manual"],
    });
    const signed = await signMarkerWithSigner(marker, signer);

    const chain = getPassportChain("alice", [signed]);
    expect(chain).toHaveLength(1);
    expect(chain[0].agentId).toBe("alice");
  });

  it("does NOT match by subject.includes() -- strict tag matching only", async () => {
    // Create a marker where the subject DID contains the agentId substring
    // but there are no matching tags
    const signer = createSigner();
    let marker = createMarker({
      subject: signer.did(),
      origin: "gastown://town-001/rig-a",
      exitType: ExitType.Voluntary,
    });
    marker = addModule(marker, "metadata", {
      tags: ["polecat:gt-other", "rig:rig-a", "town:town-001"],
    });
    const signed = await signMarkerWithSigner(marker, signer);

    // Extract a substring of the DID -- should NOT match
    const didSubstr = signed.subject.slice(8, 16);
    const chain = getPassportChain(didSubstr, [signed]);
    expect(chain).toHaveLength(0);
  });
});

describe("getPassportChainFromStore", () => {
  it("throws PassageError (not implemented)", async () => {
    const store = new InMemoryClaimStore();
    await expect(
      getPassportChainFromStore("gt-abc12", { store }),
    ).rejects.toThrow(PassageError);
    await expect(
      getPassportChainFromStore("gt-abc12", { store }),
    ).rejects.toThrow("Not implemented");
  });
});
