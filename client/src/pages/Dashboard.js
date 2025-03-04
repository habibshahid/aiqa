import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, CartesianGrid, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { format } from 'date-fns';
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import Select from 'react-select';
import WelcomeTourDialog from '../components/tour/WelcomeTourDialog';

// Updated StatsCard Component with optional subtitle and icon color
const StatsCard = ({ 
  title, 
  value, 
  subtitle = null,
  icon, 
  bgColor = 'bg-primary', 
  textColor = 'text-white',
  iconColor = 'text-white'
}) => (
  <div className="col-xl-3 col-md-6">
    <div className={`card ${bgColor} ${textColor} mb-3`}>
      <div className="card-body">
        <div className="d-flex align-items-center">
          <div className="flex-grow-1">
            <h6 className="mb-2">{title}</h6>
            <h3 className="mb-0">{value}</h3>
            {subtitle && <small>{subtitle}</small>}
          </div>
          {icon && <div className={`flex-shrink-0 ${iconColor}`}>{icon}</div>}
        </div>
      </div>
    </div>
  </div>
);

// Sentiment Icon based on sentiment value
const SentimentIcon = ({ sentiment, size = 24 }) => {
  if (!sentiment) return null;
  
  if (sentiment === 'positive') {
    return <i className="bi bi-emoji-smile-fill" style={{ fontSize: size }}></i>;
  } else if (sentiment === 'negative') {
    return <i className="bi bi-emoji-frown-fill" style={{ fontSize: size }}></i>;
  } else {
    return <i className="bi bi-emoji-neutral-fill" style={{ fontSize: size }}></i>;
  }
};

// Areas of Improvement Component
const AreasOfImprovement = ({ areas }) => {
  if (!areas?.length) return null;

  return (
    <div className="mb-2">
      <h5 className="mb-3">Areas Needing Focus</h5>
      <ul className="list-group">
        {areas.map((area, index) => (
          <li key={index} className="list-group-item">
            <i className="bi bi-exclamation-triangle text-warning me-2"></i>
            {area}
          </li>
        ))}
      </ul>
    </div>
  );
};

// Agent Strengths Component
const AgentStrengths = ({ strengths }) => {
  if (!strengths?.length) return null;

  return (
    <div className="mb-2">
      <h5 className="mb-3">Agent Strengths</h5>
      <ul className="list-group">
        {strengths.map((strength, index) => (
          <li key={index} className="list-group-item">
            <i className="bi bi-check-circle text-success me-2"></i>
            {strength}
          </li>
        ))}
      </ul>
    </div>
  );
};

