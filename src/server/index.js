const http = require("http");
const path = require("path");
const fse = require("fs-extra");
const multiparty = require("multiparty");
const server = http.createServer();
// http://nodejs.cn/api/path.html#path_path_resolve_paths
const UPLOAD_DIR = path.resolve(__dirname, "..", "target"); // 大文件存储目录

const resolvePost = req =>
  new Promise(resolve => {
    let chunk = ''
    req.on('data', (data) => {
      chunk += data
    })
    req.on('end', () => {
      resolve(JSON.parse(chunk))
    })
  })

const pipeStream = (path, writeStream) =>
  new Promise(resolve => {
    const readStream = fse.createReadStream(path);
    readStream.on("end", () => {
      fse.unlinkSync(path);
      resolve();
    });
    readStream.pipe(writeStream);
  });

// 合并切片
const mergeFileChunk = async (filePath, fileName, size) => {
  // + 222 避免用**.jpg作为文件夹
  const chunkDir = path.resolve(UPLOAD_DIR, fileName + '222')
  const chunkPaths = await fse.readdir(chunkDir)
  // 根据切片下标进行排序
  chunkPaths.sort((a, b) => a.split('-~-')[1] - b.split('-~-')[1])
  console.log('排序', chunkPaths)
  await Promise.all(
    chunkPaths.map((chunkPath, index) => {
      return pipeStream(
        path.resolve(chunkDir, chunkPath),
        // 指定位置创建可写流
        fse.createWriteStream(filePath, {
          start: Math.floor(index * size),
          end: Math.floor((index + 1) * size)
        })
      )
    }
    )
  )
  fse.rmdirSync(chunkDir); // 合并后删除保存切片的目录
}

server.on("request", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.status = 200;
    res.end();
    return;
  }
  const multipart = new multiparty.Form()
  multipart.parse(req, async (err, fields, files) => {
    if (err) return;
    // console.log("files...", files, fields)
    const [chunk] = files.chunk
    const [hash] = fields.hash
    const [filename] = fields.filename
    const chunkDir = path.resolve(UPLOAD_DIR, filename + '222')
    // 切片目录不存在，创建切片目录
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir);
    }
    await fse.move(chunk.path, `${chunkDir}/${hash}`);
    res.end("received file chunk");
  })
  console.log('req.url', req.url)
  if (req.url === "/merge") {
    const data = await resolvePost(req);
    const { filename, size } = data;
    const filePath = path.resolve(UPLOAD_DIR, `${filename}`);
    await mergeFileChunk(filePath, filename, size);
    res.end(
      JSON.stringify({
        code: 0,
        message: "file merged success"
      })
    );
   }
});



server.listen(3000, () => console.log("正在监听 3000 端口"));
