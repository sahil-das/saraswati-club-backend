module.exports = (req, res, next) => {
  // Assuming 'protect' (auth.middleware) has already run and attached req.user
  if (req.user && req.user.isPlatformAdmin) {
    return next();
  }
  return res.status(403).json({ message: "Access Denied: Platform Admin Restricted" });
};