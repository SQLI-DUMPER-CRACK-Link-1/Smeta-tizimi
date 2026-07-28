import type { TreeNode } from '../../api/types';

export type FlatNode = {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  path: string[];
};

export function flattenTree(
  nodes: TreeNode[], 
  expandedMap: Record<string, boolean>, 
  depth = 0,
  path: string[] = []
): FlatNode[] {
  let result: FlatNode[] = [];
  
  for (const node of nodes) {
    const currentPath = [...path, node.uid];
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedMap[node.uid];
    
    result.push({
      node,
      depth,
      isExpanded,
      hasChildren,
      path: currentPath
    });
    
    if (hasChildren && isExpanded) {
      result = result.concat(flattenTree(node.children, expandedMap, depth + 1, currentPath));
    }
  }
  
  return result;
}

export function getAllKeys(nodes: TreeNode[]): string[] {
  let keys: string[] = [];
  for (const node of nodes) {
    keys.push(node.uid);
    if (node.children) keys = keys.concat(getAllKeys(node.children));
  }
  return keys;
}
