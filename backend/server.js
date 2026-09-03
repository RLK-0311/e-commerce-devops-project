const express = require("express");
const pool = require("./config/database");
const { redisClient, connectRedis } = require("./config/redis");

const app = express();

const PORT = 3000;

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy"
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "E-Commerce Backend is running",
    status: "success"
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS database_connection");

    res.json({
      status: "success",
      database: rows[0].database_connection === 1
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);

    res.status(500).json({
      status: "error",
      database: false
    });
  }
});

app.get("/api/health/redis", async (req, res) => {
  try {
    const response = await redisClient.ping();

    res.json({
      status: "success",
      redis: response === "PONG"
    });
  } catch (error) {
    console.error("Redis connection failed:", error.message);

    res.status(500).json({
      status: "error",
      redis: false
    });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const { category } = req.query;

    // Create a unique Redis key for each request type
    const cacheKey = category
      ? `products:category:${category}`
      : "products:all";

    // Check Redis first
    const cachedProducts = await redisClient.get(cacheKey);

    if (cachedProducts) {
      console.log(`Redis cache HIT: ${cacheKey}`);

      return res.json(JSON.parse(cachedProducts));
    }

    console.log(`Redis cache MISS: ${cacheKey}`);

    // Redis does not have the data, so query MySQL
    let query = `
      SELECT
        id,
        name,
        description,
        category,
        price,
        image,
        stock
      FROM products
    `;

    const queryParams = [];

    if (category) {
      query += " WHERE category = ?";
      queryParams.push(category);
    }

    query += " ORDER BY id ASC";

    const [rows] = await pool.query(query, queryParams);

    const response = {
      status: "success",
      count: rows.length,
      products: rows
    };

    // Store the MySQL result in Redis for 60 seconds
    await redisClient.setEx(
      cacheKey,
      60,
      JSON.stringify(response)
    );

    console.log(`Redis cache SET: ${cacheKey} (TTL: 60s)`);

    res.json(response);
  } catch (error) {
    console.error("Failed to fetch products:", error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to fetch products"
    });
  }
});

app.delete("/api/cache/products", async (req, res) => {
  try {
    const keys = await redisClient.keys("products:*");

    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    console.log(`Redis cache invalidated: ${keys.length} key(s)`);

    res.json({
      status: "success",
      deletedKeys: keys.length
    });
  } catch (error) {
    console.error("Failed to invalidate product cache:", error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to invalidate product cache"
    });
  }
});


app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT DISTINCT category
      FROM products
      WHERE category IS NOT NULL
        AND category != ''
      ORDER BY category ASC
      `
    );

    const categories = rows.map((row) => row.category);

    res.json({
      status: "success",
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error("Failed to fetch categories:", error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to fetch categories"
    });
  }
});

async function startServer() {
  try {
    await connectRedis();

    console.log("Redis connected successfully");

    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
