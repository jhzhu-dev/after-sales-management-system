# 多阶段构建 - 前端构建阶段
FROM node:18-alpine AS frontend-builder
WORKDIR /app/client

# 复制前端依赖文件
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps

# 复制前端源码并构建
COPY client/ ./
RUN npm run build

# 后端运行阶段
FROM node:18-alpine
WORKDIR /app

# 安装后端依赖
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

# 复制后端代码
COPY server/ ./server/
COPY id-generator.js ./

# 复制前端构建产物
COPY --from=frontend-builder /app/client/build ./client/build

# 创建上传目录
RUN mkdir -p uploads/product-documents uploads/productions

# 暴露端口
EXPOSE 5000

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["node", "server/index.js"]
