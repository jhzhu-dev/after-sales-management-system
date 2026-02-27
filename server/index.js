// ─── Windows UTF-8 控制台编码修复 ───────────────────────────────────────────
if (process.platform === 'win32') {
  const { execSync } = require('child_process');
  try { execSync('chcp 65001', { stdio: 'ignore' }); } catch (_) {}
  if (process.stdout.isTTY) process.stdout.setDefaultEncoding('utf8');
  if (process.stderr.isTTY) process.stderr.setDefaultEncoding('utf8');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const { initializeDatabase } = require('./database');
const deviceRoutes = require('./routes/devices');
const moduleRoutes = require('./routes/modules');
const versionRoutes = require('./routes/versions');
const issueRoutes = require('./routes/issues');
const issueLogRoutes = require('./routes/issue-logs');
const dashboardRoutes = require('./routes/dashboard');
const moduleTypeRoutes = require('./routes/module-types');
const versionReleaseRoutes = require('./routes/version-releases');

// Phase 1: 基础数据模块路由
const productLineRoutes = require('./routes/product-lines');
const productRoutes = require('./routes/products');
const productModuleRoutes = require('./routes/product-modules');
const productDocumentRoutes = require('./routes/product-documents');
const deviceDocumentRoutes = require('./routes/device-documents');
const uploadRoutes = require('./routes/uploads');



// Phase 4: 售后管理集成路由
const afterSalesRoutes = require('./routes/after-sales');
const deviceUpgradeRoutes = require('./routes/device-upgrades');
const customerRoutes = require('./routes/customers');

const app = express();
const PORT = process.env.PORT || 5000;

// 设置响应头
app.use((req, res, next) => {
  // 设置安全性头
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 设置缓存控制头
  if (req.path.startsWith('/static/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
  } else if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  // 设置内容类型
  if (req.path === '/' || req.path.match(/\.html$/)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  } else if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  } else if (req.path.match(/\.css$/)) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  } else if (req.path.match(/\.js$/)) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (req.path.match(/\.woff2$/)) {
    res.setHeader('Content-Type', 'font/woff2');
  } else if (req.path.match(/\.woff$/)) {
    res.setHeader('Content-Type', 'font/woff');
  } else if (req.path.match(/\.ttf$/)) {
    res.setHeader('Content-Type', 'font/ttf');
  } else if (req.path.match(/\.eot$/)) {
    res.setHeader('Content-Type', 'application/vnd.ms-fontobject');
  }

  next();
});

// 处理HTTPS重定向问题
app.use((req, res, next) => {
  // 如果请求是HTTPS但端口是5000，重定向到正确的HTTPS端口5001
  if (req.secure && req.get('host').includes(':5000')) {
    const httpsUrl = `https://${req.get('host').replace(':5000', ':5001')}${req.originalUrl}`;
    return res.redirect(301, httpsUrl);
  }
  // 如果请求是HTTP但端口是5001，重定向到正确的HTTP端口5000
  if (!req.secure && req.get('host').includes(':5001')) {
    const httpUrl = `http://${req.get('host').replace(':5001', ':5000')}${req.originalUrl}`;
    return res.redirect(301, httpUrl);
  }
  next();
});

// 安全中间件
app.use(helmet({
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  xFrameOptions: false, // 禁用X-Frame-Options，使用CSP的frame-ancestors
  hsts: false, // 禁用HSTS，避免在HTTP连接上出现
  contentSecurityPolicy: false, // 暂时禁用CSP以减少不必要的头
  xXssProtection: false, // 禁用X-XSS-Protection
  xDnsPrefetchControl: false, // 禁用X-DNS-Prefetch-Control
  xDownloadOptions: false, // 禁用X-Download-Options
  xPermittedCrossDomainPolicies: false, // 禁用X-Permitted-Cross-Domain-Policies
}));

// 信任代理设置（用于开发环境）
app.set('trust proxy', 1);

