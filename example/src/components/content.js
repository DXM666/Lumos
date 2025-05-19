/**
 * 渲染内容
 */
export function renderContent(description) {
  const script = document.createElement("script");
  script.textContent = "console.log(123)";
  document.querySelector("#app").appendChild(script);

  return `
    <main class="content">
      <section class="description">
        <p>${description}</p>
      </section>
      
      <section class="counter">
        <h2>计数器示例1234</h2>
        <div class="counter-display">
          <span id="count">0</span>
        </div>
        <div class="counter-controls">
          <button id="increment">+</button>
          <button id="decrement">-</button>
          <button id="reset">重置</button>
        </div>
      </section>
      
      <!-- 计数器功能由main.js管理 -->
      <script defer>console.log(123)</script>
    </main>
  `;
}
