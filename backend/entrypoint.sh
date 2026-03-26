#!/bin/sh
set -e

echo "Waiting for database..."
until node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
pool.query('SELECT 1').then(() => { console.log('DB ready'); process.exit(0); }).catch(() => { process.exit(1); });
" 2>/dev/null; do
  echo "Database not ready, retrying in 2s..."
  sleep 2
done

echo "Running migrations..."
node src/db/migrate.js

echo "Running seeds..."
node src/db/seed.js

echo "Starting server..."
exec node src/index.js
