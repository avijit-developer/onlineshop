const cloudinary = require('cloudinary').v2;

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER = 'onlineshop'
} = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn('Cloudinary env vars are not fully set. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

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
    // Log and continue; not fatal for main flow
    console.warn('Cloudinary delete failed:', err?.message || err);
  }
}

module.exports = { cloudinary, uploadImageBuffer, deleteImageByPublicId, getFolderPath };