import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import Chat from './pages/Chat'
import Analysis from './pages/Analysis'
import Comparison from './pages/Comparison'
import Timeline from './pages/Timeline'
import ModelCatalog from './pages/ModelCatalog'
import Settings from './pages/Settings'
import PricingSources from './pages/PricingSources'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/new-project" element={<NewProject />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/comparison" element={<Comparison />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/models" element={<ModelCatalog />} />
              {/* Settings restricted to admin */}
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/settings" element={<Settings />} />
                <Route path="/pricing-sources" element={<PricingSources />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
