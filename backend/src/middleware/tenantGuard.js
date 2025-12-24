module.exports = (req, res, next) => {
  const { tenantId, role } = req.user;

  // Super admin can bypass tenant isolation
  if (role === "super_admin") {
    return next();
  }

  if (!tenantId) {
    return res.status(403).json({
      success: false,
      message: "Tenant access denied"
    });
  }

  // Attach tenantId for controllers
  req.tenantId = tenantId;
  next();
};
