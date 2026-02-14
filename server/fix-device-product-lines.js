const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'els',
  password: '111111',
  database: 'device_management'
};

// 产品线匹配规则
const matchProductLine = (deviceName, productLines) => {
  const nameLower = deviceName.toLowerCase();
  
  // 匹配规则：根据设备名称中的关键词确定产品线
  // 优先级：龙门 > 底盘 > 胎纹 > 侧扫 > 大盒子
  if (nameLower.includes('龙门') || nameLower.includes('longmen')) {
    return productLines.find(pl => pl.name.includes('龙门'));
  }
  if (nameLower.includes('底盘') || nameLower.includes('dipan')) {
    return productLines.find(pl => pl.name.includes('底盘'));
  }
  if (nameLower.includes('胎纹') || nameLower.includes('taiwen')) {
    return productLines.find(pl => pl.name.includes('胎纹'));
  }
  if (nameLower.includes('侧扫') || nameLower.includes('cesao')) {
    return productLines.find(pl => pl.name.includes('侧扫'));
  }
  if (nameLower.includes('大盒子') || nameLower.includes('dahezi') || nameLower.includes('盒子')) {
    return productLines.find(pl => pl.name.includes('大盒子'));
  }
  
  return null;
};

async function fixDeviceProductLines() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    
    // 获取所有产品线
    console.log('获取产品线列表...');
    const [productLines] = await connection.execute(
      'SELECT id, name, code FROM product_lines WHERE is_active = 1'
    );
    console.log(`找到 ${productLines.length} 个产品线:`, productLines.map(p => p.name).join(', '));
    
    // 获取所有设备
    console.log('\n获取所有设备...');
    const [devices] = await connection.execute(
      'SELECT id, name, product_line_id FROM devices'
    );
    console.log(`找到 ${devices.length} 个设备\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // 遍历每个设备，根据名称匹配产品线
    for (const device of devices) {
      const matchedProductLine = matchProductLine(device.name, productLines);
      
      if (matchedProductLine) {
        if (device.product_line_id !== matchedProductLine.id) {
          console.log(`更新设备: ${device.name}`);
          console.log(`  原产品线ID: ${device.product_line_id} -> 新产品线: ${matchedProductLine.name} (ID: ${matchedProductLine.id})`);
          
          await connection.execute(
            'UPDATE devices SET product_line_id = ? WHERE id = ?',
            [matchedProductLine.id, device.id]
          );
          updatedCount++;
        } else {
          console.log(`跳过设备 "${device.name}": 产品线已经正确 (${matchedProductLine.name})`);
          skippedCount++;
        }
      } else {
        console.log(`⚠️  无法为设备 "${device.name}" 匹配产品线`);
      }
    }
    
    console.log('\n=== 更新完成 ===');
    console.log(`更新了 ${updatedCount} 个设备`);
    console.log(`跳过了 ${skippedCount} 个设备（已正确）`);
    console.log(`无法匹配 ${devices.length - updatedCount - skippedCount} 个设备`);
    
  } catch (error) {
    console.error('发生错误:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行脚本
fixDeviceProductLines()
  .then(() => {
    console.log('✅ 脚本执行成功');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
