module.exports = (req, res, next) => {
  // Super admin can access everything
  if (req.user.role === "super_admin") {
    return next();
  }

  // All other users must belong to a tenant
  if (!req.tenantId) {
    return res.status(403).json({
      success: false,
      message: "Tenant access denied"
    });
  }

  next();
};
