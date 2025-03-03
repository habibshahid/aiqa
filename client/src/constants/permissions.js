// constants/permissions.js

// Define all available modules and their actions
const AVAILABLE_MODULES = {
    dashboard: {
      name: 'Dashboard',
      description: 'Access to dashboard and analytics',
      actions: ['read', 'write']
    },
    'qa-forms': {
      name: 'QA Forms',
      description: 'Manage quality assurance forms',
      actions: ['read', 'write']
    },
    users: {
      name: 'Users',
      description: 'Manage user accounts',
      actions: ['read', 'write']
    },
    groups: {
      name: 'Groups',
      description: 'Manage user groups and permissions',
      actions: ['read', 'write']
    },
    settings: {
      name: 'Settings',
      description: 'System settings and configuration',
      actions: ['read', 'write']
    },
    criteria: {
      name: 'QA Criteria',
      description: 'Manage quality assurance criteria',
      actions: ['read', 'write']
    },
    agents: {
      name: 'Agents',
      description: 'Manage and evaluate agents',
      actions: ['read', 'write']
    },
    'agent-comparison': {
      name: 'Agent Comparison',
      description: 'View and analyze agent performance comparisons',
      actions: ['read']
    },
    'trend-analysis': {
      name: 'Trend Analysis',
      description: 'View and analyze trend data',
      actions: ['read']
    },
    exports: {
      name: 'Exports',
      description: 'Generate and download reports',
      actions: ['read']
    },
    evaluations: {
      name: 'Evaluations',
      description: 'View and create evaluations',
      actions: ['read', 'write']
    }
  };
  
  // Default permissions template (all false)
  const createEmptyPermissionsTemplate = () => {
    const template = {};
    
    Object.keys(AVAILABLE_MODULES).forEach(moduleKey => {
      template[moduleKey] = {};
      
      AVAILABLE_MODULES[moduleKey].actions.forEach(action => {
        template[moduleKey][action] = false;
      });
    });
    
    return template;
  };
  
  // Default admin permissions (all true)
  const getAdminPermissions = () => {
    const template = createEmptyPermissionsTemplate();
    
    Object.keys(template).forEach(moduleKey => {
      Object.keys(template[moduleKey]).forEach(action => {
        template[moduleKey][action] = true;
      });
    });
    
    return template;
  };
  
  module.exports = {
    AVAILABLE_MODULES,
    createEmptyPermissionsTemplate,
    getAdminPermissions
  };