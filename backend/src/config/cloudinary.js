const cloudinary = require('cloudinary').v2;

// Accept multiple env var names for compatibility
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME || process.env.Cloud_name;
const API_KEY = process.env.CLOUDINARY_API_KEY || process.env.API_KEY || process.env.CLOUDINARY_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET || process.env.CLOUDINARY_SECRET || process.env.CLOUDINARY_APISECTRET;
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'onlineshop';

const missing = [];
const hasDiscreteCreds = Boolean(CLOUD_NAME && API_KEY && API_SECRET);
const hasUrl = Boolean(CLOUDINARY_URL);

if (!hasDiscreteCreds && !hasUrl) {
  if (!CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME (or CLOUD_NAME)');
  if (!API_KEY) missing.push('CLOUDINARY_API_KEY (or API_KEY)');
  if (!API_SECRET) missing.push('CLOUDINARY_API_SECRET (or API_SECRET)');
  console.warn(`Cloudinary env vars are not fully set. Missing: ${missing.join(', ')}. You can also set CLOUDINARY_URL.`);
}

if (hasDiscreteCreds) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true
  });
} else if (hasUrl) {
  // Let the SDK read CLOUDINARY_URL from env
  cloudinary.config({ secure: true });
}

function getFolderPath(subfolder) {
  return subfolder ? `${CLOUDINARY_FOLDER}/${subfolder}` : CLOUDINARY_FOLDER;
}

async function uploadImageBuffer(buffer, filename, subfolder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: getFolderPath(subfolder),
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        resource_type: 'image',
        eager: [
          { fetch_format: 'auto', quality: 'auto', crop: 'limit', width: 1600 }
        ]
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        const secureUrl = result?.eager?.[0]?.secure_url || result?.secure_url;
        resolve({
          publicId: result.public_id,
          url: secureUrl
        });
      }
    );
    uploadStream.end(buffer);
  });
}

async function deleteImageByPublicId(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn('Cloudinary delete failed:', err?.message || err);
  }
}

module.exports = { cloudinary, uploadImageBuffer, deleteImageByPublicId, getFolderPath };