const app = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./config/db");

async function startServer() {
  try {
    await connectDatabase(env.mongodbUri);
    console.log("MongoDB connected");

    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
