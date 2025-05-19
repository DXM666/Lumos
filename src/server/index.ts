import Koa from 'koa';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { parse as parseUrl } from 'url';
import type { Server } from 'http';
import type { ResolvedConfig, DevServer } from '../types';
import { createPluginContainer, createBuiltinPlugins } from '../plugin';
import { createModuleGraph } from './moduleGraph';
import { resolveMiddleware } from './middlewares/resolve';
import { transformMiddleware } from './middlewares/transform';
import { staticMiddleware } from './middlewares/static';
import { hmrMiddleware } from './middlewares/hmr';
import { createOptimizeDeps } from './optimizeDeps';
import { createHmrEngine } from './hmr';
import pc from 'picocolors';

/**
 * 创建开发服务器
 */
export function createDevServer(config: ResolvedConfig): DevServer {
  // 创建 Koa 应用
  const app = new Koa();
  
  // 创建 HTTP 服务器
  const httpServer = createHttpServer(app.callback());
  
  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ noServer: true });
  
  // 创建文件监视器
  const watcher = chokidar.watch(config.root, {
    ignored: config.server?.watch?.ignored || ['**/node_modules/**', '**/.git/**'],
    ignoreInitial: true,
    ignorePermissionErrors: true,
    disableGlobbing: true,
  });
  
  // 创建模块图
  const moduleGraph = createModuleGraph();
  
  // 创建插件容器
  const plugins = [...(config.plugins || []), ...createBuiltinPlugins(config)];
  const pluginContainer = createPluginContainer({ ...config, plugins });
  
  // 创建 HMR 引擎
  const hmrEngine = createHmrEngine(wss, moduleGraph);
  
  // 创建依赖优化器
  const optimizeDeps = createOptimizeDeps(config);
  
  // 添加中间件
  app.use(async (ctx, next) => {
    // 设置响应头
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With');
    
    // 处理 OPTIONS 请求
    if (ctx.method === 'OPTIONS') {
      ctx.status = 204;
      return;
    }
    
    await next();
  });
  
  // 解析中间件
  app.use(resolveMiddleware(config, moduleGraph, pluginContainer));
  
  // 转换中间件
  app.use(transformMiddleware(config, moduleGraph, pluginContainer));
  
  // HMR 中间件
  app.use(hmrMiddleware(hmrEngine));
  
  // 静态文件中间件
  app.use(staticMiddleware(config.root));
  
  // 处理 404
  app.use(async (ctx) => {
    // 尝试提供 index.html
    if (ctx.path === '/' || ctx.path.endsWith('/')) {
      // 如果路径以斜杠结尾，尝试提供目录下的 index.html
      let dirPath = ctx.path;
      if (dirPath.endsWith('/')) {
        dirPath = dirPath.slice(0, -1);
      }
      
      // 如果是空路径，使用项目根目录
      const fullDirPath = dirPath === '' 
        ? config.root 
        : path.join(config.root, dirPath.replace(/^\//, ''));
      
      const indexPath = path.join(fullDirPath, 'index.html');
      console.log(`尝试加载索引文件: ${indexPath}`);
      
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf-8');
        
        // 注入 HMR 客户端脚本
        const hmrClientScript = `<script type="module" src="/@lumos/client"></script>`;
        html = html.replace('</head>', `${hmrClientScript}</head>`);
        
        // 应用 HTML 转换插件
        for (const plugin of plugins) {
          if (plugin.transformIndexHtml) {
            const result = await plugin.transformIndexHtml(html);
            if (result) {
              html = result;
            }
          }
        }
        
        ctx.type = 'html';
        ctx.body = html;
        return;
      } else {
        console.log(`索引文件不存在: ${indexPath}`);
      }
    }
    
    ctx.status = 404;
    ctx.body = 'Not Found';
  });
  
  // 监听文件变化
  watcher.on('change', async (file) => {
    const filePath = path.resolve(file);
    console.log(pc.green(`[hmr] `) + `文件变更: ${path.relative(config.root, filePath)}`);
    
    // 通知模块图
    moduleGraph.onFileChange(filePath);
    
    // 触发 HMR
    hmrEngine.handleFileChange(filePath);
  });
  
  // 创建服务器对象
  const server: DevServer = {
    config,
    app,
    httpServer,
    wss,
    watcher,
    moduleGraph,
    pluginContainer,
    hmrEngine,
    optimizeDeps,
    
    /**
     * 启动服务器
     */
    async listen() {
      // 优化依赖
      await optimizeDeps.run();
      
      // 应用插件的 configureServer 钩子
      for (const plugin of plugins) {
        if (plugin.configureServer) {
          await plugin.configureServer(server);
        }
      }
      
      // 确定端口
      const port = config.server?.port || 3000;
      const host = typeof config.server?.host === 'string' ? config.server.host : 'localhost';
      
      // 配置 WebSocket 服务器处理 /__lumos_hmr 路径
      httpServer.on('upgrade', (request, socket, head) => {
        const { pathname } = parseUrl(request.url || '');
        
        if (pathname === '/__lumos_hmr') {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        }
      });
      
      // 启动服务器
      return new Promise<void>((resolve) => {
        httpServer.listen(port, host, () => {
          resolve();
        });
        
        // 处理 WebSocket 升级
        httpServer.on('upgrade', (req, socket, head) => {
          const { pathname } = parseUrl(req.url || '');
          
          if (pathname === '/__lumos_hmr') {
            wss.handleUpgrade(req, socket, head, (ws) => {
              wss.emit('connection', ws, req);
            });
          }
        });
      });
    },
    
    /**
     * 关闭服务器
     */
    async close() {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      watcher.close();
      wss.close();
    },
    
    /**
     * 打印服务器 URL
     */
    printUrls() {
      const port = config.server?.port || 3000;
      const host = config.server?.host || 'localhost';
      const protocol = config.server?.https ? 'https' : 'http';
      
      console.log();
      console.log(`  ${pc.green('➜')}  ${pc.bold('本地:')}   ${pc.cyan(`${protocol}://${host}:${port}/`)}`);
      
      try {
        const interfaces = require('os').networkInterfaces();
        const addresses: string[] = [];
        
        for (const name of Object.keys(interfaces)) {
          for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
              addresses.push(iface.address);
            }
          }
        }
        
        if (addresses.length) {
          console.log(`  ${pc.green('➜')}  ${pc.bold('网络:')}   ${pc.cyan(`${protocol}://${addresses[0]}:${port}/`)}`);
        }
      } catch (e) {
        // 忽略错误
      }
      
      console.log();
      console.log(`  ${pc.green('➜')}  ${pc.bold('按下 Ctrl+C 停止服务器')}`);
      console.log();
    },
    
    /**
     * 重启服务器
     */
    async restart() {
      await this.close();
      await this.listen();
      this.printUrls();
    }
  };
  
  return server;
}
