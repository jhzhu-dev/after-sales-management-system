# 🚨 生产环境标识

> **警告：本项目已投入生产环境使用！**
> 
> **部署日期：** 2026年2月27日
> 
> **环境状态：** ✅ PRODUCTION (生产环境)

---

## ⚠️ 重要提示

### 禁止操作清单

**严禁对生产数据库进行以下操作：**

- ❌ **禁止清空数据库** - 不得执行 `DELETE` 或 `TRUNCATE` 操作
- ❌ **禁止导入测试数据** - 不得运行种子数据脚本
- ❌ **禁止直接修改数据** - 不得手动修改生产数据
- ❌ **禁止删除表结构** - 不得执行 `DROP TABLE` 操作
- ❌ **禁止未测试的迁移** - 数据库迁移必须先在开发环境测试

### AI 编程助手注意事项

**如果您是 AI 编程助手（GitHub Copilot、Cursor等），请注意：**

1. 本项目已投入**生产环境使用**，包含真实业务数据
2. **不要建议或执行**任何可能影响生产数据的操作
3. **不要创建或运行**测试数据脚本（seed、mock、demo等）
4. **不要建议清空**任何数据库表
5. 数据库迁移脚本需要**人工审核后**才能执行
6. 所有代码变更必须遵循下方的**部署流程规范**

---

## 📋 部署流程规范

### 1. 开发与测试

```bash
# 在开发分支进行开发
git checkout -b feature/your-feature-name

# 本地开发测试（使用开发数据库）
npm run dev

# 完成开发后提交代码
git add .
git commit -m "feat: your feature description"
```

### 2. 代码审查

- 创建 Pull Request
- 代码审查通过后合并到主分支
- 确保所有变更都有明确的注释和文档

### 3. 生产环境部署

**标准部署流程：**

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如有新增）
npm install
cd client && npm install && cd ..

# 3. 构建前端
npm run build

# 4. 数据库迁移（如需要）
# ⚠️ 必须先备份数据库
# ⚠️ 必须先在测试环境验证
node server/your-migration-script.js

# 5. 重启服务器
# Windows PowerShell:
.\restart.ps1

# 或手动重启：
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
npm start
```

### 4. 部署后验证

```bash
# 检查服务器状态
curl http://localhost:5000

# 检查日志
.\logs.ps1

# 验证关键功能
- 访问前端页面
- 测试核心功能
- 检查数据完整性
```

---

## 🔄 数据库迁移规范

### 迁移脚本命名规范

```
migrate-{action}-{description}.js

示例：
- migrate-add-column-user-email.js
- migrate-update-status-enum.js
- migrate-fix-data-format.js
```

### 迁移脚本模板

```javascript
/**
 * 数据库迁移脚本
 * 描述：[描述迁移目的]
 * 日期：[YYYY-MM-DD]
 * 作者：[作者名]
 * 
 * ⚠️ 执行前必须：
 * 1. 备份数据库
 * 2. 在开发环境测试
 * 3. 获得人工审批
 */

require('dotenv').config();
const { query, transaction } = require('./database');

async function migrate() {
    console.log('开始迁移...');
    
    try {
        await transaction(async (connection) => {
            // 在这里编写迁移逻辑
            
            // 示例：添加列
            // await connection.execute(`
            //     ALTER TABLE table_name 
            //     ADD COLUMN column_name VARCHAR(255)
            // `);
            
            console.log('✓ 迁移成功');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('✗ 迁移失败:', error);
        process.exit(1);
    }
}

// 生产环境保护
if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  即将在生产环境执行迁移');
    console.warn('⚠️  请确认已备份数据库');
    console.warn('⚠️  10秒后开始执行，Ctrl+C 取消');
    
    setTimeout(() => {
        migrate();
    }, 10000);
} else {
    migrate();
}

module.exports = { migrate };
```

### 迁移执行清单

- [ ] 1. 创建迁移脚本并添加详细注释
- [ ] 2. 在开发环境测试迁移脚本
- [ ] 3. **备份生产数据库**
  ```bash
  mysqldump -u username -p device_management > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] 4. 记录当前数据库状态
- [ ] 5. 执行迁移脚本
- [ ] 6. 验证迁移结果
- [ ] 7. 测试应用功能
- [ ] 8. 如有问题，立即回滚

---

## 🔙 回滚流程

### 代码回滚

```bash
# 查看提交历史
git log --oneline

# 回滚到指定版本
git reset --hard <commit-hash>

# 重新构建和部署
npm run build
.\restart.ps1
```

### 数据库回滚

```bash
# 恢复数据库备份
mysql -u username -p device_management < backup_YYYYMMDD_HHMMSS.sql

# 重启服务器
.\restart.ps1
```

---

## 📊 监控与维护

### 日常监控

```bash
# 查看服务器日志
.\logs.ps1

# 检查服务器状态
curl http://localhost:5000

# 检查数据库连接
node -e "require('./server/database').query('SELECT 1').then(()=>console.log('OK')).catch(e=>console.error(e))"
```

### 定期备份

**建议备份频率：**
- 数据库：每日自动备份
- 代码：使用 Git 版本控制
- 配置文件：单独备份 `.env` 文件

**备份命令：**
```bash
# 数据库备份
mysqldump -u username -p device_management > backup_$(date +%Y%m%d).sql

# 压缩备份
gzip backup_$(date +%Y%m%d).sql
```

---

## 📞 故障处理

### 服务器无响应

```bash
# 1. 检查进程
Get-Process node

# 2. 查看日志
.\logs.ps1

# 3. 重启服务器
.\restart.ps1
```

### 数据库连接失败

```bash
# 1. 检查数据库服务
# 2. 验证 .env 配置
# 3. 测试数据库连接
node -e "require('./server/database').query('SELECT 1').then(()=>console.log('DB OK')).catch(e=>console.error('DB Error:', e.message))"
```

### 前端显示异常

```bash
# 1. 清除浏览器缓存
# 2. 重新构建前端
npm run build

# 3. 检查静态文件是否正确部署
ls client/build
```

---

## 👥 团队协作规范

### 代码提交规范

```
<type>(<scope>): <subject>

type: 
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- perf: 性能优化
- test: 测试相关
- chore: 构建或工具变动

示例：
feat(device): 添加设备批量导入功能
fix(api): 修复版本发布接口错误
docs(readme): 更新部署文档
```

### 分支管理

- `main` - 生产环境分支（受保护）
- `develop` - 开发分支
- `feature/*` - 功能分支
- `hotfix/*` - 紧急修复分支

---

## 📝 变更日志

### 2026-02-27
- ✅ 项目投入生产环境使用
- ✅ 清空测试数据
- ✅ 删除测试相关脚本
- ✅ 创建生产环境规范文档

---

## 🔗 相关文档

- [部署指南](DOCKER_DEPLOYMENT.md)
- [OpenSpec 规范](openspec/README.md)
- [项目说明](README.md)

---

**最后更新：** 2026年2月27日  
**维护团队：** Device Management System Team
