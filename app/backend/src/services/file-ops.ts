import fs from 'fs';
import path from 'path';
import { SNAPSHOT_DIR } from '../config';

function ensureSnapshotDir(): void {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

function snapshotFile(filePath: string): string | null {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return null;
  ensureSnapshotDir();
  const snapPath = path.join(SNAPSHOT_DIR, `${Date.now()}_${path.basename(p)}`);
  try {
    fs.copyFileSync(p, snapPath);
    return snapPath;
  } catch {
    return null;
  }
}

function writeFile(filePath: string, content: string): void {
  const p = path.resolve(filePath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, content, 'utf-8');
}

function readFile(filePath: string): string | null {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

function deleteFile(filePath: string): boolean {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

function scanDirectory(dirPath: string, skipHidden: boolean = true): string[] {
  const root = path.resolve(dirPath);
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const skipDirs = new Set(['node_modules', '__pycache__', '.venv', 'env', 'venv', '.git', '.snapshots']);

  function walk(current: string, relative: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relPath = relative ? `${relative}/${entry.name}` : entry.name;
      const fullPath = path.join(current, entry.name);
      if (entry.name.startsWith('.') && skipHidden) continue;
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(fullPath, relPath);
      } else {
        results.push(relPath);
      }
    }
  }

  walk(root, '');
  return results;
}

export { snapshotFile, writeFile, readFile, deleteFile, fileExists, scanDirectory };