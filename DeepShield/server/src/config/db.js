const mongoose = require("mongoose");

async function connectDatabase(mongodbUri) {
  mongoose.set("strictQuery", true);

  await mongoose.connect(mongodbUri);
  return mongoose.connection;
}

module.exports = { connectDatabase };
