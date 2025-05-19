import { renderHeader } from './components/header.js';
import { renderContent } from './components/content.js';
import { renderFooter } from './components/footer.js';

/**
 * 创建应用
 */
export function createApp(options) {
  let appElement = null;
  
  function render() {
    if (!appElement) return;
    
    // 渲染应用
    appElement.innerHTML = `
    12345eehh
      ${renderHeader(options.title)}
      ${renderContent(options.description)}
      ${renderFooter()}
    `;
  }
  
  return {
    /**
     * 挂载应用
     */
    mount(selector) {
      appElement = document.querySelector(selector);
      if (!appElement) {
        console.error(`找不到元素: ${selector}`);
        return;
      }
      
      render();
    },
    
    /**
     * 更新应用
     */
    update() {
      render();
    }
  };
}
