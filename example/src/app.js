import { renderHeader } from './components/header.js';
import { renderContent } from './components/content.js';
import { renderFooter } from './components/footer.js';

// 将 appInstance 改为全局变量，确保在热更新时可以访问
if (typeof window !== 'undefined') {
  window.__LUMOS_APP_INSTANCE__ = window.__LUMOS_APP_INSTANCE__ || null;
}

/**
 * 创建应用
 */
export function createApp(options) {
  let appElement = null;
  
  function render() {
    if (!appElement) return;
    
    // 渲染应用
    appElement.innerHTML = `
    123
      ${renderHeader(options.title)}
      ${renderContent(options.description)}
      ${renderFooter()}
    `;
    
    console.log('[HMR] 应用已渲染');
  }
  
  const app = {
    /**
     * 挂载应用
     */
    mount(selector) {
      appElement = document.querySelector(selector);
      if (!appElement) {
        console.error(`找不到元素: ${selector}`);
        return;
      }
      
      // 存储应用实例用于热更新
      window.__LUMOS_APP_INSTANCE__ = app;
      
      render();
      return app;
    },
    
    /**
     * 更新应用
     */
    update() {
      console.log('[HMR] 正在更新应用...');
      render();
      return app;
    },
    
    /**
     * 获取应用元素
     */
    getElement() {
      return appElement;
    }
  };
  
  return app;
}

// 添加热更新支持
// 检查全局 HMR API
if (typeof window !== 'undefined' && window.__lumos_hot__) {
  console.log('[HMR] app.js 使用全局 __lumos_hot__ API');
  
  // 注册自身模块的热更新
  window.__lumos_hot__.accept('./app.js', (newModule) => {
    console.log('[HMR] app.js 模块已更新', newModule);
    
    const appInstance = window.__LUMOS_APP_INSTANCE__;
    if (appInstance && appInstance.getElement()) {
      // 保存当前的 DOM 元素
      const el = appInstance.getElement();
      
      // 使用新模块创建新的应用实例
      const newApp = newModule.createApp({
        title: '热更新测试',
        description: '这是通过热更新重新渲染的内容 - ' + new Date().toLocaleTimeString()
      });
      
      // 重新渲染
      newApp.mount(el.tagName === 'DIV' ? '#' + el.id : el);
      
      console.log('[HMR] 应用已通过热更新重新渲染');
    } else {
      console.warn('[HMR] 找不到应用实例或元素，无法更新');
    }
  });
  
  // 注册组件模块的热更新
  window.__lumos_hot__.accept(['./components/header.js', './components/content.js', './components/footer.js'], () => {
    console.log('[HMR] 组件模块已更新，重新渲染应用');
    const appInstance = window.__LUMOS_APP_INSTANCE__;
    if (appInstance) {
      appInstance.render();
    }
  });
} 
// 检查 import.meta.hot 是否可用
else if (import.meta && import.meta.hot) {
  console.log('[HMR] app.js 使用 import.meta.hot API');
  
  // 注册自身模块的热更新
  import.meta.hot.accept((newModule) => {
    console.log('[HMR] app.js 模块已更新', newModule);
    
    const appInstance = window.__LUMOS_APP_INSTANCE__;
    if (appInstance && appInstance.getElement()) {
      // 保存当前的 DOM 元素
      const el = appInstance.getElement();
      
      // 使用新模块创建新的应用实例
      const newApp = newModule.createApp({
        title: '热更新测试',
        description: '这是通过热更新重新渲染的内容 - ' + new Date().toLocaleTimeString()
      });
      
      // 重新渲染
      newApp.mount(el.tagName === 'DIV' ? '#' + el.id : el);
      
      console.log('[HMR] 应用已通过热更新重新渲染');
    } else {
      console.warn('[HMR] 找不到应用实例或元素，无法更新');
    }
  });
} else {
  console.log('[HMR] 未检测到 HMR API，热更新功能不可用');
}
