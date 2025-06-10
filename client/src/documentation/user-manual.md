# AIQA: AI Quality Assessment System
## User Manual

## Table of Contents
- [Introduction](#introduction)
- [Getting Started](#getting-started)
  - [Logging In](#logging-in)
  - [User Interface Overview](#user-interface-overview)
  - [Navigation Menu](#navigation-menu)
  - [Interactive Tour](#interactive-tour)
- [Dashboard](#dashboard)
  - [Overview](#overview)
  - [Performance Metrics Cards](#performance-metrics-cards)
  - [Filter Options](#filter-options)
  - [Performance Metrics](#performance-metrics)
- [QA Evaluations](#qa-evaluations)
  - [Viewing Recent Evaluations](#viewing-recent-evaluations)
  - [Evaluation Details](#evaluation-details)
- [New Evaluations](#new-evaluations)
  - [Search Criteria](#search-criteria)
  - [Running Evaluations](#running-evaluations)
  - [Queue Monitor](#queue-monitor)
- [QA Forms](#qa-forms)
  - [Creating Forms](#creating-forms)
  - [Editing Forms](#editing-forms)
  - [Deleting Forms](#deleting-forms)
- [QA Criteria Profiles](#qa-criteria-profiles)
  - [Creating Profiles](#creating-profiles)
  - [Profile Settings](#profile-settings)
- [Scheduler](#scheduler)
  - [Scheduling Automated Evaluations](#scheduling-automated-evaluations)
  - [Manual Runs](#manual-runs)
  - [Scheduler History](#scheduler-history)
- [Agent Comparison](#agent-comparison)
  - [Comparing Agent Performance](#comparing-agent-performance)
  - [Parameter Analysis](#parameter-analysis)
- [Agent Coaching](#agent-coaching)
  - [Agent Performance Insights](#agent-performance-insights)
  - [Coaching Plans](#coaching-plans)
- [Trend Analysis](#trend-analysis)
  - [Data Visualization](#data-visualization)
  - [Time Periods](#time-periods)
- [Export Reports](#export-reports)
  - [Report Types](#report-types)
  - [Export Options](#export-options)
- [Group Management](#group-management)
  - [Creating Groups](#creating-groups)
  - [Managing User Access](#managing-user-access)
  - [Permissions](#permissions)
- [Billing & Usage](#billing--usage)
  - [Usage Statistics](#usage-statistics)
  - [Credit Management](#credit-management)
  - [Transaction History](#transaction-history)
- [System Settings](#system-settings)
  - [User Profile](#user-profile)
  - [Changing Password](#changing-password)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Contact Support](#contact-support)

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
- **Billing & Usage**: View usage statistics and manage credits

### Interactive Tour

AIQA includes an interactive tour to help you get familiar with the system:

1. **First-time Login**: The tour automatically starts on your first login to the dashboard.
2. **Tour Navigation**: Use the "Next" and "Back" buttons to navigate through the tour steps.
3. **Skip Option**: You can skip the tour at any time by clicking "Skip Tour" or the X button.
4. **Page-Specific Tours**: Different pages have specialized tours focusing on their specific features.
5. **Restart Tours**: You can restart any tour by clicking your profile icon and selecting "Restart Tours."

**Note**: Tours are designed to run on specific pages. The dashboard tour only runs on the dashboard, the scheduler tour only on the scheduler page, etc. If a tour step cannot find its target element, it will automatically skip to the next available step.

## Dashboard

### Overview

The Dashboard provides a bird's-eye view of your quality assurance program. It displays key metrics, agent performance statistics, and recent evaluation results.

### Performance Metrics Cards

The dashboard features several performance metric cards that provide at-a-glance insights:

1. **Overall QA Score**:
   - Shows your average evaluation score
   - Includes trend indicators comparing to previous periods
   - Color-coded to quickly identify performance levels

2. **Customer Sentiment**:
   - Displays percentage of positive sentiment interactions
   - Shows breakdown of positive/neutral/negative sentiment ratios
   - Tracks sentiment trends over time

3. **Evaluation Completion**:
   - Shows progress toward evaluation targets
   - Indicates completion percentage against goals
   - Helps track quality assurance coverage

4. **Areas Needing Focus**:
   - Identifies critical improvement areas
   - Highlights most common issues across evaluations
   - Prioritizes areas for agent coaching

5. **Agent Performance Spread**:
   - Shows distribution of agent performance scores
   - Helps identify performance gaps across your team
   - Indicates overall team consistency

Each card provides visual indicators through colors and icons to quickly communicate status, and many include sparkline charts showing recent trends.

### Filter Options

You can filter the dashboard data by:

- **Date Range**: Select specific start and end dates
- **Agent**: Filter by specific agent
- **Queue**: Filter by specific call queue
- **QA Form**: Filter by evaluation form type

To apply filters:

1. Select your desired filters from the dropdown menus
2. The dashboard will automatically update to reflect your selections

### Performance Metrics

The dashboard displays several key performance indicators:

- **Total Evaluations**: Number of evaluations completed
- **Average Score**: Overall average evaluation score
- **Customer Sentiment**: Average customer sentiment (positive, neutral, negative)
- **Agent Sentiment**: Average agent sentiment
- **Best Performer**: Agent with highest evaluation scores
- **Needs Improvement**: Agent with lowest evaluation scores
- **Parameter Analysis**: Scores broken down by evaluation criteria
- **Areas Needing Focus**: Common improvement areas identified
- **Recent Evaluations**: Latest evaluations with quick access links

## QA Evaluations

### Viewing Recent Evaluations

The QA Evaluations page shows a list of all completed evaluations. You can:

1. Filter evaluations by date range, agent, queue, or form type
2. Sort evaluations by various criteria
3. Navigate between pages of evaluation results
4. View detailed information for each evaluation

### Evaluation Details

Clicking "View Details" for any evaluation opens the detailed view, which includes:

- **Overall Score**: The evaluation's total score
- **Agent & Customer Information**: Details about the participants
- **Sentiment Analysis**: Sentiment tracking throughout the interaction
- **Call Summary**: AI-generated summary of the interaction
- **Parameter Scores**: Breakdown of scores by evaluation criteria
- **Areas of Improvement**: Identified improvement opportunities
- **Agent Strengths**: Positive aspects of the agent's performance
- **Transcription**: Full conversation transcript with sentiment analysis
- **Call Recording**: Audio playback of the interaction (if available)

## New Evaluations

### Search Criteria

To create new evaluations:

1. Navigate to the New Evaluations page
2. Set your search criteria:
   - **Date Range**: The period to search for interactions
   - **Criteria Profile**: (Optional) Pre-configured search settings
   - **Queues**: Specific queues to include
   - **Agents**: Specific agents to include
   - **Duration**: Minimum/maximum call duration
   - **Work Codes**: Specific work codes to filter by
   - **QA Form**: Evaluation form to use
3. Click "Search Interactions" to find matching calls

### Running Evaluations

After finding interactions:

1. Select the interactions you want to evaluate (use checkboxes)
2. Click "Run Evaluations" to start the process
3. The system will queue the evaluations for processing
4. You'll be notified when evaluations are complete

### Queue Monitor

The Queue Monitor page allows you to:

1. View the status of all evaluation jobs
2. See which evaluations are queued, in progress, completed, or failed
3. Access results of completed evaluations
4. Monitor the progress of ongoing evaluations

## QA Forms

### Creating Forms

QA Forms define the criteria and scoring system for evaluations:

1. Navigate to the QA Forms page
2. Click "New Form"
3. Enter form details:
   - **Name**: A descriptive name for the form
   - **Description**: (Optional) Additional information
   - **Status**: Active or Inactive
4. Add parameters (evaluation criteria):
   - **Parameter Name**: Name of the criterion
   - **Max Score**: Maximum points possible (typically 5)
   - **Scoring Type**: Binary (0 or max) or Variable (any value between)
   - **Context**: Instructions for evaluating this criterion
   - **AI Context Generator**: Click to automatically generate context based on parameter name
5. Click "Save Form" to create the form

### Editing Forms

To modify an existing form:

1. Navigate to the QA Forms page
2. Find the form you want to edit
3. Click the "Edit" button
4. Make your changes to the form details or parameters
5. Click "Save Form" to update the form

### Deleting Forms

To delete a form:

1. Navigate to the QA Forms page
2. Find the form you want to delete
3. Click the "Delete" button
4. Confirm the deletion

**Note**: Deleting a form will not affect existing evaluations that used this form, but the form will no longer be available for new evaluations.

## QA Criteria Profiles

### Creating Profiles

Criteria Profiles help you quickly apply common search filters for evaluations:

1. Navigate to the QA Criteria page
2. Click "New Profile"
3. Enter profile details:
   - **Profile Name**: A descriptive name
   - **Description**: (Optional) Additional information
   - **Status**: Active or Inactive
4. Configure search criteria:
   - **Queues**: Select applicable queues
   - **Agents**: Select applicable agents
   - **Work Codes**: Select relevant work codes
   - **Direction**: Inbound, outbound, or all
   - **Min Call Duration**: Minimum call length in seconds
   - **Evaluation Form**: Form to use for evaluations
5. Click "Save Profile" to create the profile

### Profile Settings

Profiles can be:

- **Active or Inactive**: Only active profiles are available for selection
- **Used for Scheduling**: Profiles can be used for automated evaluations
- **Edited or Deleted**: Manage profiles as needed from the QA Criteria page

## Scheduler

### Scheduling Automated Evaluations

The Scheduler allows you to set up automated, periodic evaluations:

1. Navigate to the QA Criteria page
2. Edit the profile you want to schedule
3. In the Scheduler Settings section:
   - Enable the scheduler
   - Select a schedule (e.g., daily at 5:00 PM)
   - Set maximum evaluations per run
4. Save the profile to activate the schedule

### Manual Runs

You can manually run scheduled evaluations:

1. Navigate to the Scheduler page
2. Find the profile you want to run
3. Click the "Run Now" button
4. Set the number of evaluations to process
5. Click "Run Now" to start the process

### Scheduler History

The Scheduler page shows:

- Status of all scheduled profiles
- Last run time and status
- Number of interactions found and processed
- History of previous runs

## Agent Comparison

### Comparing Agent Performance

The Agent Comparison page allows you to:

1. Select specific agents to compare
2. Filter by date range and other criteria
3. View side-by-side performance metrics
4. Analyze differences in evaluation scores

### Parameter Analysis

The comparison includes:

- Overall scores by agent
- Parameter-specific scores
- Sentiment analysis comparison
- Areas of improvement by agent
- Evaluation counts and other metrics

## Agent Coaching

### Agent Performance Insights

The Agent Coaching page provides:

1. Overall performance metrics for the selected agent
2. Strengths and areas for improvement
3. Parameter scores broken down by evaluation criteria
4. Sentiment trends over time

### Coaching Plans

Based on the performance data, the system suggests:

1. Focus areas for coaching
2. Specific action items for improvement
3. Follow-up recommendations
4. Performance trends to monitor

## Trend Analysis

### Data Visualization

The Trend Analysis page offers:

1. Score trends over time
2. Evaluation volume analysis
3. Sentiment trends
4. Parameter score changes over time

### Time Periods

You can analyze trends across different time periods:

- **Daily**: Day-by-day analysis
- **Weekly**: Week-over-week trends
- **Monthly**: Month-over-month performance

## Export Reports

### Report Types

AIQA offers two main report types:

1. **Evaluations Export**: Detailed export of all evaluations with scores, sentiments, and analysis
2. **Agent Performance Report**: Aggregated metrics by agent, including average scores and areas for improvement

### Export Options

When exporting reports, you can:

1. Select a specific date range
2. Filter by agent, queue, or QA form
3. Include specific parameters in the export
4. Download as CSV format compatible with Excel

## Group Management

### Creating Groups

Groups help organize users and permissions:

1. Navigate to the Group Management page
2. Click "New Group"
3. Enter group details:
   - **Group Name**: A descriptive name
   - **Description**: (Optional) Additional information
4. Configure permissions
5. Click "Save Group" to create the group

### Managing User Access

To manage users in a group:

1. Navigate to the Group Management page
2. Find the group you want to manage
3. Click "Manage Users"
4. Add or remove users as needed

### Permissions

Permissions control what actions users can perform:

- **Dashboard**: Access to dashboard and analytics
- **QA Forms**: Ability to view and manage forms
- **QA Criteria**: Ability to view and manage criteria profiles
- **Evaluations**: Access to view and create evaluations
- **Reports**: Access to export and view reports
- **And more**: Additional module-specific permissions

## Billing & Usage

### Usage Statistics

The Billing & Usage page provides detailed information about your system usage:

1. **Usage Overview**:
   - Total evaluations processed
   - Total tokens used
   - Total call duration processed
   - Cost breakdown by service

2. **Filtering Options**:
   - Select specific date ranges for analysis
   - Export CSV reports of usage data

3. **Detailed Breakdowns**:
   - Usage by agent
   - Usage by queue
   - Daily usage statistics

### Credit Management

The Credit Management section allows you to:

1. **View Credit Balance**:
   - Current credit balance
   - Low balance warnings
   - Usage statistics

2. **View Transaction History**:
   - List of all credit transactions
   - Filter by date range
   - Export transaction history

## System Settings

### User Profile

To view or update your profile:

1. Click on your username in the top-right corner
2. Select "Profile" from the dropdown menu
3. View or edit your profile information

### Changing Password

To change your password:

1. Click on your username in the top-right corner
2. Select "Change Password" from the dropdown menu
3. Enter your current password
4. Enter and confirm your new password
5. Click "Change Password" to save changes

## Troubleshooting

### Common Issues

**Session Timeout**:
- If your session times out due to inactivity, you'll see a session timeout dialog
- Enter your password to continue without losing your work
- Or click "Cancel" to return to the login page

**Tour Navigation Issues**:
- If the tour gets stuck or can't find elements, click "Skip Tour"
- You can restart tours from your profile menu
- Different tours are available on different pages

**Loading Issues**:
- If data fails to load, try refreshing the page
- Check your internet connection
- Ensure you have the necessary permissions

### Contact Support

If you encounter issues that you cannot resolve:

1. Click on your username in the top-right corner
2. Select "Help & Support"
3. Fill out the support form with details about your issue
4. Or email support directly at support@intellicon.io

---

This user manual provides a comprehensive overview of the AIQA system. For more detailed information on specific features or for assistance with advanced configurations, please contact your system administrator.