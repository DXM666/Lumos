/**
 * 渲染页头
 */
export function renderHeader(title) {
  return `
    <header class="header">
      <h1>${title}</h1>
      <nav>
        <ul>
          <li><a href="#home">首页</a></li>
          <li><a href="#about">关于</a></li>
          <li><a href="#contact">联系我们</a></li>
        </ul>
      </nav>
    </header>
  `;
}
