// server.js
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const xss = require('xss-clean');
const sanitize = require('express-mongo-sanitize');
const { pool, testConnection } = require('./config/database');
const { connectMongoDB } = require('./config/mongodb');
const routes = require('./routes');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/*const options = {
  key: fs.readFileSync(process.env.SSL_KEY),
  cert: fs.readFileSync(process.env.SSL_CERTIFICATE)
};*/

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https:", "http:"], // Add this line for audio files
      connectSrc: ["'self'", "https:", "http:"]  // Add this if needed for API calls
    },
  },
}));
app.use(xss());
app.use(sanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to API routes
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Disposition']
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static('public'));

// Development logging
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

// Add a specific route to proxy the audio file
app.get('/api/audio-proxy', async (req, res) => {
  try {
    const audioUrl = req.query.url;
    if (!audioUrl) {
      return res.status(400).json({ message: 'URL parameter is required' });
    }

    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      throw new Error(`Audio file not found: ${response.status}`);
    }

    // Forward headers
    res.set('Content-Type', response.headers.get('content-type'));
    res.set('Content-Length', response.headers.get('content-length'));
    res.set('Accept-Ranges', 'bytes');

    // Get the response as buffer and send it
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Error proxying audio:', error);
    res.status(500).json({ message: 'Error fetching audio file' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ 
      status: 'ok', 
      timestamp: new Date(),
      database: 'connected',
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Database connection failed',
      timestamp: new Date()
    });
  }
});

// API Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  try {
    // Connect to MySQL
    const isMySQLConnected = await testConnection();
    if (!isMySQLConnected) {
      console.error('Unable to connect to MySQL database. Exiting...');
      process.exit(1);
    }

    // Connect to MongoDB
    const isMongoConnected = await connectMongoDB();
    if (!isMongoConnected) {
      console.error('Unable to connect to MongoDB database. Exiting...');
      process.exit(1);
    }

    const PORT = process.env.PORT || 50000;
    const SSL_PORT = process.env.SSL_PORT || 50001;

    app.listen(PORT, () => {
      console.log(`
=======================================================
  Server running on port ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  MySQL: Connected
  MongoDB: Connected
  Time: ${new Date().toISOString()}
=======================================================
      `);
    });

    /*https.createServer(options, app).listen(SSL_PORT, () => {
      console.log(`
=======================================================
  Server running on port ${SSL_PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  MySQL: Connected
  MongoDB: Connected
  Time: ${new Date().toISOString()}
=======================================================
      `);
    });*/
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle process events
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  pool.end().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  pool.end().then(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  pool.end(() => {
    console.log('Database pool closed.');
    process.exit(0);
  });
});

startServer();