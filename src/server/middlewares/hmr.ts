import type { Middleware } from 'koa';

/**
 * HMR 中间件
 * 负责处理热模块替换相关的请求
 */
export function hmrMiddleware(hmrEngine: any): Middleware {
  return async (ctx, next) => {
    // 注意: /@lumos/client 路径已由 resolveMiddleware 处理
    // 该中间件只处理其他 HMR 相关功能
    
    await next();
  };
}
