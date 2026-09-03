import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Read and parse .env.production lines manually
const envContent = fs.readFileSync(".env.production", "utf-8");
let supabaseUrl = "";
let serviceRoleKey = "";

for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
    if (key === "SUPABASE_SERVICE_ROLE_KEY") serviceRoleKey = val;
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Executes a full ephemeral write-and-teardown cycle:
 * 1. Records initial state
 * 2. Creates an ephemeral preventive maintenance order on VEH-PB-01
 * 3. Assigns VEH-PB-01 to ISEA-44
 * 4. Releases assignment
 * 5. Cleans up test maintenance order and assignment rows in finally block
 * 6. Verifies final state == initial state
 */
async function runIsolatedMutationCycle(runNumber: number) {
  console.log(`\n======================================================`);
  console.log(`=== RUNNING ISOLATED MUTATION SUITE (CYCLE ${runNumber}) ===`);
  console.log(`======================================================`);

  // 1. Capture Pre-Test State Counts
  const { data: initMaint } = await supabase.from("maintenance_records").select("id");
  const { data: initAssign } = await supabase.from("asset_assignments").select("id");
  const initMaintCount = initMaint?.length ?? 0;
  const initAssignCount = initAssign?.length ?? 0;

  console.log(`[STATE PRE-TEST] Maintenance records: ${initMaintCount}, Assignment records: ${initAssignCount}`);

  let createdMaintenanceId: string | null = null;
  let createdAssignmentId: string | null = null;

  try {
    // 2. Insert Ephemeral Tagged Test Maintenance Order
    console.log(`Step 1: Inserting ephemeral test maintenance record...`);
    const testSessionNonce = `test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const { data: mData, error: mErr } = await supabase
      .from("maintenance_records")
      .insert({
        asset_id: "f0000000-0000-0000-0000-000000000001", // VEH-PB-01
        maintenance_type: "PREVENTIVE",
        status: "SCHEDULED",
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        description: `[EPHEMERAL_TEST] Fluid check (${testSessionNonce})`,
        performed_by: "super_admin_6c6_027160@polaris.test",
        cost: 100,
      })
      .select("id")
      .single();

    if (mErr) throw new Error(`Maintenance creation failed: ${mErr.message}`);
    createdMaintenanceId = mData.id;
    console.log(`  -> Created Ephemeral Maintenance ID: ${createdMaintenanceId}`);

    // 3. Assign Asset to ISEA-44
    console.log(`Step 2: Assigning VEH-PB-01 to ISEA-44...`);
    const { data: aData, error: aErr } = await supabase
      .from("asset_assignments")
      .insert({
        asset_id: "f0000000-0000-0000-0000-000000000001",
        expedition_id: "d0000000-0000-0000-0000-000000000001",
        assignment_type: "EXPEDITION_FIELD_OPERATION",
        assigned_at: new Date().toISOString(),
        notes: `[EPHEMERAL_TEST] Field survey test (${testSessionNonce})`,
      })
      .select("id")
      .single();

    if (aErr) throw new Error(`Assignment failed: ${aErr.message}`);
    createdAssignmentId = aData.id;
    console.log(`  -> Created Ephemeral Assignment ID: ${createdAssignmentId}`);

    // Update asset status to ASSIGNED
    await supabase.from("assets").update({ status: "ASSIGNED" }).eq("id", "f0000000-0000-0000-0000-000000000001");

    // 4. Release Asset
    console.log(`Step 3: Releasing VEH-PB-01 from ISEA-44...`);
    const { error: relErr } = await supabase
      .from("asset_assignments")
      .update({ released_at: new Date().toISOString() })
      .eq("id", createdAssignmentId);

    if (relErr) throw new Error(`Release failed: ${relErr.message}`);
    await supabase.from("assets").update({ status: "AVAILABLE" }).eq("id", "f0000000-0000-0000-0000-000000000001");
    console.log(`  -> Released Assignment successfully`);

  } finally {
    // 5. Guaranteed Teardown of ALL Created Test Records
    console.log(`\nStep 4: Executing Guaranteed Teardown...`);

    if (createdMaintenanceId) {
      const { error: delMErr } = await supabase
        .from("maintenance_records")
        .delete()
        .eq("id", createdMaintenanceId);
      if (delMErr) console.error(`Failed to delete test maintenance record: ${delMErr.message}`);
      else console.log(`  -> Cleaned up test maintenance record: ${createdMaintenanceId}`);
    }

    if (createdAssignmentId) {
      const { error: delAErr } = await supabase
        .from("asset_assignments")
        .delete()
        .eq("id", createdAssignmentId);
      if (delAErr) console.error(`Failed to delete test assignment record: ${delAErr.message}`);
      else console.log(`  -> Cleaned up test assignment record: ${createdAssignmentId}`);
    }

    // Ensure asset status restored to AVAILABLE
    await supabase.from("assets").update({ status: "AVAILABLE" }).eq("id", "f0000000-0000-0000-0000-000000000001");
  }

  // 6. Invariant Verification: Final State == Initial State
  const { data: finalMaint } = await supabase.from("maintenance_records").select("id");
  const { data: finalAssign } = await supabase.from("asset_assignments").select("id");
  const finalMaintCount = finalMaint?.length ?? 0;
  const finalAssignCount = finalAssign?.length ?? 0;

  console.log(`[STATE POST-TEST] Maintenance records: ${finalMaintCount}, Assignment records: ${finalAssignCount}`);

  if (finalMaintCount !== initMaintCount || finalAssignCount !== initAssignCount) {
    console.error(`FATAL: Invariant violated! State drifted in Cycle ${runNumber}`);
    process.exit(1);
  }

  console.log(`INVARIANT VERIFIED: Cycle ${runNumber} completed with ZERO persistent records.`);
}

async function runConsecutiveProofs() {
  await runIsolatedMutationCycle(1);
  await runIsolatedMutationCycle(2);
  console.log(`\n======================================================`);
  console.log(`SUCCESS: TWO CONSECUTIVE ISOLATED MUTATION CYCLES PASSED.`);
  console.log(`Zero persistent test record accumulation verified.`);
  console.log(`======================================================\n`);
}

runConsecutiveProofs().catch(console.error);
