import { describe, it, expect } from "vitest";
import {
  createSigner,
  createMarker,
  signMarkerWithSigner,
  ExitType,
  toJSON,
} from "cellar-door-exit";
import type { ExitMarker } from "cellar-door-exit";
import { toBeadAttachment, fromBeadAttachment, PassageError } from "../index.js";
import type { BeadAttachment } from "../types.js";

async function makeSignedMarker(): Promise<ExitMarker> {
  const signer = createSigner();
  const marker = createMarker({
    subject: signer.did(),
    origin: "gastown://town-001/my-rig",
    exitType: ExitType.Voluntary,
  });
  return signMarkerWithSigner(marker, signer);
}

describe("toBeadAttachment", () => {
  it("creates an attachment with correct type", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(attachment.type).toBe("exit-marker");
  });

  it("creates an attachment with version 1.0", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(attachment.version).toBe("1.0");
  });

  it("copies marker ID to attachment", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(attachment.markerId).toBe(marker.id);
  });

  it("copies subject to attachment", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(attachment.subject).toBe(marker.subject);
  });

  it("copies origin to attachment", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(attachment.origin).toBe(marker.origin);
  });

  it("copies timestamp to attachment", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(attachment.timestamp).toBe(marker.timestamp);
  });

  it("copies exitType to attachment", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(attachment.exitType).toBe(marker.exitType);
  });

  it("serializes marker to payload JSON", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    expect(typeof attachment.payload).toBe("string");
    const parsed = JSON.parse(attachment.payload);
    expect(parsed.id).toBe(marker.id);
  });
});

describe("fromBeadAttachment", () => {
  it("roundtrips: toBeadAttachment -> fromBeadAttachment recovers marker", async () => {
    const original = await makeSignedMarker();
    const attachment = toBeadAttachment(original);
    const recovered = fromBeadAttachment(attachment);

    expect(recovered.id).toBe(original.id);
    expect(recovered.subject).toBe(original.subject);
    expect(recovered.origin).toBe(original.origin);
    expect(recovered.exitType).toBe(original.exitType);
    expect(recovered.timestamp).toBe(original.timestamp);
    expect(recovered.proof.proofValue).toBe(original.proof.proofValue);
  });

  it("throws PassageError on wrong attachment type", () => {
    const bad: BeadAttachment = {
      type: "not-exit-marker" as any,
      version: "1.0",
      markerId: "test",
      subject: "did:key:z6MkTest",
      origin: "test",
      timestamp: new Date().toISOString(),
      exitType: "voluntary",
      payload: "{}",
    };

    expect(() => fromBeadAttachment(bad)).toThrow(PassageError);
    expect(() => fromBeadAttachment(bad)).toThrow("Invalid attachment type");
  });

  it("throws on incompatible version (2.0)", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    (attachment as any).version = "2.0";

    expect(() => fromBeadAttachment(attachment)).toThrow(PassageError);
    expect(() => fromBeadAttachment(attachment)).toThrow("Unsupported attachment version");
  });

  it("accepts version 1.1 (semver minor compatible)", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    (attachment as any).version = "1.1";

    const recovered = fromBeadAttachment(attachment);
    expect(recovered.id).toBe(marker.id);
  });

  it("accepts version 1.9 (semver minor compatible)", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    (attachment as any).version = "1.9";

    const recovered = fromBeadAttachment(attachment);
    expect(recovered.id).toBe(marker.id);
  });

  it("rejects version 0.9", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    (attachment as any).version = "0.9";

    expect(() => fromBeadAttachment(attachment)).toThrow(PassageError);
  });

  it("throws on marker ID mismatch", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    attachment.markerId = "wrong-id";

    expect(() => fromBeadAttachment(attachment)).toThrow("Marker ID mismatch");
  });

  it("throws on subject mismatch", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    attachment.subject = "did:key:z6MkWrong";

    expect(() => fromBeadAttachment(attachment)).toThrow("Subject mismatch");
  });

  it("throws on origin mismatch", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    attachment.origin = "gastown://wrong-town/wrong-rig";

    expect(() => fromBeadAttachment(attachment)).toThrow(PassageError);
    expect(() => fromBeadAttachment(attachment)).toThrow("Origin mismatch");
  });

  it("throws on timestamp mismatch", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    attachment.timestamp = "2020-01-01T00:00:00Z";

    expect(() => fromBeadAttachment(attachment)).toThrow(PassageError);
    expect(() => fromBeadAttachment(attachment)).toThrow("Timestamp mismatch");
  });

  it("throws on exitType mismatch", async () => {
    const marker = await makeSignedMarker();
    const attachment = toBeadAttachment(marker);
    attachment.exitType = "Emergency";

    expect(() => fromBeadAttachment(attachment)).toThrow(PassageError);
    expect(() => fromBeadAttachment(attachment)).toThrow("ExitType mismatch");
  });
});

describe("roundtrip integrity", () => {
  it("preserves cryptographic proof through roundtrip", async () => {
    const original = await makeSignedMarker();
    const attachment = toBeadAttachment(original);
    const recovered = fromBeadAttachment(attachment);

    expect(recovered.proof).toEqual(original.proof);
  });

  it("preserves specVersion through roundtrip", async () => {
    const original = await makeSignedMarker();
    const attachment = toBeadAttachment(original);
    const recovered = fromBeadAttachment(attachment);

    expect(recovered.specVersion).toBe(original.specVersion);
  });

  it("preserves @context through roundtrip", async () => {
    const original = await makeSignedMarker();
    const attachment = toBeadAttachment(original);
    const recovered = fromBeadAttachment(attachment);

    expect(recovered["@context"]).toBe(original["@context"]);
  });
});
