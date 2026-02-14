const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'els',
  password: '111111',
  database: 'device_management'
};

// 版本发布模拟数据
const versionReleases = [
  // 机械类模块版本
  {
    module_type_id: 31, // 机械
    version_number: 'v1.0.0',
    title: '龙门机械模块初始版本',
    change_log: '- 首次正式发布\n- 完成基础机械结构设计\n- 通过质量检测',
    release_date: '2025-01-15'
  },
  {
    module_type_id: 31,
    version_number: 'v1.1.0',
    title: '龙门机械模块优化版',
    change_log: '- 优化传动结构\n- 提升运行稳定性\n- 减少噪音10%',
    release_date: '2025-03-20'
  },
  {
    module_type_id: 31,
    version_number: 'v1.2.0',
    title: '龙门机械模块增强版',
    change_log: '- 增加防护装置\n- 提升承载能力\n- 优化润滑系统',
    release_date: '2025-06-10'
  },
  {
    module_type_id: 31,
    version_number: 'v2.0.0',
    title: '龙门机械模块重大升级',
    change_log: '- 全新结构设计\n- 采用新型材料\n- 性能提升30%\n- 维护成本降低20%',
    release_date: '2025-09-05'
  },
  {
    module_type_id: 31,
    version_number: 'v2.1.0',
    title: '龙门机械模块稳定版',
    change_log: '- 修复已知问题\n- 优化安装流程\n- 提升兼容性',
    release_date: '2025-11-18'
  },

  // 电气类模块版本
  {
    module_type_id: 32, // 电气
    version_number: 'v1.0.0',
    title: '电气控制系统基础版',
    change_log: '- 基础电路设计完成\n- 支持标准通信协议\n- 通过电气安全测试',
    release_date: '2025-01-20'
  },
  {
    module_type_id: 32,
    version_number: 'v1.1.0',
    title: '电气控制系统增强版',
    change_log: '- 增加过载保护\n- 优化供电稳定性\n- 支持远程监控',
    release_date: '2025-04-10'
  },
  {
    module_type_id: 32,
    version_number: 'v1.2.0',
    title: '电气控制系统智能版',
    change_log: '- 集成智能诊断\n- 支持自动报警\n- 优化能耗管理',
    release_date: '2025-07-15'
  },
  {
    module_type_id: 32,
    version_number: 'v2.0.0',
    title: '电气控制系统全新架构',
    change_log: '- 模块化设计\n- 支持热插拔\n- 提升响应速度50%\n- 降低故障率',
    release_date: '2025-10-08'
  },
  {
    module_type_id: 32,
    version_number: 'v2.0.1',
    title: '电气控制系统补丁版',
    change_log: '- 修复通信延迟问题\n- 优化启动速度\n- 增强稳定性',
    release_date: '2025-12-01'
  },

  // 上位机类模块版本
  {
    module_type_id: 33, // 上位机
    version_number: 'v1.0.0',
    title: '上位机软件初始版本',
    change_log: '- 基础功能开发完成\n- 支持数据采集和显示\n- 用户界面设计完成',
    release_date: '2025-02-01'
  },
  {
    module_type_id: 33,
    version_number: 'v1.1.0',
    title: '上位机软件功能增强',
    change_log: '- 新增数据分析功能\n- 优化界面响应速度\n- 增加报表导出功能',
    release_date: '2025-04-20'
  },
  {
    module_type_id: 33,
    version_number: 'v1.2.0',
    title: '上位机软件智能化升级',
    change_log: '- 集成AI辅助诊断\n- 支持预测性维护\n- 优化算法性能',
    release_date: '2025-07-05'
  },
  {
    module_type_id: 33,
    version_number: 'v2.0.0',
    title: '上位机软件重大版本',
    change_log: '- 全新UI设计\n- 支持多语言\n- 云端数据同步\n- 移动端支持',
    release_date: '2025-09-25'
  },
  {
    module_type_id: 33,
    version_number: 'v2.1.0',
    title: '上位机软件优化版',
    change_log: '- 性能优化\n- 修复已知bug\n- 新增快捷操作',
    release_date: '2025-11-30'
  },
  {
    module_type_id: 33,
    version_number: 'v2.2.0',
    title: '上位机软件最新版',
    change_log: '- 增强安全性\n- 优化数据库性能\n- 新增批量操作功能',
    release_date: '2026-01-15'
  },

  // 服务器类模块版本
  {
    module_type_id: 34, // 服务器
    version_number: 'v1.0.0',
    title: '服务器系统基础版',
    change_log: '- 基础架构搭建完成\n- 支持标准API接口\n- 数据存储功能就绪',
    release_date: '2025-02-10'
  },
  {
    module_type_id: 34,
    version_number: 'v1.1.0',
    title: '服务器系统性能优化',
    change_log: '- 数据库查询优化\n- 提升并发处理能力\n- 增强数据安全性',
    release_date: '2025-05-01'
  },
  {
    module_type_id: 34,
    version_number: 'v1.2.0',
    title: '服务器系统扩展版',
    change_log: '- 支持分布式部署\n- 新增缓存机制\n- 优化负载均衡',
    release_date: '2025-08-10'
  },
  {
    module_type_id: 34,
    version_number: 'v2.0.0',
    title: '服务器系统云原生版',
    change_log: '- 微服务架构重构\n- 支持容器化部署\n- 自动扩缩容\n- 高可用设计',
    release_date: '2025-10-20'
  },
  {
    module_type_id: 34,
    version_number: 'v2.0.1',
    title: '服务器系统稳定版',
    change_log: '- 修复内存泄漏\n- 优化日志系统\n- 增强监控能力',
    release_date: '2025-12-15'
  },
  {
    module_type_id: 34,
    version_number: 'v2.1.0',
    title: '服务器系统最新版',
    change_log: '- 支持多租户\n- 新增数据备份功能\n- 性能提升40%',
    release_date: '2026-01-28'
  },

  // 视觉类模块版本
  {
    module_type_id: 35, // 视觉
    version_number: 'v1.0.0',
    title: '视觉系统基础版',
    change_log: '- 图像采集功能\n- 基础图像处理\n- 支持常见相机协议',
    release_date: '2025-02-15'
  },
  {
    module_type_id: 35,
    version_number: 'v1.1.0',
    title: '视觉系统算法优化',
    change_log: '- 优化图像处理算法\n- 提升识别准确率\n- 增加边缘检测功能',
    release_date: '2025-05-10'
  },
  {
    module_type_id: 35,
    version_number: 'v1.2.0',
    title: '视觉系统AI增强版',
    change_log: '- 集成深度学习模型\n- 支持目标检测\n- 提升处理速度30%',
    release_date: '2025-08-20'
  },
  {
    module_type_id: 35,
    version_number: 'v2.0.0',
    title: '视觉系统智能升级',
    change_log: '- 全新AI引擎\n- 支持3D视觉\n- 多相机联动\n- 实时缺陷检测',
    release_date: '2025-11-10'
  },
  {
    module_type_id: 35,
    version_number: 'v2.1.0',
    title: '视觉系统最新版',
    change_log: '- 性能优化\n- 新增OCR识别\n- 支持高速相机\n- 改进UI界面',
    release_date: '2026-01-20'
  }
];

