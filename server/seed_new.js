const { query, transaction } = require('./database');

// 设备类型数据
const deviceTypes = [
  { name: '龙门设备', description: '用于大型工件加工的龙门式设备' },
  { name: '底盘设备', description: '用于底盘装配和检测的设备' },
  { name: '侧扫设备', description: '用于侧面扫描和检测的设备' },
  { name: '检测设备', description: '用于质量检测和测试的设备' },
  { name: '其他设备', description: '其他类型的设备' }
];

// 模块类型数据
const moduleTypes = [
  { name: '机械', code: 'mechanical', description: '机械传动模块' },
  { name: '电气', code: 'electrical', description: '电气控制模块' },
  { name: '上位机', code: 'host', description: '上位机控制模块' },
  { name: '服务器', code: 'server', description: '数据服务器模块' },
  { name: '视觉', code: 'vision', description: '视觉检测模块' }
];

// 生成10个设备
const generateDevices = () => {
  const devices = [];
  const deviceTypeNames = ['龙门设备', '底盘设备', '侧扫设备', '检测设备', '其他设备'];
  const statuses = ['正常', '异常', '维护中'];
  const locations = ['车间1-生产线A', '车间1-生产线B', '车间2-装配线', '车间2-检测区', '车间3-质检区', '车间3-包装区', '车间4-测试区', '车间4-维修区', '车间5-存储区', '车间5-发货区'];
  
  for (let i = 1; i <= 10; i++) {
    const deviceId = `DEV${i.toString().padStart(3, '0')}`;
    const deviceType = deviceTypeNames[(i - 1) % deviceTypeNames.length];
    const status = statuses[(i - 1) % statuses.length];
    const location = locations[i - 1];
    
    devices.push({
      id: deviceId,
      name: `${deviceType}${String.fromCharCode(64 + i)}`, // A, B, C, ...
      type_name: deviceType,
      location: location,
      status: status
    });
  }
  
  return devices;
};

// 生成模块数据 - 每个设备5个模块
const generateModules = (devices) => {
  const modules = [];
  const moduleTypeNames = ['机械', '电气', '上位机', '服务器', '视觉'];
  
  devices.forEach(device => {
    moduleTypeNames.forEach(moduleType => {
      modules.push({
        device_id: device.id,
        type_name: moduleType,
        status: '正常'
      });
    });
  });
  
  return modules;
};

// 生成子模块数据 - 每个模块2个子模块
const generateSubmodules = (modules) => {
  const submodules = [];
  
  // 子模块模板
  const submoduleTemplates = {
    '机械': [
      { name: '主轴电机', model: 'SM-2000', factory_version: 'v2.0', current_version: 'v2.1', description: '主轴驱动电机' },
      { name: '导轨系统', model: 'RG-500', factory_version: 'v1.5', current_version: 'v1.8', description: 'X轴导轨系统' }
    ],
    '电气': [
      { name: '主控制器', model: 'PLC-3000', factory_version: 'v3.0', current_version: 'v3.2', description: '主控PLC' },
      { name: '伺服驱动器', model: 'SD-1000', factory_version: 'v2.0', current_version: 'v2.0', description: '伺服电机驱动器' }
    ],
    '上位机': [
      { name: '工控机', model: 'IPC-5000', factory_version: 'v4.0', current_version: 'v4.1', description: '工业控制计算机' },
      { name: '触摸屏', model: 'HMI-1500', factory_version: 'v2.0', current_version: 'v2.3', description: '人机交互界面' }
    ],
    '服务器': [
      { name: '数据库服务器', model: 'DB-SRV-2000', factory_version: 'v1.5', current_version: 'v1.5', description: '数据存储服务器' },
      { name: '应用服务器', model: 'APP-SRV-1000', factory_version: 'v2.0', current_version: 'v2.0', description: '应用程序服务器' }
    ],
    '视觉': [
      { name: '工业相机', model: 'CAM-5000', factory_version: 'v3.0', current_version: 'v3.1', description: '高分辨率工业相机' },
      { name: '镜头组', model: 'LENS-200', factory_version: 'v1.2', current_version: 'v1.2', description: '变焦镜头组' }
    ]
  };
  
  modules.forEach(module => {
    const templates = submoduleTemplates[module.type_name] || [];
    templates.forEach(template => {
      submodules.push({
        module_id: module.id, // 这里会在插入时动态设置
        module_type_name: module.type_name, // 用于查找模块ID
        device_id: module.device_id,
        name: template.name,
        model: template.model,
        factory_version: template.factory_version,
        current_version: template.current_version,
        description: template.description,
        status: '正常'
      });
    });
  });
  
  return submodules;
};

