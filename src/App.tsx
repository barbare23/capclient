import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import SignUp from '@/pages/SignUp'
import Dashboard from '@/pages/Dashboard'
import Clients from '@/pages/Clients'
import Abonnement from '@/pages/Abonnement'
import Parametres from '@/pages/Parametres'
import { Toaster } from '@/components/ui/sonner'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Chargement…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function GuestRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Chargement…</p>
      </div>
    )
  }

  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <Routes>
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
          <Route path="/abonnement" element={<ProtectedRoute><Abonnement /></ProtectedRoute>} />
          <Route path="/parametres" element={<ProtectedRoute><Parametres /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
