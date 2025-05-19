// 计数器初始化脚本
import { counter } from './counter.js';

/**
 * 初始化计数器功能
 */
export function initCounter() {
  console.log('计数器初始化开始', counter);
  
  // 获取计数元素
  const countElement = document.getElementById('count');
  if (!countElement) {
    console.error('找不到计数器元素');
    return;
  }
  
  // 初始化计数器显示
  countElement.textContent = counter.getCount();
  
  // 绑定增加按钮事件
  const incrementButton = document.getElementById('increment');
  if (incrementButton) {
    incrementButton.addEventListener('click', () => {
      const count = counter.increment();
      countElement.textContent = count;
    });
  }
  
  // 绑定减少按钮事件
  const decrementButton = document.getElementById('decrement');
  if (decrementButton) {
    decrementButton.addEventListener('click', () => {
      const count = counter.decrement();
      countElement.textContent = count;
    });
  }
  
  // 绑定重置按钮事件
  const resetButton = document.getElementById('reset');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      const count = counter.reset();
      countElement.textContent = count;
    });
  }
  
  console.log('计数器初始化完成');
}
