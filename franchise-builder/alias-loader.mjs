/**
 * Custom ESM loader: resolves @/ aliases and adds .js extensions for local imports.
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'src');

export function resolve(specifier, context, nextResolve) {
  let resolved = specifier;

  // Resolve @/ alias
  if (resolved.startsWith('@/')) {
    resolved = path.join(srcDir, resolved.slice(2));
  }

  // For relative/absolute paths without extension, try adding .js
  if (resolved.startsWith('/') || resolved.startsWith('./') || resolved.startsWith('../')) {
    // If context.parentURL exists, resolve relative to parent
    let fullPath = resolved;
    if (!path.isAbsolute(resolved) && context.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      fullPath = path.resolve(parentDir, resolved);
    }

    // Try adding .js if no extension
    if (!path.extname(fullPath)) {
      // Check if it's a directory with index.js
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        const indexPath = path.join(fullPath, 'index.js');
        if (fs.existsSync(indexPath)) {
          return { shortCircuit: true, url: pathToFileURL(indexPath).href };
        }
      }
      // Try .js extension
      if (fs.existsSync(fullPath + '.js')) {
        return { shortCircuit: true, url: pathToFileURL(fullPath + '.js').href };
      }
    }

    if (path.isAbsolute(resolved)) {
      return { shortCircuit: true, url: pathToFileURL(resolved).href };
    }
  }

  // Handle @/ resolved to absolute path
  if (path.isAbsolute(resolved) && !resolved.startsWith('file:')) {
    if (!path.extname(resolved)) {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        const indexPath = path.join(resolved, 'index.js');
        if (fs.existsSync(indexPath)) {
          return { shortCircuit: true, url: pathToFileURL(indexPath).href };
        }
      }
      if (fs.existsSync(resolved + '.js')) {
        return { shortCircuit: true, url: pathToFileURL(resolved + '.js').href };
      }
    }
    return { shortCircuit: true, url: pathToFileURL(resolved).href };
  }

  return nextResolve(specifier, context);
}
