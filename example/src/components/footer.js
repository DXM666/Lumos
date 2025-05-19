/**
 * 渲染页脚
 */
export function renderFooter() {
  const year = new Date().getFullYear();
  
  return `
    <footer class="footer">
      <p>&copy; ${year} Lumos 示例应用</p>
      <p>使用 Lumos 构建 - 高性能前端打包工具</p>
    </footer>
  `;
}
