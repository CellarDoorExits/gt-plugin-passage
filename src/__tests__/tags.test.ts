import { describe, it, expect } from "vitest";
import { createSigner } from "cellar-door-exit";
import { polecatDepart, crewTransfer, PassageError, MAX_TAGS, MAX_TAG_LENGTH, validateTags } from "../index.js";

describe("tag validation", () => {
  it("validateTags throws when exceeding MAX_TAGS", () => {
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag:${i}`);
    expect(() => validateTags(tags)).toThrow(PassageError);
    expect(() => validateTags(tags)).toThrow("Too many metadata tags");
  });

  it("validateTags throws when a tag exceeds MAX_TAG_LENGTH", () => {
    const longTag = "x".repeat(MAX_TAG_LENGTH + 1);
    expect(() => validateTags([longTag])).toThrow(PassageError);
    expect(() => validateTags([longTag])).toThrow("exceeds");
  });

  it("validateTags accepts tags within limits", () => {
    const tags = Array.from({ length: MAX_TAGS }, (_, i) => `tag:${i}`);
    expect(() => validateTags(tags)).not.toThrow();
  });

  it("polecatDepart throws when beadIds would exceed tag limit", async () => {
    const signer = createSigner();
    // Base tags: polecat, rig, town, reason = 4. Need > 46 beadIds to exceed 50.
    const beadIds = Array.from({ length: 47 }, (_, i) => `bead-${i}`);
    await expect(
      polecatDepart({
        polecatId: "gt-abc12",
        rigName: "rig",
        townId: "town",
        reason: "completed",
        beadIds,
        signer,
      }),
    ).rejects.toThrow("Too many metadata tags");
  });
});
