// Usage: npx tsx scripts/scan.ts <account.near>
// Reads Burrow positions through the RPC quorum and prints the exit plan checked by the Exit Guard.
import { planExit, scanBurrow } from "../src/lib/burrow";
import { checkTx } from "../src/lib/guard";
import { BURROW_MANIFEST } from "../src/lib/manifest";

const account = process.argv[2];

const show = (name: string, rows: { token_id: string; balance: string }[]) =>
  console.log(`${name}:`, rows.length ? rows.map((r) => `${r.token_id}=${r.balance}`).join(", ") : "none");

async function main() {
  if (!account) {
    console.error("usage: tsx scripts/scan.ts <account>");
    process.exit(1);
  }
  const { position, quorum } = await scanBurrow(account);
  console.log(
    `Read at block ${quorum.block.height}; agreed: ${quorum.agreed.length} providers; failed: ${quorum.failed.length}`,
  );
  if (!position) {
    console.log("No Burrow account found.");
    return;
  }
  show("supplied", position.supplied);
  show("collateral", position.collateral);
  show("borrowed", position.borrowed);

  const plan = planExit(position);
  console.log(`\nExit plan: ${plan.kind}`);
  plan.notes.forEach((n) => console.log(`  note: ${n}`));
  for (const s of plan.steps) {
    const v = checkTx(s.tx, BURROW_MANIFEST, account);
    console.log(`  step: ${s.title} -> guard ${v.ok ? "OK" : "REFUSED"}`);
    v.explain.forEach((e) => console.log(`    - ${e}`));
    v.reasons.forEach((r) => console.log(`    ! ${r}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
