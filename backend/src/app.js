const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const telemetryRoutes = require("./routes/telemetry.routes");
const usageRoutes = require("./routes/usage.routes");
const authRoutes = require("./routes/auth.routes");
const deviceRoutes = require("./routes/device.routes");
const categoryRoutes = require("./routes/category.routes");
const billingRoutes = require("./routes/billing.routes");

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is running" });
});

app.use("/api/v1/telemetry", telemetryRoutes);
app.use("/api/v1/usage", usageRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/devices", deviceRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/billing", billingRoutes);

module.exports = app;
