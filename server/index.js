const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initializeDatabase } = require('./database');
const deviceRoutes = require('./routes/devices');
const moduleRoutes = require('./routes/modules');
const versionRoutes = require('./routes/versions');
const issueRoutes = require('./routes/issues');
const dashboardRoutes = require('./routes/dashboard');
const deviceTypeRoutes = require('./routes/device-types');
const moduleTypeRoutes = require('./routes/module-types');
const submoduleRoutes = require('./routes/submodules');
const submoduleVersionRoutes = require('./routes/submodule-versions');

const app = express();
const PORT = process.env.PORT || 5000;

// 设置响应头编码
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 安全中间件
app.use(helmet());

// 信任代理设置（用于开发环境）
app.set('trust proxy', 1);

// 限流中间件
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` headers
  legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
  trustProxy: true // 信任代理
});
app.use(limiter);

// CORS配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// 解析JSON请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static('uploads'));

// API路由
app.use('/api/devices', deviceRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/device-types', deviceTypeRoutes);
app.use('/api/module-types', moduleTypeRoutes);
app.use('/api/submodules', submoduleRoutes);
app.use('/api/submodule-versions', submoduleVersionRoutes);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    message: '设备管理系统API运行正常'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: '设备管理系统 API',
    version: '1.0.0',
    description: '支持多类型设备管理、版本追踪、售后问题记录',
    endpoints: {
      devices: '/api/devices',
      modules: '/api/modules',
      versions: '/api/versions',
      issues: '/api/issues',
      dashboard: '/api/dashboard',
      deviceTypes: '/api/device-types',
      moduleTypes: '/api/module-types',
      submodules: '/api/submodules',
      submoduleVersions: '/api/submodule-versions'
    }
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: '接口不存在',
    path: req.originalUrl,
    message: '请检查API路径是否正确'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
async function startServer() {
  try {
    console.log('🚀 正在启动设备管理系统...');
    
    // 初始化数据库
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('❌ 数据库初始化失败，服务器启动中止');
      process.exit(1);
    }

    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log('✅ 服务器启动成功!');
      console.log(`📊 API服务地址: http://localhost:${PORT}`);
      console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`📖 API文档: http://localhost:${PORT}`);
      console.log('💡 按 Ctrl+C 停止服务');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});

startServer();