// Intents Chart Component
const IntentsChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  return (
    <div className="card mb-2">
      <div className="card-header bg-white">
        <h5 className="card-title mb-0">Call Intents</h5>
      </div>
      <div className="card-body">
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart
              layout="vertical"
              data={data.slice(0, 5)} // Show top 5 intents
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip formatter={(value) => [`${value} calls`, 'Count']} />
              <Bar dataKey="count" fill="#6f42c1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// QA Forms Chart Component
const QAFormsChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  return (
    <div className="card mb-2">
      <div className="card-header bg-white">
        <h5 className="card-title mb-0">Evaluations by Form</h5>
      </div>
      <div className="card-body">
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart
              layout="vertical"
              data={data.slice(0, 5)} // Show top 5 forms
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip formatter={(value) => [`${value} evaluations`, 'Count']} />
              <Bar dataKey="count" fill="#20c997" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Agent Performance Chart
const AgentPerformanceChart = ({ data }) => {
  if (!data?.length) return null;

  return (
    <div className="card mb-2">
      <div className="card-header bg-white">
        <h5 className="card-title mb-0">Agent Performance</h5>
      </div>
      <div className="card-body">
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
            >
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Legend />
              <Bar dataKey="averageScore" fill="#4f46e5" name="Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Parameter Score Card Component
const ParameterScoreCard = ({ parameter, averageScore, count, coverage }) => {
  if (averageScore < 0) return null;
  return (
    <div className="col-md-3 mb-3">
      <div className="card h-100">
        <div className="card-body">
          <h6 className="card-subtitle mb-2 text-muted text-truncate" title={parameter}>
            {parameter}
          </h6>
          <div className="d-flex justify-content-between align-items-end mt-3">
            <div>
              <h3 className="mb-0" style={{ color: averageScore >= 80 ? '#10B981' : averageScore >= 60 ? '#F59E0B' : '#EF4444' }}>
                {averageScore}%
              </h3>
              <small className="text-muted">
                {count} evaluations ({coverage}% coverage)
              </small>
            </div>
            <div className={`badge ${
              averageScore >= 80 ? 'bg-success' : 
              averageScore >= 60 ? 'bg-warning' : 
              'bg-danger'
            }`}>
              {averageScore >= 80 ? 'Good' : 
              averageScore >= 60 ? 'Average' : 
              'Needs Improvement'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Parameter Bar Chart Component
const ParameterBarChart = ({ parameters, dateRange }) => {
  // Check if there are parameters to display
  if (!parameters || parameters.length === 0) {
    return null;
  }

  // Transform parameters data for chart display
  const transformedData = parameters
  .filter(param => param.averageScore >= 0)
  .map(param => ({
    name: param.parameter,
    score: param.averageScore,
    color: param.averageScore >= 80 ? '#10B981' : 
           param.averageScore >= 60 ? '#F59E0B' : '#EF4444'
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-sm">
          <p className="mb-1"><strong>{data.name}</strong></p>
          <p className="mb-0" style={{ color: data.color }}>
            Score: {data.score}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card mb-2">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0">Parameter Score Analysis</h5>
        <div className="text-muted small">
          {dateRange?.start} to {dateRange?.end}
        </div>
      </div>
      <div className="card-body">
        <div style={{ width: '100%', height: 500 }}>
          <ResponsiveContainer>
            <BarChart
              data={transformedData}
              margin={{ top: 20, right: 30, left: 40, bottom: 100 }}
              barSize={40}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis 
                domain={[0, 100]}
                label={{ 
                  value: 'Score (%)', 
                  angle: -90, 
                  position: 'insideLeft',
                  offset: -30
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score">
                {transformedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3">
          <div className="d-flex justify-content-center gap-4">
            <div className="d-flex align-items-center">
              <div className="badge bg-success me-2">≥ 80%</div>
              <span>Good</span>
            </div>
            <div className="d-flex align-items-center">
              <div className="badge bg-warning me-2">60-79%</div>
              <span>Average</span>
            </div>
            <div className="d-flex align-items-center">
              <div className="badge bg-danger me-2">&lt; 60%</div>
              <span>Needs Improvement</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [filters, setFilters] = useState({
    selectedForm: null,
    agents: [],
    queues: []
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState({
    agentId: '',
    queueId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    selectedForm: null
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) return null;
  
    return (
      <nav aria-label="Evaluation navigation">
        <ul className="pagination justify-content-end mb-0">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button
              className="page-link"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
          </li>
          
          {[...Array(totalPages)].map((_, index) => (
            <li key={index + 1} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
              <button
                className="page-link"
                onClick={() => onPageChange(index + 1)}
              >
                {index + 1}
              </button>
            </li>
          ))}
  
          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <button
              className="page-link"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    );
  };

  // Extract intents data from evaluations for visualization
  const extractIntentsData = (evaluations) => {
    if (!evaluations || evaluations.length === 0) return [];
    
    const intentCounts = {};
    evaluations.forEach(evaluation => {
      // Check multiple possible paths for intent data
      let intents = [];
      
      if (evaluation.intent && Array.isArray(evaluation.intent)) {
        intents = evaluation.intent;
      } else if (evaluation.intent) {
        intents = [evaluation.intent];
      } else if (evaluation.evaluation && evaluation.evaluation.intent) {
        if (Array.isArray(evaluation.evaluation.intent)) {
          intents = evaluation.evaluation.intent;
        } else {
          intents = [evaluation.evaluation.intent];
        }
      }
      
      // Count each intent
      intents.forEach(intent => {
        if (intent && typeof intent === 'string') {
          intentCounts[intent] = (intentCounts[intent] || 0) + 1;
        }
      });
    });
    
    return Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  };

  // Extract QA form counts
  const extractFormData = (evaluations) => {
    if (!evaluations || evaluations.length === 0) return [];
    
    const formCounts = {};
    evaluations.forEach(evaluation => {
      // Try different possible paths for the form name
      const formName = evaluation.qaFormName || 
                       (evaluation.evaluation && evaluation.evaluation.qaFormName) || 
                       (evaluation.qaForm && evaluation.qaForm.name) || 
                       'Unknown';
      formCounts[formName] = (formCounts[formName] || 0) + 1;
    });
    
    return Object.entries(formCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  };
  
  const formatDurationHumanReadable = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = '';
    
    if (hours > 0) {
      result += `${hours} ${hours === 1 ? 'hr' : 'hrs'} `;
    }
    
    if (minutes > 0 || hours > 0) {
      result += `${minutes} ${minutes === 1 ? 'min' : 'mins'} `;
    }
    
    if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) {
      result += `${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
    }
    
    return result.trim();
  };
  
  const fetchData = useCallback(async () => {
    try {
      // Only proceed if a form is selected when multiple forms exist
      if (!selectedFilters.formId && forms.length > 1) {
        setMetrics(null);
        setLoading(false);
        return;
      }
  
      // Start loading
      setLoading(true);
      setError(null);
  
      // Prepare query parameters
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(selectedFilters).forEach(([key, value]) => {
        // Handle different types of filter values
        if (value) {
          if (key === 'selectedForm' && value.value) {
            // Special handling for form selection
            queryParams.append('formId', value.value);
          } else if (typeof value === 'object' && value.value) {
            // Handle Select component values
            queryParams.append(key, value.value);
          } else if (typeof value === 'string' || typeof value === 'number') {
            // Handle standard input values
            queryParams.append(key, value);
          }
        }
      });
  
      // Fetch data in parallel
      const [filtersResponse, metricsResponse, formsResponse] = await Promise.all([
        fetch('/api/dashboard/filters', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch(`/api/dashboard/metrics?${queryParams}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch('/api/qa-forms', {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('token')}` 
          }
        })
      ]);
  
      // Check for successful responses
      if (!filtersResponse.ok || !metricsResponse.ok || !formsResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
  
      // Parse responses
      const [filtersData, metricsData, formsData] = await Promise.all([
        filtersResponse.json(),
        metricsResponse.json(),
        formsResponse.json()
      ]);
  
      // Log raw metrics for debugging
      console.log('Raw Metrics Data:', metricsData);  
  
      // Determine the form to select
      const formToSelect = 
        selectedFilters.selectedForm || 
        (formsData.length === 1 
          ? { 
              value: formsData[0]._id, 
              label: formsData[0].name 
            } 
          : null);
  
      // Update state
      setFilters(prev => ({ 
        ...(prev || {}), 
        ...filtersData, 
        selectedForm: formToSelect
      }));
  
      setSelectedFilters(prev => ({
        ...prev,
        formId: formToSelect ? formToSelect.value : null,
        selectedForm: formToSelect
      }));
  
      setMetrics(metricsData);
      setForms(formsData);
  
    } catch (err) {
      // Handle and log any errors
      console.error('Dashboard error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      // Ensure loading state is updated
      setLoading(false);
      setFormsLoading(false);
    }
  }, [selectedFilters, forms.length]);
  
  const handleFilterChange = (name, value) => {
    setSelectedFilters(prevFilters => {
      const updatedFilters = { ...prevFilters };
      
      if (value && value.target) {
        // Standard input event
        const { name: inputName, value: inputValue } = value.target;
        updatedFilters[inputName] = inputValue;
      } else if (name === 'selectedForm') {
        // Select component for form
        updatedFilters.formId = value ? value.value : null;
        updatedFilters.selectedForm = value;
      } else {
        // Direct value assignment
        updatedFilters[name] = value;
      }
  
      return updatedFilters;
    });
  
    // Move fetchData outside of setSelectedFilters
    fetchData();
  };
  
  // Update useEffect to depend on specific values
  useEffect(() => {
    fetchData();
  }, [
    selectedFilters.agentId, 
    selectedFilters.queueId, 
    selectedFilters.startDate, 
    selectedFilters.endDate, 
    selectedFilters.formId
  ]);

  /*useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (e) => {
    console.log(e)
    const { name, value } = e.target;
    setSelectedFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };*/

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center my-5">
        <div className="alert alert-danger">
          <h4>Error Loading Dashboard</h4>
          <p>{error}</p>
          <button 
            className="btn btn-outline-danger"
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Get customer sentiment (default to N/A if not available)
  const customerSentiment = metrics?.qa?.averageCustomerSentiment || 'N/A';
  const agentSentiment = metrics?.qa?.agentSentiment?.[0] || 'neutral';
  
  // Check if evaluations exist
  const hasEvaluations = metrics?.qa?.recentEvaluations?.length > 0;

  return (
    <div className="container-fluid py-4">
      <WelcomeTourDialog />
      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Filters</h5>
          {!filters.selectedForm && forms.length > 1 && !loading && (
            <div className="alert alert-info">
              <div className="d-flex align-items-center">
                <i className="bi bi-info-circle me-2"></i>
                <div>Please select a QA Form to run the Dashboard.</div>
              </div>
            </div>
          )}
          <div className="row g-3">
            <div className="col-md-3">
              <select 
                className="form-select"
                name="agentId"
                value={selectedFilters.agentId}
                onChange={(e) => handleFilterChange('agentId', e)}
              >
                <option value="">All Agents</option>
                {filters?.agents?.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <select
                className="form-select"
                name="queueId"
                value={selectedFilters.queueId}
                //onChange={handleFilterChange}
                onChange={(e) => handleFilterChange('queueId', e)}
              >
                <option value="">All Queues</option>
                {filters?.queues?.map(queue => (
                  <option key={queue.id} value={queue.id}>
                    {queue.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                name="startDate"
                value={selectedFilters.startDate}
                //onChange={handleFilterChange}
                onChange={(e) => handleFilterChange('startDate', e)}
              />
            </div>

            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                name="endDate"
                value={selectedFilters.endDate}
                //onChange={handleFilterChange}
                onChange={(e) => handleFilterChange('endDate', e)}
              />
            </div>

            <div className="col-md-6">
              <Select
                options={forms.map(form => ({
                  value: form._id,
                  label: form.name
                }))}
                value={selectedFilters.selectedForm}
                onChange={(selected) => handleFilterChange('selectedForm', selected)}
                isDisabled={formsLoading || forms.length === 1}
                isClearable={forms.length > 1}
                placeholder={formsLoading ? "Loading forms..." : "Select QA Form"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="row mb-2">
        <StatsCard
          title="Total Evaluations"
          value={metrics?.qa?.totalEvaluations || 0}
          icon={<i className="bi bi-file-earmark-text fs-4"></i>}
        />
        <StatsCard
          title="Average Score"
          value={metrics?.qa?.totalScore || 0}
          icon={<i className="bi bi-graph-up fs-4"></i>}
          bgColor="bg-success"
        />
        <StatsCard
          title="Customer Sentiment"
          value={customerSentiment}
          icon={<SentimentIcon sentiment={customerSentiment} size={24} />}
          bgColor="bg-info"
        />
        <StatsCard
          title="Agent Sentiment"
          value={agentSentiment}
          icon={<SentimentIcon sentiment={agentSentiment} size={24} />}
          bgColor="bg-secondary"
        />
      </div>

      {/* Performance Cards */}
      <div className="row mb-2">
        <div className="col-md-6">
          <div className="card mb-2">
            <div className="card-header bg-white">
              <h5 className="card-title mb-0">Best Performer</h5>
            </div>
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h4 className="mb-1">{metrics?.qa?.bestPerformer?.name || 'N/A'}</h4>
                  <div className="d-flex align-items-center">
                    <div className="badge bg-success me-2">
                      Score: {metrics?.qa?.bestPerformer?.averageScore || 0}
                    </div>
                    <small className="text-muted">
                      {metrics?.qa?.bestPerformer?.evaluationCount || 0} evaluations
                    </small>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="avatar rounded-circle p-3 bg-success bg-opacity-10">
                    <i className="bi bi-trophy text-success fs-4"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="card mb-2">
            <div className="card-header bg-white">
              <h5 className="card-title mb-0">Needs Improvement</h5>
            </div>
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h4 className="mb-1">{metrics?.qa?.poorPerformer?.name || 'N/A'}</h4>
                  <div className="d-flex align-items-center">
                    <div className="badge bg-danger me-2">
                      Score: {metrics?.qa?.poorPerformer?.averageScore || 0}
                    </div>
                    <small className="text-muted">
                      {metrics?.qa?.poorPerformer?.evaluationCount || 0} evaluations
                    </small>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="avatar rounded-circle p-3 bg-danger bg-opacity-10">
                    <i className="bi bi-graph-down text-danger fs-4"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Score Highlight Cards */}
      <div className="row mb-2">
        <div className="col-md-6">
          <div className="card mb-2">
            <div className="card-header bg-white">
              <h5 className="card-title mb-0">Highest Score</h5>
            </div>
            <div className="card-body">
              {metrics?.qa?.highestScore ? (
                <div>
                  <h3 className="text-success">{metrics.qa.highestScore.percentage}%</h3>
                  <p className="mb-1">Agent: {metrics.qa.highestScore.agent}</p>
                  <p className="mb-1">Score: {metrics.qa.highestScore.score} / {metrics.qa.highestScore.maxScore}</p>
                  <small className="text-muted">
                    {new Date(metrics.qa.highestScore.date).toLocaleDateString()}
                  </small>
                </div>
              ) : (
                <p className="text-muted mb-0">No data available</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="card mb-2">
            <div className="card-header bg-white">
              <h5 className="card-title mb-0">Lowest Score</h5>
            </div>
            <div className="card-body">
              {metrics?.qa?.lowestScore ? (
                <div>
                  <h3 className="text-danger">{metrics.qa.lowestScore.percentage}%</h3>
                  <p className="mb-1">Agent: {metrics.qa.lowestScore.agent}</p>
                  <p className="mb-1">Score: {metrics.qa.lowestScore.score} / {metrics.qa.lowestScore.maxScore}</p>
                  <small className="text-muted">
                    {new Date(metrics.qa.lowestScore.date).toLocaleDateString()}
                  </small>
                </div>
              ) : (
                <p className="text-muted mb-0">No data available</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Call Intents and QA Forms Row */}
      <div className="row mb-2">
        <div className="col-md-6">
          <IntentsChart data={metrics?.qa?.intentData} />
        </div>
        <div className="col-md-6">
          <QAFormsChart data={metrics?.qa?.formData} />
        </div>
      </div>

      {/* Parameter Analysis */}
      {metrics?.qa?.parameterAnalysis?.length > 0 && (
        <>
          <h5 className="mb-3">Evaluation Parameters</h5>
          <div className="row">
            {metrics.qa.parameterAnalysis.map((param, index) => {
              const excludeParams = ["TotalScore", "Total Score", "Score each parameter from 0 to 5"];
              
              if (excludeParams.includes(param.parameter)) return null;
              
              return (
                <ParameterScoreCard
                  key={index}
                  parameter={param.parameter}
                  averageScore={param.averageScore}
                  count={param.count || metrics.qa.totalEvaluations}
                  coverage={param.coverage || 100}
                />
              );
            })}
          </div>
          
          {/* Bar Chart */}
          <ParameterBarChart 
            parameters={metrics.qa.parameterAnalysis}
            dateRange={metrics.qa.dateRange}
          />
        </>
      )}

      <div className="row mb-2">
        {/* Areas of Improvement Section */}
        <div className="col-md-6">
          <AreasOfImprovement areas={metrics?.qa?.areasNeedingFocus || metrics?.areasNeedingFocus} />
        </div>
        
        {/* Agent Strengths Section */}
        <div className="col-md-6">
          <AgentStrengths strengths={metrics?.qa?.whatTheAgentDidWell} />
        </div>
      </div>

      {/* Agent Performance Chart */}
      <AgentPerformanceChart data={metrics?.qa?.agentPerformance} />

      {/* Recent Evaluations */}
      {metrics?.qa?.recentEvaluations?.length > 0 && (
        <div className="card">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Recent Evaluations</h5>
            <div className="text-muted small">
              Showing {Math.min(itemsPerPage * currentPage, metrics.qa.recentEvaluations.length)} of {metrics.qa.recentEvaluations.length}
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Agent</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Caller ID</th>
                  <th>Duration</th>
                  <th>Evaluator</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {metrics.qa.recentEvaluations
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map(evaluation => (
                    <tr key={evaluation.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar-xs me-2">
                            <span className="avatar-title rounded-circle bg-primary bg-soft text-primary">
                              {evaluation.agent?.name?.charAt(0) || 'A'}
                            </span>
                          </div>
                          <span>{evaluation.agent?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <div className={`badge bg-${
                          evaluation.scorePerc >= 90 ? 'success' : 
                          evaluation.scorePerc >= 70 ? 'warning' : 'danger'
                        }`}>
                          {evaluation.score || 0}
                          {evaluation.maxScore ? ` / ${evaluation.maxScore}` : ''}
                        </div>
                      </td>
                      <td>{format(new Date(evaluation.createdAt), 'MMM d, yyyy')}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          {evaluation.direction === '0' || evaluation.direction === 0 ? (
                            <PhoneIncoming size={16} className="text-success me-2" title="Incoming Call" />
                          ) : (
                            <PhoneOutgoing size={16} className="text-primary me-2" title="Outgoing Call" />
                          )}
                          <span>{evaluation.caller?.id || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        {formatDurationHumanReadable(evaluation?.duration || 0)}
                      </td>
                      <td>
                        <small className="text-muted">
                          Evaluated by: {evaluation.evaluator?.name || 'AI System'}
                        </small>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/evaluation/${evaluation.id}`)}
                          className="btn btn-sm btn-outline-primary"
                        >
                          <i className="bi bi-eye me-1"></i>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer bg-white">
            <Pagination
              totalItems={metrics.qa.recentEvaluations.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Define CSS class for avatar styling
const avatarStyle = `
.avatar {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-success-light {
  background-color: rgba(25, 135, 84, 0.15);
}

.bg-danger-light {
  background-color: rgba(220, 53, 69, 0.15);
}

.bg-info-light {
  background-color: rgba(13, 202, 240, 0.15);
}

.avatar-xs {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.avatar-title {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

/* Ensure charts are compact */
.chart-container-sm {
  height: 200px !important;
  max-height: 200px !important;
}

/* Text truncation for long text */
.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;

export { ParameterScoreCard, ParameterBarChart };
export default Dashboard;