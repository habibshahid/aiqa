# AIQA Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Backend Components](#backend-components)
3. [Frontend Components](#frontend-components)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Integration Points](#integration-points)
7. [Deployment Guide](#deployment-guide)
8. [Maintenance Tasks](#maintenance-tasks)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Security Considerations](#security-considerations)

## System Architecture

AIQA is built on a modern, scalable architecture designed for performance and reliability:

### Overview Diagram

```
┌─────────────────┐    ┌───────────────┐    ┌───────────────┐
│ React Frontend  │◄──►│  Express API  │◄──►│ MongoDB/MySQL │
└─────────────────┘    └───────┬───────┘    └───────────────┘
                                │
                           ┌────▼────┐      ┌───────────────┐
                           │  Redis  │◄────►│  Bull Queue   │
                           └────┬────┘      └───────────────┘
                                │
                      ┌─────────▼──────────┐
                      │  External Services │
                      │  - Deepgram STT    │
                      │  - AI Evaluation   │
                      └────────────────────┘
```

### Key Components

- **Frontend**: React SPA with Bootstrap styling
- **Backend**: Node.js/Express REST API
- **Databases**: 
  - MongoDB for interaction data and QA evaluations
  - MySQL for user management and authentication
- **Queuing**: Redis-backed Bull queue for async processing
- **External integrations**: 
  - Deepgram for speech-to-text
  - AI services for evaluation

### Authentication Flow

1. JWT-based authentication with token fingerprinting
2. Token blacklisting for secure logouts
3. Session timeout detection and reauthorization
4. Permission-based access control

## Backend Components

### Core Services

#### QA Processor Service (`qaProcessor.js`)
Handles the complete evaluation flow:
1. Downloads call recordings from source
2. Processes audio through Deepgram for transcription
3. Performs sentiment analysis on transcription data
4. Sends processed data to AI evaluation service
5. Stores completed evaluations in MongoDB

#### Queue Service (`queueService.js`)
Manages processing queues:
1. Creates and manages Bull queues
2. Handles job prioritization
3. Provides retry mechanisms with exponential backoff
4. Tracks job status and results

#### Analytics Service (`analyticsService.js`)
Provides metrics and insights:
1. Aggregates evaluation data
2. Calculates performance metrics
3. Identifies trends and patterns
4. Generates coaching insights

#### Transcription Service (`transcriptionService.js`)
Processes and enhances transcription data:
1. Handles different transcription formats
2. Performs language detection and translation
3. Analyzes sentiment and intent
4. Identifies profanity and sensitive content

### API Routes

| Route | Description |
|-------|-------------|
| `/auth` | Authentication endpoints |
| `/user` | User management endpoints |
| `/qa` | QA evaluation endpoints |
| `/qa-process` | Evaluation processing endpoints |
| `/dashboard` | Dashboard metrics endpoints |
| `/qa-forms` | Form management endpoints |
| `/analytics` | Analytics and reporting endpoints |
| `/exports` | Export generation endpoints |

## Frontend Components

### Core Components

#### App Context (`AppContext.js`)
Manages global state:
1. Authentication state
2. User profile
3. Session timeout handling
4. Error state

#### API Service (`api.js`)
Centralized API communication:
1. JWT token management
2. Request/response handling
3. Error processing
4. Session timeout detection

#### Permission Component (`WithPermission.js`)
Permission-based rendering:
1. Checks user permissions against required permissions
2. Conditionally renders protected components
3. Redirects unauthorized access attempts

### Main Pages

| Page | Component | Description |
|------|-----------|-------------|
| Dashboard | `Dashboard.js` | Overview of key metrics and insights |
| QA Evaluations | `RecentEvaluations.js` | List and filters for evaluations |
| Evaluation Detail | `QADetail.js` | Detailed evaluation view with transcription |
| New Evaluations | `NewEvaluations.js` | Processing interface for new evaluations |
| QA Forms | `QAFormsList.js` / `QAFormEditor.js` | Form management interface |
| Criteria Profiles | `CriteriaList.js` / `CriteriaEditor.js` | Profile management interface |
| Agent Comparison | `AgentComparison.js` | Agent performance comparison |
| Agent Coaching | `AgentCoaching.js` | Agent-specific coaching insights |
| Trend Analysis | `TrendAnalysis.js` | Time-based trend visualization |
| Reports Export | `ReportsExport.js` | Report generation interface |

## Database Schema

### MongoDB Collections

#### InteractionAIQA
```javascript
{
  interactionId: String,                // ID of the interaction
  qaFormName: String,                  // Name of the QA form used
  qaFormId: String,                    // ID of the QA form
  evaluator: {                         // Who performed the evaluation
    id: String,
    name: String
  },
  evaluationData: {                    // Evaluation results
    usage: {                           // Token usage stats
      prompt_tokens: Number,
      completion_tokens: Number,
      total_tokens: Number,
      // ... other usage metrics
    },
    evaluation: {                      // Evaluation results
      parameters: Map,                 // Map of parameter scores
      silencePeriods: Array,           // Detected silence periods
      summary: String,                 // Evaluation summary
      intent: Array,                   // Detected intents
      areasOfImprovements: Array,      // Areas needing improvement
      totalScore: Number,              // Overall score
      maxScore: Number,                // Maximum possible score
      whatTheAgentDidWell: Array,      // Agent strengths
      customerSentiment: Array,        // Customer sentiment
      agentSentiment: Array            // Agent sentiment
    }
  },
  interactionData: {                   // Call metadata
    agent: {                           // Agent information
      id: String,
      name: String
    },
    caller: {                          // Caller information
      id: String
    },
    direction: String,                 // Call direction
    duration: Number,                  // Call duration
    channel: String                    // Communication channel
  },
  status: String,                      // Evaluation status
  createdAt: Date,                     // Creation timestamp
  updatedAt: Date                      // Update timestamp
}
```

#### InteractionTranscription
```javascript
{
  interactionId: String,               // ID of the interaction
  transcriptionVersion: String,        // Version (realtime, recorded)
  transcription: Array,                // Transcription entries
  recordedTranscription: Array,        // Recorded transcription (optional)
  createdAt: Date,                     // Creation timestamp
  updatedAt: Date                      // Update timestamp
}
```

#### QAForm
```javascript
{
  name: String,                        // Form name
  description: String,                 // Form description
  isActive: Boolean,                   // Active status
  parameters: [{                       // Evaluation parameters
    name: String,                      // Parameter name
    context: String,                   // Parameter description
    maxScore: Number,                  // Maximum score
    scoringType: String,               // Binary or variable
    order: Number                      // Display order
  }],
  createdBy: String,                   // Creator ID
  updatedBy: String,                   // Last updater ID
  createdAt: Date,                     // Creation timestamp
  updatedAt: Date                      // Update timestamp
}
```

#### CriteriaProfile
```javascript
{
  name: String,                        // Profile name
  description: String,                 // Profile description
  queues: [{                           // Selected queues
    queueId: String,
    queueName: String
  }],
  workCodes: [{                        // Selected work codes
    code: String,
    description: String
  }],
  agents: [{                           // Selected agents
    agentId: String,
    agentName: String
  }],
  minCallDuration: Number,             // Minimum call duration
  direction: String,                   // Call direction
  evaluationForm: {                    // Selected form
    formId: ObjectId,
    formName: String
  },
  isActive: Boolean,                   // Active status
  createdBy: String,                   // Creator ID
  updatedBy: String,                   // Last updater ID
  createdAt: Date,                     // Creation timestamp
  updatedAt: Date                      // Update timestamp
}
```

### MySQL Tables

#### users
- `id`: INT (PK)
- `username`: VARCHAR(255)
- `password`: VARCHAR(255) (bcrypt-hashed)
- `email`: VARCHAR(255)
- `first_name`: VARCHAR(255)
- `last_name`: VARCHAR(255)
- `active`: TINYINT(1)
- `is_agent`: TINYINT(1)
- `last_login`: DATETIME
- `created_at`: DATETIME
- `updated_at`: DATETIME

#### aiqa_groups
- `id`: INT (PK)
- `name`: VARCHAR(255)
- `permissions`: JSON (stored permissions)
- `created_at`: DATETIME
- `updated_at`: DATETIME

#### aiqa_users_groups
- `id`: INT (PK)
- `user_id`: INT (FK to users.id)
- `group_id`: INT (FK to aiqa_groups.id)

#### user_logins
- `id`: INT (PK)
- `user_id`: INT (FK to users.id)
- `token_id`: VARCHAR(255)
- `fingerprint`: VARCHAR(255)
- `ip_address`: VARCHAR(45)
- `user_agent`: TEXT
- `is_revoked`: TINYINT(1)
- `expires_at`: DATETIME
- `created_at`: DATETIME

#### token_blacklist
- `id`: INT (PK)
- `token_id`: VARCHAR(255)
- `expires_at`: DATETIME
- `created_at`: DATETIME

## API Reference

### Authentication

#### POST /api/auth/login
Authenticates a user.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt_token_string",
  "user": {
    "id": "integer",
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string"
  }
}
```

#### POST /api/auth/logout
Ends the user session.

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### QA Evaluations

#### GET /api/qa/dashboard
Retrieves QA dashboard metrics.

**Query Parameters:**
- `agentId`: Filter by agent ID
- `queueId`: Filter by queue ID
- `startDate`: Start date for data range
- `endDate`: End date for data range
- `formId`: Filter by QA form ID

**Response:**
```json
{
  "totalEvaluations": "integer",
  "agentPerformance": [ ... ],
  "bestPerformer": { ... },
  "poorPerformer": { ... },
  "averageCustomerSentiment": "string",
  "areasNeedingFocus": [ ... ],
  "recentEvaluations": [ ... ],
  "parameterAnalysis": [ ... ],
  "dateRange": { ... }
}
```

#### GET /api/qa/evaluation/:id
Retrieves detailed evaluation data.

**Response:**
```json
{
  "id": "string",
  "interactionId": "string",
  "qaFormName": "string",
  "qaFormId": "string",
  "createdAt": "date",
  "updatedAt": "date",
  "agent": { ... },
  "evaluation": { ... },
  "interaction": { ... },
  "transcription": [ ... ],
  "evaluationData": { ... },
  "interactionData": { ... }
}
```

### QA Processing

#### POST /api/qa-process/process-evaluations
Queues evaluations for processing.

**Request Body:**
```json
{
  "evaluations": [
    {
      "interactionId": "string",
      "recordingUrl": "string",
      "agent": {
        "id": "string",
        "name": "string"
      },
      "caller": {
        "id": "string"
      },
      "qaFormId": "string"
    }
  ],
  "evaluator": {
    "id": "string",
    "name": "string"
  }
}
```

**Response:**
```json
{
  "message": "string",
  "jobs": [
    {
      "interactionId": "string",
      "jobId": "string",
      "status": "string"
    }
  ]
}
```

### Forms Management

#### GET /api/qa-forms
Retrieves all QA forms.

**Response:**
```json
[
  {
    "_id": "string",
    "name": "string",
    "description": "string",
    "isActive": "boolean",
    "parameters": [ ... ],
    "createdAt": "date",
    "updatedAt": "date"
  }
]
```

#### POST /api/qa-forms
Creates a new QA form.

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "isActive": "boolean",
  "parameters": [
    {
      "name": "string",
      "context": "string",
      "maxScore": "integer",
      "scoringType": "string",
      "order": "integer"
    }
  ]
}
```

**Response:**
Created form object.

### Analytics

#### GET /api/analytics/agent-comparison
Compares agent performance.

**Query Parameters:**
- `startDate`: Start date for data range
- `endDate`: End date for data range
- `agents`: Comma-separated list of agent IDs
- `parameters`: Comma-separated list of parameters to compare
- `formId`: QA form ID

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "evaluationCount": "integer",
    "totalScore": "integer",
    "avgScore": "number",
    "parameters": { ... },
    "sentiments": { ... }
  }
]
```

#### GET /api/analytics/trends
Retrieves trend analysis data.

**Query Parameters:**
- `startDate`: Start date for data range
- `endDate`: End date for data range
- `agentId`: Filter by agent ID
- `queueId`: Filter by queue ID
- `interval`: Time interval (day, week, month)
- `formId`: QA form ID

**Response:**
```json
[
  {
    "date": "string",
    "count": "integer",
    "totalScore": "integer",
    "avgScore": "number",
    "customerSentiment": { ... },
    "parameters": { ... }
  }
]
```

### Export

#### GET /api/exports/evaluations
Exports evaluation data as CSV.

**Query Parameters:**
- `startDate`: Start date for data range
- `endDate`: End date for data range
- `agentId`: Filter by agent ID
- `queueId`: Filter by queue ID
- `format`: Export format (csv, json)
- `formId`: QA form ID
- `includeParameters`: Comma-separated list of parameters to include

**Response:**
CSV or JSON data stream.

## Integration Points

### External Systems

#### Deepgram Speech-to-Text
- **Endpoint**: `https://api.deepgram.com/v1/listen`
- **Authentication**: API key in Authorization header
- **Parameters**:
  - `smart_format`: Boolean
  - `punctuate`: Boolean
  - `diarize`: Boolean
  - `language`: String
  - `model`: String
  - `multichannel`: Boolean
  - `utterances`: Boolean
