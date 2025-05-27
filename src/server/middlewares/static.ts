import type { Middleware } from "koa";
import serve from "koa-static";
import path from "path";
import fs from "fs";

/**
 * 静态文件中间件
 * 负责提供静态资源
 */
export function staticMiddleware(root: string): Middleware {
  const serveStatic = serve(root, {
    index: false, // 禁用自动提供 index.html，我们将手动处理
    hidden: true,
    defer: true,
  });

  return async (ctx, next) => {
    // 如果是目录请求，尝试提供 index.html
    if (ctx.path === "/" || ctx.path.endsWith("/")) {
      // 构建目录路径
      let dirPath = ctx.path;
      if (dirPath.endsWith("/")) {
        dirPath = dirPath.slice(0, -1);
      }

      // 如果是空路径，使用项目根目录
      const fullDirPath =
        dirPath === "" ? root : path.join(root, dirPath.replace(/^\//, ""));

      const indexPath = path.join(fullDirPath, "index.html");
      console.log(`尝试提供索引文件: ${indexPath}`);

      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, "utf-8");

        // 注入 HMR 客户端脚本
        const hmrClientScript = `<script type="module" src="/@lumos/client"></script>`;
        html = html.replace("</head>", `${hmrClientScript}</head>`);
        ctx.type = "html";
        ctx.body = html;
        return;
      }
    }

    // 如果不是目录请求或者没有找到 index.html，使用静态文件中间件
    return serveStatic(ctx, next);
  };
}
