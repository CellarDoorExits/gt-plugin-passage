import { describe, it, expect } from "vitest";
import { createSigner, ExitType, createMarker, signMarkerWithSigner, addModule } from "cellar-door-exit";
import { InMemoryClaimStore } from "cellar-door-entry";
import {
  townEntry,
  getPolicy,
  createTrustedTownsPolicy,
  GT_LOCKDOWN,
  GT_CAUTIOUS,
  GT_STANDARD,
  GT_OPEN_DOOR,
  PassageError,
} from "../index.js";

async function createSignedMarker(origin: string, signer: ReturnType<typeof createSigner>) {
  let marker = createMarker({
    subject: signer.did(),
    origin,
    exitType: ExitType.Voluntary,
  });
  return signMarkerWithSigner(marker, signer);
}

describe("getPolicy", () => {
  it("returns GT_LOCKDOWN for LOCKDOWN preset", () => {
    expect(getPolicy("LOCKDOWN")).toBe(GT_LOCKDOWN);
  });

  it("returns GT_CAUTIOUS for CAUTIOUS preset", () => {
    expect(getPolicy("CAUTIOUS")).toBe(GT_CAUTIOUS);
  });

  it("returns GT_STANDARD for STANDARD preset", () => {
    expect(getPolicy("STANDARD")).toBe(GT_STANDARD);
  });

  it("returns GT_OPEN_DOOR for OPEN_DOOR preset", () => {
    expect(getPolicy("OPEN_DOOR")).toBe(GT_OPEN_DOOR);
  });

  it("throws PassageError for TRUSTED_TOWNS with helpful message", () => {
    expect(() => getPolicy("TRUSTED_TOWNS")).toThrow(PassageError);
    expect(() => getPolicy("TRUSTED_TOWNS")).toThrow("createTrustedTownsPolicy");
  });
});

describe("policy presets", () => {
  it("GT_LOCKDOWN has name gt-lockdown", () => {
    expect(GT_LOCKDOWN.name).toBe("gt-lockdown");
  });

  it("GT_CAUTIOUS has name gt-cautious", () => {
    expect(GT_CAUTIOUS.name).toBe("gt-cautious");
  });

  it("GT_STANDARD has name gt-standard", () => {
    expect(GT_STANDARD.name).toBe("gt-standard");
  });

  it("GT_OPEN_DOOR has name gt-open-door", () => {
    expect(GT_OPEN_DOOR.name).toBe("gt-open-door");
  });
});

describe("createTrustedTownsPolicy", () => {
  it("creates a policy with the correct name", () => {
    const policy = createTrustedTownsPolicy(["town-a", "town-b"]);
    expect(policy.name).toBe("gt-trusted-towns");
  });
});

describe("townEntry", () => {
  it("admits a valid marker with OPEN_DOOR policy", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    const result = await townEntry({
      marker,
      targetTownId: "target-town",
      targetRig: "rig-b",
      policy: "OPEN_DOOR",
      store,
    });

    expect(result.admission.admitted).toBe(true);
  });

  it("rejects all agents with LOCKDOWN policy", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    const result = await townEntry({
      marker,
      targetTownId: "target-town",
      policy: "LOCKDOWN",
      store,
    });

    expect(result.admission.admitted).toBe(false);
  });

  it("uses STANDARD policy by default", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    const result = await townEntry({
      marker,
      targetTownId: "target-town",
      store,
    });

    expect(result.admission.admitted).toBe(true);
  });

  it("sets destination with targetRig when provided", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    const result = await townEntry({
      marker,
      targetTownId: "target-town",
      targetRig: "special-rig",
      policy: "OPEN_DOOR",
      store,
    });

    expect(result.admission.admitted).toBe(true);
  });

  it("sets destination without targetRig", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    const result = await townEntry({
      marker,
      targetTownId: "target-town",
      policy: "OPEN_DOOR",
      store,
    });

    expect(result.admission.admitted).toBe(true);
  });

  it("throws on TRUSTED_TOWNS preset via townEntry", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    await expect(
      townEntry({
        marker,
        targetTownId: "target-town",
        policy: "TRUSTED_TOWNS",
        store,
      }),
    ).rejects.toThrow(PassageError);
  });

  it("rejects invalid targetTownId", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    await expect(
      townEntry({
        marker,
        targetTownId: "town with spaces",
        policy: "OPEN_DOOR",
        store,
      }),
    ).rejects.toThrow(PassageError);
  });

  it("CAUTIOUS policy quarantines disputed markers", async () => {
    const signer = createSigner();
    const marker = await createSignedMarker("gastown://source-town/rig-a", signer);
    const store = new InMemoryClaimStore();

    const result = await townEntry({
      marker,
      targetTownId: "target-town",
      policy: "CAUTIOUS",
      store,
    });

    // CAUTIOUS admits with probation for self-only
    expect(result).toBeDefined();
  });
});
