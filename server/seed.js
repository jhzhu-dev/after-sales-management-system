const { query, transaction } = require('./database');

// 模拟数据
const sampleDeviceTypes = [
  {
    name: '龙门设备',
    description: '用于大型工件加工的龙门式设备'
  },
  {
    name: '底盘设备',
    description: '用于底盘装配和检测的设备'
  },
  {
    name: '侧扫设备',
    description: '用于侧面扫描和检测的设备'
  },
  {
    name: '检测设备',
    description: '用于质量检测和测试的设备'
  },
  {
    name: '其他设备',
    description: '其他类型的设备'
  }
];

const sampleModuleTypes = [
  {
    name: '机械',
    code: 'mechanical',
    description: '机械结构模块'
  },
  {
    name: '电气',
    code: 'electrical',
    description: '电气控制模块'
  },
  {
    name: '上位机',
    code: 'host',
    description: '上位机控制模块'
  },
  {
    name: '服务器',
    code: 'server',
    description: '服务器模块'
  },
  {
    name: '视觉',
    code: 'vision',
    description: '视觉检测模块'
  }
];

  const sampleDevices = [
    {
      id: 'DEV001',
      name: '龙门设备A',
      type_name: '龙门设备', // 使用名称而不是ID
      location: '车间1-生产线A',
      status: '正常'
    },
    {
      id: 'DEV002',
      name: '底盘设备B',
      type_name: '底盘设备',
      location: '车间2-装配线',
      status: '正常'
    },
    {
      id: 'DEV003',
      name: '侧扫设备C',
      type_name: '侧扫设备',
      location: '车间1-检测区',
      status: '维护中'
    },
    {
      id: 'DEV004',
      name: '检测设备D',
      type_name: '检测设备',
      location: '车间3-质检区',
      status: '正常'
    },
    {
      id: 'DEV005',
      name: '龙门设备E',
      type_name: '龙门设备',
      location: '车间2-生产线B',
      status: '异常'
    }
  ];

const sampleModules = [
  // DEV001 龙门设备A - 五个标准模块
  { device_id: 'DEV001', type_name: '机械', factory_version: 'v1.0' },
  { device_id: 'DEV001', type_name: '电气', factory_version: 'v2.1' },
  { device_id: 'DEV001', type_name: '上位机', factory_version: 'v1.5' },
  { device_id: 'DEV001', type_name: '服务器', factory_version: 'v3.0' },
  { device_id: 'DEV001', type_name: '视觉', factory_version: 'v2.3' },
  
  // DEV002 底盘设备B - 五个标准模块
  { device_id: 'DEV002', type_name: '机械', factory_version: 'v1.2' },
  { device_id: 'DEV002', type_name: '电气', factory_version: 'v2.8' },
  { device_id: 'DEV002', type_name: '上位机', factory_version: 'v1.8' },
  { device_id: 'DEV002', type_name: '服务器', factory_version: 'v3.2' },
  { device_id: 'DEV002', type_name: '视觉', factory_version: 'v2.5' },
  
  // DEV003 侧扫设备C - 五个标准模块
  { device_id: 'DEV003', type_name: '机械', factory_version: 'v1.1' },
  { device_id: 'DEV003', type_name: '电气', factory_version: 'v2.5' },
  { device_id: 'DEV003', type_name: '上位机', factory_version: 'v2.0' },
  { device_id: 'DEV003', type_name: '服务器', factory_version: 'v3.1' },
  { device_id: 'DEV003', type_name: '视觉', factory_version: 'v2.0' },
  
  // DEV004 检测设备D - 五个标准模块
  { device_id: 'DEV004', type_name: '机械', factory_version: 'v1.3' },
  { device_id: 'DEV004', type_name: '电气', factory_version: 'v2.9' },
  { device_id: 'DEV004', type_name: '上位机', factory_version: 'v1.9' },
  { device_id: 'DEV004', type_name: '服务器', factory_version: 'v3.5' },
  { device_id: 'DEV004', type_name: '视觉', factory_version: 'v2.8' },
  
  // DEV005 龙门设备E - 五个标准模块
  { device_id: 'DEV005', type_name: '机械', factory_version: 'v1.4' },
  { device_id: 'DEV005', type_name: '电气', factory_version: 'v3.1' },
  { device_id: 'DEV005', type_name: '上位机', factory_version: 'v2.1' },
  { device_id: 'DEV005', type_name: '服务器', factory_version: 'v3.6' },
  { device_id: 'DEV005', type_name: '视觉', factory_version: 'v2.9' }
];

