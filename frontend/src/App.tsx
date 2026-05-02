import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, AuthGuard } from './components/AuthGuard';
import { ToastContainer } from './store/toastStore';

// Pages
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import MovieDetailPage from './pages/MovieDetailPage';
import MyListPage from './pages/MyListPage';
import DiscoverPage from './pages/DiscoverPage';
import FriendsPage from './pages/FriendsPage';
import ProfilePage from './pages/ProfilePage';
import MovieOfTheDayPage from './pages/MovieOfTheDayPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AnimatePresence mode="wait">
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <AuthGuard>
                  <HomePage />
                </AuthGuard>
              }
            />
            <Route
              path="/onboarding"
              element={
                <AuthGuard>
                  <OnboardingPage />
                </AuthGuard>
              }
            />
            <Route
              path="/movie/:movieId"
              element={
                <AuthGuard>
                  <MovieDetailPage />
                </AuthGuard>
              }
            />
            <Route
              path="/list"
              element={
                <AuthGuard>
                  <MyListPage />
                </AuthGuard>
              }
            />
            <Route
              path="/discover"
              element={
                <AuthGuard>
                  <DiscoverPage />
                </AuthGuard>
              }
            />
            <Route
              path="/friends"
              element={
                <AuthGuard>
                  <FriendsPage />
                </AuthGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <AuthGuard>
                  <ProfilePage />
                </AuthGuard>
              }
            />
            <Route
              path="/movie-of-the-day"
              element={
                <AuthGuard>
                  <MovieOfTheDayPage />
                </AuthGuard>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
