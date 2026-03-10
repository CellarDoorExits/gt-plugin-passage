import { describe, it, expect, beforeEach } from "vitest";
import {
  createSigner,
  ExitType,
  verifyMarker,
} from "cellar-door-exit";
import type { Signer } from "cellar-door-exit";
import { polecatDepart, crewTransfer, mapReasonToExitType, PassageError } from "../index.js";
import type { DepartureReason, MergeResult } from "../types.js";

describe("mapReasonToExitType", () => {
  it("maps completed to Voluntary", () => {
    expect(mapReasonToExitType("completed")).toBe(ExitType.Voluntary);
  });

  it("maps completed+merged to Voluntary", () => {
    expect(mapReasonToExitType("completed", "merged")).toBe(ExitType.Voluntary);
  });

  it("maps completed+rejected to Voluntary", () => {
    expect(mapReasonToExitType("completed", "rejected")).toBe(ExitType.Voluntary);
  });

  it("maps completed+pending to Voluntary", () => {
    expect(mapReasonToExitType("completed", "pending")).toBe(ExitType.Voluntary);
  });

  it("maps manual to Voluntary", () => {
    expect(mapReasonToExitType("manual")).toBe(ExitType.Voluntary);
  });

  it("maps witness-killed to Directed", () => {
    expect(mapReasonToExitType("witness-killed")).toBe(ExitType.Directed);
  });

  it("maps timeout to Directed", () => {
    expect(mapReasonToExitType("timeout")).toBe(ExitType.Directed);
  });

  it("maps crashed to Emergency", () => {
    expect(mapReasonToExitType("crashed")).toBe(ExitType.Emergency);
  });

  it("throws on unknown reason (exhaustiveness check)", () => {
    expect(() =>
      mapReasonToExitType("unknown-reason" as DepartureReason),
    ).toThrow(PassageError);
  });
});