const sampleVersions = [
  // DEV001 机械模块版本
  { device_id: 'DEV001', type_name: '机械', version_number: 'v1.0', version_type: 'factory', release_date: '2023-01-15', description: '出厂版本', updated_by: '工程师A' },
  { device_id: 'DEV001', type_name: '机械', version_number: 'v1.1', version_type: 'update', release_date: '2023-03-20', description: '优化机械结构', updated_by: '工程师B' },
  
  // DEV001 电气模块版本
  { device_id: 'DEV001', type_name: '电气', version_number: 'v2.1', version_type: 'factory', release_date: '2023-02-10', description: '出厂版本', updated_by: '工程师C' },
  { device_id: 'DEV001', type_name: '电气', version_number: 'v2.2', version_type: 'update', release_date: '2023-04-15', description: '电气系统升级', updated_by: '工程师D' },
  
  // DEV002 电气模块版本
  { device_id: 'DEV002', type_name: '电气', version_number: 'v2.8', version_type: 'factory', release_date: '2023-01-20', description: '出厂版本', updated_by: '工程师E' },
  { device_id: 'DEV002', type_name: '电气', version_number: 'v2.9', version_type: 'update', release_date: '2023-05-10', description: '电气系统优化', updated_by: '工程师F' },
  
  // DEV003 上位机模块版本
  { device_id: 'DEV003', type_name: '上位机', version_number: 'v2.0', version_type: 'factory', release_date: '2023-03-01', description: '出厂版本', updated_by: '工程师G' },
  { device_id: 'DEV003', type_name: '上位机', version_number: 'v2.1', version_type: 'update', release_date: '2023-06-05', description: '上位机系统优化', updated_by: '工程师H' },
  
  // DEV004 服务器模块版本
  { device_id: 'DEV004', type_name: '服务器', version_number: 'v3.5', version_type: 'factory', release_date: '2023-02-15', description: '出厂版本', updated_by: '工程师I' },
  { device_id: 'DEV004', type_name: '服务器', version_number: 'v3.6', version_type: 'update', release_date: '2023-07-12', description: '服务器性能优化', updated_by: '工程师J' },
  
  // DEV005 视觉模块版本
  { device_id: 'DEV005', type_name: '视觉', version_number: 'v2.9', version_type: 'factory', release_date: '2023-04-01', description: '出厂版本', updated_by: '工程师K' },
  { device_id: 'DEV005', type_name: '视觉', version_number: 'v3.0', version_type: 'update', release_date: '2023-08-20', description: '视觉算法优化', updated_by: '工程师L' }
];

const sampleIssues = [
  {
    device_id: 'DEV001',
    module_type_name: '机械',
    description: '机械部件磨损严重，需要更换',
    severity: 'high',
    status: 'open',
    assignee: '维修工程师A'
  },
  {
    device_id: 'DEV002',
    module_type_name: '电气',
    description: '电气系统运行缓慢，需要优化',
    severity: 'medium',
    status: 'in_progress',
    assignee: '电气工程师B'
  },
  {
    device_id: 'DEV003',
    description: '上位机无法正常启动',
    severity: 'high',
    status: 'open',
    assignee: '系统工程师C'
  },
  {
    device_id: 'DEV004',
    module_type_name: '服务器',
    description: '服务器内存使用率过高',
    severity: 'medium',
    status: 'closed',
    assignee: '运维工程师D'
  },
  {
    device_id: 'DEV005',
    module_type_name: '视觉',
    description: '视觉检测精度不够',
    severity: 'low',
    status: 'in_progress',
    assignee: '算法工程师E'
  },
  {
    device_id: 'DEV001',
    description: '设备运行噪音过大',
    severity: 'low',
    status: 'closed',
    assignee: '维修工程师F'
  },
  {
    device_id: 'DEV002',
    description: '控制柜温度异常',
    severity: 'high',
    status: 'open',
    assignee: '电气工程师G'
  },
  {
    device_id: 'DEV003',
    module_type_name: '上位机',
    description: '上位机界面显示异常',
    severity: 'medium',
    status: 'closed',
    assignee: 'UI工程师H'
  }
];

