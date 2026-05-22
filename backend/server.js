const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load env variables
dotenv.config();

const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API Routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));

// Serve local upload files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve service worker with root scope access
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pwa/service-worker.js'));
});

// Serve Frontend static assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Elegant URL routing mapping (serves pages without requiring .html extension)
const views = ['login', 'restaurants', 'add-restaurant', 'restaurant-detail', 'profile', 'admin'];
views.forEach(view => {
  app.get(`/${view}`, (req, res) => {
    res.sendFile(path.join(__dirname, `../frontend/${view}.html`));
  });
});

// Root path serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Unhandled Error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server booting in Node environment on port ${PORT}`);
});
