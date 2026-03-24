const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dbConnect = require('../lib/db');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'staff-attendance-secret-key-2024';

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.post('/login', async (req, res) => {
  await dbConnect();
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username, isAdmin: true });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user._id, username: user.username, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/setup', async (req, res) => {
  await dbConnect();
  try {
    const { username, password } = req.body;
    
    const existingAdmin = await User.findOne({ isAdmin: true });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }
    
    const admin = new User({
      name: 'Administrator',
      role: 'Admin',
      username,
      password,
      isAdmin: true,
      faceDescriptor: []
    });
    
    await admin.save();
    
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ message: 'Failed to create admin' });
  }
});

app.post('/change-password', async (req, res) => {
  await dbConnect();
  try {
    const { currentPassword, newPassword } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isAdmin) {
      return res.status(401).json({ message: 'Invalid user' });
    }
    
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

module.exports = app;
