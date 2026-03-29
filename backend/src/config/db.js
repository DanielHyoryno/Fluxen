const { Pool } = require("pg");
const env = require("./env");

const sslConfig = env.dbSsl
  ? {
      rejectUnauthorized: false,
    }
  : false;

const poolConfig = env.databaseUrl
  ? {
      connectionString: env.databaseUrl,
      ssl: sslConfig,
      family: 4, // Force IPv4 to avoid Render→Supabase IPv6 issues
    }
  : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      ssl: sslConfig,
      family: 4,
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected PG error:", err);
});

module.exports = pool;
