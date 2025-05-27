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
      
      // 记录所有可用的热更新模块
      console.log('[lumos] 当前注册的热更新模块:', [...hotModulesMap.keys()]);
      
      // 动态导入更新的模块
      try {
        const newModule = await import(`${path}?t=${timestamp}`);
        console.log('[lumos] 成功加载新模块:', path);
        
        // 查找接受热更新的模块
        const acceptingModule = findAcceptingModule(path);
        if (acceptingModule) {
          console.log('[lumos] 找到接受热更新的模块:', acceptingModule.url);
          // 执行热更新
          acceptingModule.hot.accept(path, newModule);
        } else {
          // 尝试直接使用路径作为模块 ID 查找
          if (hotModulesMap.has(path)) {
            console.log('[lumos] 直接找到模块:', path);
            const moduleHot = hotModulesMap.get(path);
            const mod = { url: path, hot: { accept: (p, m) => {
              const callback = moduleHot.callbacks.get(path);
              if (callback) callback(m);
            }}};
            mod.hot.accept(path, newModule);
          } else {
            // 没有模块接受更新，执行完全刷新
            console.log('[lumos] 没有模块接受更新，执行完全刷新');
            location.reload();
          }
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

// 存储接受热更新的模块映射
const hotModulesMap = new Map();

// 存储模块路径映射
const modulePathMap = new Map();

// 模块热更新 API
window.__lumos_hot__ = {
  accept(deps, callback) {
    const mod = getCurrentModule();
    if (mod) {
      // 记录该模块接受热更新
      if (!hotModulesMap.has(mod.url)) {
        hotModulesMap.set(mod.url, {
          acceptedDeps: new Set(),
          callbacks: new Map()
        });
      }
      
      const moduleHot = hotModulesMap.get(mod.url);
      
      // 处理依赖数组
      if (Array.isArray(deps)) {
        deps.forEach(dep => {
          moduleHot.acceptedDeps.add(dep);
          moduleHot.callbacks.set(dep, callback);
        });
      } else if (typeof deps === 'string') {
        // 单个依赖
        moduleHot.acceptedDeps.add(deps);
        moduleHot.callbacks.set(deps, callback);
      } else {
        // 接受自身更新
        moduleHot.acceptedDeps.add(mod.url);
        moduleHot.callbacks.set(mod.url, callback);
      }
      
      // 记录模块路径
      modulePathMap.set(mod.url, mod.url);
      
      // 提供 hot API
      mod.hot = {
        // 接受热更新
        accept: (path, newModule) => {
          console.log('[lumos] 执行热更新回调，路径:', path || mod.url);
          
          // 如果没有指定路径，使用模块自身的 URL
          const targetPath = path || mod.url;
          
          // 获取对应的回调函数
          const callback = moduleHot.callbacks.get(targetPath);
          
          if (callback) {
            // 执行回调，传入新模块
            try {
              callback(newModule);
            } catch (e) {
              console.error('[lumos] 执行热更新回调函数失败:', e);
            }
          } else {
            console.warn('[lumos] 找不到路径的热更新回调:', targetPath);
            console.log('可用的回调:', [...moduleHot.callbacks.keys()]);
          }
        }
      };
    }
  }
};

// 兼容 Vite/Rollup 的 import.meta.hot API
// 在每个模块中注入 import.meta.hot
try {
  // 定义一个全局变量来跟踪当前处理的模块
  window.__lumos_currentModule = null;
  
  // 拦截原生的 import() 函数
  const originalImport = window.import || Function.prototype.bind.call(Function('return import(...arguments)'), {});
  
  // 重写 import()
  window.import = function(...args) {
    const importPromise = originalImport.apply(this, args);
    
    // 在模块加载后注入 hot API
    return importPromise.then(module => {
      // 获取当前模块的路径
      const currentModule = getCurrentModule();
      if (currentModule) {
        window.__lumos_currentModule = currentModule;
        
        // 如果模块已经有 import.meta，则添加 hot 属性
        if (module && typeof module === 'object') {
          // 尝试添加 import.meta.hot
          try {
            if (!module.meta) {
              Object.defineProperty(module, 'meta', {
                value: {}
              });
            }
            
            if (!module.meta.hot) {
              Object.defineProperty(module.meta, 'hot', {
                get() {
                  return {
                    accept(deps, callback) {
                      return window.__lumos_hot__.accept(deps, callback);
                    }
                  };
                }
              });
            }
          } catch (e) {
            console.warn('[lumos] 无法注入 import.meta.hot:', e);
          }
        }
      }
      
      return module;
    });
  };
  
  // 如果浏览器支持 import.meta，则尝试注入 hot 属性
  if (typeof document !== 'undefined') {
    // 添加一个全局脚本来注入 import.meta.hot
    const script = document.createElement('script');
    script.textContent = `
      // 尝试注入 import.meta.hot
      try {
        if (import.meta) {
          Object.defineProperty(import.meta, 'hot', {
            get() {
              return window.__lumos_hot__;
            }
          });
        }
      } catch (e) {
        // 忽略错误
      }
    `;
    script.type = 'module';
    document.head.appendChild(script);
  }
} catch (e) {
  console.warn('[lumos] 无法设置 import.meta.hot polyfill:', e);
}

// 查找当前模块
function getCurrentModule() {
  // 通过堆栈跟踪查找当前模块
  const err = new Error();
  const stackLines = err.stack.split('\n');
  
  for (const line of stackLines) {
    // 匹配不同格式的堆栈信息
    const match = line.match(/at\s+(.+)\s+\((.+)\)$/) || line.match(/at\s+(.+):\d+:\d+/);
    if (match) {
      let url;
      if (match[2]) {
        // 格式: at Function (url)
        url = match[2].split('?')[0];
      } else {
        // 格式: at url:line:column
        url = match[1].split('?')[0];
      }
      
      // 忽略内部脚本
      if (url.includes('/@lumos/client')) {
        continue;
      }
      
      // 标准化 URL
      try {
        const normalizedUrl = new URL(url, window.location.href).pathname;
        return { url: normalizedUrl };
      } catch (e) {
        console.warn('[lumos] 无法解析模块 URL:', url, e);
      }
    }
  }
  
  return null;
}

// 查找接受热更新的模块
function findAcceptingModule(path) {
  // 标准化路径
  const normalizedPath = new URL(path, window.location.href).pathname;
  console.log(`[lumos] 查找接受模块更新, 路径: ${normalizedPath}`);
  console.log(`[lumos] 当前所有热模块:`, Array.from(hotModulesMap.keys()));
  
  // 1. 直接检查该模块是否接受自身更新
  if (hotModulesMap.has(normalizedPath)) {
    const moduleHot = hotModulesMap.get(normalizedPath);
    console.log(`[lumos] 找到直接匹配的模块: ${normalizedPath}`);
    console.log(`[lumos] 模块接受的依赖:`, Array.from(moduleHot.acceptedDeps));
    
    if (moduleHot.acceptedDeps.has(normalizedPath)) {
      console.log(`[lumos] 模块接受自身更新`);
      // 返回一个与 mod.hot 结构兼容的对象
      return { 
        url: normalizedPath, 
        hot: {
          accept: (path, newModule) => {
            console.log(`[lumos] 调用接受回调: ${normalizedPath}`); 
            const callback = moduleHot.callbacks.get(normalizedPath);
            if (callback) {
              console.log(`[lumos] 执行回调函数`);
              callback(newModule);
            } else {
              console.warn(`[lumos] 未找到回调函数`);
            }
          }
        }
      };
    }
  }
  
  // 2. 检查是否有其他模块接受该模块的更新
  for (const [acceptorUrl, moduleHot] of hotModulesMap.entries()) {
    console.log(`[lumos] 检查接受者模块: ${acceptorUrl}`);
    console.log(`[lumos] 接受者的依赖:`, Array.from(moduleHot.acceptedDeps));
    
    // 获取当前模块接受的所有依赖
    for (const acceptedDep of moduleHot.acceptedDeps) {
      // 标准化依赖路径以便进行比较
      let normalizedDep = acceptedDep;
      
      // 如果是相对路径，将其转换为绝对路径
      if (acceptedDep.startsWith('./') || acceptedDep.startsWith('../')) {
        try {
          // 使用接受者的 URL 作为基础路径解析相对路径
          const acceptorBase = new URL(acceptorUrl, window.location.href).href;
          normalizedDep = new URL(acceptedDep, acceptorBase).pathname;
          console.log(`[lumos] 将相对路径 ${acceptedDep} 转换为绝对路径: ${normalizedDep}`);
        } catch (e) {
          console.error(`[lumos] 转换路径出错:`, e);
        }
      }
      
      // 比较不同的匹配方式
      const matchesDirect = normalizedDep === normalizedPath;
      const matchesWithoutParams = normalizedPath.split('?')[0] === normalizedDep;
      
      // 还可以比较文件名
      const getFilename = (p) => p.split('/').pop().split('?')[0];
      const depFilename = getFilename(normalizedDep);
      const pathFilename = getFilename(normalizedPath);
      const matchesFilename = depFilename === pathFilename;
      
      if (matchesDirect || matchesWithoutParams || matchesFilename) {
        console.log(`[lumos] 找到匹配! 接受者: ${acceptorUrl}, 依赖: ${acceptedDep}`);
        console.log(`[lumos] 匹配类型: 直接=${matchesDirect}, 无参数=${matchesWithoutParams}, 文件名=${matchesFilename}`);
        
        // 找到接受更新的模块
        return {
          url: acceptorUrl,
          hot: {
            accept: (updatedPath, newModule) => {
              console.log(`[lumos] 调用接受回调: ${acceptorUrl} -> ${acceptedDep}`);
              const callback = moduleHot.callbacks.get(acceptedDep);
              if (callback) {
                console.log(`[lumos] 执行更新回调`);
                callback(newModule);
              } else {
                console.warn(`[lumos] 未找到更新回调函数`); 
              }
            }
          }
        };
      }
    }
  }
  
  // 没有找到接受更新的模块
  console.warn(`[lumos] 未找到接受模块 ${normalizedPath} 更新的模块`);
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