// 子模块示例数据 - 使用设备ID和模块类型名称来动态匹配
const sampleSubmodules = [
  // 龙门设备A的机械模块子模块
  { device_id: 'DEV001', module_type_name: '机械', name: '主轴电机', model: 'SM-2000', factory_version: 'v2.0', current_version: 'v2.1', description: '主轴驱动电机', status: '正常' },
  { device_id: 'DEV001', module_type_name: '机械', name: '导轨系统', model: 'RG-500', factory_version: 'v1.5', current_version: 'v1.8', description: 'X轴导轨系统', status: '正常' },
  { device_id: 'DEV001', module_type_name: '机械', name: '丝杠传动', model: 'SB-300', factory_version: 'v1.5', current_version: 'v1.5', description: 'Y轴丝杠传动', status: '维护中' },
  
  // 龙门设备A的电气模块子模块
  { device_id: 'DEV001', module_type_name: '电气', name: '主控制器', model: 'PLC-3000', factory_version: 'v3.0', current_version: 'v3.2', description: '主控PLC', status: '正常' },
  { device_id: 'DEV001', module_type_name: '电气', name: '伺服驱动器', model: 'SD-1000', factory_version: 'v2.0', current_version: 'v2.0', description: '伺服电机驱动器', status: '正常' },
  { device_id: 'DEV001', module_type_name: '电气', name: '安全继电器', model: 'SR-200', factory_version: 'v1.0', current_version: 'v1.0', description: '安全保护继电器', status: '正常' },
  
  // 龙门设备A的上位机模块子模块
  { device_id: 'DEV001', module_type_name: '上位机', name: '工控机', model: 'IPC-5000', factory_version: 'v4.0', current_version: 'v4.1', description: '工业控制计算机', status: '正常' },
  { device_id: 'DEV001', module_type_name: '上位机', name: '触摸屏', model: 'HMI-1500', factory_version: 'v2.0', current_version: 'v2.3', description: '人机交互界面', status: '正常' },
  
  // 龙门设备A的服务器模块子模块
  { device_id: 'DEV001', module_type_name: '服务器', name: '数据库服务器', model: 'DB-SRV-2000', factory_version: 'v1.5', current_version: 'v1.5', description: '数据存储服务器', status: '正常' },
  { device_id: 'DEV001', module_type_name: '服务器', name: '应用服务器', model: 'APP-SRV-1000', factory_version: 'v2.0', current_version: 'v2.0', description: '应用程序服务器', status: '正常' },
  
  // 龙门设备A的视觉模块子模块
  { device_id: 'DEV001', module_type_name: '视觉', name: '工业相机', model: 'CAM-5000', factory_version: 'v3.0', current_version: 'v3.1', description: '高分辨率工业相机', status: '正常' },
  { device_id: 'DEV001', module_type_name: '视觉', name: '镜头组', model: 'LENS-200', factory_version: 'v1.2', current_version: 'v1.2', description: '变焦镜头组', status: '正常' },
  { device_id: 'DEV001', module_type_name: '视觉', name: '光源系统', model: 'LED-1000', factory_version: 'v2.0', current_version: 'v2.5', description: 'LED环形光源', status: '正常' },
  
  // 底盘设备B的机械模块子模块
  { device_id: 'DEV002', module_type_name: '机械', name: '底盘框架', model: 'CF-800', factory_version: 'v1.0', current_version: 'v1.0', description: '底盘主体框架', status: '正常' },
  { device_id: 'DEV002', module_type_name: '机械', name: '行走轮', model: 'WR-400', factory_version: 'v1.5', current_version: 'v1.5', description: '驱动行走轮', status: '正常' },
  
  // 底盘设备B的电气模块子模块
  { device_id: 'DEV002', module_type_name: '电气', name: '电机控制器', model: 'MC-600', factory_version: 'v2.0', current_version: 'v2.1', description: '行走电机控制器', status: '正常' },
  { device_id: 'DEV002', module_type_name: '电气', name: '传感器组', model: 'SENS-300', factory_version: 'v1.8', current_version: 'v1.8', description: '位置检测传感器', status: '正常' }
];

