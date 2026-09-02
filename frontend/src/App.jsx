import './App.css'

import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'

import Header from './components/Header'
import Navigation from './components/Navigation'

import Home from './pages/Home'
import Products from './pages/Products'
import Electronics from './pages/Electronics'
import Clothing from './pages/Clothing'
import Books from './pages/Books'
import Offers from './pages/Offers'


function PageTransition() {

  const location = useLocation()

  return (
    <div
      key={location.pathname}
      className="page-transition"
    >

      <Routes location={location}>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/products"
          element={<Products />}
        />

        <Route
          path="/electronics"
          element={<Electronics />}
        />

        <Route
          path="/clothing"
          element={<Clothing />}
        />

        <Route
          path="/books"
          element={<Books />}
        />

        <Route
          path="/offers"
          element={<Offers />}
        />

      </Routes>

    </div>
  )
}


function App() {

  return (
    <BrowserRouter>

      <div className="app">

        <Header />

        <Navigation />

        <PageTransition />

      </div>

    </BrowserRouter>
  )
}


export default App
