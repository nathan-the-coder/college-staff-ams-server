const express = require('express');
const cors = require('cors');
const dbConnect = require('../lib/db');
const Settings = require('../models/Settings');

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

app.get('/', async (req, res) => {
  await dbConnect();
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

app.post('/', async (req, res) => {
  await dbConnect();
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

app.post('/bulk', async (req, res) => {
  await dbConnect();
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

module.exports = app;
