# Lumos

Lumos 是一个高性能的前端打包工具，参考 Vite 实现，提供亚秒级的冷启动和高效的热模块替换（HMR）功能。

## 特性

- ⚡️ 亚秒级冷启动的开发服务器
- 📦 基于 ESM 的模块加载
- 🔄 高效的热模块替换（HMR）
- 🛠️ 依赖预构建（使用 esbuild）
- 🔌 可扩展的插件系统
- 🏗️ 优化的生产构建（基于 Rollup）

## 安装

```bash
# 使用 pnpm 安装
pnpm install -D lumos

# 或使用 npm 安装
npm install -D lumos

# 或使用 yarn 安装
yarn add -D lumos
```

## 使用方法

### 开发模式

```bash
# 启动开发服务器
lumos

# 指定端口
lumos --port 8080

# 指定主机
lumos --host 0.0.0.0
```

### 生产构建

```bash
# 构建生产版本
lumos build

# 指定输出目录
lumos build --outDir dist

# 启用 sourcemap
lumos build --sourcemap
```

## 配置

Lumos 支持通过 `lumos.config.js` 文件进行配置：

```js
// lumos.config.js
export default {
  // 公共基础路径
  base: '/',
  
  // 服务器选项
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  // 构建选项
  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: false
  },
  
  // 插件
  plugins: []
}
```

## 示例项目

Lumos 包含一个示例项目，位于 `example` 目录下。你可以通过以下命令运行示例项目：

```bash
# 进入示例目录
cd example

# 使用 Lumos 启动开发服务器
npx lumos
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 开发模式（监视文件变化）
pnpm dev

# 运行测试
pnpm test
```

## 许可证

MIT
