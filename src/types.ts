// 核心类型定义

import { Server, IncomingMessage } from "http";

// 配置选项
export interface LumosOptions {
  // 项目根目录
  root?: string;
  // 公共基础路径
  base?: string;
  // 模式 - 开发或生产
  mode?: "development" | "production";
  // 配置文件路径
  configFile?: string | null;
  // 日志级别
  logLevel?: "info" | "warn" | "error" | "silent";
  // 服务器选项
  server?: ServerOptions;
  // 构建选项
  build?: BuildOptions;
  // 依赖优化选项
  optimizeDeps?: DepOptimizationOptions;
  // 插件
  plugins?: LumosPlugin[];
}

// 服务器选项
export interface ServerOptions {
  host?: string | boolean;
  port?: number;
  https?: boolean;
  open?: boolean | string;
  cors?: boolean;
  strictPort?: boolean;
  hmr?: boolean | { port?: number; host?: string };
  watch?: {
    ignored?: string | RegExp | (string | RegExp)[];
  };
  middlewareMode?: boolean;
}

// 构建选项
export interface BuildOptions {
  target?: "modules" | "esnext" | "es2020" | "es2015";
  outDir?: string;
  assetsDir?: string;
  assetsInlineLimit?: number;
  cssCodeSplit?: boolean;
  minify?: boolean | "terser" | "esbuild";
  manifest?: boolean;
  emptyOutDir?: boolean;
  sourcemap?: boolean | "inline" | "hidden";
  rollupOptions?: any; // Rollup 选项
}

// 依赖优化选项
export interface DepOptimizationOptions {
  entries?: string | string[];
  include?: string[];
  exclude?: string[];
  force?: boolean;
  getOptimizedPath?: (id: string) => string | undefined;
}

// 插件接口
export interface LumosPlugin {
  name: string;
  enforce?: "pre" | "post";
  apply?: "serve" | "build" | null;
  configResolved?: (config: ResolvedConfig) => void | Promise<void>;
  configureServer?: (server: DevServer) => void | Promise<void>;
  transformIndexHtml?: (html: string) => string | Promise<string>;
  resolveId?: (
    id: string,
    importer?: string
  ) => string | null | Promise<string | null>;
  load?: (id: string) => string | null | Promise<string | null>;
  transform?: (code: string, id: string) => any | Promise<any>;
  buildStart?: () => void | Promise<void>;
  buildEnd?: () => void | Promise<void>;
  generateBundle?: (outputOptions: any, bundle: any) => void | Promise<void>;
}

// 解析后的配置
export interface ResolvedConfig extends LumosOptions {
  root: string;
  base: string;
  mode: "development" | "production";
  configFile?: string | null;
  command: "build" | "serve";
  env: Record<string, string>;
  resolve?: ResolveOptions;
  plugins: LumosPlugin[];
}

// 解析选项
export interface ResolveOptions {
  alias?: Record<string, string>;
  dedupe?: string[];
  conditions?: string[];
  mainFields?: string[];
  extensions?: string[];
}

// 开发服务器
export interface DevServer {
  config: ResolvedConfig;
  listen: () => Promise<void>;
  close: () => Promise<void>;
  printUrls: () => void;
  restart: () => Promise<void>;
  watcher: any; // Chokidar watcher
  app: any;
  wss: any;
  httpServer: any;
  pluginContainer: any;
  hmrEngine: any;
  optimizeDeps: any;
  moduleGraph: ModuleGraph;
}

// 模块图
export interface ModuleGraph {
  getModuleById: (id: string) => ModuleNode | undefined;
  getModulesByFile: (file: string) => Set<ModuleNode> | undefined;
  updateModule: (
    id: string,
    file: string | null,
    type: ModuleNode["type"],
    result: TransformResult | null
  ) => ModuleNode;
  updateModuleDependencies: (id: string, deps: string[]) => void;
  onFileChange: (file: string) => void;
  invalidateModule: (module: ModuleNode) => void;
  invalidateAll: () => void;
  getModuleDependencies: (id: string, seen: Set<string>) => Set<string>;
  getModuleImporters: (id: string, seen: Set<string>) => Set<string>;
}

// 模块节点
export interface ModuleNode {
  id: string;
  file: string | null;
  type: "js" | "css" | "html" | "json" | "asset";
  importers: Set<ModuleNode>;
  importedModules: Set<ModuleNode>;
  transformResult: TransformResult | null;
  lastHMRTimestamp: number;
}

// 转换结果
export interface TransformResult {
  code: string;
  map: any | null;
  etag?: string;
  deps?: string[];
  dynamicDeps?: string[];
}
