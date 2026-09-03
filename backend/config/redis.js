const { createClient } = require("redis");

const redisClient = createClient({
  url: "redis://redis:6379"
});

redisClient.on("error", (error) => {
  console.error("Redis Client Error:", error.message);
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

module.exports = {
  redisClient,
  connectRedis
};