- **Request Format**: JSON with URL to audio file
- **Response Format**: Detailed transcription data with timestamps and metadata

#### AI Evaluation Service
- **Endpoint**: Configurable via `QAEVALUATION_URL` environment variable
- **Default**: `http://democc.contegris.com:60027/aiqa`
- **Request Format**: JSON with instructions and transcription
- **Response Format**: JSON with evaluation scores, insights, and metrics

#### Sentiment Analysis Service
- **Endpoint**: Configurable via `SENTIMENT_API_URL` environment variable
- **Default**: `http://democc.contegris.com:60027/callTranscription`
- **Request Format**: JSON with text to analyze
- **Response Format**: JSON with sentiment scores, intents, and language detection

### Call Recording Storage
- **Upload Endpoint**: `${STORAGE_API_URL}/store/single/voice_recording/${interactionId}`
- **Download Base URL**: `${STORAGE_BASE_URL}/store${response.data.url}`
- **Authentication**: None (internal service)
- **Format**: Multipart form-data for upload

## Deployment Guide

### Environment Variables

#### Server Configuration
- `NODE_ENV`: Environment (development, production)
- `PORT`: HTTP port (default: 50000)
- `SSL_PORT`: HTTPS port (default: 50001)
- `SSL_KEY`: Path to SSL key file
- `SSL_CERTIFICATE`: Path to SSL certificate file
- `CORS_ORIGIN`: Allowed CORS origin (default: http://localhost:3000)
- `TABLE_PREFIX`: Prefix for MySQL tables

#### Database Configuration
- `DB_HOST`: MySQL host
- `DB_USER`: MySQL username
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: MySQL database name
- `DB_TIMEZONE`: MySQL timezone
- `MONGODB_URI`: MongoDB connection URI

#### Redis Configuration
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port
- `REDIS_PASSWORD`: Redis password
- `REDIS_DB`: Redis database number

#### External Services
- `STORAGE_BASE_URL`: Storage service base URL
- `STORAGE_API_URL`: Storage service API URL
- `DEEPGRAM_API_KEY`: Deepgram API key
- `QAEVALUATION_URL`: QA evaluation service URL
- `SENTIMENT_API_URL`: Sentiment analysis service URL
- `AIQA_SAMPLE_RESPONSE`: Sample response format for AI QA

#### Security
- `JWT_SECRET`: Secret key for JWT signing

### Docker Deployment

#### Docker Compose Example
```yaml
version: '3'

services:
  mongodb:
    image: mongo:5
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password

  mysql:
    image: mysql:8
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=aiqa

  redis:
    image: redis:6
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  aiqa-backend:
    build: ./backend
    ports:
      - "50000:50000"
    depends_on:
      - mongodb
      - mysql
      - redis
    environment:
      - NODE_ENV=production
      - PORT=50000
      - MONGODB_URI=mongodb://admin:password@mongodb:27017/aiqa?authSource=admin
      - DB_HOST=mysql
      - DB_USER=root
      - DB_PASSWORD=password
      - DB_NAME=aiqa
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      # Add other environment variables

  aiqa-frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - aiqa-backend
    environment:
      - REACT_APP_API_URL=http://localhost:50000/api/

volumes:
  mongo_data:
  mysql_data:
  redis_data:
```

## Maintenance Tasks

### Database Backups

#### MongoDB Backup
```bash
mongodump --uri="mongodb://username:password@host:port/aiqa?authSource=admin" --out=/backup/mongodb-$(date +%Y%m%d)
```

#### MySQL Backup
```bash
mysqldump -h host -u root -p aiqa > /backup/mysql-$(date +%Y%m%d).sql
```

### Log Rotation
Configure log rotation using logrotate:

```
/var/log/aiqa/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 aiqa adm
    sharedscripts
    postrotate
        service aiqa restart
    endscript
}
```

### System Monitoring
Set up monitoring for:
- CPU/Memory usage
- Disk space
- API response times
- Queue length and processing times
- Error rates
- Database connection pool

### Regular Maintenance
- Clean up old/completed jobs in Bull queue
- Archive old evaluations
- Remove unused audio files
- Check for database index effectiveness

## Troubleshooting Guide

### Common Issues

#### Queue Processing Failures
**Symptoms**:
- Jobs stay in "active" state indefinitely
- "Error processing job" messages in logs

**Solutions**:
1. Check Redis connection
2. Verify external API availability (Deepgram, AI services)
3. Check disk space for temporary audio files
4. Increase job timeout settings in Bull configuration
5. Restart the worker process

#### Transcription Issues
**Symptoms**:
- Empty transcription in evaluations
- Missing timestamps or text

**Solutions**:
1. Check audio file quality and accessibility
2. Verify Deepgram API key and permissions
3. Check for proper audio format support
4. Look for transcription errors in the logs
5. Verify language detection settings

#### Database Connection Errors
**Symptoms**:
- API timeouts
- "Cannot connect to database" errors

**Solutions**:
1. Check database server status
2. Verify connection credentials
3. Check network connectivity
4. Increase connection pool size
5. Optimize long-running queries

### Logging

#### Important Log Files
- `/var/log/aiqa/api.log` - Main API logs
- `/var/log/aiqa/worker.log` - Queue worker logs
- `/var/log/aiqa/error.log` - Error-level logs

#### Log Levels
Configure log levels in environment variables:
- `LOG_LEVEL=error` - Only errors
- `LOG_LEVEL=warn` - Warnings and errors
- `LOG_LEVEL=info` - General info (default)
- `LOG_LEVEL=debug` - Detailed debugging info
- `LOG_LEVEL=trace` - Extremely verbose tracing

### Performance Tuning

#### Redis Optimization
- Enable persistence to avoid data loss
- Configure appropriate memory limits
- Use Redis cluster for high availability

#### MongoDB Optimization
- Create indexes for frequently queried fields
- Use aggregation pipeline for complex queries
- Enable WiredTiger storage engine with compression

#### Node.js Optimization
- Set appropriate memory limits
- Enable clustering for multi-core utilization
- Implement request rate limiting
- Use compression middleware

## Security Considerations

### Data Security

#### Sensitive Data
- Recordings and transcripts may contain PII and should be handled accordingly
- Implement data retention policies
- Consider data anonymization for long-term storage

#### Encryption
- Enable TLS/SSL for all connections
- Use environment variables for sensitive configuration
- Store passwords with bcrypt (already implemented)
- Implement field-level encryption for sensitive data

### API Security

#### Input Validation
- All inputs are validated using express-validator
- Implement strict type checking
- Sanitize inputs to prevent injection attacks

#### Rate Limiting
- API rate limiting is configured in server.js
- Adjust limits based on expected usage

#### Authentication
- Use secure JWT practices
- Implement token expiration
- Use refresh tokens for extended sessions

### Auditing

#### Action Logging
Log all important actions:
- User logins/logouts
- Evaluation creation and modification
- Form and profile changes
- Report generation

#### Compliance
Consider relevant compliance requirements:
- GDPR for personal data
- Industry-specific regulations
- Data retention policies

---

This technical documentation provides a comprehensive overview of the AIQA system architecture, API reference, deployment guide, and maintenance procedures. For additional information, contact the development team.