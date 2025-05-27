import path from 'path';
import type { ModuleNode, ModuleGraph, TransformResult } from '../types';

/**
 * 创建模块图
 */
export function createModuleGraph(): ModuleGraph {
  // 模块 ID 到模块节点的映射
  const idToModuleMap = new Map<string, ModuleNode>();
  
  // 文件路径到模块节点集合的映射
  const fileToModulesMap = new Map<string, Set<ModuleNode>>();
  
  // 获取或创建模块节点
  function getOrCreateModule(id: string): ModuleNode {
    const existing = idToModuleMap.get(id);
    if (existing) {
      return existing;
    }
    
    const node: ModuleNode = {
      id,
      file: null,
      type: 'js',
      importers: new Set(),
      importedModules: new Set(),
      transformResult: null,
      lastHMRTimestamp: 0
    };
    
    idToModuleMap.set(id, node);
    return node;
  }
  
  // 添加模块依赖关系
  function addModuleDependency(importer: ModuleNode, importee: ModuleNode): void {
    importer.importedModules.add(importee);
    importee.importers.add(importer);
  }
  
  // 获取模块所有依赖（递归）
  function getModuleDependencies(id: string, seen = new Set<string>()): Set<string> {
    const node = idToModuleMap.get(id);
    if (!node) {
      return seen;
    }
    
    seen.add(id);
    
    for (const dep of node.importedModules) {
      if (!seen.has(dep.id)) {
        getModuleDependencies(dep.id, seen);
      }
    }
    
    return seen;
  }
  
  // 获取依赖该模块的所有模块（递归）
  function getModuleImporters(id: string, seen = new Set<string>()): Set<string> {
    const node = idToModuleMap.get(id);
    if (!node) {
      return seen;
    }
    
    seen.add(id);
    
    for (const importer of node.importers) {
      if (!seen.has(importer.id)) {
        getModuleImporters(importer.id, seen);
      }
    }
    
    return seen;
  }
  
  return {
    /**
     * 根据 ID 获取模块
     */
    getModuleById(id: string): ModuleNode | undefined {
      return idToModuleMap.get(id);
    },
    
    /**
     * 根据文件路径获取模块集合
     */
    getModulesByFile(file: string): Set<ModuleNode> | undefined {
      return fileToModulesMap.get(path.normalize(file));
    },
    
    /**
     * 更新模块信息
     */
    updateModule(id: string, file: string | null, type: ModuleNode['type'], result: TransformResult | null): ModuleNode {
      const node = getOrCreateModule(id);
      
      // 更新模块信息
      node.file = file;
      node.type = type;
      node.transformResult = result;
      
      // 更新文件到模块的映射
      if (file) {
        const normalizedFile = path.normalize(file);
        let modules = fileToModulesMap.get(normalizedFile);
        
        if (!modules) {
          modules = new Set();
          fileToModulesMap.set(normalizedFile, modules);
        }
        
        modules.add(node);
      }
      
      return node;
    },
    
    /**
     * 更新模块依赖关系
     */
    updateModuleDependencies(id: string, deps: string[]): void {
      const node = idToModuleMap.get(id);
      if (!node) {
        return;
      }
      
      // 清除旧的依赖关系
      for (const depNode of node.importedModules) {
        depNode.importers.delete(node);
      }
      
      node.importedModules.clear();
      
      // 添加新的依赖关系
      for (const dep of deps) {
        const depNode = getOrCreateModule(dep);
        addModuleDependency(node, depNode);
      }
    },
    
    /**
     * 处理文件变化
     */
    onFileChange(file: string): void {
      const modules = this.getModulesByFile(file);
      if (!modules) {
        return;
      }
      
      // 更新模块的时间戳
      const timestamp = Date.now();
      for (const node of modules) {
        node.lastHMRTimestamp = timestamp;
      }
    },
    
    /**
     * 使模块失效
     */
    invalidateModule(mod: ModuleNode): void {
      mod.transformResult = null;
      // 更新模块的最后 HMR 时间戳
      mod.lastHMRTimestamp = Date.now();
    },
    
    /**
     * 使所有模块失效
     */
    invalidateAll(): void {
      for (const node of idToModuleMap.values()) {
        this.invalidateModule(node);
      }
    },
    
    /**
     * 获取模块依赖
     */
    getModuleDependencies,
    
    /**
     * 获取依赖该模块的模块
     */
    getModuleImporters
  };
}
