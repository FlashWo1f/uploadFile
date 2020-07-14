<template>
   <div>
    <input type="file" @change="handleFileChange" />
    <el-button @click="handleUpload">上传</el-button>
  </div>
</template>

<script>
import { request } from '../api'
// 切片大小
const SIZE = 0.1 * 1024 * 1024
// const SIZE = 10 * 1024 * 1024
export default {
  name: 'helloworld',
  data: () => ({
    container: {
      file: null
    },
    data: []
  }),
  methods: {
     handleFileChange(e) {
      const [file] = e.target.files;
      // console.log("?", this.$data, this.$options.data(), Object.assign(this.$data, this.$options.data()))
      if (!file) return;
      Object.assign(this.$data, this.$options.data());
      this.container.file = file;
    },
    async handleUpload() {
      if (!this.container.file) return;
      const fileChunkList = this.createFileChunk(this.container.file)
      this.data = fileChunkList.map(({ file }, idx) => ({
        chunk: file,
        hash: this.container.file.name + "-" + idx // 文件名 + 数组下标
      }))
      await this.uploadChunks()
    },
    // 生成文件切片
    createFileChunk(file, size = SIZE) {
      const fileChunkList = []
      let cur = 0 
      while(cur < file.size) {
        fileChunkList.push({ file: file.slice(cur, cur + size) })
        cur += size;
      }
      return fileChunkList
    },
    // 上传切片
    async uploadChunks() {
      const requestList = this.data.map(({chunk, hash}) => {
        const formData = new FormData()
        formData.append("chunk", chunk)
        formData.append("hash", hash)
        formData.append("filename", this.container.file.name)
        return { formData }
      })
      .map(async ({ formData }) =>
        request({
          url: "http://localhost:3000",
          data: formData
        })
      )
      // 并发切片
      await Promise.all(requestList)
      // 合并切片
      await this.mergeRequest()
    },
    async mergeRequest(size = SIZE) {
      await request({
        url: "http://localhost:3000/merge",
        headers: {
          "content-type": "application/json"
        },
        data: JSON.stringify({
          filename: this.container.file.name,
          size
        })
      })
    }
  }
};
</script>