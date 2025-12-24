const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const checkConnection = async () => {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = { pool, checkConnection };
