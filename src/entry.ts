/**
 * gt-plugin-passage -- Cross-town entry and policy presets
 */

import {
  admit,
  LOCKDOWN as ENTRY_LOCKDOWN,
  CAUTIOUS as ENTRY_CAUTIOUS,
  OPEN_DOOR as ENTRY_OPEN_DOOR,
  STRICT as ENTRY_STRICT,
  createPolicy,
} from "cellar-door-entry";
import type { AdmitResult, BuiltPolicy, ClaimStore } from "cellar-door-entry";
import type { ExitMarker } from "cellar-door-exit";
import { PassageError } from "./errors.js";
import { validateIdentifier } from "./validation.js";
import type { GasTownPolicyPreset, TownEntryOptions } from "./types.js";

/**
 * Gas Town policy preset mapping.
 *
 * | Gas Town Preset  | Behavior                              |
 * |-----------------|---------------------------------------|
 * | LOCKDOWN        | Reject all cross-town agents          |
 * | CAUTIOUS        | Verify + quarantine new agents        |
 * | STANDARD        | Verify EXIT marker, accept if valid   |
 * | TRUSTED_TOWNS   | Whitelist specific towns              |
 * | OPEN_DOOR       | Accept any valid marker               |
 */

/** LOCKDOWN: reject all cross-town agents. */
export const GT_LOCKDOWN: BuiltPolicy = createPolicy("gt-lockdown")
  .requireVerifiedDeparture()
  .conflictResolution("deny-overrides")
  .custom("reject-all", () => ({
    admitted: false,
    reason: "Town is in lockdown mode -- no cross-town agents accepted",
  }))
  .build();

/** CAUTIOUS: verify + quarantine new agents. */
export const GT_CAUTIOUS: BuiltPolicy = createPolicy("gt-cautious")
  .requireVerifiedDeparture()
  .onSelfOnly("probation", { duration: "7d" })
  .onDisputed("quarantine", { maxDuration: "7d", reviewRequired: true })
  .conflictResolution("deny-overrides")
  .build();

/** STANDARD: verify EXIT marker, accept if valid. */
export const GT_STANDARD: BuiltPolicy = createPolicy("gt-standard")
  .requireVerifiedDeparture()
  .maxAge("24h")
  .conflictResolution("deny-overrides")
  .build();

/** TRUSTED_TOWNS: whitelist specific towns. Uses STANDARD as base. */
export function createTrustedTownsPolicy(
  trustedTownIds: string[],
): BuiltPolicy {
  const origins = trustedTownIds.map((id) => `gastown://${id}`);
  return createPolicy("gt-trusted-towns")
    .requireVerifiedDeparture()
    .allowOrigins(origins)
    .conflictResolution("deny-overrides")
    .build();
}

/** OPEN_DOOR: accept any valid marker. */
export const GT_OPEN_DOOR: BuiltPolicy = createPolicy("gt-open-door")
  .requireVerifiedDeparture()
  .defaultDecision("admit")
  .conflictResolution("permit-overrides")
  .build();

/** Map Gas Town preset names to built policies. */
const PRESET_MAP: Record<Exclude<GasTownPolicyPreset, "TRUSTED_TOWNS">, BuiltPolicy> = {
  LOCKDOWN: GT_LOCKDOWN,
  CAUTIOUS: GT_CAUTIOUS,
  STANDARD: GT_STANDARD,
  OPEN_DOOR: GT_OPEN_DOOR,
};

/**
 * Get a built policy for a Gas Town preset name.
 *
 * @throws {PassageError} if TRUSTED_TOWNS is passed (use createTrustedTownsPolicy instead)
 */
export function getPolicy(preset: GasTownPolicyPreset): BuiltPolicy {
  if (preset === "TRUSTED_TOWNS") {
    throw new PassageError(
      "TRUSTED_TOWNS_REQUIRES_CONFIG",
      "TRUSTED_TOWNS preset requires explicit town IDs. Use createTrustedTownsPolicy(townIds) instead.",
    );
  }
  return PRESET_MAP[preset];
}

/**
 * Process a cross-town entry.
 *
 * When an agent arrives from another Town, this function:
 * 1. Looks up the appropriate policy preset
 * 2. Runs the admission ceremony via cellar-door-entry
 * 3. Returns the admission result
 */
export async function townEntry(
  options: TownEntryOptions,
): Promise<AdmitResult> {
  const { marker, targetTownId, targetRig, policy: presetName, store } = options;

  validateIdentifier(targetTownId, "targetTownId");
  if (targetRig) validateIdentifier(targetRig, "targetRig");

  const policyPreset = presetName ?? "STANDARD";
  const builtPolicy = getPolicy(policyPreset);

  const destination = targetRig
    ? `gastown://${targetTownId}/${targetRig}`
    : `gastown://${targetTownId}`;

  const result = await admit(marker, {
    policy: builtPolicy,
    store,
    destination,
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
