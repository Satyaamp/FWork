const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    user = new User({
      name,
      username,
      password,
      role: role || 'worker'
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'restaurant_secret_key_98765',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        phoneNumber: user.phoneNumber || ''
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Please enter all credentials.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'restaurant_secret_key_98765',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        phoneNumber: user.phoneNumber || ''
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    username: req.user.username,
    role: req.user.role,
    phoneNumber: req.user.phoneNumber || ''
  });
});

// Register a new worker (Admin only)
router.post('/create-worker', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }

    const { name, username, password, phoneNumber, role } = req.body;
    if (!name || !username || !password || !phoneNumber || !role) {
      return res.status(400).json({ message: 'All fields (name, username, password, phone number, role) are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const allowedRoles = ['worker', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    const newWorker = new User({
      name: name.trim(),
      username: normalizedUsername,
      password,
      phoneNumber: phoneNumber.trim(),
      role
    });

    await newWorker.save();

    res.status(201).json({
      message: 'User registered successfully.',
      worker: {
        id: newWorker._id,
        name: newWorker.name,
        username: newWorker.username,
        role: newWorker.role,
        phoneNumber: newWorker.phoneNumber,
        createdAt: newWorker.createdAt
      }
    });
  } catch (error) {
    console.error('Create Worker Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
