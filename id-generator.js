/**
 * 6位随机ID生成器
 * 使用数字和英文字母（大小写）组成
 */

class IDGenerator {
  constructor() {
    // 字符集：数字0-9，大写字母A-Z，小写字母a-z
    this.charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    this.length = 6;
  }

  /**
   * 生成单个随机ID
   * @returns {string} 6位随机ID
   */
  generate() {
    let result = '';
    for (let i = 0; i < this.length; i++) {
      result += this.charset.charAt(Math.floor(Math.random() * this.charset.length));
    }
    return result;
  }

  /**
   * 生成多个不重复的ID
   * @param {number} count 需要生成的ID数量
   * @returns {string[]} ID数组
   */
  generateMultiple(count) {
    const ids = new Set();
    while (ids.size < count) {
      ids.add(this.generate());
    }
    return Array.from(ids);
  }

  /**
   * 验证ID格式是否正确
   * @param {string} id 要验证的ID
   * @returns {boolean} 是否有效
   */
  isValid(id) {
    if (!id || typeof id !== 'string') return false;
    if (id.length !== this.length) return false;
    
    // 检查是否只包含允许的字符
    for (const char of id) {
      if (!this.charset.includes(char)) return false;
    }
    
    return true;
  }

  /**
   * 获取可能的ID总数
   * @returns {number} 可能的ID总数
   */
  getTotalPossible() {
    return Math.pow(this.charset.length, this.length);
  }
}

// 测试ID生成器
function testIDGenerator() {
  const generator = new IDGenerator();
  
  console.log('🧪 测试ID生成器...');
  console.log('字符集长度:', generator.charset.length);
  console.log('可能的ID总数:', generator.getTotalPossible().toLocaleString());
  
  // 生成10个ID进行测试
  console.log('\n生成10个测试ID:');
  for (let i = 0; i < 10; i++) {
    const id = generator.generate();
    console.log(`${i + 1}. ${id} (有效: ${generator.isValid(id)})`);
  }
  
  // 测试批量生成
  console.log('\n批量生成5个不重复ID:');
  const multipleIds = generator.generateMultiple(5);
  multipleIds.forEach((id, index) => {
    console.log(`${index + 1}. ${id}`);
  });
  
  // 测试ID验证
  console.log('\n测试ID验证:');
  const testIds = ['ABC123', 'abc123', '123456', 'ABCDEF', '12345', '1234567', 'ABC@123'];
  testIds.forEach(id => {
    console.log(`${id}: ${generator.isValid(id) ? '✅ 有效' : '❌ 无效'}`);
  });
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  testIDGenerator();
}

module.exports = IDGenerator;
