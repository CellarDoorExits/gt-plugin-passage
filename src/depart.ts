/**
 * gt-plugin-passage -- Departure ceremonies for Gas Town agents
 */

import {
  createMarker,
  signMarkerWithSigner,
  addModule,
  ExitType,
  toJSON,
  canonicalize,
} from "cellar-door-exit";
import type { ExitMarker } from "cellar-door-exit";
import { toBeadAttachment } from "./bead.js";
import { PassageError } from "./errors.js";
import { validateIdentifier, validateTags } from "./validation.js";
import type {
  PolecatDepartureOptions,
  PolecatDepartureResult,
  CrewTransferOptions,
  CrewTransferResult,
  DepartureReason,
  MergeResult,
} from "./types.js";

/**
 * Map a Gas Town departure reason + merge result to an EXIT ceremony type.
 *
 * Mappings:
 *   completed + merged    -> ExitType.Voluntary (cooperative exit)
 *   completed + rejected  -> ExitType.Voluntary (cooperative exit)
 *   completed + pending   -> ExitType.Voluntary (cooperative exit)
 *   witness-killed        -> ExitType.Directed (unilateral exit)
 *   timeout               -> ExitType.Directed (unilateral exit)
 *   crashed               -> ExitType.Emergency (emergency exit)
 *   manual                -> ExitType.Voluntary (cooperative exit)
 */
export function mapReasonToExitType(
  reason: DepartureReason,
  _mergeResult?: MergeResult,
): ExitType {
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
      const _exhaustive: never = reason;
      throw new PassageError(
        "UNKNOWN_REASON",
        `Unknown departure reason: ${_exhaustive as string}`,
      );
    }
  }
}

/**
 * Build the origin URI for a Gas Town agent.
 */
export function buildOrigin(townId: string, rigName: string): string {
  return `gastown://${townId}/${rigName}`;
}

/**
 * SHA-256 hash helper. Returns hex string.
 */
async function sha256hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(input),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a transfer token from a signed marker.
 * This is a deterministic SHA-256 hash of the marker's canonical form.
 */
async function generateTransferToken(marker: ExitMarker): Promise<string> {
  const canonical = canonicalize(marker);
  const hash = await sha256hex(canonical);
  return `xfer-${hash}`;
}

/**
 * Decommission a Polecat with a proper EXIT ceremony.
 *
 * Called after the Refinery has merged (or rejected) the Polecat's work.
 * Creates a signed EXIT marker with Gas Town metadata attached.
 */
export async function polecatDepart(
  options: PolecatDepartureOptions,
): Promise<PolecatDepartureResult> {
  const {
    polecatId,
    rigName,
    townId,
    reason,
    hookRef,
    beadIds,
    mergeResult,
    signer,
  } = options;

  // Validate identifiers
  validateIdentifier(polecatId, "polecatId");
  validateIdentifier(rigName, "rigName");
  validateIdentifier(townId, "townId");

  const exitType = mapReasonToExitType(reason, mergeResult);
  const origin = buildOrigin(townId, rigName);

  // Create the base marker
  let marker = createMarker({
    subject: signer.did(),
    origin,
    exitType,
    emergencyJustification:
      exitType === ExitType.Emergency
        ? `Polecat ${polecatId} crashed during execution`
        : undefined,
  });

  // Attach metadata module with Gas Town context
  const tags: string[] = [
    `polecat:${polecatId}`,
    `rig:${rigName}`,
    `town:${townId}`,
    `reason:${reason}`,
  ];
  if (mergeResult) tags.push(`merge:${mergeResult}`);
  if (hookRef) tags.push(`hook:${hookRef}`);
  if (beadIds) beadIds.forEach((id) => tags.push(`bead:${id}`));

  validateTags(tags);

  marker = addModule(marker, "metadata", {
    reason: `Polecat ${polecatId} departure: ${reason}`,
    tags,
  });

  // Attach state snapshot if we have hook/bead references
  if (hookRef || (beadIds && beadIds.length > 0)) {
    const refs: string[] = [];
    if (hookRef) refs.push(hookRef);
    if (beadIds) refs.push(...beadIds);
    const stateHash = await sha256hex(refs.join(":"));

    marker = addModule(marker, "stateSnapshot", {
      stateHash,
      stateLocation: hookRef ? `gastown://${townId}/hooks/${hookRef}` : undefined,
      obligations: beadIds?.map((id) => `bead:${id}`),
    });
  }

  // Sign the marker
  const signed = await signMarkerWithSigner(marker, signer);

  const result: PolecatDepartureResult = {
    marker: signed,
    attachment: toBeadAttachment(signed),
  };

  options.events?.onDepart?.(result);

  return result;
}

/**
 * Transfer a crew member between rigs.
 *
 * Creates a signed EXIT marker for the source rig with transfer metadata.
 */
export async function crewTransfer(
  options: CrewTransferOptions,
): Promise<CrewTransferResult> {
  const { crewName, sourceRig, targetRig, townId, workState, signer } = options;

  // Validate identifiers
  validateIdentifier(crewName, "crewName");
  validateIdentifier(sourceRig, "sourceRig");
  validateIdentifier(targetRig, "targetRig");
  validateIdentifier(townId, "townId");

  const origin = buildOrigin(townId, sourceRig);

  let marker = createMarker({
    subject: signer.did(),
    origin,
    exitType: ExitType.Voluntary,
  });

  // Attach metadata about the transfer
  const tags = [
    `crew:${crewName}`,
    `source:${sourceRig}`,
    `target:${targetRig}`,
    `town:${townId}`,
    "transfer",
  ];
  validateTags(tags);

  marker = addModule(marker, "metadata", {
    reason: `Crew transfer: ${crewName} from ${sourceRig} to ${targetRig}`,
    tags,
  });

  // Attach lineage for continuity tracking
  marker = addModule(marker, "lineage", {
    successor: `gastown://${townId}/${targetRig}/${crewName}`,
  });

  // Attach work state snapshot if provided
  if (workState) {
    const stateJson = JSON.stringify(workState);
    const stateHash = await sha256hex(stateJson);

    marker = addModule(marker, "stateSnapshot", {
      stateHash,
      stateLocation: `gastown://${townId}/${sourceRig}/handoff/${crewName}`,
    });
  }

  const signed = await signMarkerWithSigner(marker, signer);
  const transferToken = await generateTransferToken(signed);

  const result: CrewTransferResult = {
    departureMarker: signed,
    transferToken,
  };

  options.events?.onTransfer?.(result);

  return result;
}
