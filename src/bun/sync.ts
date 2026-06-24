import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getSyncConfig, saveSyncConfig } from './storage';
import { logger } from './logger';

const TMP_DIR = join(process.env.HOME || '', '.coursereader', 'tmp-sync');

let _isSyncing = false;

export function isSyncing(): boolean {
  return _isSyncing;
}

function backupSRSDirs(coursesDir: string): Map<string, string> {
  const backups = new Map<string, string>();
  if (!existsSync(coursesDir)) return backups;

  const entries = readdirSync(coursesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const deckPath = join(coursesDir, entry.name, 'srs', 'deck.json');
    if (existsSync(deckPath)) {
      backups.set(entry.name, readFileSync(deckPath, 'utf-8'));
    }
  }
  return backups;
}

function restoreSRSDirs(backups: Map<string, string>, coursesDir: string): void {
  for (const [courseId, deckJSON] of backups) {
    const srsDir = join(coursesDir, courseId, 'srs');
    mkdirSync(srsDir, { recursive: true });
    writeFileSync(join(srsDir, 'deck.json'), deckJSON);
  }
}

function findCoursesDir(): string | null {
  const possiblePaths = [
    join(process.env.HOME || '', 'Desktop', 'courses', 'subjects'),
    join(import.meta.dir, '..', '..', 'subjects'),
    join(import.meta.dir, '..', '..', '..', 'subjects'),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }
  return possiblePaths[0];
}

async function getLatestRemoteCommit(repoURL: string): Promise<string> {
  const match = repoURL.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL format');

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');

  const res = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/commits/main`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

function gitClone(repoURL: string, destDir: string): void {
  execSync(`git clone --depth 1 "${repoURL}" "${destDir}"`, {
    stdio: 'pipe',
    timeout: 60000,
  });
}

export async function syncCourses(): Promise<{
  success: boolean;
  commitHash: string;
  message: string;
  unchanged?: boolean;
}> {
  if (_isSyncing) return { success: false, commitHash: '', message: 'Sync already in progress' };
  _isSyncing = true;

  try {
    const config = getSyncConfig();
    const repoURL = config.remoteRepoURL;

    if (!repoURL) {
      return { success: false, commitHash: '', message: 'No remote repository configured' };
    }

    const remoteSHA = await getLatestRemoteCommit(repoURL);
    if (remoteSHA === config.lastSyncedCommit) {
      return {
        success: true,
        commitHash: remoteSHA,
        message: 'Already up to date',
        unchanged: true,
      };
    }

    const coursesDir = findCoursesDir();
    if (!coursesDir) {
      return { success: false, commitHash: '', message: 'Courses directory not found' };
    }

    const backups = backupSRSDirs(coursesDir);

    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
    mkdirSync(TMP_DIR, { recursive: true });

    gitClone(repoURL, TMP_DIR);

    const clonedEntries = readdirSync(TMP_DIR, { withFileTypes: true });
    const courseDirs = clonedEntries.filter(
      (e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'srs',
    );

    if (existsSync(coursesDir)) {
      const existingEntries = readdirSync(coursesDir, { withFileTypes: true });
      for (const entry of existingEntries) {
        if (entry.name === 'srs') continue;
        rmSync(join(coursesDir, entry.name), { recursive: true, force: true });
      }
    } else {
      mkdirSync(coursesDir, { recursive: true });
    }

    for (const dir of courseDirs) {
      cpSync(join(TMP_DIR, dir.name), join(coursesDir, dir.name), { recursive: true });
    }

    restoreSRSDirs(backups, coursesDir);

    saveSyncConfig({
      remoteRepoURL: repoURL,
      lastSyncedCommit: remoteSHA,
      lastSyncTime: new Date().toISOString(),
    });

    rmSync(TMP_DIR, { recursive: true, force: true });

    return {
      success: true,
      commitHash: remoteSHA,
      message: `Synced ${courseDirs.length} courses`,
    };
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Sync failed');
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
    return {
      success: false,
      commitHash: '',
      message: (err as Error).message,
    };
  } finally {
    _isSyncing = false;
  }
}
