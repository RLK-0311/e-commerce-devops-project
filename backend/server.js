const express = require("express");
const pool = require("./config/database");

const app = express();

const PORT = 3000;

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

app.get("/api/products", async (req, res) => {
  try {
    const { category } = req.query;

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

    res.json({
      status: "success",
      count: rows.length,
      products: rows
    });
  } catch (error) {
    console.error("Failed to fetch products:", error.message);

    res.status(500).json({
      status: "error",
      message: "Failed to fetch products"
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