async function seedDatabase() {
  try {
    console.log('🌱 开始插入模拟数据...');
    
    let submoduleVersionMap = new Map();
    
    await transaction(async (connection) => {
      // 清空现有数据
      console.log('🗑️ 清空现有数据...');
      await connection.execute('DELETE FROM issues');
      await connection.execute('DELETE FROM submodules');
      await connection.execute('DELETE FROM module_versions');
      await connection.execute('DELETE FROM modules');
      await connection.execute('DELETE FROM devices');
      await connection.execute('DELETE FROM device_types');
      await connection.execute('DELETE FROM module_types');
      
      // 插入设备类型数据
      console.log('📋 插入设备类型数据...');
      for (const deviceType of sampleDeviceTypes) {
        await connection.execute(
          'INSERT INTO device_types (name, description) VALUES (?, ?)',
          [deviceType.name, deviceType.description]
        );
      }
      
      // 插入模块类型数据
      console.log('🔧 插入模块类型数据...');
      for (const moduleType of sampleModuleTypes) {
        await connection.execute(
          'INSERT INTO module_types (name, code, description) VALUES (?, ?, ?)',
          [moduleType.name, moduleType.code, moduleType.description]
        );
      }
      
      // 插入设备数据
      console.log('📱 插入设备数据...');
      for (const device of sampleDevices) {
        // 根据设备类型名称查找对应的ID
        const [deviceTypeResult] = await connection.execute(
          'SELECT id FROM device_types WHERE name = ?',
          [device.type_name]
        );
        
        if (deviceTypeResult.length > 0) {
          const typeId = deviceTypeResult[0].id;
          await connection.execute(
            'INSERT INTO devices (id, name, type_id, location, status) VALUES (?, ?, ?, ?, ?)',
            [device.id, device.name, typeId, device.location, device.status]
          );
        }
      }
      
      // 插入模块数据
      console.log('🔧 插入模块数据...');
      const moduleIdMap = new Map();
      for (const module of sampleModules) {
        // 根据模块类型名称查找对应的ID
        const [moduleTypeResult] = await connection.execute(
          'SELECT id FROM module_types WHERE name = ?',
          [module.type_name]
        );
        
        if (moduleTypeResult.length > 0) {
          const typeId = moduleTypeResult[0].id;
          const [result] =           await connection.execute(
            'INSERT INTO modules (device_id, type_id) VALUES (?, ?)',
            [module.device_id, typeId]
          );
          // 存储模块ID映射
          const key = `${module.device_id}_${typeId}`;
          moduleIdMap.set(key, result.insertId);
        }
      }
      
      // 插入版本数据
      console.log('📋 插入版本数据...');
      for (const version of sampleVersions) {
        // 根据模块类型名称查找对应的ID
        const [moduleTypeResult] = await connection.execute(
          'SELECT id FROM module_types WHERE name = ?',
          [version.type_name]
        );
        
        if (moduleTypeResult.length > 0) {
          const typeId = moduleTypeResult[0].id;
          // 根据设备ID和模块类型ID找到对应的模块ID
          const key = `${version.device_id}_${typeId}`;
          const moduleId = moduleIdMap.get(key);
          
          if (moduleId) {
            await connection.execute(
              'INSERT INTO module_versions (module_id, version_number, version_type, release_date, description, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
              [moduleId, version.version_number, version.version_type, version.release_date, version.description, version.updated_by]
            );
          }
        }
      }
      
      // 插入子模块数据
      console.log('🔧 插入子模块数据...');
      for (const submodule of sampleSubmodules) {
        // 根据设备ID和模块类型名称查找对应的模块ID
        const [moduleTypeResult] = await connection.execute(
          'SELECT id FROM module_types WHERE name = ?',
          [submodule.module_type_name]
        );
        
        if (moduleTypeResult.length > 0) {
          const typeId = moduleTypeResult[0].id;
          const key = `${submodule.device_id}_${typeId}`;
          const actualModuleId = moduleIdMap.get(key);
          
          if (actualModuleId) {
            await connection.execute(
              'INSERT INTO submodules (module_id, name, model, factory_version, current_version, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [actualModuleId, submodule.name, submodule.model, submodule.factory_version, submodule.current_version, submodule.description, submodule.status]
            );
          } else {
            console.log(`警告: 找不到模块键 ${key} 对应的实际模块`);
          }
        } else {
          console.log(`警告: 找不到模块类型 ${submodule.module_type_name}`);
        }
      }
      
      // 插入子模块版本历史数据
      console.log('📋 插入子模块版本历史数据...');
      
      // 获取所有子模块
      const [allSubmodules] = await connection.execute('SELECT id, name, factory_version, current_version FROM submodules');
      
      for (const submodule of allSubmodules) {
        // 插入出厂版本
        if (submodule.factory_version) {
          const factoryResult = await connection.execute(
            'INSERT INTO submodule_versions (submodule_id, version_number, version_type, release_date, description, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
            [submodule.id, submodule.factory_version, 'factory', '2024-01-01', `出厂版本 - ${submodule.name}`, '系统管理员']
          );
          submoduleVersionMap.set(`${submodule.id}_factory`, factoryResult.insertId);
        }
        
        // 如果当前版本与出厂版本不同，插入更新版本
        if (submodule.current_version && submodule.current_version !== submodule.factory_version) {
          const updateResult = await connection.execute(
            'INSERT INTO submodule_versions (submodule_id, version_number, version_type, release_date, description, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
            [submodule.id, submodule.current_version, 'update', '2024-06-01', `版本更新 - ${submodule.name}`, '维护工程师']
          );
          submoduleVersionMap.set(`${submodule.id}_update`, updateResult.insertId);
        }
      }
      
      // 插入问题数据
      console.log('🚨 插入问题数据...');
      for (const issue of sampleIssues) {
        let moduleId = null;
        if (issue.module_type_name) {
          // 根据模块类型名称查找对应的ID
          const [moduleTypeResult] = await connection.execute(
            'SELECT id FROM module_types WHERE name = ?',
            [issue.module_type_name]
          );
          
          if (moduleTypeResult.length > 0) {
            const typeId = moduleTypeResult[0].id;
            const key = `${issue.device_id}_${typeId}`;
            moduleId = moduleIdMap.get(key);
          }
        }
        
        await connection.execute(
          'INSERT INTO issues (device_id, module_id, description, severity, status, assignee) VALUES (?, ?, ?, ?, ?, ?)',
          [issue.device_id, moduleId, issue.description, issue.severity, issue.status, issue.assignee]
        );
      }
    });
    
    console.log('✅ 模拟数据插入完成！');
    console.log('');
    console.log('📊 数据统计:');
    console.log(`   - 设备类型: ${sampleDeviceTypes.length} 种`);
    console.log(`   - 模块类型: ${sampleModuleTypes.length} 种`);
    console.log(`   - 设备: ${sampleDevices.length} 台`);
    console.log(`   - 模块: ${sampleModules.length} 个`);
    console.log(`   - 子模块: ${sampleSubmodules.length} 个`);
    console.log(`   - 子模块版本: ${submoduleVersionMap.size} 个`);
    console.log(`   - 问题: ${sampleIssues.length} 个`);
    console.log('');
    console.log('🎯 现在可以启动前端应用查看数据了！');
    
  } catch (error) {
    console.error('❌ 插入模拟数据失败:', error);
    throw error;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 数据库种子数据插入完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 种子数据插入失败:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
