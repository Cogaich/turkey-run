// Turkey Run — the entry courier (Node 22, standard library only).
//
// The game is plain static files under game/ plus 3-4 screenshots under
// screenshots/. This program hands them in: it copies both folders from beside
// this file into /output, checks every copied byte against its source with
// SHA-256, and writes /output/dossier.json with the vendored make.fun library
// (buildDossier), which is the summary the judge reads. It runs twice in the
// grader and must write the same bytes both times, so it takes no input but
// the files beside it, reads no clock, and writes nothing but the copy.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (from the kit's gate): only text_max_bytes shapes the
// dossier's bytes; the others refuse an entry the scorer would refuse, so this
// program fails early where the scorer would (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files in all).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Every regular file under `dir`, as paths relative to `dir`, sorted.
function listFiles(dir, base = dir) {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) found.push(...listFiles(path, base));
    else if (st.isFile()) found.push(relative(base, path));
  }
  return found;
}

// Copy a folder, then prove the copy byte for byte: hash each file on both
// sides and refuse to continue on the first mismatch.
function copyVerified(srcDir, dstDir) {
  mkdirSync(dstDir, { recursive: true });
  cpSync(srcDir, dstDir, { recursive: true });
  const files = listFiles(srcDir);
  for (const rel of files) {
    const a = readFileSync(join(srcDir, rel));
    const b = readFileSync(join(dstDir, rel));
    if (sha256(a) !== sha256(b)) {
      throw new Error(`copy mismatch: ${rel} (source ${sha256(a)} != output ${sha256(b)})`);
    }
  }
  return files.length;
}

mkdirSync(out, { recursive: true });
const gameFiles = copyVerified(join(here, 'game'), join(out, 'game'));
let shotFiles = 0;
if (existsSync(join(here, 'screenshots'))) {
  shotFiles = copyVerified(join(here, 'screenshots'), join(out, 'screenshots'));
}

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`Turkey Run: copied ${gameFiles} game files, ${shotFiles} screenshots, dossier ${dossier.length} bytes -> ${out}`);
