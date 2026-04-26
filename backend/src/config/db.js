const { Pool } = require("pg");
const env = require("./env");

const sslConfig = env.dbSsl
  ? {
      rejectUnauthorized: false,
    }
  : false;

const sharedPoolConfig = {
  ssl: sslConfig,
  family: 4, // Force IPv4 to avoid Render→Supabase IPv6 issues
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  query_timeout: 10000,
  statement_timeout: 10000,
  keepAlive: true,
};

const poolConfig = env.databaseUrl
  ? {
      connectionString: env.databaseUrl,
      ...sharedPoolConfig,
    }
  : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      ...sharedPoolConfig,
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected PG error:", err);
});

module.exports = pool;
