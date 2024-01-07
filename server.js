const express = require("express");
const multer = require("multer");
const path = require("path");
const https = require('https');
const fs = require("fs");


// // 将两个证书文件读取放到options对象中
// // 使用readFileSync()方法，顺序地执行读文件和启动服务操作
// const options = {
//   key: fs.readFileSync('./mengke.yaodaibang.com.key'),
//   cert: fs.readFileSync('./mengke.yaodaibang.com.pem')
// };

// 读取SSL证书和私钥
const privateKey = fs.readFileSync(path.join(__dirname, 'mengke.yaodaibang.com.key'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'mengke.yaodaibang.com.pem'), 'utf8');
const credentials = { key: privateKey, cert: certificate };

// 临时保存文件名信息
let tempUploads = {};
// 时间戳格式化函数
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// 设置存储选项
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // // 使用格式化的当前时间戳作为文件名
    // console.log(file)
    // console.log(req)
    // // 从req.body中获取编码
    // const patientCode = req.body.patientCode || 'unknown';
    // const doctorCode = req.body.doctorCode || 'unknown';
    // const hospitalCode = req.body.hospitalCode || 'unknown';

    // const timestamp = formatTimestamp(Date.now());
    // cb(null, `${patientCode}-${doctorCode}-${hospitalCode}-${timestamp}.wav`); // 设置文件扩展名为 .wav
    // 直接使用时间戳作为文件名的一部分，确保唯一性
    const timestamp = formatTimestamp(Date.now());
    // 仅设置文件扩展名为 .wav，实际的文件名将在后续处理中设置
    const tempFilename = `${timestamp}.wav`;
    tempUploads[tempFilename] = { file: file };
    cb(null, tempFilename);
  },
});

const upload = multer({ storage: storage });

// 创建express应用
const app = express();

// 允许跨域请求
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// 提供静态文件服务
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// 处理文件上传的POST请求
app.post("/upload", upload.single("audio"), function (req, res) {
  // 在这里，req.file 已经被处理，我们可以访问 req.body 来获取其他字段
  if (req.file) {
    // 获取临时文件名
    const tempFilename = req.file.filename;
    // 从临时存储中获取文件信息
    const fileInfo = tempUploads[tempFilename];

    // 检查是否有必要的字段信息
    if (req.body.patientCode && req.body.doctorCode && req.body.hospitalCode) {
      // 构建新的文件名
      const newFilename = `H-${req.body.hospitalCode}-D-${req.body.doctorCode}-P-${req.body.patientCode}-${tempFilename}`;
      // 获取文件的旧路径和新路径
      const oldPath = path.join("uploads", tempFilename);
      const newPath = path.join("uploads", newFilename);

      // 重命名文件
      fs.rename(oldPath, newPath, (err) => {
        if (err) {
          console.error("Error renaming file:", err);
          delete tempUploads[tempFilename]; // 清理临时存储
          return res.json({ success: false });
        }
        // 清理临时存储
        delete tempUploads[tempFilename];
        res.json({
          success: true,
          audioName: newFilename,
          audioUrl: `/uploads/${newFilename}`,
        });
      });
    } else {
      // 如果没有接收到所有的编码参数，返回错误
      delete tempUploads[tempFilename]; // 清理临时存储
      res.json({
        success: false,
        message: "Missing codes in the request body.",
      });
    }
  } else {
    res.json({ success: false, message: "File upload failed." });
  }
});

app.get("/files", function (req, res) {
  const directoryPath = path.join(__dirname, "uploads/");
  fs.readdir(directoryPath, function (err, files) {
    if (err) {
      res.status(500).send("Unable to scan files!");
    } else {
      // 过滤文件列表以仅包含.webm文件
      let fileInfos = files
        .filter((file) => path.extname(file).toLowerCase() === ".wav")
        .map((file) => {
          return {
            name: file,
            url: `/uploads/${file}`,
          };
        });
      res.send(fileInfos);
    }
  });
});

// 确保uploads目录存在
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// 特定文件的路由
app.get("/sweep_signal.wav", (req, res) => {
  // 文件路径
  const audioPath = path.join(__dirname, "public", "sweep_signal.wav");

  // 设置缓存相关的头信息
  res.setHeader("Cache-Control", "public, max-age=31536000"); // 缓存1年
  // res.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString()); // 设置Expires头
  // res.setHeader("ETag", "specific-audio-file-version"); // 设置一个假设的ETag值

  // 发送文件
  res.sendFile(audioPath);
});

// 设置服务器端口
const PORT = process.env.PORT || 3000;

// 启动服务器
app.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}`);
});

// 创建HTTPS服务器
const httpsServer = https.createServer(credentials, app);

// 设置HTTPS服务器监听的端口
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// 让服务器开始监听请求
httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});