import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync, chmodSync } from "node:fs";
if (existsSync(".dev.vars")) {
  console.log("Existing .dev.vars retained. Read OWNER_KEY there to sign in.");
} else {
  writeFileSync(
    ".dev.vars",
    `OWNER_KEY=${randomBytes(32).toString("base64url")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .dev.vars. Read OWNER_KEY there to sign in; keep it private.",
  );
}
chmodSync(".dev.vars", 0o600);
