// src/pages/CriteriaProfiles/CriteriaEditor.js - Updated with scheduler
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Select from 'react-select';
import { api } from '../../services/api';
import _ from 'lodash';
import SchedulerSettings from '../../components/scheduler/SchedulerSettings';

export default function CriteriaEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [queues, setQueues] = useState([]);
  const [agents, setAgents] = useState([]);
  const [workCodeCategories, setWorkCodeCategories] = useState([]);
  const [workCodesByCategory, setWorkCodesByCategory] = useState({});
  const [qaForms, setQaForms] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    queues: [],
    workCodes: [],
    agents: [],
    minCallDuration: 0,
    direction: 'all',
    evaluationForm: null,
    isActive: true,
    scheduler: {
      enabled: false,
      cronExpression: '0 17 * * *', // Default to 5:00 PM daily
      maxEvaluations: 50,
      evaluatorId: 'system',
      evaluatorName: 'Automated System'
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [queuesData, agentsData, formsData, categoriesData, workCodesData] = await Promise.all([
          api.getQueues(),
          api.getAgents(),
          api.getQAForms(),
          api.getWorkCodeCategories(),
          api.getWorkCodes()
        ]);

        console.log('Fetched Data:', {
          queues: queuesData,
          agents: agentsData,
          workCodes: workCodesData
        });

        setQueues(queuesData);
        setAgents(agentsData);
        setQaForms(formsData);
        setWorkCodeCategories(categoriesData);
        
        const groupedCodes = _.groupBy(workCodesData, 'category_id');
        setWorkCodesByCategory(groupedCodes);

        if (id) {
          const profileData = await api.getCriteriaProfile(id);
          setFormData(profileData);
        }
      } catch (error) {
        console.error('Fetch error:', error);
        setError('Failed to load required data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
        name: formData.name,
        description: formData.description,
        queues: formData.queues.map(q => ({
            queueId: q.queueId || q.id,  // Handle both create and update cases
            queueName: q.queueName || q.name
        })),
        agents: formData.agents.map(a => ({
            agentId: a.agentId || a.id,  // Handle both create and update cases
            agentName: a.agentName || a.name
        })),
        workCodes: formData.workCodes.map(w => ({
            code: w.code || w.id,  // Handle both create and update cases
            description: w.description || w.name
        })),
        minCallDuration: formData.minCallDuration,
        direction: formData.direction,
        evaluationForm: formData.evaluationForm,
        isActive: formData.isActive,
        scheduler: formData.scheduler // Include scheduler settings
    };
  
    console.log('Submitting payload:', payload);
    
    try {
      setSaving(true);
      setError(null);
  
      const method = id ? 'updateCriteriaProfile' : 'createCriteriaProfile';
      if(id){
        await api[method](id, payload);
      }
      else{
        await api[method](payload);
      }
      
      navigate('/criteria');
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSchedulerChange = (schedulerData) => {
    setFormData(prev => ({
      ...prev,
      scheduler: {
        ...schedulerData,
        // Add profile ID for API calls if we're editing
        profileId: id || undefined
      }
    }));
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex align-items-center mb-4">
        <button 
          className="btn btn-link p-0 me-3"
          onClick={() => navigate('/criteria')}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="h3 mb-0">{id ? 'Edit Profile' : 'New Criteria Profile'}</h1>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Profile Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Queues</label>
                <Select
                  isMulti
                  options={queues
                    .filter(q => !formData.queues.some(selected => selected.queueId === q.id.toString()))
                    .map(q => ({
                      value: q.id,
                      label: q.name
                    }))}
                  value={formData.queues.map(q => ({
                    value: q.queueId,
                    label: q.queueName
                  }))}
                  onChange={(selected) => {
                    setFormData(prev => ({
                      ...prev,
                      queues: selected.map(s => ({
                        queueId: s.value,
                        queueName: s.label
                      }))
                    }));
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Agents</label>
                <Select
                  isMulti
                  options={agents
                    .filter(a => !formData.agents.some(selected => selected.agentId === a.id.toString()))
                    .map(a => ({
                      value: a.id,
                      label: a.name
                    }))}
                  value={formData.agents.map(a => ({
                    value: a.agentId,
                    label: a.agentName
                  }))}
                  onChange={(selected) => {
                    setFormData(prev => ({
                      ...prev,
                      agents: selected.map(s => ({
                        agentId: s.value,
                        agentName: s.label
                      }))
                    }));
                  }}
                />
              </div>

              <div className="col-12">
                <label className="form-label">Work Codes</label>
                <Select
                  isMulti
                  options={workCodeCategories.map(category => ({
                    label: category.name,
                    options: (workCodesByCategory[category.id] || [])
                      .filter(code => !formData.workCodes.some(selected => selected.code === code.id.toString()))
                      .map(code => ({
                        value: code.id,
                        label: code.name
                      }))
                  }))}
                  value={formData.workCodes.map(wc => ({
                    value: wc.code,
                    label: wc.description
                  }))}
                  onChange={(selected) => {
                    setFormData(prev => ({
                      ...prev,
                      workCodes: selected.map(s => ({
                        code: s.value,
                        description: s.label
                      }))
                    }));
                  }}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Direction</label>
                <select
                  className="form-select"
                  value={formData.direction}
                  onChange={(e) => setFormData(prev => ({ ...prev, direction: e.target.value }))}
                >
                  <option value="all">All</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Min Call Duration (seconds)</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  value={formData.minCallDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, minCallDuration: parseInt(e.target.value) }))}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Evaluation Form</label>
                <Select
                  options={qaForms.map(f => ({
                    value: f._id,
                    label: f.name
                  }))}
                  value={formData.evaluationForm ? {
                    value: formData.evaluationForm.formId,
                    label: formData.evaluationForm.formName
                  } : null}
                  onChange={(selected) => setFormData(prev => ({
                    ...prev,
                    evaluationForm: selected ? {
                      formId: selected.value,
                      formName: selected.label
                    } : null
                  }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scheduler Settings */}
        <SchedulerSettings 
          value={{
            ...formData.scheduler,
            profileId: id // Pass profile ID for API calls
          }}
          onChange={handleSchedulerChange}
          isNewProfile={!id}
        />

        <div className="d-flex justify-content-end gap-2">
          <button 
            type="button" 
            className="btn btn-outline-secondary"
            onClick={() => navigate('/criteria')}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Saving...
              </>
            ) : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}