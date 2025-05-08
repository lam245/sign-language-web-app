const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize express application
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename with original extension
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    // Accept only video files
    const filetypes = /mp4|mov|avi|wmv|flv|mkv/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only video files are allowed'));
  }
});

// Import the sign recognition model
const signRecognitionModel = require('./model/signRecognitionModel');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Sign Language Recognition API is running',
    version: '1.0.0',
    modelVersion: signRecognitionModel.getModelVersion()
  });
});

// Endpoint for processing videos
app.post('/api/recognize', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }
    
    console.log(`Processing uploaded video: ${req.file.originalname}`);
    
    // Get original filename for potential keyword matching
    const originalFilename = req.file.originalname;
    const isRecorded = req.body.isRecorded === 'true';
    
    // Process the video using the sign recognition model
    const result = await signRecognitionModel.processVideo(req.file.path, originalFilename, isRecorded);
    
    // Remove the temporary file
    fs.unlinkSync(req.file.path);
    
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error processing video'
    });
  }
});

// Endpoint for translating recognized signs
app.post('/api/translate', express.json(), async (req, res) => {
  try {
    const { text, targetLanguage = 'vi' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'No text provided for translation'
      });
    }
    
    // Translate the text using the model
    const translationResult = await signRecognitionModel.translateText(text, targetLanguage);
    
    res.status(200).json({
      success: true,
      ...translationResult
    });
  } catch (error) {
    console.error('Error translating text:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error translating text'
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Sign Language Recognition API running on port ${port}`);
  console.log(`Model version: ${signRecognitionModel.getModelVersion()}`);
}); 