describe("polecatDepart", () => {
  let signer: Signer;

  beforeEach(() => {
    signer = createSigner();
  });

  it("creates a valid signed EXIT marker for completed+merged", async () => {
    const result = await polecatDepart({
      polecatId: "gt-abc12",
      rigName: "my-project",
      townId: "town-001",
      reason: "completed",
      mergeResult: "merged",
      signer,
    });

    expect(result.marker).toBeDefined();
    expect(result.marker.exitType).toBe(ExitType.Voluntary);
    expect(result.marker.origin).toBe("gastown://town-001/my-project");
    expect(result.marker.proof.proofValue).toBeTruthy();

    const verification = verifyMarker(result.marker);
    expect(verification.valid).toBe(true);
  });

  it("creates an emergency marker for crashed polecats", async () => {
    const result = await polecatDepart({
      polecatId: "gt-xyz99",
      rigName: "broken-rig",
      townId: "town-001",
      reason: "crashed",
      signer,
    });

    expect(result.marker.exitType).toBe(ExitType.Emergency);
    expect(result.marker.emergencyJustification).toContain("gt-xyz99");
  });

  it("creates a directed marker for witness-killed polecats", async () => {
    const result = await polecatDepart({
      polecatId: "gt-stuck1",
      rigName: "slow-rig",
      townId: "town-001",
      reason: "witness-killed",
      signer,
    });

    expect(result.marker.exitType).toBe(ExitType.Directed);
  });

  it("creates a directed marker for timed-out polecats", async () => {
    const result = await polecatDepart({
      polecatId: "gt-slow2",
      rigName: "slow-rig",
      townId: "town-001",
      reason: "timeout",
      signer,
    });

    expect(result.marker.exitType).toBe(ExitType.Directed);
  });

  it("includes metadata tags with Gas Town context", async () => {
    const result = await polecatDepart({
      polecatId: "gt-abc12",
      rigName: "my-project",
      townId: "town-001",
      reason: "completed",
      mergeResult: "merged",
      hookRef: "refs/hooks/gt-abc12",
      beadIds: ["bead-1", "bead-2"],
      signer,
    });

    const tags = result.marker.metadata?.tags ?? [];
    expect(tags).toContain("polecat:gt-abc12");
    expect(tags).toContain("rig:my-project");
    expect(tags).toContain("town:town-001");
    expect(tags).toContain("reason:completed");
    expect(tags).toContain("merge:merged");
    expect(tags).toContain("hook:refs/hooks/gt-abc12");
    expect(tags).toContain("bead:bead-1");
    expect(tags).toContain("bead:bead-2");
  });

  it("attaches state snapshot when hookRef is provided", async () => {
    const result = await polecatDepart({
      polecatId: "gt-abc12",
      rigName: "my-project",
      townId: "town-001",
      reason: "completed",
      hookRef: "refs/hooks/gt-abc12",
      signer,
    });

    expect(result.marker.stateSnapshot).toBeDefined();
    expect(result.marker.stateSnapshot!.stateLocation).toContain("hooks");
    // stateHash should be a SHA-256 hex, not the marker ID
    expect(result.marker.stateSnapshot!.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("attaches state snapshot when beadIds are provided", async () => {
    const result = await polecatDepart({
      polecatId: "gt-abc12",
      rigName: "my-project",
      townId: "town-001",
      reason: "completed",
      beadIds: ["bead-1"],
      signer,
    });

    expect(result.marker.stateSnapshot).toBeDefined();
    expect(result.marker.stateSnapshot!.obligations).toContain("bead:bead-1");
    expect(result.marker.stateSnapshot!.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stateHash is deterministic for same inputs", async () => {
    const opts = {
      polecatId: "gt-abc12",
      rigName: "my-project",
      townId: "town-001",
      reason: "completed" as const,
      hookRef: "refs/hooks/gt-abc12",
      beadIds: ["bead-1"],
      signer,
    };

    const r1 = await polecatDepart(opts);
    const r2 = await polecatDepart(opts);

    expect(r1.marker.stateSnapshot!.stateHash).toBe(
      r2.marker.stateSnapshot!.stateHash,
    );
  });

  it("returns a valid bead attachment", async () => {
    const result = await polecatDepart({
      polecatId: "gt-abc12",
      rigName: "my-project",
      townId: "town-001",
      reason: "completed",
      signer,
    });

    expect(result.attachment.type).toBe("exit-marker");
    expect(result.attachment.version).toBe("1.0");
    expect(result.attachment.markerId).toBe(result.marker.id);
    expect(result.attachment.subject).toBe(result.marker.subject);
  });

  it("creates a voluntary marker for manual departure", async () => {
    const result = await polecatDepart({
      polecatId: "gt-manual1",
      rigName: "my-rig",
      townId: "town-001",
      reason: "manual",
      signer,
    });

    expect(result.marker.exitType).toBe(ExitType.Voluntary);
  });

  // Adversarial input tests
  it("rejects polecatId with special characters", async () => {
    await expect(
      polecatDepart({
        polecatId: "gt-abc12; rm -rf /",
        rigName: "my-project",
        townId: "town-001",
        reason: "completed",
        signer,
      }),
    ).rejects.toThrow(PassageError);
  });

  it("rejects empty polecatId", async () => {
    await expect(
      polecatDepart({
        polecatId: "",
        rigName: "my-project",
        townId: "town-001",
        reason: "completed",
        signer,
      }),
    ).rejects.toThrow(PassageError);
  });

  it("rejects rigName with spaces", async () => {
    await expect(
      polecatDepart({
        polecatId: "gt-abc12",
        rigName: "my project",
        townId: "town-001",
        reason: "completed",
        signer,
      }),
    ).rejects.toThrow(PassageError);
  });

  it("rejects townId with injection characters", async () => {
    await expect(
      polecatDepart({
        polecatId: "gt-abc12",
        rigName: "my-project",
        townId: "town<script>alert(1)</script>",
        reason: "completed",
        signer,
      }),
    ).rejects.toThrow(PassageError);
  });
});

describe("crewTransfer", () => {
  let signer: Signer;

  beforeEach(() => {
    signer = createSigner();
  });

  it("creates a valid signed departure marker", async () => {
    const result = await crewTransfer({
      crewName: "alice",
      sourceRig: "rig-a",
      targetRig: "rig-b",
      townId: "town-001",
      signer,
    });

    expect(result.departureMarker).toBeDefined();
    expect(result.departureMarker.exitType).toBe(ExitType.Voluntary);
    expect(result.departureMarker.origin).toBe("gastown://town-001/rig-a");

    const verification = verifyMarker(result.departureMarker);
    expect(verification.valid).toBe(true);
  });

  it("generates a deterministic transfer token (SHA-256 based)", async () => {
    const result = await crewTransfer({
      crewName: "alice",
      sourceRig: "rig-a",
      targetRig: "rig-b",
      townId: "town-001",
      signer,
    });

    expect(result.transferToken).toBeTruthy();
    expect(result.transferToken.startsWith("xfer-")).toBe(true);
    // SHA-256 hex = 64 chars + "xfer-" prefix
    expect(result.transferToken.length).toBe(69);
  });

  it("generates different tokens for different markers", async () => {
    const r1 = await crewTransfer({
      crewName: "alice",
      sourceRig: "rig-a",
      targetRig: "rig-b",
      townId: "town-001",
      signer,
    });
    const r2 = await crewTransfer({
      crewName: "bob",
      sourceRig: "rig-a",
      targetRig: "rig-c",
      townId: "town-001",
      signer,
    });

    expect(r1.transferToken).not.toBe(r2.transferToken);
  });

  it("includes transfer metadata tags", async () => {
    const result = await crewTransfer({
      crewName: "bob",
      sourceRig: "rig-a",
      targetRig: "rig-c",
      townId: "town-002",
      signer,
    });

    const tags = result.departureMarker.metadata?.tags ?? [];
    expect(tags).toContain("crew:bob");
    expect(tags).toContain("source:rig-a");
    expect(tags).toContain("target:rig-c");
    expect(tags).toContain("transfer");
  });

  it("sets lineage successor to target rig", async () => {
    const result = await crewTransfer({
      crewName: "alice",
      sourceRig: "rig-a",
      targetRig: "rig-b",
      townId: "town-001",
      signer,
    });

    expect(result.departureMarker.lineage?.successor).toBe(
      "gastown://town-001/rig-b/alice",
    );
  });

  it("attaches state snapshot when workState is provided", async () => {
    const result = await crewTransfer({
      crewName: "alice",
      sourceRig: "rig-a",
      targetRig: "rig-b",
      townId: "town-001",
      workState: { currentTask: "fix-bug-123", progress: 0.75 },
      signer,
    });

    expect(result.departureMarker.stateSnapshot).toBeDefined();
    expect(result.departureMarker.stateSnapshot!.stateHash).toBeTruthy();
    expect(result.departureMarker.stateSnapshot!.stateLocation).toContain(
      "handoff/alice",
    );
  });

  it("does not attach state snapshot without workState", async () => {
    const result = await crewTransfer({
      crewName: "alice",
      sourceRig: "rig-a",
      targetRig: "rig-b",
      townId: "town-001",
      signer,
    });

    expect(result.departureMarker.stateSnapshot).toBeUndefined();
  });

  it("rejects crewName with special characters", async () => {
    await expect(
      crewTransfer({
        crewName: "alice; drop table",
        sourceRig: "rig-a",
        targetRig: "rig-b",
        townId: "town-001",
        signer,
      }),
    ).rejects.toThrow(PassageError);
  });
});
