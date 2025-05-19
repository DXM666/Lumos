// Lumos HMR 客户端
const socketProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const socketHost = location.host;
let socket = new WebSocket(`${socketProtocol}://${socketHost}/__lumos_hmr`);

// 重连逻辑
let isReconnecting = false;
let pendingMessages = [];

socket.addEventListener('open', () => {
  console.log('[lumos] 已连接到 HMR 服务器');
  
  // 发送连接消息
  socket.send(JSON.stringify({ type: 'connected' }));
  
  // 发送待处理的消息
  if (pendingMessages.length > 0) {
    pendingMessages.forEach(msg => socket.send(msg));
    pendingMessages = [];
  }
  
  isReconnecting = false;
});

socket.addEventListener('message', async ({ data }) => {
  try {
    const message = JSON.parse(data);
    
    if (message.type === 'js-update') {
      // JS 模块更新
      const { path, timestamp } = message;
      console.log(`[lumos] 模块更新: ${path}`);
      
      // 动态导入更新的模块
      try {
        const newModule = await import(`${path}?t=${timestamp}`);
        
        // 查找接受热更新的模块
        const acceptingModule = findAcceptingModule(path);
        if (acceptingModule) {
          // 执行热更新
          acceptingModule.hot.accept(path, newModule);
        } else {
          // 没有模块接受更新，执行完全刷新
          console.log('[lumos] 没有模块接受更新，执行完全刷新');
          location.reload();
        }
      } catch (e) {
        console.error(`[lumos] 热更新失败: ${e}`);
        location.reload();
      }
    } else if (message.type === 'css-update') {
      // CSS 更新
      const { path, timestamp } = message;
      console.log(`[lumos] CSS 更新: ${path}`);
      
      // 查找并更新样式表
      updateStyle(path, timestamp);
    } else if (message.type === 'full-reload') {
      // 完全刷新
      console.log('[lumos] 执行完全刷新');
      location.reload();
    }
  } catch (e) {
    console.error('[lumos] 处理 HMR 消息失败:', e);
  }
});

socket.addEventListener('close', () => {
  console.log('[lumos] HMR 连接已断开，尝试重连...');
  
  if (!isReconnecting) {
    isReconnecting = true;
    
    // 尝试重连
    setTimeout(() => {
      const newSocket = new WebSocket(`${socketProtocol}://${socketHost}/__lumos_hmr`);
      socket = newSocket;
    }, 1000);
  }
});

socket.addEventListener('error', (e) => {
  console.error('[lumos] HMR 连接错误:', e);
});

// 模块热更新 API
window.__lumos_hot__ = {
  accept(deps, callback) {
    const mod = getCurrentModule();
    if (mod) {
      mod.hot = {
        accept: (path, newModule) => {
          if (callback) {
            callback(newModule);
          }
        }
      };
    }
  }
};

// 查找当前模块
function getCurrentModule() {
  // 通过堆栈跟踪查找当前模块
  const err = new Error();
  const stackLines = err.stack.split('\n');
  
  for (const line of stackLines) {
    const match = line.match(/at\s+(.+)\s+\((.+)\)$/);
    if (match && match[2].includes('?')) {
      const url = match[2].split('?')[0];
      return { url };
    }
  }
  
  return null;
}

// 查找接受热更新的模块
function findAcceptingModule(path) {
  // 简单实现，实际上需要维护模块依赖图
  return null;
}

// 更新样式表
function updateStyle(path, timestamp) {
  // 查找所有样式表
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  
  for (const link of links) {
    const href = link.getAttribute('href');
    
    if (href && href.includes(path)) {
      // 创建新的样式表
      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = `${path}?t=${timestamp}`;
      
      // 替换旧的样式表
      link.parentNode.insertBefore(newLink, link.nextSibling);
      
      // 移除旧的样式表
      setTimeout(() => {
        link.parentNode.removeChild(link);
      }, 500);
      
      return;
    }
  }
  
  // 没有找到匹配的样式表，添加新的
  const newLink = document.createElement('link');
  newLink.rel = 'stylesheet';
  newLink.href = `${path}?t=${timestamp}`;
  document.head.appendChild(newLink);
}

console.log('[lumos] HMR 客户端已初始化');
