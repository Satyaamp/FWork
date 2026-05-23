const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PasswordHistory = require('../models/PasswordHistory');
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
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }

    const { name, username, password, phoneNumber, role } = req.body;
    if (!name || !username || !password || !phoneNumber || !role) {
      return res.status(400).json({ message: 'All fields (name, username, password, phone number, role) are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const allowedRoles = req.user.role === 'superadmin' 
      ? ['worker', 'admin', 'superadmin'] 
      : ['worker'];
      
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified or insufficient privileges.' });
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

// Reset password for any user (Superadmin only)
router.post('/reset-password', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin privileges required.' });
    }

    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const targetUser = await User.findOne({ username: username.toLowerCase().trim() });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Set the new password - mongoose save hook will automatically hash it
    targetUser.password = newPassword;
    await targetUser.save();

    // Log the password reset history and calculate auto-increment count
    const currentCount = await PasswordHistory.countDocuments({ userId: targetUser._id });
    const newHistory = new PasswordHistory({
      userId: targetUser._id,
      username: targetUser.username,
      password: newPassword, // Store plain password
      resetBy: {
        id: req.user._id,
        name: req.user.name,
        username: req.user.username
      },
      resetCount: currentCount + 1,
      modifiedOn: new Date()
    });
    await newHistory.save();

    res.json({ message: `Password for user @${targetUser.username} has been reset successfully.` });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
