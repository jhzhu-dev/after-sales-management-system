const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: '请输入用户名和密码' });
  }

  const validUsername = process.env.LOGIN_USERNAME || 'admin';
  const validPassword = process.env.LOGIN_PASSWORD || 'admin123';
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const jwtSecret = process.env.JWT_SECRET || 'default_secret_change_me';
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

  if (username !== validUsername) {
    return res.status(401).json({ success: false, error: '用户名或密码错误' });
  }

  let role = null;
  if (adminPassword && password === adminPassword) {
    role = 'admin';
  } else if (password === validPassword) {
    role = 'user';
  } else {
    return res.status(401).json({ success: false, error: '用户名或密码错误' });
  }

  const token = jwt.sign({ username, role }, jwtSecret, { expiresIn: jwtExpiresIn });

  res.json({ success: true, token, username, role });
});

// GET /api/auth/verify
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' });
  }

  const jwtSecret = process.env.JWT_SECRET || 'default_secret_change_me';

  try {
    const decoded = jwt.verify(token, jwtSecret);
    res.json({ success: true, username: decoded.username, role: decoded.role || 'user' });
  } catch (err) {
    res.status(401).json({ success: false, error: '令牌无效或已过期' });
  }
});

module.exports = router;