// 限流中间件 - 放宽限制以避免429错误
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 限制每个IP 15分钟内最多1000个请求（大幅放宽）
  message: JSON.stringify({ success: false, error: '请求过于频繁，请稍后再试' }), // 返回JSON格式
  standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` headers
  legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
  trustProxy: true, // 信任代理
  skip: (req) => {
    // 跳过静态资源的限流
    return req.path.startsWith('/static/') ||
      req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/);
  }
});
app.use(limiter);

// CORS配置
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// 提供前端静态文件（开发和生产环境都支持）
app.use(express.static(path.join(__dirname, '../client/build')));

// 现有路由
app.use('/api/devices', deviceRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/issue-logs', issueLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/module-types', moduleTypeRoutes);
app.use('/api/version-releases', versionReleaseRoutes);

// Phase 1: 基础数据模块路由
app.use('/api/product-lines', productLineRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-modules', productModuleRoutes);
app.use('/api/product-documents', productDocumentRoutes);
app.use('/api/device-documents', deviceDocumentRoutes);
app.use('/api/uploads', uploadRoutes);

// 客户管理路由
app.use('/api/customers', customerRoutes);

// Phase 4: 售后管理集成路由
app.use('/api/after-sales', afterSalesRoutes);
app.use('/api/device-upgrades', deviceUpgradeRoutes);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    message: '售后登记系统API运行正常'
  });
});

// 所有非API路由都返回前端应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
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

    // 获取本机所有IP地址
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';
    let allIPs = [];

    // 收集所有可用的IPv4地址
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          allIPs.push(iface.address);
        }
      }
    }

    // 使用第一个可用IP作为主要显示IP
    localIP = allIPs[0] || 'localhost';

    let sslOptions;
    let sslEnabled = false;
    try {
      const keyPath = path.join(__dirname, '../ssl/server-key.pem');
      const certPath = path.join(__dirname, '../ssl/server-cert.pem');
      
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        sslOptions = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        };
        sslEnabled = true;
        console.log('✅ SSL证书加载成功，HTTPS服务将启动');
      } else {
        console.log('ℹ️  SSL证书文件不存在，仅启动HTTP服务');
      }
    } catch (error) {
      console.log('ℹ️  SSL证书加载失败，仅启动HTTP服务:', error.message);
    }

    const httpServer = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ HTTP服务器启动成功!');
      console.log(`📊 本地HTTP访问地址: http://localhost:${PORT}`);
      
      if (allIPs.length > 0) {
        console.log('🌐 局域网访问地址 (HTTP):');
        allIPs.forEach((ip, index) => {
          console.log(`   ${index + 1}. http://${ip}:${PORT}`);
        });
      }
      
      console.log('💡 按 Ctrl+C 停止服务');
      console.log('');
    });

    httpServer.keepAliveTimeout = 5000;
    httpServer.headersTimeout = 6000;
    httpServer.maxConnections = 100;

    // 如果SSL证书可用，启动HTTPS服务器
    if (sslEnabled && sslOptions) {
      const httpsServer = https.createServer(sslOptions, app);

      httpsServer.on('error', (error) => {
        console.error('❌ HTTPS服务器启动失败:', error.message);
        if (error.code === 'EADDRINUSE') {
          console.error('   端口被占用，请检查是否有其他服务在使用端口', PORT + 1);
        } else if (error.code === 'EACCES') {
          console.error('   权限不足，无法绑定端口', PORT + 1);
        }
      });

      httpsServer.listen(PORT + 1, '0.0.0.0', () => {
        console.log('✅ HTTPS服务器启动成功!');
        console.log(`🔒 本地HTTPS访问地址: https://localhost:${PORT + 1}`);
        
        if (allIPs.length > 0) {
          console.log('🌐 局域网访问地址 (HTTPS):');
          allIPs.forEach((ip, index) => {
            console.log(`   ${index + 1}. https://${ip}:${PORT + 1}`);
          });
        }
      });

      httpsServer.keepAliveTimeout = 5000;
      httpsServer.headersTimeout = 6000;
      httpsServer.maxConnections = 100;
    }

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