async function seedVersionReleases() {
  let connection;
  
  try {
    console.log('🔗 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    
    // 获取所有模块类型
    console.log('📋 获取模块类型列表...');
    const [moduleTypes] = await connection.execute(
      'SELECT id, name FROM module_types ORDER BY id'
    );
    console.log(`找到 ${moduleTypes.length} 个模块类型:`);
    moduleTypes.forEach(mt => console.log(`  - ID ${mt.id}: ${mt.name}`));
    
    if (moduleTypes.length === 0) {
      console.log('⚠️  没有找到模块类型，请先运行基础数据填充脚本');
      return;
    }
    
    // 清空现有版本发布数据
    console.log('\n🗑️  清空现有版本发布数据...');
    await connection.execute('DELETE FROM version_releases');
    console.log('✅ 现有数据已清空');
    
    // 插入新数据
    console.log('\n📦 开始插入版本发布数据...');
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const release of versionReleases) {
      // 检查module_type_id是否存在
      const moduleTypeExists = moduleTypes.some(mt => mt.id === release.module_type_id);
      if (!moduleTypeExists) {
        console.log(`⚠️  跳过: 模块类型ID ${release.module_type_id} 不存在 - ${release.title}`);
        skippedCount++;
        continue;
      }
      
      try {
        await connection.execute(
          `INSERT INTO version_releases 
           (module_type_id, version_number, title, change_log, release_date) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            release.module_type_id,
            release.version_number,
            release.title,
            release.change_log,
            release.release_date
          ]
        );
        
        const moduleTypeName = moduleTypes.find(mt => mt.id === release.module_type_id)?.name || '未知';
        console.log(`✅ [${moduleTypeName}] ${release.version_number} - ${release.title}`);
        insertedCount++;
      } catch (error) {
        console.log(`❌ 插入失败: ${release.title} - ${error.message}`);
        skippedCount++;
      }
    }
    
    // 显示统计信息
    console.log('\n=== 插入完成 ===');
    console.log(`✅ 成功插入: ${insertedCount} 条`);
    if (skippedCount > 0) {
      console.log(`⚠️  跳过: ${skippedCount} 条`);
    }
    
    // 查询并显示结果
    console.log('\n📊 按模块类型统计:');
    const [stats] = await connection.execute(`
      SELECT 
        mt.name as module_type_name,
        COUNT(vr.id) as version_count
      FROM module_types mt
      LEFT JOIN version_releases vr ON mt.id = vr.module_type_id
      GROUP BY mt.id, mt.name
      ORDER BY mt.id
    `);
    
    stats.forEach(stat => {
      console.log(`  ${stat.module_type_name}: ${stat.version_count} 个版本`);
    });
    
    // 显示最近的版本
    console.log('\n🆕 最近发布的版本:');
    const [recentReleases] = await connection.execute(`
      SELECT 
        vr.version_number,
        vr.title,
        mt.name as module_type_name,
        vr.release_date
      FROM version_releases vr
      LEFT JOIN module_types mt ON vr.module_type_id = mt.id
      ORDER BY vr.release_date DESC
      LIMIT 5
    `);
    
    recentReleases.forEach((release, index) => {
      console.log(`  ${index + 1}. [${release.module_type_name}] ${release.version_number} - ${release.title} (${release.release_date})`);
    });
    
  } catch (error) {
    console.error('❌ 发生错误:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行脚本
seedVersionReleases()
  .then(() => {
    console.log('\n✅ 版本发布数据填充完成！');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
