/**
 * Downloads a GGUF model file for on-device inference, verifying its SHA-256
 * checksum before making it available to the app.
 *
 * Usage:
 *   npx ts-node scripts/download-model.ts           # downloads Phi-3.5 Mini (default)
 *   npx ts-node scripts/download-model.ts gemma     # downloads Gemma 2B IT
 *
 * The downloaded file lands in models/ at the repo root.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as url from 'url';

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------

interface ModelEntry {
  name: string;
  url: string;
  /** Lowercase hex SHA-256 of the expected file. Fill in after first download. */
  sha256: string;
  /** Approximate size string shown in progress. */
  sizeHint: string;
}

const MODELS: Record<string, ModelEntry> = {
  phi: {
    name: 'Phi-3.5 Mini Instruct Q4_K_M',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    // TODO: replace with authoritative SHA-256 from HuggingFace model card
    sha256: 'TODO_REPLACE_WITH_SHA256_OF_Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sizeHint: '~2.4 GB',
  },
  gemma: {
    name: 'Gemma 2B IT Q4_K_M',
    url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    // TODO: replace with authoritative SHA-256 from HuggingFace model card
    sha256: 'TODO_REPLACE_WITH_SHA256_OF_gemma-2-2b-it-Q4_K_M.gguf',
    sizeHint: '~1.5 GB',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODELS_DIR = path.resolve(__dirname, '..', 'models');

function ensureModelsDir(): void {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

function destPath(modelUrl: string): string {
  const parsed = new url.URL(modelUrl);
  const filename = path.basename(parsed.pathname);
  return path.join(MODELS_DIR, filename);
}

/** Streams a URL to disk, following up to maxRedirects HTTP redirects. */
function download(
  fileUrl: string,
  dest: string,
  onProgress: (received: number, total: number) => void,
  maxRedirects = 5,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    https
      .get(fileUrl, (res) => {
        if (res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400) {
          const location = res.headers.location;
          if (!location) {
            reject(new Error(`Redirect with no Location header (HTTP ${res.statusCode})`));
            return;
          }
          res.resume();
          resolve(download(location, dest, onProgress, maxRedirects - 1));
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Unexpected HTTP status ${res.statusCode ?? 'unknown'} for ${fileUrl}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let received = 0;

        const file = fs.createWriteStream(dest);

        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          onProgress(received, total);
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        res.on('error', reject);
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

/** Computes hex SHA-256 of a file on disk. */
function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk as Buffer));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function renderProgress(received: number, total: number): void {
  if (total > 0) {
    const pct = ((received / total) * 100).toFixed(1);
    const bar = '='.repeat(Math.floor((received / total) * 30)).padEnd(30, ' ');
    process.stdout.write(`\r  [${bar}] ${pct}%  ${formatBytes(received)} / ${formatBytes(total)}`);
  } else {
    process.stdout.write(`\r  Downloaded ${formatBytes(received)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const arg = process.argv[2] ?? 'phi';
  const modelKey = arg.toLowerCase();

  const model = MODELS[modelKey];
  if (!model) {
    console.error(`Unknown model "${arg}". Available: ${Object.keys(MODELS).join(', ')}`);
    process.exit(1);
  }

  ensureModelsDir();

  const dest = destPath(model.url);
  console.log(`\nDownloading ${model.name} (${model.sizeHint})`);
  console.log(`  Source : ${model.url}`);
  console.log(`  Dest   : ${dest}\n`);

  if (fs.existsSync(dest)) {
    console.log('  File already exists — verifying checksum…');
  } else {
    try {
      await download(model.url, dest, renderProgress);
      process.stdout.write('\n');
    } catch (err) {
      process.stdout.write('\n');
      // Clean up partial download before rethrowing.
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      throw err;
    }
  }

  if (model.sha256.startsWith('TODO')) {
    console.log('\n  ⚠  Checksum is a TODO placeholder — skipping verification.');
    console.log('     Update scripts/download-model.ts with the real SHA-256 before shipping.');
    console.log('\nDone (unverified).');
    return;
  }

  console.log('\n  Verifying SHA-256…');
  const actual = await sha256File(dest);

  if (actual !== model.sha256.toLowerCase()) {
    fs.unlinkSync(dest);
    throw new Error(
      `Checksum mismatch!\n  expected: ${model.sha256}\n  actual  : ${actual}\nFile deleted.`,
    );
  }

  console.log('  Checksum OK.');
  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error('\nError:', err instanceof Error ? err.message : err);
  process.exit(1);
});
