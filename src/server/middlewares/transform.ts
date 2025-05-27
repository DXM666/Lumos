import type { Middleware } from "koa";
import path from "path";
import fs from "fs";
import { init, parse } from "es-module-lexer";
import MagicString from "magic-string";
import type { ResolvedConfig, ModuleGraph, TransformResult } from "../../types";

/**
 * 转换中间件
 * 负责转换模块代码
 */
export function transformMiddleware(
  config: ResolvedConfig,
  moduleGraph: ModuleGraph,
  pluginContainer: any
): Middleware {
  return async (ctx, next) => {
    // 获取文件路径
    const filePath = ctx.state.filePath;
    if (!filePath) {
      return next();
    }

    // 获取模块 ID
    const moduleId =
      "/" + path.relative(config.root, filePath).replace(/\\/g, "/");
      
    // 检查是否有时间戳参数（用于缓存破坏）
    const timestamp = ctx.query.t;
    
    // 检查模块图中是否有缓存
    const module = moduleGraph.getModuleById(moduleId);
    
    // 只有当没有时间戳参数或者时间戳与模块的最后更新时间一致时才使用缓存
    if (module?.transformResult && (!timestamp || parseInt(timestamp as string) <= module.lastHMRTimestamp)) {
      ctx.type = "js";
      ctx.body = module.transformResult.code;
      return;
    }

    // 读取文件内容
    let code: string;
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        ctx.status = 404;
        ctx.body = `文件不存在: ${filePath}`;
        return;
      }

      // 检查文件是否是目录
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        console.error(`路径是目录而不是文件: ${filePath}`);
        ctx.status = 404;
        ctx.body = `路径是目录而不是文件: ${filePath}`;
        return;
      }

      code = fs.readFileSync(filePath, "utf-8");
    } catch (e: any) {
      console.error(`读取文件失败: ${filePath}`, e);
      ctx.status = 404;
      ctx.body = `无法读取文件: ${filePath}, 错误: ${e.message}`;
      return;
    }

    // 确定模块类型
    let type: "js" | "css" | "html" | "json" | "asset" = "js";
    if (filePath.endsWith(".css")) {
      type = "css";
    } else if (filePath.endsWith(".html")) {
      type = "html";
    } else if (filePath.endsWith(".json")) {
      type = "json";
    } else if (!/\.(js|jsx|ts|tsx|mjs)$/.test(filePath)) {
      type = "asset";
    }

    // 应用插件转换
    let result: TransformResult | null = null;

    try {
      // 使用插件加载
      const loadResult = await pluginContainer.hookFirstAsync("load", [
        moduleId,
      ]);
      if (loadResult) {
        code = loadResult;
      }

      // 使用插件转换
      const transformResult = await pluginContainer.hookFirstAsync(
        "transform",
        [code, moduleId]
      );
      if (transformResult) {
        result = transformResult;
      } else {
        // 默认转换
        result = await transform(code, moduleId, config);
      }
    } catch (e) {
      console.error(`转换失败: ${moduleId}`, e);
      ctx.status = 500;
      ctx.body = `转换失败: ${e}`;
      return;
    }

    if (!result) {
      // 无需转换，直接返回原始内容
      // moduleGraph.updateModule(moduleId, filePath, type, {
      //   code,
      //   map: null,
      //   deps: [],
      // });
      
      // 如果是 HTML 文件，注入 HMR 客户端脚本
      if (type === "html") {
        const hmrClientScript = `<script type="module" src="/@lumos/client"></script>`;
        code = code.replace("</head>", `${hmrClientScript}</head>`);
      }
      
      ctx.type = type === "js" ? "application/javascript" : type;
      ctx.body = code;
      return;
    }

    // 更新模块图
    moduleGraph.updateModule(moduleId, filePath, type, result);

    // 更新依赖关系
    if (result.deps) {
      moduleGraph.updateModuleDependencies(moduleId, result.deps);
    }

    // 返回转换后的代码
    ctx.type = "js";
    ctx.body = result.code;
  };
}

/**
 * 转换模块代码
 */
async function transform(
  code: string,
  id: string,
  config: ResolvedConfig
): Promise<TransformResult | null> {
  // 初始化解析器
  await init;

  // 不同类型的文件处理方式不同
  if (id.endsWith(".json")) {
    // JSON 转换为 ES 模块
    return {
      code: `export default ${code}`,
      map: null,
    };
  }

  if (id.endsWith(".css")) {
    // CSS 转换为 JS 模块
    return {
      code: `
        const style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.textContent = ${JSON.stringify(code)};
        document.head.appendChild(style);
        export default {};
      `,
      map: null,
    };
  }

  if (!id.match(/\.(js|jsx|ts|tsx|mjs)$/)) {
    // 非 JS 文件不转换
    return null;
  }

  // 解析 ES 模块
  const [imports, exports] = parse(code);

  // 如果没有导入，不需要转换
  if (imports.length === 0) {
    return null;
  }

  // 使用 MagicString 进行代码转换
  const s = new MagicString(code);
  const deps: string[] = [];

  // 重写导入语句
  for (const { s: start, e: end, n: name } of imports) {
    if (!name) continue;

    // 处理裸模块导入
    if (
      !name.startsWith(".") &&
      !name.startsWith("/") &&
      !name.startsWith("\\")
    ) {
      const replacement = `/@modules/${name}`;
      s.overwrite(start, end, replacement);
      deps.push(replacement);
    } else {
      // 处理相对路径导入
      deps.push(name);
    }
  }

  return {
    code: s.toString(),
    map: null,
    deps,
  };
}
