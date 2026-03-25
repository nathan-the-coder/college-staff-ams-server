require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Attendance = require('./models/Attendance');
const Settings = require('./models/Settings');

const JWT_SECRET = process.env.JWT_SECRET || 'staff-attendance-secret-key-2024';

const app = express();
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/staff-attendance";

const corsOptions = {
  origin: ['https://ams-sigma-snowy.vercel.app', 'http://localhost:5173'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

mongoose.connect(uri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-faceDescriptor');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { name, role, faceDescriptor } = req.body;
    
    const newUser = new User({
      name,
      role,
      faceDescriptor
    });
    
    await newUser.save();
    
    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
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

app.delete('/api/users/:id', async (req, res) => {
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

app.get('/api/attendance', async (req, res) => {
  try {
    const attendance = await Attendance.find().sort({ timestamp: -1 });
    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

app.get('/api/attendance/today', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const attendance = await Attendance.find({
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ timestamp: -1 });
    
    res.json(attendance);
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

app.get('/api/attendance/dtr', async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const query = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
        query.timestamp.$gte.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
        query.timestamp.$lte.setHours(23, 59, 59, 999);
      }
    }
    
    const attendance = await Attendance.find(query).sort({ timestamp: -1 });
    res.json(attendance);
  } catch (error) {
    console.error('Error fetching DTR:', error);
    res.status(500).json({ message: 'Failed to fetch DTR' });
  }
});

app.post('/api/attendance/check', async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    
    const lateThreshold = await Settings.findOne({ key: 'lateThreshold' });
    const thresholdTime = lateThreshold ? lateThreshold.value : '08:00';
    
    const users = await User.find({ role: { $in: ['Instructor', 'Staff'] } });
    
    let matchedUser = null;
    let minDistance = 0.6;
    
    for (const user of users) {
      if (!user.faceDescriptor || user.faceDescriptor.length === 0) continue;
      
      const storedDescriptor = new Float32Array(user.faceDescriptor);
      const inputDescriptor = new Float32Array(faceDescriptor);
      
      if (storedDescriptor.length !== inputDescriptor.length) continue;
      
      let distance = 0;
      for (let i = 0; i < storedDescriptor.length; i++) {
        distance += Math.pow(storedDescriptor[i] - inputDescriptor[i], 2);
      }
      distance = Math.sqrt(distance);
      
      if (distance < minDistance) {
        minDistance = distance;
        matchedUser = user;
      }
    }
    
    if (!matchedUser) {
      return res.status(404).json({ success: false, message: 'User not recognized. Please register first.' });
    }
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const lastLog = await Attendance.findOne({
      userId: matchedUser._id,
      timestamp: { $gte: startOfDay }
    }).sort({ timestamp: -1 });
    
    const type = !lastLog || lastLog.type === 'out' ? 'in' : 'out';
    
    const currentTime = new Date();
    const [thresholdHour, thresholdMinute] = thresholdTime.split(':').map(Number);
    const thresholdDate = new Date(currentTime);
    thresholdDate.setHours(thresholdHour, thresholdMinute, 0, 0);
    const isLate = type === 'in' && currentTime > thresholdDate;
    
    const attendance = new Attendance({
      userId: matchedUser._id,
      name: matchedUser.name,
      role: matchedUser.role,
      type,
      isLate: isLate
    });
    
    await attendance.save();
    
    res.json({ success: true, name: matchedUser.name, role: matchedUser.role, type, isLate });
  } catch (error) {
    console.error('Check error:', error);
    res.status(500).json({ success: false, message: 'Error processing attendance' });
  }
});

app.post('/api/auth/login', async (req, res) => {
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

app.post('/api/auth/setup', async (req, res) => {
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
    
    console.log('Creating admin with:', { username, isAdmin: true });
    await admin.save();
    console.log('Admin created successfully');
    
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ message: 'Failed to create admin', error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Settings.find();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    
    await Settings.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true }
    );
    
    res.json({ message: 'Setting saved successfully' });
  } catch (error) {
    console.error('Error saving setting:', error);
    res.status(500).json({ message: 'Failed to save setting' });
  }
});

app.post('/api/settings/bulk', async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await Settings.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true }
      );
    }
    
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ message: 'Failed to save settings' });
  }
});

app.post('/api/seed', async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['Instructor', 'Staff'] } });
    
    if (users.length === 0) {
      return res.status(400).json({ message: 'No users found. Please enroll users first.' });
    }
    
    const now = new Date();
    const attendanceRecords = [];
    
    for (const user of users) {
      attendanceRecords.push({
        userId: user._id,
        name: user.name,
        role: user.role,
        type: 'in',
        isLate: false,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000)
      });
      attendanceRecords.push({
        userId: user._id,
        name: user.name,
        role: user.role,
        type: 'out',
        isLate: false,
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000)
      });
    }
    
    await Attendance.insertMany(attendanceRecords);
    
    res.json({ message: `Created ${attendanceRecords.length} sample attendance records` });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ message: 'Failed to seed data' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