// 生成子模块版本数据
const generateSubmoduleVersions = (submodules) => {
  const versions = [];
  
  submodules.forEach(submodule => {
    // 出厂版本
    versions.push({
      submodule_id: submodule.id, // 这里会在插入时动态设置
      version_number: submodule.factory_version,
      version_type: 'factory',
      release_date: '2024-01-01',
      description: `出厂版本 - ${submodule.name}`,
      updated_by: '制造商'
    });
    
    // 当前版本（如果与出厂版本不同）
    if (submodule.current_version !== submodule.factory_version) {
      versions.push({
        submodule_id: submodule.id,
        version_number: submodule.current_version,
        version_type: 'update',
        release_date: '2024-06-01',
        description: `版本更新 - ${submodule.name}`,
        updated_by: '维护工程师'
      });
    }
  });
  
  return versions;
};

// 生成问题数据
const generateIssues = (devices) => {
  const issues = [];
  const descriptions = [
    '设备运行异常，需要检查',
    '传感器读数异常',
    '控制系统响应缓慢',
    '机械部件磨损严重',
    '电气连接松动',
    '软件版本过旧',
    '网络连接不稳定',
    '数据同步失败'
  ];
  const severities = ['low', 'medium', 'high'];
  const statuses = ['open', 'in_progress', 'closed'];
  const assignees = ['维护工程师A', '电气工程师B', '机械工程师C', '软件工程师D', '系统管理员E'];
  
  devices.forEach((device, index) => {
    const issueCount = Math.floor(Math.random() * 3) + 1; // 1-3个问题
    for (let i = 0; i < issueCount; i++) {
      issues.push({
        device_id: device.id,
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        assignee: assignees[Math.floor(Math.random() * assignees.length)]
      });
    }
  });
  
  return issues;
};

