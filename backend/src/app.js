const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const secureTestRoutes = require("./routes/secure-test.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/secure", secureTestRoutes);

const userRoutes = require("./routes/users.routes");
app.use("/api", userRoutes);

const projectRoutes = require("./routes/projects.routes");
app.use("/api", projectRoutes);

const taskRoutes = require("./routes/tasks.routes");
app.use("/api", taskRoutes);

module.exports = app;
