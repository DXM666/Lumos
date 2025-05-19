import type { LumosPlugin, ResolvedConfig } from './types';

/**
 * 创建插件上下文
 */
export function createPluginContainer(config: ResolvedConfig) {
  const plugins = config.plugins || [];
  
  // 按照 enforce 属性排序插件
  const sortedPlugins = sortPlugins(plugins);
  
  // 创建插件容器
  return {
    /**
     * 获取所有插件
     */
    getPlugins() {
      return sortedPlugins;
    },
    
    /**
     * 调用插件钩子
     */
    async hookAsync(
      hookName: keyof LumosPlugin,
      args: any[],
      skip?: (plugin: LumosPlugin) => boolean
    ): Promise<void> {
      for (const plugin of sortedPlugins) {
        const hook = plugin[hookName];
        
        if (!hook || (skip && skip(plugin))) {
          continue;
        }
        
        // @ts-ignore
        await hook.apply(plugin, args);
      }
    },
    
    /**
     * 调用插件钩子并返回第一个非空结果
     */
    async hookFirstAsync(
      hookName: keyof LumosPlugin,
      args: any[],
      skip?: (plugin: LumosPlugin) => boolean
    ): Promise<any> {
      for (const plugin of sortedPlugins) {
        const hook = plugin[hookName];
        
        if (!hook || (skip && skip(plugin))) {
          continue;
        }
        
        // @ts-ignore
        const result = await hook.apply(plugin, args);
        
        if (result !== null && result !== undefined) {
          return result;
        }
      }
      
      return null;
    },
    
    /**
     * 调用插件钩子并收集所有结果
     */
    async hookParallelAsync(
      hookName: keyof LumosPlugin,
      args: any[],
      skip?: (plugin: LumosPlugin) => boolean
    ): Promise<any[]> {
      const promises: Promise<any>[] = [];
      
      for (const plugin of sortedPlugins) {
        const hook = plugin[hookName];
        
        if (!hook || (skip && skip(plugin))) {
          continue;
        }
        
        // @ts-ignore
        promises.push(hook.apply(plugin, args));
      }
      
      return Promise.all(promises);
    }
  };
}

/**
 * 按照 enforce 属性排序插件
 */
function sortPlugins(plugins: LumosPlugin[]): LumosPlugin[] {
  const prePlugins: LumosPlugin[] = [];
  const normalPlugins: LumosPlugin[] = [];
  const postPlugins: LumosPlugin[] = [];
  
  for (const plugin of plugins) {
    if (plugin.enforce === 'pre') {
      prePlugins.push(plugin);
    } else if (plugin.enforce === 'post') {
      postPlugins.push(plugin);
    } else {
      normalPlugins.push(plugin);
    }
  }
  
  return [...prePlugins, ...normalPlugins, ...postPlugins];
}

/**
 * 创建内置插件
 */
export function createBuiltinPlugins(config: ResolvedConfig): LumosPlugin[] {
  return [
    // 解析 HTML 插件
    {
      name: 'lumos:html',
      transformIndexHtml(html: string) {
        // 注入 HMR 客户端脚本
        if (config.command === 'serve' && config.server?.hmr) {
          return html.replace(
            /<\/head>/,
            `  <script type="module" src="/@lumos/client"></script>\n</head>`
          );
        }
        return html;
      }
    },
    
    // 解析 TypeScript 插件
    {
      name: 'lumos:typescript',
      async transform(code: string, id: string) {
        if (id.endsWith('.ts') || id.endsWith('.tsx')) {
          // 使用 esbuild 转换 TypeScript
          const { transform } = await import('esbuild');
          const result = await transform(code, {
            loader: id.endsWith('.tsx') ? 'tsx' : 'ts',
            target: 'es2020',
            format: 'esm',
            sourcemap: config.build?.sourcemap ? 'inline' : false,
          });
          
          return {
            code: result.code,
            map: result.map || null
          };
        }
        
        return null;
      }
    },
    
    // 解析 CSS 插件
    {
      name: 'lumos:css',
      async transform(code: string, id: string) {
        if (id.endsWith('.css')) {
          // 在开发模式下，将 CSS 转换为 JS 模块
          if (config.command === 'serve') {
            return {
              code: `
                const style = document.createElement('style');
                style.setAttribute('type', 'text/css');
                style.textContent = ${JSON.stringify(code)};
                document.head.appendChild(style);
                export default {};
              `,
              map: null
            };
          }
          
          // 在构建模式下，返回原始 CSS
          return {
            code,
            map: null
          };
        }
        
        return null;
      }
    },
    
    // 解析 JSON 插件
    {
      name: 'lumos:json',
      transform(code: string, id: string) {
        if (id.endsWith('.json')) {
          return {
            code: `export default ${code}`,
            map: null
          };
        }
        
        return null;
      }
    },
    
    // 资源插件
    {
      name: 'lumos:assets',
      async load(id: string) {
        const assetExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
        
        for (const ext of assetExts) {
          if (id.endsWith(ext)) {
            // 在开发模式下，返回资源 URL
            if (config.command === 'serve') {
              return `export default "${id}"`;
            }
            
            // 在构建模式下，将小资源内联为 base64
            const content = await fs.promises.readFile(id);
            const limit = config.build?.assetsInlineLimit || 4096;
            
            if (content.length < limit) {
              const mimeType = getMimeType(ext);
              const base64 = content.toString('base64');
              return `export default "data:${mimeType};base64,${base64}"`;
            }
            
            // 大资源复制到输出目录
            const fileName = path.basename(id);
            const outDir = config.build?.outDir || 'dist';
            const assetsDir = config.build?.assetsDir || 'assets';
            const outputPath = path.join(outDir, assetsDir, fileName);
            
            await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.promises.copyFile(id, outputPath);
            
            return `export default "/${assetsDir}/${fileName}"`;
          }
        }
        
        return null;
      }
    }
  ];
}

/**
 * 获取 MIME 类型
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// 导入缺少的依赖
import fs from 'fs';
import path from 'path';
