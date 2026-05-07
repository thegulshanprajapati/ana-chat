import { runMigrations } from "./dbMigrate.js";
import { runSeed } from "./dbSeed.js";

async function run() {
  await runMigrations();
  await runSeed();
}

run()
  .then(() => {
    console.log("Database init complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("db:init failed", err);
    process.exit(1);
  });
