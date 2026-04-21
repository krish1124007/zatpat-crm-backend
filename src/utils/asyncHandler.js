// Wraps an async route handler so thrown errors propagate to Express's error middleware
// instead of becoming unhandled rejections.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
