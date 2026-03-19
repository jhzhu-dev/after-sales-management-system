const OSS = require('ali-oss');
const path = require('path');

/**
 * 阿里云OSS服务封装
 * 文件按产品线组织存储在 oss://els-pub-04/static/After-sales management system/{产品线名称}/
 */
class OSSService {
  constructor() {
    this.enabled = process.env.USE_OSS_STORAGE === 'true';
    
    if (this.enabled) {
      this.client = new OSS({
        region: process.env.OSS_REGION || 'oss-cn-shanghai',
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET || 'els-pub-04',
      });
      this.basePath = process.env.OSS_BASE_PATH || 'static/After-sales management system';
      this.bucket = process.env.OSS_BUCKET || 'els-pub-04';
      
      console.log('✅ 阿里云OSS服务已启用');
      console.log(`📦 Bucket: ${this.bucket}`);
      console.log(`📂 基础路径: ${this.basePath}`);
    } else {
      console.log('ℹ️ 阿里云OSS服务未启用，使用本地文件存储');
    }
  }

  /**
   * 标准化产品线名称用于路径
   * 移除特殊字符，将空格替换为下划线
   */
  normalizeProductLineName(productLineName) {
    if (!productLineName) return 'unknown';
    return productLineName
      .replace(/[<>:"/\\|?*]/g, '') // 移除文件系统不允许的字符
      .replace(/\s+/g, '_')          // 空格替换为下划线
      .trim();
  }

  /**
   * 标准化产品型号用于路径
   * 移除特殊字符，将空格替换为下划线
   */
  normalizeProductModel(productModel) {
    if (!productModel) return 'default';
    return productModel
      .replace(/[<>:"/\\|?*]/g, '') // 移除文件系统不允许的字符
      .replace(/\s+/g, '_')          // 空格替换为下划线
      .trim();
  }

  /**
   * 构建OSS完整路径
   * @param {string} productLineName - 产品线名称
   * @param {string} productModel - 产品型号（可选）
   * @param {string} fileName - 文件名
   * @param {string} category - 文件类别 (product-documents, productions)
   */
  buildOSSPath(productLineName, productModel, fileName, category = 'product-documents') {
    const normalizedProductLine = this.normalizeProductLineName(productLineName);
    
    if (category === 'productions') {
      // 生产资料统一存储在 productions 目录下
      return `${this.basePath}/productions/${fileName}`;
    }
    
    // 产品文档按 Product Line Information/产品线/产品型号 层级存储
    if (productModel) {
      const normalizedModel = this.normalizeProductModel(productModel);
      return `${this.basePath}/Product Line Information/${normalizedProductLine}/${normalizedModel}/${fileName}`;
    }
    
    // 如果没有产品型号，只按产品线存储
    return `${this.basePath}/Product Line Information/${normalizedProductLine}/${fileName}`;
  }

  /**
   * 上传文件到OSS
   * @param {Object} file - Multer上传的文件对象
   * @param {string} productLineName - 产品线名称
   * @param {string} productModel - 产品型号（可选）
   * @param {string} category - 文件类别
   * @returns {Promise<Object>} 包含ossPath和url的对象
   */
  async uploadFile(file, productLineName, productModel = null, category = 'product-documents') {
    if (!this.enabled) {
      throw new Error('OSS服务未启用');
    }

    try {
      const fileName = path.basename(file.path || file.filename);
      const ossPath = this.buildOSSPath(productLineName, productModel, fileName, category);
      
      // 上传文件
      const result = await this.client.put(ossPath, file.path);
      
      console.log(`✅ 文件上传成功: ${ossPath}`);
      
      // 返回OSS路径格式
      return {
        ossPath: `oss://${this.bucket}/${ossPath}`,
        url: result.url,
        name: result.name
      };
    } catch (error) {
      console.error('❌ OSS上传失败:', error);
      throw new Error(`文件上传到OSS失败: ${error.message}`);
    }
  }

  /**
   * 生成带签名的下载URL
   * @param {string} filePath - OSS文件路径 (格式: oss://bucket/path/to/file)
   * @param {number} expiresInSeconds - URL有效期（秒），默认1小时
   * @param {string|null} fileName - 下载时使用的文件名（原始文件名），为空则不指定
   * @returns {Promise<string>} 签名URL
   */
  async getSignedUrl(filePath, expiresInSeconds = 3600, fileName = null) {
    if (!this.enabled) {
      throw new Error('OSS服务未启用');
    }

    try {
      // 解析OSS路径
      const ossPathMatch = filePath.match(/^oss:\/\/([^\/]+)\/(.+)$/);
      if (!ossPathMatch) {
        throw new Error('无效的OSS路径格式');
      }

      const [, bucket, objectName] = ossPathMatch;

      // 构建 Content-Disposition，携带原始文件名（RFC 5987 编码，正确支持中文）
      const disposition = fileName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        : 'attachment';

      // 生成签名URL
      const url = this.client.signatureUrl(objectName, {
        expires: expiresInSeconds,
        response: {
          'content-disposition': disposition
        }
      });

      return url;
    } catch (error) {
      console.error('❌ 生成签名URL失败:', error);
      throw new Error(`生成下载链接失败: ${error.message}`);
    }
  }

  /**
   * 从OSS删除文件
   * @param {string} filePath - OSS文件路径 (格式: oss://bucket/path/to/file)
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteFile(filePath) {
    if (!this.enabled) {
      throw new Error('OSS服务未启用');
    }

    try {
      // 解析OSS路径
      const ossPathMatch = filePath.match(/^oss:\/\/([^\/]+)\/(.+)$/);
      if (!ossPathMatch) {
        throw new Error('无效的OSS路径格式');
      }

      const [, bucket, objectName] = ossPathMatch;
      
      // 删除文件
      await this.client.delete(objectName);
      
      console.log(`✅ 文件删除成功: ${filePath}`);
      return true;
    } catch (error) {
      console.error('❌ OSS删除失败:', error);
      throw new Error(`从OSS删除文件失败: ${error.message}`);
    }
  }

  /**
   * 列出指定路径下的文件
   * @param {string} productLineName - 产品线名称
   * @param {string} category - 文件类别
   * @returns {Promise<Array>} 文件列表
   */
  async listFiles(productLineName, category = 'product-documents') {
    if (!this.enabled) {
      throw new Error('OSS服务未启用');
    }

    try {
      const prefix = this.buildOSSPath(productLineName, '', category).replace(/\/$/, '') + '/';
      
      const result = await this.client.list({
        prefix: prefix,
        'max-keys': 1000
      });

      return result.objects || [];
    } catch (error) {
      console.error('❌ OSS列表查询失败:', error);
      throw new Error(`查询文件列表失败: ${error.message}`);
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - OSS文件路径
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    if (!this.enabled) {
      return false;
    }

    try {
      const ossPathMatch = filePath.match(/^oss:\/\/([^\/]+)\/(.+)$/);
      if (!ossPathMatch) {
        return false;
      }

      const [, bucket, objectName] = ossPathMatch;
      await this.client.head(objectName);
      return true;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 判断路径是否为OSS路径
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  isOSSPath(filePath) {
    return filePath && filePath.startsWith('oss://');
  }

  /**
   * 构建设备文件夹名称（用于OSS路径）
   * 格式: {客户简称}-{生产序列号}-{订单号}-{产品名}
   * @param {Object} device - 设备对象，需包含 id, name, customer_short_name|customer_name, product_name|product_model
   * @returns {string} 安全的设备文件夹名称
   */
  buildDeviceFolder(device) {
    const safe = (s) => (s || 'unknown').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim();
    const customer = safe(device.customer_short_name || device.customer_name);
    const serial   = safe(device.id);
    const order    = safe(device.name);
    const product  = safe(device.product_name || device.product_model);
    return `${customer}-${serial}-${order}-${product}`;
  }

  /**
   * 统一路径构建器（新规范）
   * @param {string} type - 路径类型
   *   'product-docs'              → product-docs/{产品线}/{型号}/{文件名}
   *   'device-docs'               → devices/{设备标识}/device-docs/{分类}/{文件名}
   *   'issue-attachments-pending' → devices/{设备标识}/issues/pending/{文件名}
   *   'issue-attachments'         → devices/{设备标识}/issues/{issueId}/{文件名}
   *   'issue-log-attachments'     → devices/{设备标识}/issues/{issueId}/logs/{文件名}
   * @param {Object} params - 路径参数
   * @returns {string} OSS 对象 key（不含 oss://bucket/ 前缀）
   */
  buildPathByType(type, params) {
    const safe = (s) => (s || 'unknown').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim();
    const base = this.basePath;

    switch (type) {
      case 'product-docs': {
        const safe2 = (s) => (s || '').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').trim();
        const modelFolder = safe2(params.productModel)
          ? (safe2(params.productName)
              ? `${safe2(params.productModel)}-${safe2(params.productName)}`
              : safe2(params.productModel))
          : (safe2(params.productName) || 'default');
        const docFolder = safe(params.docType) || '\u4ea7\u54c1\u6587\u6863';
        return `${base}/Product Line Information/${safe(params.productLine)}/${modelFolder}/${docFolder}/${params.fileName}`;
      }

      case 'device-docs': {
        const deviceFolder = this.buildDeviceFolder(params.device);
        return `${base}/devices/${deviceFolder}/device-docs/${safe(params.category)}/${params.fileName}`;
      }

      case 'issue-attachments-pending': {
        const deviceFolder = this.buildDeviceFolder(params.device);
        return `${base}/devices/${deviceFolder}/issues/pending/${params.fileName}`;
      }

      case 'issue-attachments': {
        const deviceFolder = this.buildDeviceFolder(params.device);
        return `${base}/devices/${deviceFolder}/issues/${params.issueId}/${params.fileName}`;
      }

      case 'issue-log-attachments': {
        const deviceFolder = this.buildDeviceFolder(params.device);
        return `${base}/devices/${deviceFolder}/issues/${params.issueId}/logs/${params.fileName}`;
      }

      case 'checklist-attachments': {
        const deviceFolder = this.buildDeviceFolder(params.device);
        const moduleFolder = safe(params.moduleType || 'unknown-module');
        const versionFolder = params.versionFolder || 'checklist';
        return `${base}/devices/${deviceFolder}/module-versions/${moduleFolder}/${versionFolder}/${params.fileName}`;
      }

      default:
        throw new Error(`buildPathByType: 未知路径类型 "${type}"`);
    }
  }

  /**
   * 将 OSS 对象从旧路径移动到新路径（CopyObject + DeleteObject）
   * @param {string} oldOssPath - 源路径（oss://bucket/key 格式）
   * @param {string} newOssPath - 目标路径（oss://bucket/key 格式）
   */
  async moveObject(oldOssPath, newOssPath) {
    if (!this.enabled) throw new Error('OSS服务未启用');

    const parseOss = (p) => {
      const m = p.match(/^oss:\/\/([^/]+)\/(.+)$/);
      if (!m) throw new Error(`无效的OSS路径: ${p}`);
      return { bucket: m[1], key: m[2] };
    };

    const src = parseOss(oldOssPath);
    const dst = parseOss(newOssPath);

    // 复制到新位置（同桶内 copy，第二参数为源 key 字符串）
    await this.client.copy(dst.key, src.key);
    // 删除旧位置
    await this.client.delete(src.key);

    console.log(`✅ OSS对象已移动: ${src.key} → ${dst.key}`);
  }
}

// 导出单例
module.exports = new OSSService();
