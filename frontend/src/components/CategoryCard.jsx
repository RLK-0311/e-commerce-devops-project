function CategoryCard({ name, description }) {
  return (
    <article className="category-card">
      <div className="category-icon">
        {name.charAt(0)}
      </div>

      <div className="category-content">
        <h3>{name}</h3>
        <p>{description}</p>
      </div>
    </article>
  )
}

export default CategoryCard
