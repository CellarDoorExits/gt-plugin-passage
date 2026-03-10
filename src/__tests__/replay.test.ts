import { describe, it, expect } from "vitest";
import { createSigner, createMarker, signMarkerWithSigner, ExitType } from "cellar-door-exit";
import { InMemoryClaimStore } from "cellar-door-entry";
import { townEntry } from "../index.js";

describe("replay protection", () => {
  it("rejects the same marker admitted twice", async () => {
    const signer = createSigner();
    let m = createMarker({
      subject: signer.did(),
      origin: "gastown://town-a/rig-1",
      exitType: ExitType.Voluntary,
    });
    m = await signMarkerWithSigner(m, signer);
    const store = new InMemoryClaimStore();

    const r1 = await townEntry({
      marker: m,
      targetTownId: "town-b",
      policy: "OPEN_DOOR",
      store,
    });
    expect(r1.admission.admitted).toBe(true);

    const r2 = await townEntry({
      marker: m,
      targetTownId: "town-b",
      policy: "OPEN_DOOR",
      store,
    });
    expect(r2.admission.admitted).toBe(false);
  });

  it("admits different markers from the same agent", async () => {
    const signer = createSigner();
    const store = new InMemoryClaimStore();

    const m1 = await signMarkerWithSigner(
      createMarker({ subject: signer.did(), origin: "gastown://t/r1", exitType: ExitType.Voluntary }),
      signer,
    );
    const m2 = await signMarkerWithSigner(
      createMarker({ subject: signer.did(), origin: "gastown://t/r2", exitType: ExitType.Voluntary }),
      signer,
    );

    const r1 = await townEntry({ marker: m1, targetTownId: "town-b", policy: "OPEN_DOOR", store });
    const r2 = await townEntry({ marker: m2, targetTownId: "town-b", policy: "OPEN_DOOR", store });

    expect(r1.admission.admitted).toBe(true);
    expect(r2.admission.admitted).toBe(true);
  });
});
