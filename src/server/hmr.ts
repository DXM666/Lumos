import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import type { ModuleGraph } from '../types';
import pc from 'picocolors';

// HMR 更新类型
export type HMRUpdate = {
  type: 'js-update' | 'css-update' | 'full-reload';
  path: string;
  timestamp: number;
  acceptedPath?: string;
};

/**
 * 创建 HMR 引擎
 */
export function createHmrEngine(wss: WebSocketServer, moduleGraph: ModuleGraph) {
  // 客户端连接集合
  const clients = new Set<WebSocket>();
  
  // 处理 WebSocket 连接
  wss.on('connection', (socket: WebSocket) => {
    clients.add(socket);
    
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connected') {
          console.log(pc.green(`[hmr] `) + `客户端已连接`);
        }
      } catch (e) {
        console.error(pc.red(`[hmr] `) + `无效的消息: ${e}`);
      }
    });
    
    socket.on('close', () => {
      clients.delete(socket);
    });
  });
  
  return {
    /**
     * 发送 HMR 更新
     */
    send(update: HMRUpdate): void {
      const stringified = JSON.stringify(update);
      
      clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
          client.send(stringified);
        }
      });
    },
    
    /**
     * 处理文件变化
     */
    handleFileChange(file: string): void {
      const modules = moduleGraph.getModulesByFile(file);
      if (!modules) {
        return;
      }
      
      const timestamp = Date.now();
      
      // 将文件系统路径转换为浏览器可识别的 URL 路径
      const fileToUrl = (filePath: string): string => {
        // 获取相对于项目根目录的路径
        const relativePath = path.relative(process.cwd(), filePath);
        // 将反斜杠转换为正斜杠（对于 Windows 路径）
        const normalizedPath = relativePath.split(path.sep).join('/');
        
        // 处理 example 目录下的文件
        if (normalizedPath.startsWith('example/')) {
          // 移除 'example/' 前缀，因为浏览器中是从项目根目录访问的
          return '/' + normalizedPath.replace(/^example\/?/, '');
        }
        
        // 其他路径保持不变
        return '/' + normalizedPath;
      };
      
      for (const mod of modules) {
        // 使模块无效
        moduleGraph.invalidateModule(mod);
        
        // 确定更新类型
        let type: HMRUpdate['type'] = 'js-update';
        if (file.endsWith('.css')) {
          type = 'css-update';
        } else if (file.endsWith('.html')) {
          type = 'full-reload';
        }
        
        // 将文件路径转换为 URL 路径
        const browserPath = fileToUrl(file);
        
        // 发送更新
        this.send({
          type,
          path: browserPath,  // 使用浏览器可识别的路径
          timestamp,
          acceptedPath: browserPath,  // 同样使用浏览器路径
        });
        
        console.log(
          pc.green(`[hmr] `) + 
          `已发送更新: ${path.relative(process.cwd(), file)} -> ${browserPath}`
        );
      }
    },
    
    /**
     * 触发完全刷新
     */
    fullReload(): void {
      this.send({
        type: 'full-reload',
        path: '*',
        timestamp: Date.now()
      });
      
      console.log(pc.green(`[hmr] `) + `已触发页面刷新`);
    }
  };
}
