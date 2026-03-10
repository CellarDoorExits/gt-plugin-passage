import { describe, it, expect, vi } from "vitest";
import { createSigner, createMarker, signMarkerWithSigner, ExitType } from "cellar-door-exit";
import { InMemoryClaimStore } from "cellar-door-entry";
import { polecatDepart, crewTransfer, townEntry } from "../index.js";
import type { PassageEvents } from "../index.js";

describe("observability callbacks", () => {
  it("fires onDepart for polecatDepart", async () => {
    const onDepart = vi.fn();
    const signer = createSigner();

    const result = await polecatDepart({
      polecatId: "gt-obs1",
      rigName: "rig",
      townId: "town",
      reason: "completed",
      signer,
      events: { onDepart },
    });

    expect(onDepart).toHaveBeenCalledOnce();
    expect(onDepart).toHaveBeenCalledWith(result);
  });

  it("fires onTransfer for crewTransfer", async () => {
    const onTransfer = vi.fn();
    const signer = createSigner();

    const result = await crewTransfer({
      crewName: "alice",
      sourceRig: "r1",
      targetRig: "r2",
      townId: "town",
      signer,
      events: { onTransfer },
    });

    expect(onTransfer).toHaveBeenCalledOnce();
    expect(onTransfer).toHaveBeenCalledWith(result);
  });

  it("fires onEntry for admitted markers", async () => {
    const onEntry = vi.fn();
    const signer = createSigner();
    const marker = await signMarkerWithSigner(
      createMarker({ subject: signer.did(), origin: "gastown://t/r", exitType: ExitType.Voluntary }),
      signer,
    );
    const store = new InMemoryClaimStore();

    await townEntry({
      marker,
      targetTownId: "town-b",
      policy: "OPEN_DOOR",
      store,
      events: { onEntry },
    });

    expect(onEntry).toHaveBeenCalledOnce();
    expect(onEntry.mock.calls[0][0]).toBe(marker);
  });

  it("fires onRejected for rejected markers", async () => {
    const onRejected = vi.fn();
    const signer = createSigner();
    const marker = await signMarkerWithSigner(
      createMarker({ subject: signer.did(), origin: "gastown://t/r", exitType: ExitType.Voluntary }),
      signer,
    );
    const store = new InMemoryClaimStore();

    await townEntry({
      marker,
      targetTownId: "town-b",
      policy: "LOCKDOWN",
      store,
      events: { onRejected },
    });

    expect(onRejected).toHaveBeenCalledOnce();
    expect(typeof onRejected.mock.calls[0][0]).toBe("string");
    expect(onRejected.mock.calls[0][1]).toBe(marker);
  });

  it("does not throw when no events are provided", async () => {
    const signer = createSigner();
    await expect(
      polecatDepart({
        polecatId: "gt-no-events",
        rigName: "rig",
        townId: "town",
        reason: "completed",
        signer,
      }),
    ).resolves.toBeDefined();
  });
});
