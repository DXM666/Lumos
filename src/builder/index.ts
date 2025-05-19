import path from 'path';
import fs from 'fs';
import { rollup, watch } from 'rollup';
import type { ResolvedConfig } from '../types';
import { createPluginContainer, createBuiltinPlugins } from '../plugin';
import { createRollupPlugins } from './rollupPlugins';
import pc from 'picocolors';

/**
 * 创建构建器
 */
export function createBuilder(config: ResolvedConfig) {
  // 创建插件容器
  const plugins = [...(config.plugins || []), ...createBuiltinPlugins(config)];
  const pluginContainer = createPluginContainer({ ...config, plugins });
  
  // 创建 Rollup 插件
  const rollupPlugins = createRollupPlugins(config, pluginContainer);
  
  return {
    /**
     * 构建生产版本
     */
    async build() {
      console.log(pc.cyan(`\n构建开始...\n`));
      
      // 确定输出目录
      const outDir = path.resolve(config.root, config.build?.outDir || 'dist');
      
      // 清空输出目录
      if (config.build?.emptyOutDir) {
        console.log(`清空输出目录: ${outDir}`);
        if (fs.existsSync(outDir)) {
          fs.rmSync(outDir, { recursive: true, force: true });
        }
        fs.mkdirSync(outDir, { recursive: true });
      }
      
      // 查找入口文件
      const entryPoints = await findEntryPoints(config);
      
      if (entryPoints.length === 0) {
        throw new Error('找不到入口文件');
      }
      
      console.log(`找到入口文件: ${entryPoints.join(', ')}`);
      
      // 调用插件钩子
      await pluginContainer.hookAsync('buildStart', []);
      
      // 创建 Rollup 构建配置
      const rollupOptions = {
        input: entryPoints,
        plugins: rollupPlugins,
        external: config.build?.external || [],
        ...config.build?.rollupOptions,
      };
      
      // 创建 Rollup 输出配置
      const outputOptions = {
        dir: outDir,
        format: 'es',
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        sourcemap: config.build?.sourcemap,
        ...config.build?.rollupOptions?.output,
      };
      
      try {
        // 构建
        const bundle = await rollup(rollupOptions);
        
        // 生成输出
        await bundle.write(outputOptions);
        
        // 关闭 bundle
        await bundle.close();
        
        // 调用插件钩子
        await pluginContainer.hookAsync('buildEnd', []);
        
        console.log(pc.green(`\n构建成功！\n`));
        
        // 打印构建信息
        console.log(`输出目录: ${outDir}`);
        
        // 生成 manifest 文件
        if (config.build?.manifest) {
          // TODO: 生成 manifest 文件
        }
      } catch (e) {
        console.error(pc.red(`\n构建失败: ${e}\n`));
        throw e;
      }
    },
    
    /**
     * 监视模式构建
     */
    async watch(callback: (event: any) => void) {
      // 查找入口文件
      const entryPoints = await findEntryPoints(config);
      
      if (entryPoints.length === 0) {
        throw new Error('找不到入口文件');
      }
      
      // 确定输出目录
      const outDir = path.resolve(config.root, config.build?.outDir || 'dist');
      
      // 创建 Rollup 构建配置
      const rollupOptions = {
        input: entryPoints,
        plugins: rollupPlugins,
        external: config.build?.external || [],
        ...config.build?.rollupOptions,
      };
      
      // 创建 Rollup 输出配置
      const outputOptions = {
        dir: outDir,
        format: 'es',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        sourcemap: true,
        ...config.build?.rollupOptions?.output,
      };
      
      // 启动监视模式
      const watcher = watch({
        ...rollupOptions,
        output: outputOptions,
        watch: {
          clearScreen: false,
        },
      });
      
      watcher.on('event', (event) => {
        if (event.code === 'BUNDLE_START') {
          console.log(pc.cyan(`\n构建开始...\n`));
        } else if (event.code === 'BUNDLE_END') {
          console.log(pc.green(`\n构建成功！\n`));
        } else if (event.code === 'ERROR') {
          console.error(pc.red(`\n构建失败: ${event.error}\n`));
        }
        
        callback(event);
      });
      
      return watcher;
    }
  };
}

/**
 * 查找入口文件
 */
async function findEntryPoints(config: ResolvedConfig): Promise<string[]> {
  const entryPoints: string[] = [];
  
  // 使用配置中指定的入口
  if (config.build?.rollupOptions?.input) {
    const input = config.build.rollupOptions.input;
    
    if (typeof input === 'string') {
      entryPoints.push(input);
    } else if (Array.isArray(input)) {
      entryPoints.push(...input);
    } else if (typeof input === 'object') {
      entryPoints.push(...Object.values(input));
    }
    
    return entryPoints;
  }
  
  // 自动查找入口文件
  const indexHtml = path.join(config.root, 'index.html');
  if (fs.existsSync(indexHtml)) {
    // 从 HTML 中提取入口
    const html = fs.readFileSync(indexHtml, 'utf-8');
    const scriptMatch = html.match(/<script\s+type="module"\s+src="([^"]+)"/);
    
    if (scriptMatch) {
      entryPoints.push(path.join(config.root, scriptMatch[1]));
    }
  }
  
  // 查找 src 目录下的入口文件
  const srcDir = path.join(config.root, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      if (file.match(/\.(js|ts|jsx|tsx)$/) && file.match(/^(index|main|app)\./)) {
        entryPoints.push(path.join(srcDir, file));
      }
    }
  }
  
  return entryPoints;
}
