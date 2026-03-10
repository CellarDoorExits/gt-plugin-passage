import { describe, it, expect } from "vitest";
import {
  createSigner,
  createMarker,
  signMarkerWithSigner,
  addModule,
  ExitType,
} from "cellar-door-exit";
import type { ExitMarker } from "cellar-door-exit";
import { getPassportChain } from "../index.js";

async function makeSignedMarker(polecatId: string, rigName: string): Promise<ExitMarker> {
  const signer = createSigner();
  let marker = createMarker({
    subject: signer.did(),
    origin: `gastown://town/${rigName}`,
    exitType: ExitType.Voluntary,
  });
  marker = addModule(marker, "metadata", {
    tags: [`polecat:${polecatId}`, `rig:${rigName}`, "town:town", "reason:completed"],
  });
  return signMarkerWithSigner(marker, signer);
}

function makeTamperedMarker(polecatId: string): ExitMarker {
  const signer = createSigner();
  let marker = createMarker({
    subject: signer.did(),
    origin: "gastown://town/rig",
    exitType: ExitType.Voluntary,
  });
  marker = addModule(marker, "metadata", {
    tags: [`polecat:${polecatId}`, "rig:rig", "town:town", "reason:completed"],
  });
  // Return unsigned — proof.proofValue will be empty
  return marker;
}

describe("getPassportChain with verify option", () => {
  it("returns all markers when verify is false (default)", async () => {
    const signed = await makeSignedMarker("agent-1", "rig-a");
    const tampered = makeTamperedMarker("agent-1");

    const chain = getPassportChain("agent-1", [signed, tampered]);
    expect(chain).toHaveLength(2);
  });

  it("excludes invalid markers when verify is true", async () => {
    const signed = await makeSignedMarker("agent-1", "rig-a");
    const tampered = makeTamperedMarker("agent-1");

    const chain = getPassportChain("agent-1", [signed, tampered], { verify: true });
    expect(chain).toHaveLength(1);
    expect(chain[0].marker).toBe(signed);
  });

  it("returns empty chain when all markers fail verification", () => {
    const t1 = makeTamperedMarker("agent-2");
    const t2 = makeTamperedMarker("agent-2");

    const chain = getPassportChain("agent-2", [t1, t2], { verify: true });
    expect(chain).toHaveLength(0);
  });
});
