const notFound = (req, res, next) => {
    res.status(404);
    next(new Error(`Not Found - ${req.originalUrl}`));
  };
  
  const errorHandler = (err, req, res, next) => {
    let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    // Multer file size limit
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      err.message = 'File too large. Max 5MB allowed';
    }

    const payload = {
      message: err.message,
      code: err.code || undefined,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    };

    res.status(status).json(payload);
  };
  
  module.exports = { notFound, errorHandler };