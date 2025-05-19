// Lumos 主入口文件
import { createDevServer } from "./server";
import { createBuilder } from "./builder";
import { resolveConfig } from "./config";
import type { ResolvedConfig } from "./types";

export async function createServer(options: ResolvedConfig) {
  const config = await resolveConfig(options);
  return createDevServer(config);
}

export async function build(options: ResolvedConfig) {
  const config = await resolveConfig(options);
  const builder = createBuilder(config);
  return builder.build();
}

export * from "./types";
export * from "./plugin";
