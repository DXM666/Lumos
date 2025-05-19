import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import type { LumosOptions, ResolvedConfig } from "./types";

// 默认配置
const defaultConfig: Partial<ResolvedConfig> = {
  root: process.cwd(),
  base: "/",
  mode: "development",
  configFile: undefined,
  logLevel: "info",
  server: {
    host: "localhost",
    port: 3000,
    cors: true,
    hmr: true,
    watch: {
      ignored: ["**/node_modules/**", "**/.git/**"],
    },
  },
  build: {
    target: "modules",
    outDir: "dist",
    assetsDir: "assets",
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    minify: true,
    emptyOutDir: true,
    sourcemap: false,
  },
  optimizeDeps: {
    entries: [],
    include: [],
    exclude: [],
    force: false,
  },
  plugins: [],
  resolve: {
    alias: {},
    dedupe: [],
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
  },
  command: "serve",
  env: {},
};

// 支持的配置文件名
const configFileNames = [
  "lumos.config.js",
  "lumos.config.mjs",
  "lumos.config.ts",
  "lumos.config.cjs",
];

/**
 * 查找配置文件
 */
async function findConfigFile(
  root: string,
  configFile?: string | null
): Promise<string | null> {
  if (configFile) {
    const resolvedPath = path.resolve(root, configFile);
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
    throw new Error(`指定的配置文件 ${resolvedPath} 不存在`);
  }

  // 自动查找配置文件
  for (const filename of configFileNames) {
    const filePath = path.resolve(root, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * 加载配置文件
 */
async function loadConfigFile(configFile: string): Promise<LumosOptions> {
  try {
    const fileUrl = pathToFileURL(configFile).href;
    const module = await import(fileUrl);
    return module.default || module;
  } catch (e) {
    throw new Error(`加载配置文件失败: ${e}`);
  }
}

/**
 * 解析环境变量
 */
function resolveEnvVars(mode: string): Record<string, string> {
  const env: Record<string, string> = {};

  // 加载 .env 文件
  const envFiles = [`.env`, `.env.${mode}`, `.env.local`, `.env.${mode}.local`];

  for (const file of envFiles) {
    if (fs.existsSync(path.resolve(process.cwd(), file))) {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), file),
        "utf-8"
      );
      const lines = content.split("\n");

      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";

          // 去除引号
          if (
            value.length > 1 &&
            (value[0] === '"' || value[0] === "'") &&
            value[0] === value[value.length - 1]
          ) {
            value = value.substring(1, value.length - 1);
          }

          env[key] = value;
        }
      }
    }
  }

  // 添加 NODE_ENV
  env.NODE_ENV = mode;

  return env;
}

/**
 * 解析配置
 */
export async function resolveConfig(
  options: ResolvedConfig
): Promise<ResolvedConfig> {
  // 处理根目录路径
  let root = options.root || process.cwd();

  // 如果根目录是相对路径，将其转换为绝对路径
  if (root && !path.isAbsolute(root)) {
    root = path.resolve(process.cwd(), root);
  }

  // 确保根目录存在
  if (root && !fs.existsSync(root)) {
    console.warn(`指定的根目录不存在: ${root}，将使用当前工作目录`);
    root = process.cwd();
  }

  console.log(`使用根目录: ${root}`);

  const mode = options.mode || "development";
  const command = options.command || "serve";

  // 查找配置文件
  const configFile = await findConfigFile(root, options.configFile);

  // 合并配置
  let config: Partial<ResolvedConfig> = { ...defaultConfig };

  // 加载配置文件
  if (configFile) {
    const fileConfig = await loadConfigFile(configFile);
    config = mergeConfig(config, fileConfig);
  }

  // 合并命令行参数
  config = mergeConfig(config, options);

  // 确保必要的属性存在
  config.root = root;
  config.mode = mode;
  config.command = command;
  config.configFile = configFile;

  // 解析环境变量
  config.env = resolveEnvVars(mode);

  // 应用插件配置钩子
  if (config.plugins && config.plugins.length > 0) {
    for (const plugin of config.plugins) {
      if (plugin.configResolved) {
        await plugin.configResolved(config as ResolvedConfig);
      }
    }
  }

  return config as ResolvedConfig;
}

/**
 * 合并配置
 */
function mergeConfig(
  defaults: Record<string, any>,
  overrides: Record<string, any>
): Record<string, any> {
  const merged: Record<string, any> = { ...defaults };

  for (const key in overrides) {
    const value = overrides[key];

    if (value === null || value === undefined) {
      continue;
    }

    const existing = merged[key];

    // 简单类型直接覆盖
    if (
      existing === null ||
      existing === undefined ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof existing !== "object" ||
      Array.isArray(existing)
    ) {
      merged[key] = value;
      continue;
    }

    // 对象类型递归合并
    merged[key] = mergeConfig(existing, value);
  }

  return merged;
}
