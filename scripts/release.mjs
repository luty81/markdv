#!/usr/bin/env node
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import process from 'node:process';

const BUMPS = new Set(['patch', 'minor', 'major']);

const run = cmd => {
	console.log(`\n$ ${cmd}`);
	execSync(cmd, {stdio: 'inherit'});
};

const capture = cmd => execSync(cmd).toString().trim();

const die = msg => {
	console.error(`\nrelease: ${msg}`);
	process.exit(1);
};

const bump = process.argv[2];
if (!BUMPS.has(bump)) {
	die(`usage: node scripts/release.mjs <patch|minor|major>`);
}

if (capture('git status --porcelain')) {
	die('working tree is not clean — commit or stash first');
}

const branch = capture('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
	die(`expected branch main, on ${branch}`);
}

run('npm run build');
run('npm test');

run(`npm version ${bump} -w markdv --no-git-tag-version`);

const pkg = JSON.parse(readFileSync('apps/cli/package.json', 'utf8'));
const tag = `v${pkg.version}`;

run('git add apps/cli/package.json package-lock.json');
run(`git commit -m "release: ${tag}"`);
run(`git tag ${tag}`);

run('npm publish -w markdv --access public');

const hasRemote = (() => {
	try {
		capture('git remote get-url origin');
		return true;
	} catch {
		return false;
	}
})();

if (hasRemote) {
	run('git push origin main --follow-tags');
} else {
	console.log('\nrelease: no `origin` remote — skipped git push');
}

console.log(`\n✓ Released ${tag}`);
