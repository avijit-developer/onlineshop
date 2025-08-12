const notFound = (req, res, next) => {
    res.status(404);
    next(new Error(`Not Found - ${req.originalUrl}`));
  };
  
  const errorHandler = (err, req, res, next) => {
    let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  
    // Multer file size limit
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      err.message = err.message || 'File too large. Max 5MB allowed';
    }
  
    const message = err && err.message ? String(err.message) : 'Internal Server Error';
    const code = err && err.code ? String(err.code) : 'INTERNAL_ERROR';
    const details = err && (err.errors || err.reason || err.cause) ? (err.errors || err.reason || err.cause) : undefined;
  
    // Server-side log for debugging
    if (process.env.NODE_ENV !== 'test') {
      console.error('[ERROR]', {
        method: req.method,
        path: req.originalUrl,
        status,
        message,
        code,
        stack: err && err.stack ? err.stack : undefined
      });
    }
  
    res.status(status).json({
      success: false,
      message,
      code,
      details: details && details.message ? details.message : undefined
    });
  };
  
  module.exports = { notFound, errorHandler };