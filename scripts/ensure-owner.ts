import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { createId, now } from "../lib/id";

async function main() {
  const passwordHash = await hash("Owner123!@#", 10);
  const existing = db.select().from(users).where(eq(users.email, "owner")).get();
  if (existing) {
    db.update(users)
      .set({ passwordHash, platformRole: "owner", name: "Owner" })
      .where(eq(users.id, existing.id))
      .run();
    console.log("Updated operator login: user owner");
    return;
  }
  db.insert(users)
    .values({
      id: createId(),
      name: "Owner",
      email: "owner",
      passwordHash,
      telegramUsername: "owner",
      telegramLinkToken: createId(),
      platformRole: "owner",
      createdAt: now(),
    })
    .run();
  console.log("Created operator login: user owner");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
