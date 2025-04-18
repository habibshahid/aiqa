import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Menu from './components/Menu';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import QADetail from './pages/QADetail';
import RecentEvaluations from './pages/RecentEvaluations';
import NewEvaluations from './pages/NewEvaluations';
import ChangePassword from './pages/ChangePassword';
import QAFormsList from './pages/QAForms/QAFormsList';
import QAFormEditor from './pages/QAForms/QAFormEditor';
import CriteriaList from './pages/CriteriaProfiles/CriteriaList';
import CriteriaEditor from './pages/CriteriaProfiles/CriteriaEditor';
import { WithPermission } from './components/WithPermission';
import QueueMonitor from './pages/QueueMonitor';
import AgentCoaching from './pages/AgentCoaching';
import AgentComparison from './pages/AgentComparison';
import TrendAnalysis from './pages/TrendAnalysis';
import ReportsExport from './pages/ReportsExport';
import GroupsList from './pages/GroupManagement/GroupsList';
import GroupEditor from './pages/GroupManagement/GroupEditor';
import GroupUsers from './pages/GroupManagement/GroupUsers';
import SchedulerDashboard from './pages/SchedulerDashboard';
import TourProvider from './components/tour/TourProvider';
import Documentation from './pages/Documentation';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'shepherd.js/dist/css/shepherd.css';

const AgentRestricted = ({ children }) => {
  const [userRoles, setUserRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Get user role information
    const savedRoles = localStorage.getItem('userRoles');
    if (savedRoles) {
      setUserRoles(JSON.parse(savedRoles));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // If user is an agent but not admin, check if they should access this route
  if (userRoles && userRoles.isAgent && !userRoles.isAdmin) {
    // List of routes agents should not access
    const adminOnlyRoutes = [
      '/new-evaluations',
      '/qa-forms',
      '/criteria',
      '/scheduler',
      '/agent-comparison',
      '/trend-analysis',
      '/exports',
      '/groups'
    ];
    
    // Check if current path starts with any admin-only route
    const isAdminRoute = adminOnlyRoutes.some(route => 
      location.pathname === route || location.pathname.startsWith(`${route}/`)
    );
    
    if (isAdminRoute) {
      // Redirect agents away from admin routes
      navigate('/dashboard');
      return null;
    }
  }

  return children;
};

const PrivateLayout = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="vh-100 d-flex flex-column">
      <div className="position-fixed top-0 start-0 end-0 bg-white" style={{ zIndex: 1030 }}>
        <TopBar />
      </div>
      
      <div className="flex-grow-1 d-flex mt-5">
        <div className="position-fixed start-0 bottom-0" style={{ top: '61px', width: '60px' }}>
          <Menu />
        </div>
        
        <div className="flex-grow-1 overflow-auto" style={{ marginLeft: '60px', marginTop: '1rem' }}>
          <AgentRestricted>
            {children}
          </AgentRestricted>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <TourProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <PrivateLayout>
              <WithPermission permission="dashboard.read">
                <Dashboard />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/evaluations"
          element={
            <PrivateLayout>
              <RecentEvaluations />
            </PrivateLayout>
          }
        />
        <Route
          path="/new-evaluations"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.write">
                <NewEvaluations />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/evaluation/:id"
          element={
            <PrivateLayout>
              <QADetail />
            </PrivateLayout>
          }
        />
        <Route
          path="/change-password"
          element={
            <PrivateLayout>
              <ChangePassword />
            </PrivateLayout>
          }
        />
        {/* Add QA Forms routes */}
        <Route
          path="/qa-forms"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.read">
                <QAFormsList />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/qa-forms/new"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.write">
                <QAFormEditor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/qa-forms/edit/:id"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.write">
                <QAFormEditor />
              </WithPermission>      
            </PrivateLayout>
          }
        />
        <Route
          path="/criteria"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.read">
                <CriteriaList />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/criteria/new"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.write">
                <CriteriaEditor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/criteria/edit/:id"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.write">
                <CriteriaEditor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/queue-monitor"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.read">
                <QueueMonitor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/agent-coaching/:agentId"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.read">
                <AgentCoaching />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/agent-comparison"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.read">
                <AgentComparison />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/trend-analysis"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.read">
                <TrendAnalysis />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/exports"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.read">
                <ReportsExport />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/groups"
          element={
            <PrivateLayout>
              <WithPermission permission="groups.read">
                <GroupsList />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/groups/new"
          element={
            <PrivateLayout>
              <WithPermission permission="groups.write">
                <GroupEditor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/groups/edit/:id"
          element={
            <PrivateLayout>
              <WithPermission permission="groups.write">
                <GroupEditor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/groups/:id/users"
          element={
            <PrivateLayout>
              <WithPermission permission="groups.write">
                <GroupUsers />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/scheduler"
          element={
            <PrivateLayout>
              <WithPermission permission="qa-forms.write">
                <SchedulerDashboard />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/documentation"
          element={
            <PrivateLayout>
              <Documentation />
            </PrivateLayout>
          }
        />
        <Route path="/documentation" element={<Documentation />} />
      </Routes>
    </TourProvider>
  );
}

export default App;