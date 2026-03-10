/**
 * gt-plugin-passage — Basic Usage Example
 *
 * Demonstrates the full lifecycle:
 * 1. Polecat departure (EXIT marker creation)
 * 2. Cross-town entry (admission ceremony)
 * 3. Passport chain (departure history)
 *
 * Run: npx tsx examples/basic-usage.ts
 */

import { polecatDepart, crewTransfer, townEntry, getPassportChain } from "gt-plugin-passage";
import { createSigner } from "cellar-door-exit";
import { InMemoryClaimStore } from "cellar-door-entry";
import type { PassageEvents } from "gt-plugin-passage";

async function main() {
  // --- 1. Create a signer (represents the agent's identity) ---
  const signer = createSigner();
  console.log("Agent DID:", signer.did());

  // --- 2. Optional: set up observability callbacks ---
  const events: PassageEvents = {
    onDepart: (result) => console.log("[event] Departed:", result.marker.id),
    onEntry: (marker) => console.log("[event] Admitted:", marker.id),
    onRejected: (reason, marker) => console.log("[event] Rejected:", marker.id, reason),
  };

  // --- 3. Polecat departure ---
  const departure = await polecatDepart({
    polecatId: "gt-demo-1",
    rigName: "example-project",
    townId: "town-alpha",
    reason: "completed",
    mergeResult: "merged",
    hookRef: "refs/hooks/gt-demo-1",
    beadIds: ["bead-100"],
    signer,
    events,
  });

  console.log("\n=== Departure ===");
  console.log("Marker ID:", departure.marker.id);
  console.log("Exit Type:", departure.marker.exitType);
  console.log("Origin:", departure.marker.origin);
  console.log("Tags:", departure.marker.metadata?.tags);

  // --- 4. Cross-town entry ---
  // ⚠️ InMemoryClaimStore is for testing only!
  const store = new InMemoryClaimStore();

  const entryResult = await townEntry({
    marker: departure.marker,
    targetTownId: "town-beta",
    targetRig: "receiving-rig",
    policy: "STANDARD",
    store,
    events,
  });

  console.log("\n=== Entry ===");
  console.log("Admitted:", entryResult.admission.admitted);

  // --- 5. Replay protection: same marker rejected ---
  const replay = await townEntry({
    marker: departure.marker,
    targetTownId: "town-beta",
    policy: "STANDARD",
    store,
    events,
  });

  console.log("\n=== Replay Attempt ===");
  console.log("Admitted:", replay.admission.admitted, "(should be false)");

  // --- 6. Crew transfer ---
  const transfer = await crewTransfer({
    crewName: "alice",
    sourceRig: "frontend",
    targetRig: "backend",
    townId: "town-alpha",
    workState: { currentTask: "api-migration", progress: 0.5 },
    signer,
  });

  console.log("\n=== Transfer ===");
  console.log("Transfer Token:", transfer.transferToken);

  // --- 7. Passport chain ---
  const chain = getPassportChain("gt-demo-1", [departure.marker]);
  console.log("\n=== Passport Chain ===");
  for (const entry of chain) {
    console.log(`  ${entry.timestamp}: ${entry.rigName} @ ${entry.townId} (${entry.reason})`);
  }

  // --- 8. Passport chain with signature verification ---
  const verifiedChain = getPassportChain("gt-demo-1", [departure.marker], { verify: true });
  console.log(`\nVerified chain entries: ${verifiedChain.length}`);

  console.log("\n✅ Done!");
}

main().catch(console.error);
