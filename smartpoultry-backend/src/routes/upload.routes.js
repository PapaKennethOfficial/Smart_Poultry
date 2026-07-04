const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // The URL to access the file from the frontend
  const fileUrl = `/uploads/${req.file.filename}`;

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl
  });
});

module.exports = router;
