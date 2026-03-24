const express = require('express');
const cors = require('cors');
const dbConnect = require('../lib/db');
const User = require('../models/User');

const app = express();

// Handle OPTIONS for all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.sendStatus(200);
  }
  next();
});

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', async (req, res) => {
  await dbConnect();
  try {
    const users = await User.find().select('-faceDescriptor');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

app.post('/register', async (req, res) => {
  await dbConnect();
  try {
    const { name, role, faceDescriptor } = req.body;
    
    const newUser = new User({ name, role, faceDescriptor });
    await newUser.save();
    
    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

app.put('/:id', async (req, res) => {
  await dbConnect();
  try {
    const { name, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, role },
      { new: true }
    ).select('-faceDescriptor');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

app.delete('/:id', async (req, res) => {
  await dbConnect();
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = app;
