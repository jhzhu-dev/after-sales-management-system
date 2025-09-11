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
const dashboardRoutes = require('./routes/dashboard');
const deviceTypeRoutes = require('./routes/device-types');
const moduleTypeRoutes = require('./routes/module-types');
const submoduleRoutes = require('./routes/submodules');
const submoduleVersionRoutes = require('./routes/submodule-versions');

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
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
}
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

// 生产环境：处理前端路由
if (process.env.NODE_ENV === 'production') {
  // 所有非API路由都返回前端应用
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
} else {
  // 开发环境：API文档
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
      },
      health: '/api/health'
    });
  });

  // 开发环境：404处理
  app.use('*', (req, res) => {
    res.status(404).json({ 
      error: '接口不存在',
      path: req.originalUrl,
      message: '请检查API路径是否正确'
    });
  });
}

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
    try {
      sslOptions = {
        key: fs.readFileSync(path.join(__dirname, '../ssl/server-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '../ssl/server-cert.pem'))
      };
      console.log('✅ SSL证书加载成功');
    } catch (error) {
      console.error('❌ SSL证书加载失败:', error.message);
      process.exit(1);
    }

    const httpServer = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ HTTP服务器启动成功!');
      console.log(`📊 本地HTTP访问地址: http://localhost:${PORT}`);
    });

    httpServer.keepAliveTimeout = 5000;
    httpServer.headersTimeout = 6000;
    httpServer.maxConnections = 100;

    const httpsServer = https.createServer(sslOptions, app);
    
    httpsServer.on('error', (error) => {
      console.error('❌ HTTPS服务器启动失败:', error.message);
      if (error.code === 'EADDRINUSE') {
        console.error('   端口被占用，请检查是否有其他服务在使用端口', PORT + 1);
      } else if (error.code === 'ENOTFOUND') {
        console.error('   SSL证书文件未找到');
      } else if (error.code === 'EACCES') {
        console.error('   权限不足，无法绑定端口', PORT + 1);
      }
    });
    
    httpsServer.listen(PORT + 1, '0.0.0.0', () => {
      console.log('✅ HTTPS服务器启动成功!');
      console.log(`🔒 本地HTTPS访问地址: https://localhost:${PORT + 1}`);
      console.log('💡 按 Ctrl+C 停止服务');
      console.log('');
      
      // 显示所有可用的IP地址
      if (allIPs.length > 0) {
        console.log('🌐 局域网访问地址 (HTTP - 所有IP都可访问):');
        allIPs.forEach((ip, index) => {
          console.log(`   ${index + 1}. http://${ip}:${PORT}`);
        });
        console.log('');
        
        console.log('🔒 局域网访问地址 (HTTPS - 所有IP都可访问):');
        allIPs.forEach((ip, index) => {
          console.log(`   ${index + 1}. https://${ip}:${PORT + 1}`);
        });
        console.log('');
        
        console.log('🔍 健康检查地址:');
        allIPs.forEach((ip, index) => {
          console.log(`   HTTP: http://${ip}:${PORT}/api/health`);
          console.log(`   HTTPS: https://${ip}:${PORT + 1}/api/health`);
        });
        console.log('');
        
        console.log('📖 系统访问地址:');
        allIPs.forEach((ip, index) => {
          console.log(`   HTTP: http://${ip}:${PORT}`);
          console.log(`   HTTPS: https://${ip}:${PORT + 1}`);
        });
        console.log('');
      }
      
      console.log('📋 其他设备访问说明:');
      console.log(`   1. 确保设备与服务器在同一局域网`);
      console.log(`   2. 在浏览器中访问上述任意一个IP地址`);
      console.log(`   3. 如果无法访问，请检查防火墙设置`);
      console.log(`   4. HTTP推荐使用: http://192.168.0.136:${PORT}`);
      console.log(`   5. HTTPS推荐使用: https://192.168.0.136:${PORT + 1}`);
      console.log(`   6. 首次访问HTTPS会提示证书不安全，点击"高级"→"继续访问"`);
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