// 主函数
async function seedDatabase() {
  try {
    console.log('🌱 开始插入模拟数据...');
    
    // 生成数据
    const devices = generateDevices();
    const modules = generateModules(devices);
    const submodules = generateSubmodules(modules);
    const submoduleVersions = generateSubmoduleVersions(submodules);
    const issues = generateIssues(devices);
    
    console.log(`📊 生成数据统计:`);
    console.log(`   - 设备: ${devices.length} 台`);
    console.log(`   - 模块: ${modules.length} 个`);
    console.log(`   - 子模块: ${submodules.length} 个`);
    console.log(`   - 子模块版本: ${submoduleVersions.length} 个`);
    console.log(`   - 问题: ${issues.length} 个`);
    
    await transaction(async (connection) => {
      // 清空现有数据
      console.log('🗑️ 清空现有数据...');
      await connection.execute('DELETE FROM issues');
      await connection.execute('DELETE FROM submodule_versions');
      await connection.execute('DELETE FROM submodules');
      await connection.execute('DELETE FROM modules');
      await connection.execute('DELETE FROM devices');
      await connection.execute('DELETE FROM device_types');
      await connection.execute('DELETE FROM module_types');
      
      // 插入设备类型数据
      console.log('📋 插入设备类型数据...');
      for (const deviceType of deviceTypes) {
        await connection.execute(
          'INSERT INTO device_types (name, description) VALUES (?, ?)',
          [deviceType.name, deviceType.description]
        );
      }
      
      // 插入模块类型数据
      console.log('🔧 插入模块类型数据...');
      for (const moduleType of moduleTypes) {
        await connection.execute(
          'INSERT INTO module_types (name, code, description) VALUES (?, ?, ?)',
          [moduleType.name, moduleType.code, moduleType.description]
        );
      }
      
      // 插入设备数据
      console.log('📱 插入设备数据...');
      const deviceTypeMap = new Map();
      const [deviceTypeResults] = await connection.execute('SELECT id, name FROM device_types');
      deviceTypeResults.forEach(dt => deviceTypeMap.set(dt.name, dt.id));
      
      for (const device of devices) {
        const typeId = deviceTypeMap.get(device.type_name);
        await connection.execute(
          'INSERT INTO devices (id, name, type_id, location, status) VALUES (?, ?, ?, ?, ?)',
          [device.id, device.name, typeId, device.location, device.status]
        );
      }
      
      // 插入模块数据
      console.log('🔧 插入模块数据...');
      const moduleTypeMap = new Map();
      const [moduleTypeResults] = await connection.execute('SELECT id, name FROM module_types');
      moduleTypeResults.forEach(mt => moduleTypeMap.set(mt.name, mt.id));
      
      const moduleIdMap = new Map();
      for (const module of modules) {
        const typeId = moduleTypeMap.get(module.type_name);
        const [result] = await connection.execute(
          'INSERT INTO modules (device_id, type_id, status) VALUES (?, ?, ?)',
          [module.device_id, typeId, module.status]
        );
        moduleIdMap.set(`${module.device_id}_${typeId}`, result.insertId);
      }
      
      // 插入子模块数据
      console.log('📋 插入子模块数据...');
      for (const submodule of submodules) {
        const typeId = moduleTypeMap.get(submodule.module_type_name);
        const key = `${submodule.device_id}_${typeId}`;
        const moduleId = moduleIdMap.get(key);
        
        if (moduleId) {
          const [result] = await connection.execute(
            'INSERT INTO submodules (module_id, name, model, factory_version, current_version, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [moduleId, submodule.name, submodule.model, submodule.factory_version, submodule.current_version, submodule.description, submodule.status]
          );
          submodule.id = result.insertId; // 保存插入后的ID
        }
      }
      
      // 插入子模块版本数据
      console.log('📋 插入子模块版本历史数据...');
      for (const version of submoduleVersions) {
        if (version.submodule_id) {
          await connection.execute(
            'INSERT INTO submodule_versions (submodule_id, version_number, version_type, release_date, description, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
            [version.submodule_id, version.version_number, version.version_type, version.release_date, version.description, version.updated_by]
          );
        }
      }
      
      // 插入问题数据
      console.log('🚨 插入问题数据...');
      for (const issue of issues) {
        await connection.execute(
          'INSERT INTO issues (device_id, description, severity, status, assignee) VALUES (?, ?, ?, ?, ?)',
          [issue.device_id, issue.description, issue.severity, issue.status, issue.assignee]
        );
      }
    });
    
    console.log('✅ 模拟数据插入完成！');
    console.log('');
    console.log('📊 最终数据统计:');
    console.log(`   - 设备类型: ${deviceTypes.length} 种`);
    console.log(`   - 模块类型: ${moduleTypes.length} 种`);
    console.log(`   - 设备: ${devices.length} 台`);
    console.log(`   - 模块: ${modules.length} 个`);
    console.log(`   - 子模块: ${submodules.length} 个`);
    console.log(`   - 子模块版本: ${submoduleVersions.length} 个`);
    console.log(`   - 问题: ${issues.length} 个`);
    console.log('');
    console.log('🎯 现在可以启动前端应用查看数据了！');
    console.log('🎉 数据库种子数据插入完成！');
    
  } catch (error) {
    console.error('❌ 插入模拟数据失败:', error);
    throw error;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ 种子数据插入完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 种子数据插入失败:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
