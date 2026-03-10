// src/errors.ts
var PassageError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "PassageError";
    this.code = code;
  }
};

// src/types.ts
var MAX_TAGS = 50;
var MAX_TAG_LENGTH = 256;

// src/validation.ts
var IDENTIFIER_PATTERN = /^[a-zA-Z0-9._-]+$/;
function validateIdentifier(value, fieldName) {
  if (!value || value.length === 0) {
    throw new PassageError(
      "INVALID_IDENTIFIER",
      `${fieldName} must not be empty`
    );
  }
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new PassageError(
      "INVALID_IDENTIFIER",
      `${fieldName} contains invalid characters: must match ${IDENTIFIER_PATTERN} (got "${value}")`
    );
  }
}
function validateTags(tags) {
  if (tags.length > MAX_TAGS) {
    throw new PassageError(
      "TAG_LIMIT_EXCEEDED",
      `Too many metadata tags: ${tags.length} exceeds maximum of ${MAX_TAGS}`
    );
  }
  for (const tag of tags) {
    if (tag.length > MAX_TAG_LENGTH) {
      throw new PassageError(
        "TAG_TOO_LONG",
        `Metadata tag exceeds ${MAX_TAG_LENGTH} characters (got ${tag.length})`
      );
    }
  }
}

// src/depart.ts
import {
  createMarker,
  signMarkerWithSigner,
  addModule,
  ExitType,
  canonicalize
} from "cellar-door-exit";

// src/bead.ts
import { toJSON, fromJSON } from "cellar-door-exit";
function isCompatibleVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)$/);
  if (!match) return false;
  return match[1] === "1";
}
function toBeadAttachment(marker) {
  return {
    type: "exit-marker",
    version: "1.0",
    markerId: marker.id,
    subject: marker.subject,
    origin: marker.origin,
    timestamp: marker.timestamp,
    exitType: marker.exitType,
    payload: toJSON(marker)
  };
}
function fromBeadAttachment(attachment) {
  if (attachment.type !== "exit-marker") {
    throw new PassageError(
      "INVALID_ATTACHMENT_TYPE",
      `Invalid attachment type: expected "exit-marker", got "${attachment.type}"`
    );
  }
  if (!isCompatibleVersion(attachment.version)) {
    throw new PassageError(
      "UNSUPPORTED_VERSION",
      `Unsupported attachment version: ${attachment.version} (expected 1.x)`
    );
  }
  const marker = fromJSON(attachment.payload);
  if (marker.id !== attachment.markerId) {
    throw new PassageError(
      "MARKER_ID_MISMATCH",
      `Marker ID mismatch: attachment says "${attachment.markerId}", marker says "${marker.id}"`
    );
  }
  if (marker.subject !== attachment.subject) {
    throw new PassageError(
      "SUBJECT_MISMATCH",
      `Subject mismatch: attachment says "${attachment.subject}", marker says "${marker.subject}"`
    );
  }
  if (marker.origin !== attachment.origin) {
    throw new PassageError(
      "ORIGIN_MISMATCH",
      `Origin mismatch: attachment says "${attachment.origin}", marker says "${marker.origin}"`
    );
  }
  if (marker.timestamp !== attachment.timestamp) {
    throw new PassageError(
      "TIMESTAMP_MISMATCH",
      `Timestamp mismatch: attachment says "${attachment.timestamp}", marker says "${marker.timestamp}"`
    );
  }
  if (marker.exitType !== attachment.exitType) {
    throw new PassageError(
      "EXIT_TYPE_MISMATCH",
      `ExitType mismatch: attachment says "${attachment.exitType}", marker says "${marker.exitType}"`
    );
  }
  return marker;
}

