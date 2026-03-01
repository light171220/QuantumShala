import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import MainLayout from '@/components/layout/MainLayout'
import LoadingScreen from '@/components/ui/LoadingScreen'

const HomePage = lazy(() => import('@/pages/home/HomePage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const VerifyPage = lazy(() => import('@/pages/auth/VerifyPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const DashboardPage = lazy(() => import('@/pages/home/DashboardPage'))
const LearningPathsPage = lazy(() => import('@/pages/learning/LearningPathsPage'))
const TrackPage = lazy(() => import('@/pages/learning/TrackPage'))
const ModulePage = lazy(() => import('@/pages/learning/ModulePage'))
const LessonPage = lazy(() => import('@/pages/learning/LessonPage'))
const QuizPage = lazy(() => import('@/pages/learning/QuizPage'))
const ExercisesPage = lazy(() => import('@/pages/learning/ExercisesPage'))
const SimulatorPage = lazy(() => import('@/pages/simulator/SimulatorPage'))
const CircuitBuilderPage = lazy(() => import('@/pages/simulator/CircuitBuilderPage'))
const CodePlaygroundPage = lazy(() => import('@/pages/simulator/CodePlaygroundPage'))
const QMLStudioPage = lazy(() => import('@/pages/hubs/QMLStudioPage'))
const PQCLabPage = lazy(() => import('@/pages/hubs/PQCLabPage'))
const ChemistryLabPage = lazy(() => import('@/pages/hubs/ChemistryLabPage'))
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'))
const SettingsPage = lazy(() => import('@/pages/profile/SettingsPage'))
const LeaderboardPage = lazy(() => import('@/pages/profile/LeaderboardPage'))
const AchievementsPage = lazy(() => import('@/pages/profile/AchievementsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const AboutPage = lazy(() => import('@/pages/legal/AboutPage'))
const PrivacyPolicyPage = lazy(() => import('@/pages/legal/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('@/pages/legal/TermsOfServicePage'))
const CookiePolicyPage = lazy(() => import('@/pages/legal/CookiePolicyPage'))
const ContactPage = lazy(() => import('@/pages/legal/ContactPage'))
const FAQPage = lazy(() => import('@/pages/legal/FAQPage'))

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminContentPage = lazy(() => import('@/pages/admin/AdminContentPage'))

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuthStore()
  
  if (isLoading) {
    return <LoadingScreen />
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  
  if (isLoading) {
    return <LoadingScreen />
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  
  if (isLoading) {
    return <LoadingScreen />
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

export default function App() {
  const { checkAuth } = useAuthStore()
  
  useEffect(() => {
    checkAuth()
  }, [checkAuth])
  
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />

        <Route path="/verify" element={<VerifyPage />} />
        
        <Route path="/forgot-password" element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        } />
        
        {/* Legal & Info Routes (Public) */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/cookies" element={<CookiePolicyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FAQPage />} />
        
        {/* Protected Routes with Layout */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/learn" element={
            <ProtectedRoute>
              <LearningPathsPage />
            </ProtectedRoute>
          } />
          
          <Route path="/learn/:trackId" element={
            <ProtectedRoute>
              <TrackPage />
            </ProtectedRoute>
          } />
          
          <Route path="/learn/:trackId/:moduleId" element={
            <ProtectedRoute>
              <ModulePage />
            </ProtectedRoute>
          } />
          
          <Route path="/learn/:trackId/:moduleId/:lessonId" element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          } />
          
          <Route path="/learn/:trackId/:moduleId/:lessonId/quiz" element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          } />

          <Route path="/learn/:trackId/:moduleId/:lessonId/exercises" element={
            <ProtectedRoute>
              <ExercisesPage />
            </ProtectedRoute>
          } />
          
          <Route path="/simulator" element={
            <ProtectedRoute>
              <SimulatorPage />
            </ProtectedRoute>
          } />
          
          <Route path="/simulator/circuit" element={
            <ProtectedRoute>
              <CircuitBuilderPage />
            </ProtectedRoute>
          } />
          
          <Route path="/simulator/code" element={
            <ProtectedRoute>
              <CodePlaygroundPage />
            </ProtectedRoute>
          } />
          
          <Route path="/hub/qml" element={
            <ProtectedRoute>
              <QMLStudioPage />
            </ProtectedRoute>
          } />
          
          <Route path="/hub/pqc" element={
            <ProtectedRoute>
              <PQCLabPage />
            </ProtectedRoute>
          } />
          
          <Route path="/hub/chemistry" element={
            <ProtectedRoute>
              <ChemistryLabPage />
            </ProtectedRoute>
          } />
          
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          
          <Route path="/profile/:userId" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
          
          <Route path="/leaderboard" element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/achievements" element={
            <ProtectedRoute>
              <AchievementsPage />
            </ProtectedRoute>
          } />
          
          {/* Admin Routes - Inside MainLayout */}
          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          } />
          
          <Route path="/admin/users" element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          } />
          
          <Route path="/admin/content" element={
            <AdminRoute>
              <AdminContentPage />
            </AdminRoute>
          } />
        </Route>
        
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
