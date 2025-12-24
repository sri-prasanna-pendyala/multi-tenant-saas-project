const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const secureTestRoutes = require("./routes/secure-test.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/secure", secureTestRoutes);

module.exports = app;
