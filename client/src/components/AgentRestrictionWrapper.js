// src/components/AgentRestrictionWrapper.js
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * A wrapper component that handles agent restrictions for analytics pages
 * This enforces that agent users can only see their own data
 */
const AgentRestrictionWrapper = ({ 
  children,
  onAgentRestriction = () => {},
  filterSetter = null,
  agentIdField = 'agentId'
}) => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Get user profile to determine if agent or admin
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        const userInfo = await api.getUserProfile();
        setUserInfo(userInfo);
        
        // If user is an agent (not admin), set the restriction
        if (userInfo && userInfo.isAgent && !userInfo.isAdmin && userInfo.agentId) {
          console.log(`Applying agent restriction for ${userInfo.agentId}`);
          
          // Call the callback with the agent ID and restricted status
          onAgentRestriction(userInfo.agentId, true);
          
          // If a filter setter function was provided, update the filters
          if (filterSetter) {
            filterSetter(prev => ({
              ...prev,
              [agentIdField]: userInfo.agentId
            }));
          }
        } else {
          // If not an agent or if admin, call callback with no restriction
          onAgentRestriction(null, false);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        onAgentRestriction(null, false);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserInfo();
  }, [onAgentRestriction, filterSetter, agentIdField]);

  if (loading) {
    return (
      <div className="text-center my-3">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Clone children with agent restriction props
  return React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        isAgentRestricted: userInfo?.isAgent && !userInfo?.isAdmin,
        restrictedAgentId: userInfo?.agentId,
      });
    }
    return child;
  });
};

export default AgentRestrictionWrapper;