// Push project to GitHub via Octokit (GitHub integration)
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

const IGNORE_DIRS = new Set(['node_modules', '.git', '.cache', '.config', '.local', '.upm', 'dist', 'server/public', 'attached_assets']);
const IGNORE_FILES = new Set(['.DS_Store']);

function shouldIgnore(relativePath: string): boolean {
  const parts = relativePath.split('/');
  for (const dir of IGNORE_DIRS) {
    if (relativePath.startsWith(dir + '/') || relativePath === dir) return true;
  }
  if (IGNORE_FILES.has(path.basename(relativePath))) return true;
  if (relativePath.match(/vite\.config\.ts\..*/)) return true;
  if (relativePath.endsWith('.tar.gz')) return true;
  return false;
}

function collectFiles(dir: string, base: string = ''): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;

    if (shouldIgnore(relativePath)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath);
        const isText = !content.includes(0x00);
        if (isText) {
          results.push({ path: relativePath, content: content.toString('base64') });
        }
      } catch {}
    }
  }
  return results;
}

async function main() {
  const repoName = 'utm-spec';
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  let repo;
  let needsInit = false;
  try {
    const existing = await octokit.repos.get({ owner: user.login, repo: repoName });
    repo = existing.data;
    console.log(`Repository ${user.login}/${repoName} already exists`);
    try {
      await octokit.git.getRef({ owner: user.login, repo: repoName, ref: 'heads/main' });
    } catch {
      needsInit = true;
    }
  } catch (e: any) {
    if (e.status === 404) {
      const created = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: 'UTM Spec - SaaS for parsing, linting, and cleaning UTM parameters in marketing URLs',
        private: true,
        auto_init: true,
      });
      repo = created.data;
      console.log(`Created repository: ${repo.html_url}`);
      await new Promise(r => setTimeout(r, 2000));
    } else {
      throw e;
    }
  }

  if (needsInit) {
    console.log('Initializing empty repository with README...');
    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: repoName,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from('# UTM Spec\n').toString('base64'),
    });
    console.log('Repository initialized');
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Collecting files...');
  const rootDir = '/home/runner/workspace';
  const files = collectFiles(rootDir);
  console.log(`Found ${files.length} files to push`);

  const blobs = [];
  for (const file of files) {
    const blob = await octokit.git.createBlob({
      owner: user.login,
      repo: repoName,
      content: file.content,
      encoding: 'base64',
    });
    blobs.push({ path: file.path, sha: blob.data.sha });
  }
  console.log(`Created ${blobs.length} blobs`);

  const tree = await octokit.git.createTree({
    owner: user.login,
    repo: repoName,
    tree: blobs.map(b => ({
      path: b.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: b.sha,
    })),
  });

  let parentSha: string | undefined;
  try {
    const ref = await octokit.git.getRef({ owner: user.login, repo: repoName, ref: 'heads/main' });
    parentSha = ref.data.object.sha;
  } catch {}

  const commit = await octokit.git.createCommit({
    owner: user.login,
    repo: repoName,
    message: 'UTM Spec: full project push from Replit',
    tree: tree.data.sha,
    parents: parentSha ? [parentSha] : [],
  });

  try {
    if (parentSha) {
      await octokit.git.updateRef({
        owner: user.login,
        repo: repoName,
        ref: 'heads/main',
        sha: commit.data.sha,
        force: true,
      });
    } else {
      await octokit.git.createRef({
        owner: user.login,
        repo: repoName,
        ref: 'refs/heads/main',
        sha: commit.data.sha,
      });
    }
  } catch {
    await octokit.git.createRef({
      owner: user.login,
      repo: repoName,
      ref: 'refs/heads/main',
      sha: commit.data.sha,
    });
  }

  console.log(`\nPushed successfully to: ${repo.html_url}`);
  console.log(`\nTo clone locally:\n  git clone https://github.com/${user.login}/${repoName}.git`);
  console.log(`\nTo run locally:`);
  console.log(`  cd ${repoName}`);
  console.log(`  npm install`);
  console.log(`  # Set up .env with DATABASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET`);
  console.log(`  npm run db:push`);
  console.log(`  npm run dev`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
