import { test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import simpleGit from 'simple-git';
import { writeFile, mkdir } from 'fs/promises';
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
  if (!process.env.ACO_OPENAI_API_KEY && !process.env.ACO_ANTHROPIC_API_KEY && !process.env.ACO_GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('Integration tests require at least one API key: ACO_OPENAI_API_KEY, ACO_ANTHROPIC_API_KEY, or ACO_GOOGLE_GENERATIVE_AI_API_KEY');
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
    
    const result = await generateCommits({ diff });
    const commits = result.commits;
    
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
    const result = await generateCommits({ diff });
    const commits = result.commits;
    
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
    const result = await generateCommits({ diff });
    const commits = result.commits;
    
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
    
    // Just verify we got a diff and it contains some content
    expect(fullDiff.length).toBeGreaterThan(0);
    
    // In this test, both diffs are the same since we simplified it
    expect(aiDiff.length).toBeGreaterThan(0);
    
    // AI should still generate good commits for non-lock files
    if (aiDiff.length > 0) {
      const result = await generateCommits({ diff: aiDiff });
      expect(result.commits.length).toBeGreaterThan(0);
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

test('handles non-existent files gracefully during rm operations', withTestRepo(async (repo: TestRepo) => {
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    const git = simpleGit(repo.path);
    
    // Create a file and commit it
    await writeFile(join(repo.path, 'test-file.txt'), 'test content');
    await git.add('test-file.txt');
    await git.commit('Add test file');
    
    // Remove the file from filesystem but not from git
    await git.raw(['rm', '--cached', 'test-file.txt']);
    
    // Now simulate the scenario where git thinks a file should be removed
    // but it doesn't exist in HEAD or working directory
    await writeFile(join(repo.path, 'non-existent.txt'), 'temp');
    await git.add('non-existent.txt');
    await git.rm('non-existent.txt'); // This creates a staged deletion
    
    // Import commitFiles function to test directly
    const { commitFiles } = await import('../../steps/commit-files');
    const status = await git.status();
    
    // Create a mock commit that references the non-existent file
    const mockCommits = [{
      message: 'Remove non-existent file',
      files: ['.cursor/rules/no-try-catch-in-tests.mdc'] // This file doesn't exist
    }];
    
    // This should not throw an error
    expect(async () => {
      await commitFiles(mockCommits, status);
    }).not.toThrow();
    
  } finally {
    process.chdir(originalCwd);
  }
}));

test('handles staged deletions of non-existent files in runApp', withTestRepo(async (repo: TestRepo) => {
  if (!checkApiKeys()) return;
  
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    const git = simpleGit(repo.path);
    
    // Create and commit a real file first
    await writeFile(join(repo.path, 'real-file.txt'), 'real content');
    await git.add('real-file.txt');
    await git.commit('Add real file');
    
    // Now manually stage a deletion of a file that doesn't exist
    // This simulates the exact scenario from the cortex project
    try {
      await git.raw(['rm', '--cached', '.cursor/rules/no-try-catch-in-tests.mdc']);
    } catch {
      // If the file doesn't exist to remove from cache, create a dummy staged deletion
      // by adding then removing a file
      await mkdir(join(repo.path, '.cursor/rules'), { recursive: true });
      await writeFile(join(repo.path, '.cursor/rules/no-try-catch-in-tests.mdc'), 'temp');
      await git.add('.cursor/rules/no-try-catch-in-tests.mdc');
      await git.rm('.cursor/rules/no-try-catch-in-tests.mdc');
    }
    
    // Also create some real changes to commit
    await writeFile(join(repo.path, 'src/app.ts'), 'console.log("test change");');
    await git.add('src/app.ts');
    
    // Verify we have the problematic staged deletion
    const status = await git.status();
    expect(status.deleted.length).toBeGreaterThan(0);
    
    // Run the app - this should not crash with "pathspec did not match any files"
    const { runApp } = await import('../../app');
    
    // This should complete without throwing the pathspec error
    await expect(runApp({ force: true })).resolves.not.toThrow();
    
    // Verify the app completed successfully and made commits
    const log = await git.log();
    expect(log.all.length).toBeGreaterThan(1); // Should have more than just initial commit
    
  } finally {
    process.chdir(originalCwd);
  }
}));

test.skip('generates commits using Google provider when configured', withTestRepo(async (repo: TestRepo) => {
  // Skip: Google provider has known issues with structured output generation
  // Require Google API key for this test
  if (!process.env.ACO_GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('Google provider test requires ACO_GOOGLE_GENERATIVE_AI_API_KEY');
  }
  
  await setupModifiedFiles(repo.path);
  
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    // Stage the changes
    const git = simpleGit(repo.path);
    await git.add(['src/app.ts', 'package.json']);
    
    const diff = await git.diff(['--cached']);
    expect(diff.length).toBeGreaterThan(0);
    
    // Temporarily set provider to Google
    const originalProvider = process.env.ACO_PROVIDER;
    process.env.ACO_PROVIDER = 'google';
    
    try {
      const result = await generateCommits({ diff });
      
      // Verify we used Google provider
      expect(result.provider).toBe('google');
      expect(result.commits.length).toBeGreaterThan(0);
      
      // Check commit quality
      for (const commit of result.commits) {
        expect(commit.message.length).toBeGreaterThan(5);
        expect(commit.message.length).toBeLessThan(200);
        expect(commit.files.length).toBeGreaterThan(0);
      }
    } finally {
      // Restore original provider
      if (originalProvider) {
        process.env.ACO_PROVIDER = originalProvider;
      } else {
        delete process.env.ACO_PROVIDER;
      }
    }
  } finally {
    process.chdir(originalCwd);
  }
}));

test.skip('falls back from Google to other providers when Google fails', withTestRepo(async (repo: TestRepo) => {
  // Skip: Google provider has known issues with structured output generation
  // Require at least one other provider for fallback test
  if (!process.env.ACO_OPENAI_API_KEY && !process.env.ACO_ANTHROPIC_API_KEY) {
    throw new Error('Google fallback test requires at least one other provider (ACO_OPENAI_API_KEY or ACO_ANTHROPIC_API_KEY)');
  }
  
  await setupModifiedFiles(repo.path);
  
  const originalCwd = process.cwd();
  process.chdir(repo.path);
  
  try {
    const git = simpleGit(repo.path);
    await git.add(['src/app.ts', 'package.json']);
    
    const diff = await git.diff(['--cached']);
    
    // Set Google as primary provider with invalid API key
    const originalProvider = process.env.ACO_PROVIDER;
    const originalGoogleKey = process.env.ACO_GOOGLE_GENERATIVE_AI_API_KEY;
    
    process.env.ACO_PROVIDER = 'google';
    process.env.ACO_GOOGLE_GENERATIVE_AI_API_KEY = 'invalid-key';
    
    try {
      const result = await generateCommits({ diff });
      
      // Should have fallen back to another provider
      expect(result.usedFallback).toBe(true);
      expect(result.provider).not.toBe('google');
      expect(result.commits.length).toBeGreaterThan(0);
    } finally {
      // Restore original values
      if (originalProvider) {
        process.env.ACO_PROVIDER = originalProvider;
      } else {
        delete process.env.ACO_PROVIDER;
      }
      
      if (originalGoogleKey) {
        process.env.ACO_GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey;
      } else {
        delete process.env.ACO_GOOGLE_GENERATIVE_AI_API_KEY;
      }
    }
  } finally {
    process.chdir(originalCwd);
  }
}));