// src/depart.ts
function mapReasonToExitType(reason, _mergeResult) {
  switch (reason) {
    case "completed":
    case "manual":
      return ExitType.Voluntary;
    case "witness-killed":
    case "timeout":
      return ExitType.Directed;
    case "crashed":
      return ExitType.Emergency;
    default: {
      const _exhaustive = reason;
      throw new PassageError(
        "UNKNOWN_REASON",
        `Unknown departure reason: ${_exhaustive}`
      );
    }
  }
}
function buildOrigin(townId, rigName) {
  return `gastown://${townId}/${rigName}`;
}
async function sha256hex(input) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(input)
  );
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function generateTransferToken(marker) {
  const canonical = canonicalize(marker);
  const hash = await sha256hex(canonical);
  return `xfer-${hash}`;
}
async function polecatDepart(options) {
  const {
    polecatId,
    rigName,
    townId,
    reason,
    hookRef,
    beadIds,
    mergeResult,
    signer
  } = options;
  validateIdentifier(polecatId, "polecatId");
  validateIdentifier(rigName, "rigName");
  validateIdentifier(townId, "townId");
  const exitType = mapReasonToExitType(reason, mergeResult);
  const origin = buildOrigin(townId, rigName);
  let marker = createMarker({
    subject: signer.did(),
    origin,
    exitType,
    emergencyJustification: exitType === ExitType.Emergency ? `Polecat ${polecatId} crashed during execution` : void 0
  });
  const tags = [
    `polecat:${polecatId}`,
    `rig:${rigName}`,
    `town:${townId}`,
    `reason:${reason}`
  ];
  if (mergeResult) tags.push(`merge:${mergeResult}`);
  if (hookRef) tags.push(`hook:${hookRef}`);
  if (beadIds) beadIds.forEach((id) => tags.push(`bead:${id}`));
  validateTags(tags);
  marker = addModule(marker, "metadata", {
    reason: `Polecat ${polecatId} departure: ${reason}`,
    tags
  });
  if (hookRef || beadIds && beadIds.length > 0) {
    const refs = [];
    if (hookRef) refs.push(hookRef);
    if (beadIds) refs.push(...beadIds);
    const stateHash = await sha256hex(refs.join(":"));
    marker = addModule(marker, "stateSnapshot", {
      stateHash,
      stateLocation: hookRef ? `gastown://${townId}/hooks/${hookRef}` : void 0,
      obligations: beadIds?.map((id) => `bead:${id}`)
    });
  }
  const signed = await signMarkerWithSigner(marker, signer);
  const result = {
    marker: signed,
    attachment: toBeadAttachment(signed)
  };
  options.events?.onDepart?.(result);
  return result;
}
async function crewTransfer(options) {
  const { crewName, sourceRig, targetRig, townId, workState, signer } = options;
  validateIdentifier(crewName, "crewName");
  validateIdentifier(sourceRig, "sourceRig");
  validateIdentifier(targetRig, "targetRig");
  validateIdentifier(townId, "townId");
  const origin = buildOrigin(townId, sourceRig);
  let marker = createMarker({
    subject: signer.did(),
    origin,
    exitType: ExitType.Voluntary
  });
  const tags = [
    `crew:${crewName}`,
    `source:${sourceRig}`,
    `target:${targetRig}`,
    `town:${townId}`,
    "transfer"
  ];
  validateTags(tags);
  marker = addModule(marker, "metadata", {
    reason: `Crew transfer: ${crewName} from ${sourceRig} to ${targetRig}`,
    tags
  });
  marker = addModule(marker, "lineage", {
    successor: `gastown://${townId}/${targetRig}/${crewName}`
  });
  if (workState) {
    const stateJson = JSON.stringify(workState);
    const stateHash = await sha256hex(stateJson);
    marker = addModule(marker, "stateSnapshot", {
      stateHash,
      stateLocation: `gastown://${townId}/${sourceRig}/handoff/${crewName}`
    });
  }
  const signed = await signMarkerWithSigner(marker, signer);
  const transferToken = await generateTransferToken(signed);
  const result = {
    departureMarker: signed,
    transferToken
  };
  options.events?.onTransfer?.(result);
  return result;
}

