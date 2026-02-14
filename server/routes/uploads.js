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

// 上传留底材料
router.post('/productions', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '未检测到上传文件' });
        }

        let fileUrl = `/uploads/productions/${req.file.filename}`;
        let filePath = req.file.path;

        // 如果启用了OSS存储，上传到阿里云
        if (ossService.enabled) {
            try {
                const ossResult = await ossService.uploadFile(
                    req.file,
                    'productions', // 生产资料统一使用productions作为产品线名称
                    'productions'
                );
                filePath = ossResult.ossPath;
                fileUrl = ossResult.ossPath;

                // 上传成功后删除本地临时文件
                fs.unlinkSync(req.file.path);

                console.log(`✅ 生产资料已上传到OSS: ${filePath}`);
            } catch (ossError) {
                console.error('OSS上传失败，保存到本地:', ossError);
                // OSS上传失败时继续使用本地路径
            }
        }

        res.json({
            success: true,
            data: {
                url: fileUrl,
                name: req.file.originalname,
                size: req.file.size,
                path: filePath
            }
        });
    } catch (error) {
        console.error('上传生产资料失败:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: '上传生产资料失败',
            message: error.message
        });
    }
});

module.exports = router;
