const { query } = require('./database');

async function fixProductLineMismatch() {
  try {
    console.log('🔍 开始检查产品线数据一致性...\n');

    // 1. 查看所有产品线
    console.log('===== 步骤1: 查看所有产品线 =====');
    const productLines = await query('SELECT id, name, is_active FROM product_lines ORDER BY id');
    console.table(productLines);

    // 2. 查看所有产品及其产品线关联
    console.log('\n===== 步骤2: 查看所有产品 =====');
    const products = await query(`
      SELECT p.id, p.name, p.product_line_id, pl.name as product_line_name, p.model, p.is_active
      FROM products p
      LEFT JOIN product_lines pl ON p.product_line_id = pl.id
      ORDER BY p.id
    `);
    console.table(products);

    // 3. 查找龙门相关的产品线
    console.log('\n===== 步骤3: 查找龙门产品线 =====');
    const longmenLines = productLines.filter(pl => pl.name.includes('龙门'));
    console.log('找到的龙门产品线:');
    console.table(longmenLines);

    // 4. 查找龙门相关的产品
    console.log('\n===== 步骤4: 查找龙门产品 =====');
    const longmenProducts = products.filter(p => p.name && p.name.includes('龙门'));
    console.log('找到的龙门产品:');
    console.table(longmenProducts);

    // 5. 分析问题
    console.log('\n===== 步骤5: 问题分析 =====');
    if (longmenLines.length > 1) {
      console.log('⚠️  发现多个龙门产品线记录！');
      console.log('建议: 保留一个正确的产品线ID，删除重复的');
    }

    if (longmenProducts.length > 0) {
      const uniqueLineIds = [...new Set(longmenProducts.map(p => p.product_line_id))];
      console.log(`龙门产品关联的产品线ID: ${uniqueLineIds.join(', ')}`);
      
      if (longmenLines.length > 0) {
        const correctLineId = longmenLines[0].id;
        const needsUpdate = longmenProducts.some(p => p.product_line_id !== correctLineId);
        
        if (needsUpdate) {
          console.log(`\n💡 解决方案: 将所有龙门产品的product_line_id统一为 ${correctLineId}`);
          
          // 询问是否执行修复
          console.log('\n是否执行修复? (请手动确认)');
          console.log('执行以下SQL命令:');
          console.log(`UPDATE products SET product_line_id = ${correctLineId} WHERE name LIKE '%龙门%';`);
          
          // 如果确认，执行修复
          const shouldFix = process.env.AUTO_FIX === 'true';
          if (shouldFix) {
            console.log('\n✅ 开始修复...');
            const result = await query(
              `UPDATE products SET product_line_id = ? WHERE name LIKE '%龙门%'`,
              [correctLineId]
            );
            console.log(`✅ 已更新 ${result.affectedRows} 条产品记录`);
            
            // 验证修复结果
            const updatedProducts = await query(`
              SELECT p.id, p.name, p.product_line_id, pl.name as product_line_name
              FROM products p
              LEFT JOIN product_lines pl ON p.product_line_id = pl.id
              WHERE p.name LIKE '%龙门%'
            `);
            console.log('\n===== 修复后的龙门产品 =====');
            console.table(updatedProducts);
          }
        } else {
          console.log('✅ 数据一致，无需修复');
        }
      }
    }

    // 6. 提供手动修复建议
    console.log('\n===== 手动修复建议 =====');
    if (longmenLines.length > 1) {
      console.log('1. 确定哪个产品线ID是正确的（通常是ID最小的那个）');
      console.log('2. 删除重复的产品线记录');
      console.log('3. 更新所有产品的product_line_id为正确的ID');
    }
    
    console.log('\n如果要自动执行修复，请运行:');
    console.log('AUTO_FIX=true node server/fix-product-line-mismatch.js');

  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixProductLineMismatch();
