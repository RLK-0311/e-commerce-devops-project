import { NavLink } from 'react-router-dom'

function Navigation() {
  return (
    <nav className="navigation">
      <div className="navigation-container">

        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
        >
          Home
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
        >
          Products
        </NavLink>

        <NavLink
          to="/electronics"
          className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
        >
          Electronics
        </NavLink>

        <NavLink
          to="/clothing"
          className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
        >
          Clothing
        </NavLink>

        <NavLink
          to="/books"
          className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
        >
          Books
        </NavLink>

        <NavLink
          to="/offers"
          className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
        >
          Offers
        </NavLink>

      </div>
    </nav>
  )
}

export default Navigation
