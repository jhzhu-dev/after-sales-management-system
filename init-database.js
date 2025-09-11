const { initializeDatabase } = require('./server/database');

async function initDatabase() {
  console.log('🚀 开始初始化数据库...');
  console.log('📊 数据库配置: 用户名=els, 密码=111111, 数据库=device_management');
  
  try {
    const success = await initializeDatabase();
    
    if (success) {
      console.log('✅ 数据库初始化成功！');
      console.log('📊 数据库表结构已创建');
      console.log('🔗 可以开始使用设备管理系统了');
      console.log('');
      console.log('📋 已创建的数据表:');
      console.log('   - devices (设备表)');
      console.log('   - modules (模块表)');
      console.log('   - module_versions (版本表)');
      console.log('   - issues (问题表)');
    } else {
      console.log('❌ 数据库初始化失败');
      console.log('💡 请检查:');
      console.log('   1. MySQL服务是否启动');
      console.log('   2. 用户名密码是否正确 (els/111111)');
      console.log('   3. 数据库连接是否正常');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 数据库初始化过程中发生错误:', error.message);
    console.log('💡 请检查数据库连接配置');
    process.exit(1);
  }
}

// 运行初始化
initDatabase();