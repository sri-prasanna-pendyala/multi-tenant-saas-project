const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const secureTestRoutes = require("./routes/secure-test.routes");
const userRoutes = require("./routes/users.routes");
const projectRoutes = require("./routes/projects.routes");
const taskRoutes = require("./routes/tasks.routes");
const healthRoutes = require("./routes/health.routes");
const tenantRoutes = require("./routes/tenants.routes");


const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);
app.use("/api/secure", secureTestRoutes);
app.use("/api", userRoutes);


module.exports = app;
