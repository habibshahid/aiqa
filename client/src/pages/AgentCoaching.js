// src/pages/AgentCoaching.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const AgentCoaching = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchInsights();
  }, [agentId, dateRange]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }).toString();
      
      const response = await fetch(`/api/coaching/agent/${agentId}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch coaching insights');
      }
      
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Error fetching coaching insights:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="alert alert-danger m-3">
        <h4>Error</h4>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchInsights}>Retry</button>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">{insights?.agentName || 'Agent'} - Coaching Insights</h2>
          <p className="text-muted">Based on {insights?.totalEvaluations || 0} evaluations</p>
        </div>
        
        <div className="d-flex gap-3">
          <input
            type="date"
            className="form-control"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          />
          <input
            type="date"
            className="form-control"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          />
          <button className="btn btn-outline-primary" onClick={() => navigate('/agent-comparison')}>
            Back to Comparison
          </button>
        </div>
      </div>
      
      {insights && (
        <>
          {/* Overall Score Card */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row">
                <div className="col-md-3 text-center">
                  <h6 className="text-muted mb-2">Overall Score</h6>
                  <h2 className={`mb-0 ${
                    insights.avgScore >= 80 ? 'text-success' : 
                    insights.avgScore >= 60 ? 'text-warning' : 'text-danger'
                  }`}>
                    {Math.round(insights.avgScore)}%
                  </h2>
                </div>
                <div className="col-md-3 text-center">
                  <h6 className="text-muted mb-2">Total Evaluations</h6>
                  <h2 className="mb-0">{insights.totalEvaluations}</h2>
                </div>
                <div className="col-md-6">
                  <h6 className="text-muted mb-2">Coaching Recommendation</h6>
                  <p className="mb-0">
                    {insights.avgScore >= 80 
                      ? 'This agent is performing well. Consider additional responsibilities or mentorship opportunities.'
                      : insights.avgScore >= 60
                      ? 'This agent needs improvement in specific areas. Focus on targeted coaching.'
                      : 'This agent requires immediate attention and comprehensive training.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Parameter Scores Chart */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Performance by Parameter</h5>
            </div>
            <div className="card-body">
              <div style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={insights.parameters.slice(0, 10)} // Top 10 parameters
                    margin={{ top: 20, right: 30, left: 140, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 5]} />
                    <YAxis dataKey="parameter" type="category" width={120} />
                    <Tooltip 
                      formatter={(value) => [`${value.toFixed(2)} / 5`, 'Score']}
                    />
                    <Bar 
                      dataKey="avgScore" 
                      name="Score" 
                      fill="#8884d8" 
                      background={{ fill: '#eee' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3">
                <h6>Development Areas</h6>
                <ul className="list-group">
                  {insights.parameters.slice(0, 3).map((param, index) => (
                    <li key={index} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{param.parameter}</strong>
                          <div className="text-muted small">Average score: {param.avgScore.toFixed(2)} / 5</div>
                        </div>
                        <span className="badge bg-danger">Priority {index + 1}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          <div className="row">
            {/* Areas of Improvement */}
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title mb-0">Areas for Improvement</h5>
                </div>
                <div className="card-body">
                  {insights.improvementAreas.length > 0 ? (
                    <ul className="list-group">
                      {insights.improvementAreas.slice(0, 5).map((item, index) => (
                        <li key={index} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-center">
                            <span>{item.area}</span>
                            <span className="badge bg-danger rounded-pill">{item.count}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No improvement areas identified</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Strengths */}
            <div className="col-md-6">
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="card-title mb-0">Agent Strengths</h5>
                </div>
                <div className="card-body">
                  {insights.strengths.length > 0 ? (
                    <ul className="list-group">
                      {insights.strengths.slice(0, 5).map((item, index) => (
                        <li key={index} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-center">
                            <span>{item.strength}</span>
                            <span className="badge bg-success rounded-pill">{item.count}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No strengths identified</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Coaching Plan */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Suggested Coaching Plan</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Focus Area</th>
                      <th>Current Performance</th>
                      <th>Action Items</th>
                      <th>Follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.parameters.slice(0, 3).map((param, index) => (
                      <tr key={index}>
                        <td><strong>{param.parameter}</strong></td>
                        <td>
                          <div className={`badge ${
                            param.avgScore >= 4 ? 'bg-success' :
                            param.avgScore >= 3 ? 'bg-warning' : 'bg-danger'
                          }`}>
                            {param.avgScore.toFixed(2)} / 5
                          </div>
                        </td>
                        <td>
                          <ul className="mb-0">
                            <li>Review training materials on {param.parameter}</li>
                            <li>Listen to call examples with good practices</li>
                            <li>Role-play scenarios with supervisor</li>
                          </ul>
                        </td>
                        <td>Re-evaluate after 2 weeks</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AgentCoaching;