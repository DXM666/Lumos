// 计数器模块
let count = 0;

/**
 * 增加计数
 */
export function increment() {
  count++;
  return count;
}

/**
 * 减少计数
 */
export function decrement() {
  count--;
  return count;
}

/**
 * 获取当前计数
 */
export function getCount() {
  return count;
}

/**
 * 重置计数
 */
export function reset() {
  count = 0;
  return count;
}

/**
 * 导出计数器对象
 */
export const counter = {
  increment,
  decrement,
  getCount,
  reset
};
