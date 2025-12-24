require("dotenv").config();
const app = require("./app");
const { checkConnection } = require("./config/db");

const PORT = process.env.PORT || 5000;

app.get("/api/health", async (req, res) => {
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    return res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }

  res.status(200).json({
    status: "ok",
    database: "connected",
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
