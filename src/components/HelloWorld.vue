<template>
   <div class='container'>
    <input type="file" @change="handleFileChange" />
    <el-button @click="handleUpload">上传</el-button>
    <h2>上传《{{container.file && container.file.name}}》总进度</h2>
    <el-progress :percentage="uploadPercentage"></el-progress>
    <el-table
      :data="data"
      stripe
      style="width: 100%">
      <el-table-column
        prop="hash"
        label="切片"
        width="180">
      </el-table-column>
      <el-table-column
        label="大小(kb)"
        width="180" v-slot='{row:{ chunk: { size } }}'>
        {{ (size / 1024).toFixed(1) }}
      </el-table-column>
      <el-table-column
        prop="percentage"
        label="进度" v-slot='{row:{ percentage }}'>
        <el-progress :percentage="percentage"></el-progress>
      </el-table-column>
    </el-table>
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
  mounted() {
    // console.log("this.data", this.data)
  },
  computed: {
    uploadPercentage() {
      if (!this.container.file || !this.data.length) return 0;
      const loaded = this.data
        .map(item => item.chunk.size * item.percentage)
        .reduce((acc, cur) => acc + cur);
      // console.log("loaded", loaded)
      return parseInt((loaded / this.container.file.size).toFixed(2));
    }
  },
  methods: {
     handleFileChange(e) {
      const [file] = e.target.files;
      console.log("??file", file)
      // console.log("?", this.$data, this.$options.data(), Object.assign(this.$data, this.$options.data()))
      if (!file) return;
      Object.assign(this.$data, this.$options.data());
      this.container.file = file;
    },
    async handleUpload() {
      if (!this.container.file) return;
      const fileChunkList = this.createFileChunk(this.container.file)
      this.data = fileChunkList.map(({ file }, index) => ({
        chunk: file,
        index,
        hash: this.container.file.name + "-" + index, // 文件名 + 数组下标
        percentage: 0
      }))
      // console.log(2333,this.data)
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
      console.log("!!", fileChunkList)
      return fileChunkList
    },
    // 上传切片
    async uploadChunks() {
      const requestList = this.data.map(({chunk, hash, index}) => {
        const formData = new FormData()
        formData.append("chunk", chunk)
        formData.append("hash", hash)
        formData.append("filename", this.container.file.name)
        return { formData, index }
      })
      .map(async ({ formData, index }) =>
        request({
          url: "http://localhost:3000",
          data: formData,
          onProgress: this.createProgressHandler(this.data[index])
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
    },
    createProgressHandler(item) {
      return e => {
        // console.log("whhat", e)
        item.percentage = parseInt(String((e.loaded / e.total) * 100));
      }
    }
  }
};
</script>

<style lang="stylus" scoped>
  .container {
    width 100%
    padding 50px
    box-sizing border-box
  }
</style>