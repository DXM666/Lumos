import type { Middleware } from 'koa';
import path from 'path';
import fs from 'fs';
import { parse } from 'url';
import type { ResolvedConfig, ModuleGraph } from '../../types';

/**
 * 解析中间件
 * 负责解析请求的模块路径
 */
export function resolveMiddleware(
  config: ResolvedConfig,
  moduleGraph: ModuleGraph,
  pluginContainer: any
): Middleware {
  return async (ctx, next) => {
    // 解析请求路径
    const { pathname } = parse(ctx.url);
    if (!pathname) {
      return next();
    }
    
    // 处理特殊路径
    if (pathname === '/@lumos/client') {
      // 提供 HMR 客户端脚本
      ctx.type = 'js';
      ctx.body = fs.readFileSync(path.join(__dirname, '../client/client.js'), 'utf-8');
      return;
    }
    
    // 处理裸模块导入
    if (pathname.startsWith('/@modules/')) {
      const id = pathname.slice('/@modules/'.length);
      
      // 尝试从优化的依赖中加载
      const optimizedPath = config.optimizeDeps?.getOptimizedPath?.(id);
      if (optimizedPath) {
        ctx.type = 'js';
        ctx.body = fs.readFileSync(optimizedPath, 'utf-8');
        return;
      }
      
      // 尝试从 node_modules 加载
      try {
        const modulePath = require.resolve(id, { paths: [config.root] });
        ctx.type = 'js';
        ctx.body = fs.readFileSync(modulePath, 'utf-8');
        return;
      } catch (e) {
        ctx.status = 404;
        ctx.body = `找不到模块: ${id}`;
        return;
      }
    }
    
    // 解析文件路径
    let filePath: string;
    
    if (pathname.startsWith('/@fs/')) {
      // 绝对路径
      filePath = pathname.slice('/@fs/'.length);
      if (process.platform === 'win32') {
        filePath = filePath.replace(/^[A-Z]:/, (m) => m.toLowerCase());
      }
    } else {
      // 相对于项目根目录的路径
      // 处理 Windows 路径格式
      const normalizedPathname = pathname.replace(/\\/g, '/');
      filePath = path.join(config.root, normalizedPathname);
      console.log(`解析路径: ${pathname} -> ${filePath}`);
    }
    
    // 检查路径是否存在
    try {
      const pathStat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      
      // 如果路径存在且是目录
      if (pathStat && pathStat.isDirectory()) {
        console.log(`路径是目录: ${filePath}`);
        
        // 尝试查找目录下的 index.html
        const indexHtmlPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          filePath = indexHtmlPath;
        } else {
          // 如果没有 index.html，尝试查找 index.js 等文件
          const extensions = config.resolve?.extensions || ['.js', '.ts', '.jsx', '.tsx', '.json'];
          let found = false;
          
          for (const ext of extensions) {
            const indexPath = path.join(filePath, `index${ext}`);
            if (fs.existsSync(indexPath)) {
              filePath = indexPath;
              found = true;
              break;
            }
          }
          
          if (!found) {
            // 如果没有找到任何索引文件，交给下一个中间件处理
            return next();
          }
        }
      } 
      // 如果路径不存在，尝试添加扩展名
      else if (!pathStat) {
        const extensions = config.resolve?.extensions || ['.js', '.ts', '.jsx', '.tsx', '.json'];
        let found = false;
        
        // 尝试添加扩展名
        for (const ext of extensions) {
          const tryPath = filePath + ext;
          if (fs.existsSync(tryPath)) {
            filePath = tryPath;
            found = true;
            break;
          }
        }
        
        // 尝试解析为目录下的 index 文件
        if (!found) {
          // 检查是否为目录
          const dirPath = filePath;
          if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
            for (const ext of extensions) {
              const tryPath = path.join(dirPath, `index${ext}`);
              if (fs.existsSync(tryPath)) {
                filePath = tryPath;
                found = true;
                break;
              }
            }
          }
        }
        
        if (!found) {
          // 尝试使用插件解析
          const resolved = await pluginContainer.hookFirstAsync('resolveId', [pathname, undefined]);
          if (resolved) {
            filePath = resolved;
            found = true;
          }
        }
        
        if (!found) {
          console.log(`未找到文件: ${pathname} -> ${filePath}`);
          return next();
        }
      }
    } catch (err) {
      console.error(`解析文件路径出错: ${pathname}`, err);
      return next();
    }
    
    // 保存解析后的路径
    ctx.state.filePath = filePath;
    
    // 继续处理
    await next();
  };
}
