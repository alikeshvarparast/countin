/**
 * Seed public demo communities for the directory, plus one rich showcase club.
 *
 * Usage: npx tsx scripts/seed-demo-directory.ts
 *        npx tsx scripts/seed-demo-directory.ts --force
 */
import { seedDemoDirectory } from "../lib/seed-demo-directory";

const force = process.argv.includes("--force");

seedDemoDirectory({ force })
  .then((result) => {
    if (result.skipped) {
      console.log(`Skipped: ${result.reason}. Pass --force to re-run.`);
      return;
    }
    console.log("\nOpen http://localhost:3000/ for the public directory.");
    console.log("Showcase club: http://localhost:3000/app/c/showcase-united (alex@club.com / password123)");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
