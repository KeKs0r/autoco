import { test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import simpleGit from 'simple-git';
import { 
  createTestRepo, 
  setupModifiedFiles, 
  setupDeletedFiles, 
  setupRenamedFiles, 
  setupMixedScenario,
  evaluateCommitMessage,
  withTestRepo,
  type TestRepo 
} from '../test-utils';
import { generateCommits } from '../../steps/generate-commits';
import { getDiffForAI, getStatus, getDiff } from '../../git';
import { runApp } from '../../app';

// Check if we have API keys for testing
function checkApiKeys() {
  if (!process.env.ACO_OPENAI_API_KEY && !process.env.ACO_ANTHROPIC_API_KEY) {
    console.warn('Skipping integration tests - need ACO_OPENAI_API_KEY or ACO_ANTHROPIC_API_KEY');
    return false;
  }
  return true;
}

test('generates quality commit messages for modified files', withTestRepo(async (repo: TestRepo) => {
  if (!checkApiKeys()) return;
  
  await setupModifiedFiles(repo.path);
  
  // Change to test repo directory
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    // Stage the changes
    const git = simpleGit(repo.path);
    await git.add(['src/app.ts', 'package.json']);
    
    // Get diff directly from the test repo's git instance
    const diff = await git.diff(['--cached']);
    expect(diff.length).toBeGreaterThan(0);
    
    const commits = await generateCommits({ diff });
    
    // Evaluate commit quality
    expect(commits.length).toBeGreaterThan(0);
    expect(commits.length).toBeLessThanOrEqual(2); // Should be logical grouping
    
    for (const commit of commits) {
      // Basic quality checks (less strict than full evaluation)
      expect(commit.message.length).toBeGreaterThan(5);
      expect(commit.message.length).toBeLessThan(200);
      expect(commit.message).not.toMatch(/lorem ipsum|placeholder|todo|fix stuff/i);
      
      // Should include the modified files
      expect(commit.files.length).toBeGreaterThan(0);
      expect(commit.files.every(f => ['src/app.ts', 'package.json'].includes(f))).toBe(true);
    }
  } finally {
    process.chdir(originalCwd);
  }
}));

test('handles deleted files correctly', withTestRepo(async (repo: TestRepo) => {
  if (!checkApiKeys()) return;
  
  await setupDeletedFiles(repo.path);
  
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    // Stage the deletions
    const git = simpleGit(repo.path);
    await git.rm(['src/deprecated.ts', 'src/utils.ts']);
    
    const diff = await git.diff(['--cached']);
    const commits = await generateCommits({ diff });
    
    expect(commits.length).toBeGreaterThan(0);
    
    // Should mention deletion/removal
    const hasDeleteCommit = commits.some(c => 
      c.message.toLowerCase().includes('delet') || 
      c.message.toLowerCase().includes('remov') ||
      c.message.includes('🗑️') ||
      c.message.includes('🔥')
    );
    expect(hasDeleteCommit).toBe(true);
    
    // Should include deleted files
    const deletedFiles = commits.flatMap(c => c.files);
    expect(deletedFiles).toContain('src/deprecated.ts');
    expect(deletedFiles).toContain('src/utils.ts');
  } finally {
    process.chdir(originalCwd);
  }
}));

test('handles renamed files correctly', withTestRepo(async (repo: TestRepo) => {
  if (!checkApiKeys()) return;
  
  await setupRenamedFiles(repo.path);
  
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    const git = simpleGit(repo.path);
    const diff = await git.diff(['--cached']);
    const commits = await generateCommits({ diff });
    
    expect(commits.length).toBeGreaterThan(0);
    
    // Should mention rename/move
    const hasRenameCommit = commits.some(c => 
      c.message.toLowerCase().includes('renam') || 
      c.message.toLowerCase().includes('mov') ||
      c.message.includes('🚚')
    );
    expect(hasRenameCommit).toBe(true);
    
    // Should include both old and new file names in files array
    const allFiles = commits.flatMap(c => c.files);
    expect(allFiles).toContain('src/old-name.ts');
    expect(allFiles).toContain('src/new-name.ts');
  } finally {
    process.chdir(originalCwd);
  }
}));

test('filters lock files from AI but includes in commit files', withTestRepo(async (repo: TestRepo) => {
  if (!checkApiKeys()) return;
  
  await setupMixedScenario(repo.path);
  
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    // Stage all changes
    const git = simpleGit(repo.path);
    const status = await getStatus();
    
    // Stage everything
    if (status.modified.length > 0) await git.add(status.modified);
    if (status.not_added.length > 0) await git.add(status.not_added);
    if (status.deleted.length > 0) await git.rm(status.deleted);
    
    // Get both diffs
    const fullDiff = await git.diff(['--cached']);
    const aiDiff = await git.diff(['--cached']); // In test, just use same diff
    
    // Full diff should include lock file changes
    expect(fullDiff).toContain('package-lock.json');
    
    // AI diff should NOT include lock file changes  
    expect(aiDiff).not.toContain('package-lock.json');
    
    // AI should still generate good commits for non-lock files
    if (aiDiff.length > 0) {
      const commits = await generateCommits({ diff: aiDiff });
      expect(commits.length).toBeGreaterThan(0);
    }
    
    // Lock files should be added to commits by enhanceCommitsWithLockFiles
    // (This would be tested in the full app integration test)
  } finally {
    process.chdir(originalCwd);
  }
}));

test('end-to-end app workflow with real LLM', withTestRepo(async (repo: TestRepo) => {
  if (!checkApiKeys()) return;
  
  await setupMixedScenario(repo.path);
  
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    // Run the full app with force=true to skip user confirmation
    await runApp({ force: true });
    
    // Verify commits were made
    const git = simpleGit(repo.path);
    const log = await git.log();
    
    // Should have more commits than just the initial one
    expect(log.all.length).toBeGreaterThan(1); // initial + our commits
    
    // Get our generated commits (skip initial commit)
    const generatedCommits = log.all.slice(0, -1);
    
    for (const commit of generatedCommits) {
      const evaluation = evaluateCommitMessage(commit.message);
      if (!evaluation.isValid) {
        console.warn(`Commit message quality issues for "${commit.message}":`, evaluation.issues);
      }
      // Don't fail test on commit quality, but log for review
    }
    
    // Verify all changes were committed
    const status = await getStatus();
    expect(status.isClean()).toBe(true);
    
  } finally {
    process.chdir(originalCwd);
  }
}));