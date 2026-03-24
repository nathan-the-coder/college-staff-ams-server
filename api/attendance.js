const express = require('express');
const cors = require('cors');
const dbConnect = require('../lib/db');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Settings = require('../models/Settings');

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

app.get('/', async (req, res) => {
  await dbConnect();
  try {
    const attendance = await Attendance.find().sort({ timestamp: -1 });
    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

app.get('/today', async (req, res) => {
  await dbConnect();
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

app.get('/dtr', async (req, res) => {
  await dbConnect();
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

app.post('/check', async (req, res) => {
  await dbConnect();
  try {
    const { faceDescriptor } = req.body;
    
    const lateSetting = await Settings.findOne({ key: 'lateThreshold' });
    const thresholdTime = lateSetting ? lateSetting.value : '08:00';
    
    const users = await User.find({ role: { $in: ['Teaching', 'Non-Teaching'] } });
    
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
      isLate
    });
    
    await attendance.save();
    
    res.json({ success: true, name: matchedUser.name, role: matchedUser.role, type, isLate });
  } catch (error) {
    console.error('Check error:', error);
    res.status(500).json({ success: false, message: 'Error processing attendance' });
  }
});

app.post('/seed', async (req, res) => {
  await dbConnect();
  try {
    const users = await User.find({ role: { $in: ['Teaching', 'Non-Teaching'] } });
    
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

module.exports = app;
