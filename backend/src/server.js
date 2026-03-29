const app = require("./app");
const pool = require("./config/db");
const env = require("./config/env");

const PORT = env.port;

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("Database connected ✅");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect DB:", err.message);
    process.exit(1);
  }
}

startServer();
