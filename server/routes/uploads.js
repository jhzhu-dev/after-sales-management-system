const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ossService = require('../services/oss-service');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/productions');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ⚠️ DEPRECATED: 生产留底资料接口已废弃
// 生产留底资料概念已归并到「设备出厂资料」(device-documents)。
// 请通过 POST /api/device-documents/upload 上传，分类名填「生产留底」。
router.post('/productions', async (req, res) => {
    res.status(410).json({
        success: false,
        error: '此接口已废弃',
        message: '生产留底资料请改用 POST /api/device-documents/upload（分类填"生产留底"），需传入 device_id 字段。'
    });
});

module.exports = router;
