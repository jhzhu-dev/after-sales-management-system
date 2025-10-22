/**
 * ID生成器类
 * 用于生成6位随机设备ID
 */
class IDGenerator {
  constructor() {
    this.usedIds = new Set();
  }

  /**
   * 生成6位随机ID
   * @returns {string} 6位随机ID
   */
  generate() {
    let id;
    let attempts = 0;
    const maxAttempts = 100; // 防止无限循环

    do {
      // 生成6位随机数字
      id = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('无法生成唯一ID，请重试');
      }
    } while (this.usedIds.has(id));

    this.usedIds.add(id);
    return id;
  }

  /**
   * 检查ID是否已被使用
   * @param {string} id - 要检查的ID
   * @returns {boolean} 是否已被使用
   */
  isUsed(id) {
    return this.usedIds.has(id);
  }

  /**
   * 释放ID（从已使用集合中移除）
   * @param {string} id - 要释放的ID
   */
  release(id) {
    this.usedIds.delete(id);
  }

  /**
   * 清空已使用的ID集合
   */
  clear() {
    this.usedIds.clear();
  }
}

module.exports = IDGenerator;