// src/entry.ts
import {
  admit,
  createPolicy
} from "cellar-door-entry";
var GT_LOCKDOWN = createPolicy("gt-lockdown").requireVerifiedDeparture().conflictResolution("deny-overrides").custom("reject-all", () => ({
  admitted: false,
  reason: "Town is in lockdown mode -- no cross-town agents accepted"
})).build();
var GT_CAUTIOUS = createPolicy("gt-cautious").requireVerifiedDeparture().onSelfOnly("probation", { duration: "7d" }).onDisputed("quarantine", { maxDuration: "7d", reviewRequired: true }).conflictResolution("deny-overrides").build();
var GT_STANDARD = createPolicy("gt-standard").requireVerifiedDeparture().maxAge("24h").conflictResolution("deny-overrides").build();
function createTrustedTownsPolicy(trustedTownIds) {
  const origins = trustedTownIds.map((id) => `gastown://${id}`);
  return createPolicy("gt-trusted-towns").requireVerifiedDeparture().allowOrigins(origins).conflictResolution("deny-overrides").build();
}
var GT_OPEN_DOOR = createPolicy("gt-open-door").requireVerifiedDeparture().defaultDecision("admit").conflictResolution("permit-overrides").build();
var PRESET_MAP = {
  LOCKDOWN: GT_LOCKDOWN,
  CAUTIOUS: GT_CAUTIOUS,
  STANDARD: GT_STANDARD,
  OPEN_DOOR: GT_OPEN_DOOR
};
function getPolicy(preset) {
  if (preset === "TRUSTED_TOWNS") {
    throw new PassageError(
      "TRUSTED_TOWNS_REQUIRES_CONFIG",
      "TRUSTED_TOWNS preset requires explicit town IDs. Use createTrustedTownsPolicy(townIds) instead."
    );
  }
  return PRESET_MAP[preset];
}
async function townEntry(options) {
  const { marker, targetTownId, targetRig, policy: presetName, store } = options;
  validateIdentifier(targetTownId, "targetTownId");
  if (targetRig) validateIdentifier(targetRig, "targetRig");
  const policyPreset = presetName ?? "STANDARD";
  const builtPolicy = getPolicy(policyPreset);
  const destination = targetRig ? `gastown://${targetTownId}/${targetRig}` : `gastown://${targetTownId}`;
  const result = await admit(marker, {
    policy: builtPolicy,
    store,
    destination
  });
  if (options.events) {
    if (result.admission.admitted) {
      options.events.onEntry?.(marker);
    } else {
      const reason = result.admission.reasonCodes?.join("; ") ?? "unknown";
      options.events.onRejected?.(reason, marker);
    }
  }
  return result;
}

// src/passport.ts
import { verifyMarker } from "cellar-door-exit";
function extractGasTownContext(marker) {
  const tags = marker.metadata?.tags ?? [];
  let townId = "unknown";
  let rigName = "unknown";
  let reason = "unknown";
  for (const tag of tags) {
    if (tag.startsWith("town:")) townId = tag.slice(5);
    else if (tag.startsWith("rig:")) rigName = tag.slice(4);
    else if (tag.startsWith("reason:")) reason = tag.slice(7);
  }
  if (townId === "unknown" && marker.origin.startsWith("gastown://")) {
    const parts = marker.origin.slice("gastown://".length).split("/");
    if (parts[0]) townId = parts[0];
    if (parts[1]) rigName = parts[1];
  }
  return { townId, rigName, reason };
}
function markerToPassportEntry(agentId, marker) {
  const { townId, rigName, reason } = extractGasTownContext(marker);
  return {
    agentId,
    townId,
    rigName,
    timestamp: marker.timestamp,
    marker,
    reason
  };
}
function getPassportChain(agentId, markers, options) {
  const entries = [];
  const shouldVerify = options?.verify === true;
  for (const marker of markers) {
    const tags = marker.metadata?.tags ?? [];
    const isMatch = tags.some(
      (t) => t === `polecat:${agentId}` || t === `crew:${agentId}`
    );
    if (isMatch) {
      if (shouldVerify) {
        const verification = verifyMarker(marker);
        if (!verification.valid) continue;
      }
      entries.push(markerToPassportEntry(agentId, marker));
    }
  }
  entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  return entries;
}
async function getPassportChainFromStore(_agentId, _options) {
  throw new PassageError(
    "NOT_IMPLEMENTED",
    "Not implemented -- use getPassportChain() with a marker array"
  );
}
export {
  GT_CAUTIOUS,
  GT_LOCKDOWN,
  GT_OPEN_DOOR,
  GT_STANDARD,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  PassageError,
  buildOrigin,
  createTrustedTownsPolicy,
  crewTransfer,
  extractGasTownContext,
  fromBeadAttachment,
  getPassportChain,
  getPassportChainFromStore,
  getPolicy,
  mapReasonToExitType,
  markerToPassportEntry,
  polecatDepart,
  toBeadAttachment,
  townEntry,
  validateIdentifier,
  validateTags
};
//# sourceMappingURL=index.js.map