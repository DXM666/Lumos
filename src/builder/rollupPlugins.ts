import path from 'path';
import fs from 'fs';
import { Plugin } from 'rollup';
import type { ResolvedConfig } from '../types';

/**
 * 创建 Rollup 插件
 */
export function createRollupPlugins(config: ResolvedConfig, pluginContainer: any): Plugin[] {
  return [
    // 解析插件
    {
      name: 'lumos:resolve',
      async resolveId(id, importer) {
        // 使用插件容器解析 ID
        const resolved = await pluginContainer.hookFirstAsync('resolveId', [id, importer]);
        if (resolved) {
          return resolved;
        }
        
        // 处理裸模块导入
        if (!id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\\')) {
          try {
            return require.resolve(id, { paths: [config.root] });
          } catch (e) {
            // 忽略错误
          }
        }
        
        // 处理相对路径导入
        if (importer && (id.startsWith('.') || id.startsWith('/') || id.startsWith('\\'))) {
          const basedir = path.dirname(importer);
          const resolvedPath = path.resolve(basedir, id);
          
          // 检查文件是否存在
          if (fs.existsSync(resolvedPath)) {
            return resolvedPath;
          }
          
          // 尝试添加扩展名
          const extensions = config.resolve?.extensions || ['.js', '.ts', '.jsx', '.tsx', '.json'];
          
          for (const ext of extensions) {
            const tryPath = resolvedPath + ext;
            if (fs.existsSync(tryPath)) {
              return tryPath;
            }
          }
          
          // 尝试解析为目录下的 index 文件
          for (const ext of extensions) {
            const tryPath = path.join(resolvedPath, `index${ext}`);
            if (fs.existsSync(tryPath)) {
              return tryPath;
            }
          }
        }
        
        return null;
      }
    },
    
    // 加载插件
    {
      name: 'lumos:load',
      async load(id) {
        // 使用插件容器加载模块
        const loaded = await pluginContainer.hookFirstAsync('load', [id]);
        if (loaded !== null) {
          return loaded;
        }
        
        // 默认加载文件
        if (fs.existsSync(id)) {
          return fs.readFileSync(id, 'utf-8');
        }
        
        return null;
      }
    },
    
    // 转换插件
    {
      name: 'lumos:transform',
      async transform(code, id) {
        // 使用插件容器转换代码
        const result = await pluginContainer.hookFirstAsync('transform', [code, id]);
        if (result) {
          return result;
        }
        
        return null;
      }
    },
    
    // HTML 插件
    {
      name: 'lumos:html',
      async transform(code, id) {
        if (id.endsWith('.html')) {
          // 使用插件容器转换 HTML
          const transformed = await pluginContainer.hookFirstAsync('transformIndexHtml', [code]);
          if (transformed) {
            return {
              code: transformed,
              map: null
            };
          }
        }
        
        return null;
      }
    },
    
    // CSS 插件
    {
      name: 'lumos:css',
      async transform(code, id) {
        if (id.endsWith('.css')) {
          // 在生产环境中，提取 CSS 到单独的文件
          const cssFileName = path.basename(id).replace(/\.css$/, '.css');
          const cssContent = code;
          
          // 输出 CSS 文件
          this.emitFile({
            type: 'asset',
            fileName: `assets/${cssFileName}`,
            source: cssContent
          });
          
          // 返回一个导入 CSS 的 JS 模块
          return {
            code: `import "./${cssFileName}"; export default {};`,
            map: null
          };
        }
        
        return null;
      }
    },
    
    // 资源插件
    {
      name: 'lumos:assets',
      async load(id) {
        const assetExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
        
        for (const ext of assetExts) {
          if (id.endsWith(ext)) {
            // 读取资源
            const content = fs.readFileSync(id);
            const fileName = path.basename(id);
            
            // 输出资源文件
            const referenceId = this.emitFile({
              type: 'asset',
              name: fileName,
              source: content
            });
            
            // 返回一个导入资源的 JS 模块
            return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
          }
        }
        
        return null;
      }
    },
    
    // 生成 bundle 插件
    {
      name: 'lumos:generateBundle',
      async generateBundle(outputOptions, bundle) {
        // 使用插件容器的 generateBundle 钩子
        await pluginContainer.hookAsync('generateBundle', [outputOptions, bundle]);
      }
    }
  ];
}
