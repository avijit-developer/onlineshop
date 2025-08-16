const express = require('express');
const { authenticate, requireAdmin, requireRole } = require('../middleware/auth');
const { cloudinary, getFolderPath } = require('../config/cloudinary');

const router = express.Router();

router.post('/signature', authenticate, requireRole(['admin','vendor']), async (req, res) => {
  const { folder = '' } = req.body || {};
  const subfolder = typeof folder === 'string' && folder ? folder : '';
  const fullFolder = getFolderPath(subfolder);

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: fullFolder,
    unique_filename: true,
    overwrite: false
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
        cloudName: cloudinary.config().cloud_name
      }
    });
  } catch (e) {
    res.status(500);
    throw new Error('Failed to generate upload signature');
  }
});

module.exports = router;