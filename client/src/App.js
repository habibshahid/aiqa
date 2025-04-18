// Fixed App.js with improved route handling for agent evaluation access
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

// Special wrapper for evaluation routes to ensure agents can view their own evaluations
const EvaluationRouteWrapper = ({ children }) => {
  const [userRoles, setUserRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Get user role information from localStorage
    const savedRoles = localStorage.getItem('userRoles');
    
    if (savedRoles) {
      try {
        setUserRoles(JSON.parse(savedRoles));
      } catch (e) {
        console.error('Error parsing saved roles:', e);
      }
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

  // If user is an agent but not admin, add the agentId prop
  if (userRoles && userRoles.isAgent && !userRoles.isAdmin) {
    return React.cloneElement(children, {
      agentRestricted: true,
      agentId: userRoles.agentId
    });
  }

  return children;
};

const AgentRestricted = ({ children }) => {
  const [userRoles, setUserRoles] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Get user role information
    const savedRoles = localStorage.getItem('userRoles');
    const savedPermissions = localStorage.getItem('cachedPermissions');
    
    if (savedRoles) {
      try {
        setUserRoles(JSON.parse(savedRoles));
      } catch (e) {
        console.error('Error parsing saved roles:', e);
      }
    }
    
    if (savedPermissions) {
      try {
        setPermissions(JSON.parse(savedPermissions));
      } catch (e) {
        console.error('Error parsing saved permissions:', e);
      }
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
    // Map routes to their required permissions
    const routePermissions = {
      '/new-evaluations': 'evaluations.write',
      '/qa-forms': 'qa-forms.read',
      '/criteria': 'criteria.read',
      '/scheduler': 'qa-forms.write',
      '/agent-comparison': 'agent-comparison.read',
      '/trend-analysis': 'trend-analysis.read',
      '/exports': 'exports.read',
      '/groups': 'groups.read'
    };
    
    const hasPermission = (route) => {
      if (!permissions) return false;
      
      // If route needs permission, check if user has it
      if (routePermissions[route]) {
        const [resource, action] = routePermissions[route].split('.');
        return permissions[resource]?.[action] === true;
      }
      
      // Default routes everyone can access
      const defaultRoutes = ['/dashboard', '/evaluations', '/documentation', '/change-password'];
      return defaultRoutes.includes(route);
    };
    
    // IMPORTANT: Special case for evaluation detail route
    if (location.pathname.startsWith('/evaluation/')) {
      console.log('Agent accessing an evaluation details page - allowing access');
      return children;
    }
    
    // Check if current path is allowed based on permissions
    const isAllowed = hasPermission(location.pathname) || 
                     Object.keys(routePermissions).some(route => 
                       location.pathname.startsWith(route) && hasPermission(route)
                     );
    
    if (!isAllowed) {
      console.warn(`Agent access denied to ${location.pathname} - redirecting to dashboard`);
      console.log('Current permissions:', permissions);
      console.log('Required permission:', routePermissions[location.pathname] || 'Unknown');
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
              <WithPermission permission="evaluations.read">
                <RecentEvaluations />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/new-evaluations"
          element={
            <PrivateLayout>
              <WithPermission permission="evaluations.write">
                <NewEvaluations />
              </WithPermission>
            </PrivateLayout>
          }
        />
        {/* MODIFIED: Special handling for evaluation detail route */}
        <Route
          path="/evaluation/:id"
          element={
            <PrivateLayout>
              <EvaluationRouteWrapper>
                <QADetail />
              </EvaluationRouteWrapper>
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
        {/* QA Forms routes */}
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
              <WithPermission permission="criteria.read">
                <CriteriaList />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/criteria/new"
          element={
            <PrivateLayout>
              <WithPermission permission="criteria.write">
                <CriteriaEditor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/criteria/edit/:id"
          element={
            <PrivateLayout>
              <WithPermission permission="criteria.write">
                <CriteriaEditor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/queue-monitor"
          element={
            <PrivateLayout>
              <WithPermission permission="evaluations.read">
                <QueueMonitor />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/agent-coaching/:agentId"
          element={
            <PrivateLayout>
              <WithPermission permission="evaluations.read">
                <AgentCoaching />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/agent-comparison"
          element={
            <PrivateLayout>
              <WithPermission permission="agent-comparison.read">
                <AgentComparison />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/trend-analysis"
          element={
            <PrivateLayout>
              <WithPermission permission="trend-analysis.read">
                <TrendAnalysis />
              </WithPermission>
            </PrivateLayout>
          }
        />
        <Route
          path="/exports"
          element={
            <PrivateLayout>
              <WithPermission permission="exports.read">
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
      </Routes>
    </TourProvider>
  );
}

export default App;