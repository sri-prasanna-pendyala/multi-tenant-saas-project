require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./src/config/db");

const runSQLFiles = async (dirPath) => {
  const files = fs.readdirSync(dirPath).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dirPath, file), "utf8");
    console.log(`Running ${file}`);
    await pool.query(sql);
  }
};

const start = async () => {
  try {
    console.log("Waiting for database...");
    await pool.query("SELECT 1");

    console.log("Running migrations...");
    await runSQLFiles("/app/database/migrations");

    console.log("Running seed data...");
    await runSQLFiles("/app/database/seeds");

    console.log("Starting server...");
    require("./src/server");
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
};

start();
