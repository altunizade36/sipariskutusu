import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './index.css';
import AuthGuard from './components/AuthGuard';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import ListingsPage from './pages/ListingsPage';
import ReportsPage from './pages/ReportsPage';
import CommentsPage from './pages/CommentsPage';
import UsersPage from './pages/UsersPage';
import OpsPage from './pages/OpsPage';
import AuditLogPage from './pages/AuditLogPage';

export default function App() {
  return (
    <Router>
      <AuthGuard>
        <div className="layout">
          <Sidebar />
          <main className="main">
            <Routes>
              <Route path="/"          element={<DashboardPage />} />
              <Route path="/listings"  element={<ListingsPage />} />
              <Route path="/reports"   element={<ReportsPage />} />
              <Route path="/comments"  element={<CommentsPage />} />
              <Route path="/users"     element={<UsersPage />} />
              <Route path="/ops"       element={<OpsPage />} />
              <Route path="/audit"    element={<AuditLogPage />} />
            </Routes>
          </main>
        </div>
      </AuthGuard>
    </Router>
  );
}
