import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }

        return response.json();
      })
      .then((data) => {
        setProducts(data.products);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching products:", error);
        setError("Unable to load products.");
        setLoading(false);
      });
  }, []);

  return (
    <main className="products-page">
      <section className="products-header">
        <p className="hero-label">
          OUR COLLECTION
        </p>

        <h1>All Products</h1>

        <p>
          Explore our collection of quality products
          across multiple categories.
        </p>
      </section>

      <section className="products-section">
        {loading && (
          <p>Loading products...</p>
        )}

        {error && (
          <p>{error}</p>
        )}

        {!loading && !error && (
          <div className="products-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Products;
