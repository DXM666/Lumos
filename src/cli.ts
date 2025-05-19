import cac from "cac";
import { createServer, build } from "./index";
import { version } from "../package.json";
import pc from "picocolors";

export async function cli() {
  const cli = cac("lumos");

  // 全局选项
  cli.option("-c, --config <file>", "指定配置文件路径");
  cli.option("--base <path>", "公共基础路径");
  cli.option("--outDir <dir>", "输出目录");
  cli.option("--clearScreen", "清除屏幕", { default: true });
  cli.option("--logLevel <level>", "日志级别");

  // 开发服务器命令
  cli
    .command("[root]", "启动开发服务器")
    .alias("dev")
    .alias("serve")
    .option("--host [host]", "指定服务器主机名")
    .option("--port <port>", "指定服务器端口")
    .option("--https", "使用 TLS + HTTP/2")
    .option("--open [path]", "启动时打开浏览器")
    .option("--cors", "启用 CORS")
    .option("--strictPort", "如果端口已被使用则直接退出")
    .option("--force", "强制优化器忽略缓存并重新构建")
    .action(async (root: string, options: Record<string, any>) => {
      try {
        console.log(pc.cyan(`\n🚀 Lumos v${version}\n`));

        const server = await createServer({
          root,
          base: options.base,
          mode: "development",
          configFile: options.config,
          logLevel: options.logLevel,
          server: {
            host: options.host,
            port: options.port,
            https: options.https,
            open: options.open,
            cors: options.cors,
            strictPort: options.strictPort,
          },
          optimizeDeps: {
            force: options.force,
          },
          command: "build",
          env: {},
          resolve: undefined,
          plugins: [],
        });

        await server.listen();

        // 显示服务器信息
        server.printUrls();
      } catch (e) {
        console.error(pc.red(`启动服务器失败: ${e}`));
        process.exit(1);
      }
    });

  // 构建命令
  cli
    .command("build [root]", "构建生产版本")
    .option("--target <target>", "构建目标", { default: "modules" })
    .option("--outDir <dir>", "输出目录", { default: "dist" })
    .option("--minify [minifier]", "是否压缩代码", { default: true })
    .option("--manifest", "生成 manifest.json 文件")
    .option("--emptyOutDir", "构建前清空输出目录", { default: true })
    .option("--sourcemap", "生成 source maps")
    .action(async (root: string, options: Record<string, any>) => {
      try {
        console.log(pc.cyan(`\n🔨 Lumos v${version}\n`));

        await build({
          root,
          base: options.base,
          mode: "production",
          configFile: options.config,
          logLevel: options.logLevel,
          build: {
            target: options.target,
            outDir: options.outDir,
            minify: options.minify,
            manifest: options.manifest,
            emptyOutDir: options.emptyOutDir,
            sourcemap: options.sourcemap,
          },
          command: "build",
          env: {},
          resolve: undefined,
          plugins: [],
        });

        console.log(pc.green("\n✓ 构建完成！\n"));
      } catch (e) {
        console.error(pc.red(`构建失败: ${e}`));
        process.exit(1);
      }
    });

  // 显示版本
  cli.version(version);
  cli.help();

  // 解析命令行参数
  cli.parse(process.argv, { run: false });

  // 处理未知命令
  const parsed = cli.parse();
  if (!parsed.options.help && parsed.args.length === 0) {
    cli.outputHelp();
  }
}
