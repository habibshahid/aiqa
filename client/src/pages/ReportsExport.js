// src/pages/ReportsExport.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Select from 'react-select';
import { FileDown, FileText, FileSpreadsheet, UserCheck } from 'lucide-react';
import { api } from '../services/api';

const ReportsExport = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [queues, setQueues] = useState([]);
  const [forms, setForms] = useState([]);
  const [formParameters, setFormParameters] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [filters, setFilters] = useState({
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    selectedAgent: null,
    selectedQueue: null,
    selectedForm: null,
    reportType: { value: 'evaluations', label: 'Evaluations' }
  });

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [agentsResponse, queuesResponse, formsResponse] = await Promise.all([
          fetch('/api/agents', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch('/api/queues', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch('/api/qa-forms', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);
        
        if (!agentsResponse.ok || !queuesResponse.ok || !formsResponse.ok) {
          throw new Error('Failed to fetch options');
        }
        
        const [agentsData, queuesData, formsData] = await Promise.all([
          agentsResponse.json(),
          queuesResponse.json(),
          formsResponse.json()
        ]);
        
        setAgents(agentsData);
        setQueues(queuesData);
        setForms(formsData);
        
        // If there's only one form, select it automatically
        if (formsData.length === 1) {
          const form = {
            value: formsData[0]._id,
            label: formsData[0].name
          };
          setFilters(prev => ({ 
            ...prev, 
            selectedForm: form
          }));
          // Fetch parameters for the selected form
          fetchFormParameters(formsData[0]._id);
        }
      } catch (error) {
        console.error('Error fetching options:', error);
        setError('Failed to load filter options');
      } finally {
        setFormsLoading(false);
      }
    };
    
    fetchOptions();
  }, []);

  // Fetch form parameters when a form is selected
  useEffect(() => {
    const fetchFormParameters = async () => {
      if (filters.selectedForm) {
        try {
          const response = await fetch(`/api/qa-forms/${filters.selectedForm.value}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch form details');
          }
          
          const formData = await response.json();
          if (formData.parameters) {
            setFormParameters(formData.parameters);
          }
        } catch (error) {
          console.error('Error fetching form details:', error);
          setFormParameters([]);
        }
      } else {
        setFormParameters([]);
      }
    };
    
    if (filters.selectedForm) {
      fetchFormParameters();
    }
  }, [filters.selectedForm]);

  const fetchFormParameters = async (formId) => {
    try {
      const response = await fetch(`/api/qa-forms/${formId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch form details');
      }
      
      const formData = await response.json();
      if (formData.parameters) {
        setFormParameters(formData.parameters);
      }
    } catch (error) {
      console.error('Error fetching form details:', error);
      setFormParameters([]);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    
    // If form selection changes, fetch the form parameters
    if (name === 'selectedForm' && value) {
      fetchFormParameters(value.value);
    }
  };

  const exportReport = async () => {
    // Validate form selection if multiple forms exist
    if (!filters.selectedForm && forms.length > 1) {
      setError('Please select a QA Form to export reports.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: 'csv'
      });
      
      if (filters.selectedForm) {
        params.append('formId', filters.selectedForm.value);
        
        // Add parameter names to include in the export
        if (formParameters.length > 0) {
          const paramNames = formParameters.map(param => param.name).join(',');
          params.append('includeParameters', paramNames);
        }
      }
      
      if (filters.selectedAgent) {
        params.append('agentId', filters.selectedAgent.value);
      }
      
      if (filters.selectedQueue) {
        params.append('queueId', filters.selectedQueue.value);
      }
      
      // Determine endpoint based on report type
      const endpoint = `/api/exports/${filters.reportType.value}`;
      
      // Use Fetch API to get the file as a blob
      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }
      
      // Get content as Blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filters.reportType.value}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting report:', error);
      setError(`Failed to export report: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">      
      <div className="row">
        <div className="col-md-8">
          {/* Filters */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Export Options</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Report Type</label>
                  <Select
                    options={[
                      { value: 'evaluations', label: 'Evaluations Export' },
                      { value: 'agent-performance', label: 'Agent Performance Report' }
                    ]}
                    value={filters.reportType}
                    onChange={(selected) => handleFilterChange('reportType', selected)}
                  />
                </div>
                
                <div className="col-md-6">
                  <label className="form-label">QA Form</label>
                  <Select
                    options={forms.map(form => ({
                      value: form._id,
                      label: form.name
                    }))}
                    value={filters.selectedForm}
                    onChange={(selected) => handleFilterChange('selectedForm', selected)}
                    isDisabled={formsLoading || forms.length === 1}
                    isClearable={forms.length > 1}
                    placeholder={formsLoading ? "Loading forms..." : "Select QA Form"}
                  />
                </div>
                
                <div className="col-md-3">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </div>
                
                <div className="col-md-3">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
                
                {filters.reportType.value === 'evaluations' && (
                  <>
                    <div className="col-md-6">
                      <label className="form-label">Agent (Optional)</label>
                      <Select
                        options={agents.map(agent => ({
                          value: agent.id,
                          label: agent.name
                        }))}
                        value={filters.selectedAgent}
                        onChange={(selected) => handleFilterChange('selectedAgent', selected)}
                        isClearable
                        placeholder="All Agents"
                      />
                    </div>
                    
                    <div className="col-md-6">
                      <label className="form-label">Queue (Optional)</label>
                      <Select
                        options={queues.map(queue => ({
                          value: queue.id,
                          label: queue.name
                        }))}
                        value={filters.selectedQueue}
                        onChange={(selected) => handleFilterChange('selectedQueue', selected)}
                        isClearable
                        placeholder="All Queues"
                      />
                    </div>
                  </>
                )}
                
                {/* Form validation message */}
                {!filters.selectedForm && forms.length > 1 && (
                  <div className="col-12">
                    <div className="alert alert-warning">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>Please select a QA Form to export reports.</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Display parameters that will be included */}
                {formParameters.length > 0 && (
                  <div className="col-12">
                    <label className="form-label">Parameters to be included in export:</label>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {formParameters.map(param => (
                        <span key={param.name} className="badge bg-info text-white">
                          {param.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="col-12 mt-4">
                  <button
                    className="btn btn-primary"
                    onClick={exportReport}
                    disabled={loading || (!filters.selectedForm && forms.length > 1)}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FileDown className="me-2" size={18} />
                        Export Report
                      </>
                    )}
                  </button>
                </div>
                
                {error && (
                  <div className="col-12">
                    <div className="alert alert-danger mt-2">
                      {error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          {/* Report Descriptions */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Available Reports</h5>
            </div>
            <div className="card-body p-0">
              <ul className="list-group list-group-flush">
                <li className="list-group-item d-flex align-items-center p-3">
                  <div className="me-3">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <div>
                    <h6 className="mb-1">Evaluations Export</h6>
                    <p className="mb-0 text-muted">
                      Detailed export of all evaluations with scores, sentiments, and analysis.
                    </p>
                  </div>
                </li>
                <li className="list-group-item d-flex align-items-center p-3">
                  <div className="me-3">
                    <UserCheck size={24} className="text-success" />
                  </div>
                  <div>
                    <h6 className="mb-1">Agent Performance Report</h6>
                    <p className="mb-0 text-muted">
                      Aggregated metrics by agent, including average scores and areas for improvement.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Report Format</h5>
            </div>
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <FileSpreadsheet size={24} className="me-3 text-success" />
                <div>
                  <h6 className="mb-1">CSV Format</h6>
                  <p className="mb-0 text-muted">
                    Reports will be exported as CSV files compatible with Excel and other spreadsheet applications.
                  </p>
                </div>
              </div>
              <div className="alert alert-info mb-0">
                <small>
                  <strong>Tip:</strong> For large date ranges, the export may take a few moments to generate.
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsExport;