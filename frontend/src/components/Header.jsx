function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          E-Commerce
        </div>

        <div className="search">
          <input
            type="text"
            placeholder="Search products..."
          />
        </div>

        <div className="header-actions">
          <button type="button">
            Login
          </button>

          <button type="button">
            Cart
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
