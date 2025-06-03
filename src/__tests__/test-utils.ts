import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import simpleGit from 'simple-git';

export interface TestRepo {
  path: string;
  cleanup: () => Promise<void>;
}

export async function createTestRepo(): Promise<TestRepo> {
  // Create temp directory
  const tempDir = await mkdtemp(join(tmpdir(), 'autoco-test-'));
  
  // Initialize git repo
  const git = simpleGit(tempDir);
  await git.init();
  await git.addConfig('user.name', 'Test User');
  await git.addConfig('user.email', 'test@example.com');
  
  // Create initial commit to establish main branch
  await writeFile(join(tempDir, 'README.md'), '# Test repo');
  await git.add('README.md');
  await git.commit('Initial commit');
  
  return {
    path: tempDir,
    cleanup: async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup ${tempDir}:`, error);
      }
    }
  };
}

export async function setupModifiedFiles(repoPath: string): Promise<void> {
  // Create and commit initial files
  await writeFile(join(repoPath, 'src/app.ts'), 'export function hello() { return "world"; }');
  await writeFile(join(repoPath, 'package.json'), '{"name": "test", "version": "1.0.0"}');
  
  const git = simpleGit(repoPath);
  await git.add(['src/app.ts', 'package.json']);
  await git.commit('Add initial files');
  
  // Modify files (unstaged changes)
  await writeFile(join(repoPath, 'src/app.ts'), 'export function hello() { return "updated world"; }');
  await writeFile(join(repoPath, 'package.json'), '{"name": "test", "version": "1.1.0"}');
}

export async function setupDeletedFiles(repoPath: string): Promise<void> {
  // Create and commit files
  await mkdir(join(repoPath, 'src'), { recursive: true });
  await writeFile(join(repoPath, 'src/deprecated.ts'), 'export const OLD_API = "deprecated";');
  await writeFile(join(repoPath, 'src/utils.ts'), 'export function helper() {}');
  
  const git = simpleGit(repoPath);
  await git.add(['src/deprecated.ts', 'src/utils.ts']);
  await git.commit('Add files to be deleted');
  
  // Delete files
  await rm(join(repoPath, 'src/deprecated.ts'));
  await rm(join(repoPath, 'src/utils.ts'));
}

export async function setupRenamedFiles(repoPath: string): Promise<void> {
  // Create and commit initial file
  await mkdir(join(repoPath, 'src'), { recursive: true });
  await writeFile(join(repoPath, 'src/old-name.ts'), 'export const API_VERSION = "1.0";');
  
  const git = simpleGit(repoPath);
  await git.add('src/old-name.ts');
  await git.commit('Add file to be renamed');
  
  // Rename file using git mv
  await git.mv('src/old-name.ts', 'src/new-name.ts');
}

export async function setupMixedScenario(repoPath: string): Promise<void> {
  // Create directory structure
  await mkdir(join(repoPath, 'src'), { recursive: true });
  await mkdir(join(repoPath, 'docs'), { recursive: true });
  
  // Create initial files
  await writeFile(join(repoPath, 'src/app.ts'), 'export function main() {}');
  await writeFile(join(repoPath, 'src/old-file.ts'), 'export const OLD = true;');
  await writeFile(join(repoPath, 'docs/readme.md'), '# Documentation');
  await writeFile(join(repoPath, 'package.json'), '{"name": "test", "version": "1.0.0"}');
  await writeFile(join(repoPath, 'package-lock.json'), '{"lockfileVersion": 2}');
  
  const git = simpleGit(repoPath);
  await git.add(['src/app.ts', 'src/old-file.ts', 'docs/readme.md', 'package.json', 'package-lock.json']);
  await git.commit('Add initial project files');
  
  // Mix of operations:
  // 1. Modify existing file
  await writeFile(join(repoPath, 'src/app.ts'), 'export function main() { console.log("updated"); }');
  
  // 2. Rename file
  await git.mv('src/old-file.ts', 'src/new-file.ts');
  
  // 3. Delete file
  await rm(join(repoPath, 'docs/readme.md'));
  
  // 4. Add new file
  await writeFile(join(repoPath, 'src/types.ts'), 'export interface User { id: string; }');
  
  // 5. Update lock file (should be filtered from AI but still committed)
  await writeFile(join(repoPath, 'package-lock.json'), '{"lockfileVersion": 2, "updated": true}');
}

export function evaluateCommitMessage(message: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check length (good practice: under 72 chars for first line)
  if (message.length > 72) {
    issues.push('Commit message too long (should be under 72 characters)');
  }
  
  // Check for conventional commit format
  const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|test|chore|ci|build|perf)(\(.+\))?: .+/;
  const gitmojiRegex = /^[🎨📦🚀🐛📝✅♻️⬆️🔒]/;
  
  if (!conventionalCommitRegex.test(message) && !gitmojiRegex.test(message)) {
    issues.push('Does not follow conventional commit format or use gitmoji');
  }
  
  // Check for placeholder text
  const placeholders = ['lorem ipsum', 'placeholder', 'todo', 'fix stuff', 'update things'];
  if (placeholders.some(p => message.toLowerCase().includes(p))) {
    issues.push('Contains placeholder text');
  }
  
  // Check for meaningful description
  if (message.length < 10) {
    issues.push('Message too short to be descriptive');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

export function withTestRepo<T>(
  testFn: (repo: TestRepo) => Promise<T>
): () => Promise<T> {
  return async () => {
    const repo = await createTestRepo();
    try {
      return await testFn(repo);
    } finally {
      await repo.cleanup();
    }
  };
}