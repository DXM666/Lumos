import { defineConfig } from 'tsup';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['esbuild'],
  outDir: 'dist',
  // 构建成功后复制客户端脚本
  async onSuccess() {
    try {
      // 使用命令行复制文件，避免 ESM 中的 fs 问题
      const srcDir = path.resolve('./src/server/client');
      const destDir = path.resolve('./dist/client');
      
      // 创建目标目录
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      // 复制文件
      fs.copyFileSync(
        path.join(srcDir, 'client.js'), 
        path.join(destDir, 'client.js')
      );
      
      console.log('✅ 客户端脚本已复制到:', path.join(destDir, 'client.js'));
    } catch (err) {
      console.error('复制客户端脚本时出错:', err);
    }
  }
});
