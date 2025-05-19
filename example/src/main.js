import { createApp } from './app.js';
import { counter } from './counter.js';
import { initCounter } from './counter-init.js';

// 创建应用
const app = createApp({
  title: 'Lumos 示例应用',
  description: '一个简单的示例应用，用于测试 Lumos 打包工具'
});

// 挂载应用
app.mount('#app');

// 在应用挂载后初始化计数器
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成，初始化计数器');
  initCounter();
});

// 启用热模块替换
if (window.__lumos_hot__) {
  window.__lumos_hot__.accept(['./app.js', './counter.js', './counter-init.js'], (newModule) => {
    console.log('模块已更新', newModule);
    app.update();
    // 更新后重新初始化计数器
    initCounter();
  });
}
