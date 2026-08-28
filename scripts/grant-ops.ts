import { eq } from "drizzle-orm";
import { APP_NAME } from "../lib/brand";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";

const email = String(process.argv[2] ?? "")
  .toLowerCase()
  .trim();

if (!email.includes("@")) {
  console.error("Usage: npx tsx scripts/grant-ops.ts you@email.com");
  process.exit(1);
}

const user = db.select().from(users).where(eq(users.email, email)).get();
if (!user) {
  console.error(`No account found for ${email}. Register or log in first, then run this again.`);
  process.exit(1);
}

db.update(users).set({ platformRole: "owner" }).where(eq(users.id, user.id)).run();
console.log(`Granted ${APP_NAME} operator access to ${user.name} <${user.email}>. Open the Ops host (local: http://ops.localhost:3000).`);
