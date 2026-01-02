const express = require('express');
const { authenticate, requireAdmin, requireRole } = require('../middleware/auth');
const { cloudinary, getFolderPath } = require('../config/cloudinary');

const router = express.Router();

// Allow public access for vendor registration
router.post('/signature', async (req, res) => {
  const { folder = '', resource_type = 'auto' } = req.body || {};
  const subfolder = typeof folder === 'string' && folder ? folder : '';
  const fullFolder = getFolderPath(subfolder);

  const timestamp = Math.floor(Date.now() / 1000);
  
  // Build params to sign - must match exactly what will be sent in FormData
  // Note: resource_type is in the URL path, NOT in FormData, so it's NOT in the signature
  // Cloudinary requires parameters to be sorted alphabetically for signature
  const paramsToSign = {
    folder: fullFolder,
    overwrite: false,
    timestamp,
    type: 'upload',
    unique_filename: true
  };

  try {
    const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinary.config().api_secret);
    return res.json({
      success: true,
      data: {
        timestamp,
        folder: fullFolder,
        signature,
        apiKey: cloudinary.config().api_key,
        cloudName: cloudinary.config().cloud_name,
        resource_type: resource_type || 'auto'
      }
    });
  } catch (e) {
    res.status(500);
    throw new Error('Failed to generate upload signature');
  }
});

module.exports = router;