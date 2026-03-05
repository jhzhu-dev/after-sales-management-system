const jwt = require('jsonwebtoken');

/**
 * JWT 认证中间件
 * 验证请求头中的 Bearer Token，验证失败返回 401
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  // 支持 Authorization header 或 query 参数中的 token（用于浏览器直接打开文件预览/下载）
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌，请先登录' });
  }

  const jwtSecret = process.env.JWT_SECRET || 'default_secret_change_me';

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: '认证令牌无效或已过期，请重新登录' });
  }
}

module.exports = authenticate;
