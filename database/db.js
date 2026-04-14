import pkg from "pg";
const { Pool } = pkg;   // ← Use Pool instead of Client (much better for real apps)

import dotenv from "dotenv";
dotenv.config();   // Make sure this runs early

// Use full connection string - best practice for Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,   // Neon requires this for their certs
  },
});

// Optional: Test connection once when file loads
pool.connect()
  .then(client => {
    console.log("✅ Connected to Neon PostgreSQL successfully");
    client.release();
  })
  .catch(err => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });

export default pool;   // Export the pool, not a single client