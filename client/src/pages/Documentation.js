// src/pages/Documentation.js
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug'; // Add this import
import remarkGfm from 'remark-gfm';

// Import your user manual markdown or use a string instead
// If the import isn't working, we'll use a fallback approach
import userManualContent from '../documentation/user-manual.md';

const Documentation = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to set the content directly
    try {
      setContent(userManualContent);
      setLoading(false);
    } catch (error) {
      console.error("Error loading markdown:", error);
      
      // Fallback: Try to fetch the markdown file
      fetch('/documentation/user-manual.md')
        .then(response => response.text())
        .then(text => {
          setContent(text);
          setLoading(false);
        })
        .catch(err => {
          console.error("Fallback fetch failed:", err);
          // If all else fails, use hardcoded content from the full user manual
          setContent(fallbackMarkdown);
          setLoading(false);
        });
    }
  }, []);

  // Add a function to generate TOC from markdown content
  const generateTOC = () => {
    // Basic TOC generation - this is a simplified approach
    return (
      <>
        <a className="nav-link" href="#introduction">Introduction</a>
        <a className="nav-link" href="#getting-started">Getting Started</a>
        <a className="nav-link ms-3" href="#logging-in">Logging In</a>
        <a className="nav-link ms-3" href="#user-interface-overview">User Interface Overview</a>
        <a className="nav-link ms-3" href="#navigation-menu">Navigation Menu</a>
        <a className="nav-link" href="#dashboard">Dashboard</a>
        <a className="nav-link" href="#qa-evaluations">QA Evaluations</a>
        <a className="nav-link" href="#new-evaluations">New Evaluations</a>
        <a className="nav-link" href="#qa-forms">QA Forms</a>
        <a className="nav-link" href="#qa-criteria-profiles">QA Criteria Profiles</a>
        <a className="nav-link" href="#scheduler">Scheduler</a>
        <a className="nav-link" href="#agent-comparison">Agent Comparison</a>
        <a className="nav-link" href="#agent-coaching">Agent Coaching</a>
        <a className="nav-link" href="#trend-analysis">Trend Analysis</a>
        <a className="nav-link" href="#export-reports">Export Reports</a>
        <a className="nav-link" href="#group-management">Group Management</a>
        <a className="nav-link" href="#system-settings">System Settings</a>
      </>
    );
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

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-md-3">
          {/* Table of Contents */}
          <div className="card sticky-top" style={{ top: '80px' }}>
            <div className="card-header">
              <h5 className="card-title mb-0">Contents</h5>
            </div>
            <div className="card-body">
              <nav id="toc" className="nav flex-column">
                {generateTOC()}
              </nav>
            </div>
          </div>
        </div>
        <div className="col-md-9">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">AIQA User Manual</h5>
            </div>
            <div className="card-body">
              <div className="markdown-body">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeSlug]}  // Add rehypeSlug here
                  remarkPlugins={[remarkGfm]}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Fallback markdown content in case loading fails
const fallbackMarkdown = `# AIQA: AI Quality Assessment System
## User Manual

## Introduction

AIQA (AI Quality Assessment) is an advanced system designed to automate the evaluation of call center interactions. This system leverages artificial intelligence to analyze call recordings, transcribe conversations, detect sentiments, and evaluate agent performance based on predefined quality criteria.

The platform offers comprehensive tools for quality management, including automated evaluations, scheduling, agent performance analysis, trend visualization, and customized reporting.

## Getting Started

### Logging In

1. Navigate to the AIQA login page
2. Enter your username and password
3. Click the "Login" button
4. For security reasons, your session may time out after a period of inactivity. If this happens, you'll be prompted to log in again.

### User Interface Overview

The AIQA interface is divided into several key areas:

- **Top Navigation Bar**: Displays the current page title, notification alerts, evaluation queue status, and user profile menu
- **Side Navigation Menu**: Provides access to different sections of the application
- **Main Content Area**: Shows the content of the selected section
- **Filter Panel**: Available on most pages to refine the displayed data

### Navigation Menu

The side menu provides access to these main sections:

- **Dashboard**: Overview of QA metrics and recent evaluations
- **QA Evaluations**: List of completed evaluations
- **New Evaluations**: Create new evaluations from call recordings
- **QA Forms**: Manage evaluation forms and criteria
- **QA Criteria**: Configure profiles for automated evaluations
- **Scheduler**: Schedule automated evaluations
- **Agent Comparison**: Compare performance across agents
- **Trend Analysis**: Analyze QA metrics over time
- **Export Reports**: Generate CSV reports for analysis
- **Group Management**: Manage user groups and permissions

## Dashboard

The Dashboard provides a bird's-eye view of your quality assurance program. It displays key metrics, agent performance statistics, and recent evaluation results.

<!-- Add more content as needed -->`;

export default Documentation;