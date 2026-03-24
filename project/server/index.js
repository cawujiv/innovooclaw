const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Import Controllers
const { getStrompreise, getAuftraege, getAllData } = require('./controllers/dataController');

// ===== API ENDPOINTS =====

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    message: '⚡ EFDM Lastmanagement Server läuft',
    version: '1.0.0',
    dataSource: process.env.DATA_SOURCE || 'simulated',
  });
});

// Strompreise Endpoint
app.get('/api/strompreise', getStrompreise);

// Aufträge Endpoint
app.get('/api/auftraege', getAuftraege);

// Kombinierte Daten Endpoint
app.get('/api/data', getAllData);

// Root Route - API Dokumentation
app.get('/api', (req, res) => {
  res.json({
    message: '⚡ EFDM Lastmanagement API',
    version: '1.0.0',
    endpoints: {
      health: {
        method: 'GET',
        path: '/api/health',
        description: 'Server Health Check',
      },
      strompreise: {
        method: 'GET',
        path: '/api/strompreise',
        description: 'Day-Ahead Strompreise abrufen',
      },
      auftraege: {
        method: 'GET',
        path: '/api/auftraege',
        description: 'Produktionsaufträge abrufen',
      },
      data: {
        method: 'GET',
        path: '/api/data',
        description: 'Alle Daten kombiniert (Strompreise + Aufträge)',
      },
    },
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ 
    success: false,
    error: err.message 
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint nicht gefunden',
    path: req.path,
  });
});

// Server starten
app.listen(PORT, () => {
  console.log('');
  console.log('⚡========================================⚡');
  console.log('  EFDM LASTMANAGEMENT SERVER GESTARTET  ');
  console.log('=========================================');
  console.log('');
  console.log(`🚀 Server läuft auf: http://localhost:${PORT}`);
  console.log(`📊 API Docs:         http://localhost:${PORT}/api`);
  console.log(`💚 Health Check:     http://localhost:${PORT}/api/health`);
  console.log(`📈 Strompreise:      http://localhost:${PORT}/api/strompreise`);
  console.log(`📋 Aufträge:         http://localhost:${PORT}/api/auftraege`);
  console.log(`🎯 Alle Daten:       http://localhost:${PORT}/api/data`);
  console.log('');
  console.log(`📁 Datenquelle:      ${process.env.DATA_SOURCE || 'simulated'}`);
  console.log('');
  console.log('⚡========================================⚡');
  console.log('');
});

module.exports = app;
