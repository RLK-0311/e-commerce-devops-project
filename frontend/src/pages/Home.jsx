import { useEffect, useState } from "react";
import CategoryCard from "../components/CategoryCard";
import ProductCard from "../components/ProductCard";

function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [productError, setProductError] = useState("");
  const [categoryError, setCategoryError] = useState("");

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
        setLoadingProducts(false);
      })
      .catch((error) => {
        console.error("Error fetching products:", error);
        setProductError("Unable to load products.");
        setLoadingProducts(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }

        return response.json();
      })
      .then((data) => {
        setCategories(data.categories);
        setLoadingCategories(false);
      })
      .catch((error) => {
        console.error("Error fetching categories:", error);
        setCategoryError("Unable to load categories.");
        setLoadingCategories(false);
      });
  }, []);

  return (
    <main>
      <section className="hero-section">
        <div className="hero-content">
          <h1>Welcome to Our Store</h1>

          <p>
            Discover quality products at affordable prices.
          </p>

          <button className="hero-button">
            Shop Now
          </button>
        </div>
      </section>

      <section className="categories-section">
        <h2>Shop by Category</h2>

        {loadingCategories && (
          <p>Loading categories...</p>
        )}

        {categoryError && (
          <p>{categoryError}</p>
        )}

        {!loadingCategories && !categoryError && (
          <div className="categories-grid">
            {categories.map((category) => (
              <CategoryCard
                key={category}
                name={category}
                description={`Explore our ${category.toLowerCase()} products`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="products-section">
        <h2>Featured Products</h2>

        {loadingProducts && (
          <p>Loading products...</p>
        )}

        {productError && (
          <p>{productError}</p>
        )}

        {!loadingProducts && !productError && (
          <div className="products-grid">
            {products.slice(0, 4).map((product) => (
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

export default Home;
