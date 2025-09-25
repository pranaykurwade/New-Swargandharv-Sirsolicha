const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const port = process.env.PORT || 3000;

// Environment variables
require('dotenv').config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());

// Registration Schema
const registrationSchema = new mongoose.Schema({
  registrationId: { type: String, unique: true },
  fullName: { type: String, required: true },
  age: { type: Number, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  category: { type: String, required: true },
  songType: { type: String, required: true },
  songTitle: { type: String },
  paymentScreenshot: {
    url: { type: String, required: true },
    originalName: { type: String },
    filename: { type: String, unique: true },
    size: { type: Number },
    type: { type: String },
    transactionId: { type: String, unique: true, sparse: true }, // Add transactionId
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    validationNotes: { type: String },
  },
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Registration = mongoose.model('Registration', registrationSchema);

// Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'swargandhav_payments',
    allowed_formats: ['jpg', 'png', 'gif'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// Generate unique registration ID
function generateRegistrationId() {
  return 'SG' + crypto.randomInt(100000, 999999).toString();
}

// Test Cloudinary route
app.get('/api/test-cloudinary', async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', {
      folder: 'test_uploads',
    });
    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error('Cloudinary Test Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// POST /api/check-transaction
app.post('/api/check-transaction', async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }

    const existing = await Registration.findOne({ 'paymentScreenshot.transactionId': transactionId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID already exists',
        data: {
          fullName: existing.fullName,
          phone: existing.phone,
        },
      });
    }

    res.json({ success: true, message: 'Transaction ID is available' });
  } catch (error) {
    console.error('Transaction ID check error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/register
app.post('/api/register', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    console.log('Request Body:', req.body);
    console.log('Request File:', req.file);

    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, message: 'Payment screenshot is required' });
    }

    // Check for duplicate phone
    const existing = await Registration.findOne({ phone: req.body.phone });
    if (existing) {
      await cloudinary.uploader.destroy(req.file.public_id || '').catch(err => console.error('Cleanup error:', err));
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    const registrationId = generateRegistrationId();

    const registration = new Registration({
      registrationId,
      fullName: req.body.fullName,
      age: parseInt(req.body.age),
      phone: req.body.phone,
      email: req.body.email || '',
      category: req.body.category,
      songType: req.body.songType,
      songTitle: req.body.songTitle || '',
      paymentScreenshot: {
        url: req.file.path,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        filename: req.file.filename,
        validationNotes: 'Uploaded successfully',
      },
    });

    await registration.save();
    res.json({ success: true, data: { registrationId } });
  } catch (error) {
    console.error('Registration Error:', error);
    if (req.file && req.file.public_id) {
      await cloudinary.uploader.destroy(req.file.public_id).catch(err => console.error('Cleanup error:', err));
    }
    res.status(500).json({ success: false, message: error.message, details: error });
  }
});

// GET /api/registration/:id
app.get('/api/registration/:id', async (req, res) => {
  try {
    const registration = await Registration.findOne({ registrationId: req.params.id });
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    res.json({ success: true, data: registration });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/registration/ date
app.get('/api/registration/:id', async (req, res) => {
  try {
    const registration = await Registration.findOne({ registrationId: req.params.id });
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    console.log('Registration Data:', registration); // Log to verify createdAt is included
    res.json({ success: true, data: registration });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  try {
    const totalRegistrations = await Registration.countDocuments();
    const byCategory = await Registration.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } },
    ]);

    res.json({
      success: true,
      data: {
        totalRegistrations,
        byCategory,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/registrations
app.get('/api/registrations', async (req, res) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 });
    res.json({ success: true, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/registration/:id/verify
// PATCH /api/registration/:id/verify
app.patch('/api/registration/:id/verify', async (req, res) => {
  try {
    const { verified, verifiedBy, validationNotes, transactionId, status } = req.body;
    console.log('Verify Request:', {
      registrationId: req.params.id,
      body: req.body,
    });

    const registration = await Registration.findOne({ registrationId: req.params.id });
    if (!registration) {
      console.log('Registration not found for ID:', req.params.id);
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // If verifying with transaction ID, check for duplicates
    if (verified && transactionId) {
      const existing = await Registration.findOne({
        'paymentScreenshot.transactionId': transactionId,
        registrationId: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Transaction ID already exists',
          data: {
            fullName: existing.fullName,
            phone: existing.phone,
          },
        });
      }
      registration.paymentScreenshot.transactionId = transactionId;
    }

    registration.paymentScreenshot.verified = verified;
    registration.paymentScreenshot.verifiedAt = new Date();
    registration.paymentScreenshot.verifiedBy = verifiedBy || 'admin';
    registration.paymentScreenshot.validationNotes = validationNotes || 'Payment processed';
    registration.status = status || (verified ? 'approved' : 'pending');
    registration.updatedAt = new Date();

    await registration.save();
    console.log('Registration Updated:', registration);

    res.json({ success: true, data: registration });
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});