const fs = require('node:fs');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

const [platform, mode, ...extra] = process.argv.slice(2);
const env = process.env;
const present = name => Object.hasOwn(env, name);
const exact = (value, pattern) => typeof value === 'string' && value.match(pattern)?.[0] === value;
if (!['android', 'ios'].includes(platform) || !['download', 'verify'].includes(mode) || extra.length ||
    present('MAESTRO_DEVICE_KEY') || present('PAAD_LIVE_CONFIG') ||
    (mode === 'verify' && (present('GH_TOKEN') || present('GITHUB_TOKEN'))) ||
    env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    env.GITHUB_REF !== 'refs/heads/feature/adr-onboarding' ||
    env.GITHUB_REPOSITORY !== 'HangyiWang/iot-central-paad' ||
    env.GITHUB_REPOSITORY_OWNER !== 'HangyiWang' ||
    env.GITHUB_ACTOR !== env.GITHUB_REPOSITORY_OWNER ||
    env.GITHUB_TRIGGERING_ACTOR !== env.GITHUB_REPOSITORY_OWNER ||
    !exact(env.GITHUB_SHA, /^[a-f0-9]{40}$/) ||
    !exact(env.SOURCE_RUN, /^[0-9]+$/) ||
    !exact(env.SOURCE_SHA, /^[a-f0-9]{40}$/) || env.PAAD_VARIANT !== 'ci') {
  console.error('Replay artifact authorization or invocation rejected.');
  process.exit(1);
}
process.umask(0o077);

const label = platform === 'android' ? 'Android' : 'iOS';
const binary = platform === 'android' ? 'foundation-ci.apk' : 'foundation-simulator.app.zip';
const binaryPath = `build/ci-artifacts/${binary}`;
const artifactName = `live-build-${platform}-${env.SOURCE_SHA}-1`;

if (mode === 'download') {
  try {
    const repository = env.GITHUB_REPOSITORY;
    const owner = env.GITHUB_REPOSITORY_OWNER;
    const sourceRun = env.SOURCE_RUN;
    const sourceSha = env.SOURCE_SHA;
    const gh = args => execFileSync('gh', args, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const endpoint = `repos/${repository}/actions/runs/${sourceRun}`;
    const run = JSON.parse(gh(['api', endpoint]));
    if (String(run.id) !== sourceRun || run.repository?.full_name !== repository ||
        run.head_repository?.full_name !== repository || run.head_sha !== sourceSha ||
        run.head_branch !== 'feature/adr-onboarding' || run.workflow_id !== 359345717 ||
        run.event !== 'workflow_dispatch' || run.actor?.login !== owner ||
        run.triggering_actor?.login !== owner || run.run_attempt !== 1 ||
        run.status !== 'completed') throw new Error();
    const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `${endpoint}/artifacts?per_page=100`]));
    const artifacts = pages.flatMap(page => page.artifacts).filter(artifact => artifact.name === artifactName);
    if (artifacts.length !== 1) throw new Error();
    const artifact = artifacts[0];
    if (artifact.expired !== false || !Number.isSafeInteger(artifact.id) || artifact.id <= 0 ||
        artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== sourceSha ||
        artifact.workflow_run?.head_branch !== run.head_branch ||
        artifact.workflow_run?.head_repository_id !== run.head_repository.id ||
        artifact.workflow_run?.repository_id !== run.repository.id) throw new Error();
    // The completed, first-attempt run and unique exact name bind the download.
    if (!fs.existsSync('build')) fs.mkdirSync('build');
    const build = fs.lstatSync('build');
    if (!build.isDirectory() || build.isSymbolicLink()) throw new Error();
    fs.mkdirSync('build/ci-artifacts');
    gh(['run', 'download', sourceRun, '--repo', repository, '--name', artifactName, '--dir', 'build/ci-artifacts']);
    if (fs.readdirSync('build/ci-artifacts').sort().join('\n') !== [binary, 'identity.txt'].sort().join('\n')) {
      throw new Error();
    }
  } catch {
    console.error(`${label} replay source run or artifact verification failed.`);
    process.exit(1);
  }
}

try {
  for (const directory of ['build', 'build/ci-artifacts']) {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
  }
  for (const file of ['identity.txt', binary]) {
    const stat = fs.lstatSync(`build/ci-artifacts/${file}`);
    if (!stat.isFile() || stat.isSymbolicLink() || !stat.size) throw new Error();
  }
  const lines = fs.readFileSync('build/ci-artifacts/identity.txt', 'utf8').split(/\r?\n/);
  const expected = {
    'Built commit: ': env.SOURCE_SHA,
    'Event SHA: ': env.SOURCE_SHA,
    'Run: ': `${env.SOURCE_RUN} attempt 1`,
    'Native variant: ': 'ci',
  };
  for (const [prefix, value] of Object.entries(expected)) {
    const matches = lines.filter(line => line.startsWith(prefix));
    if (matches.length !== 1 || matches[0] !== prefix + value) throw new Error();
  }
  const entries = lines.filter(line => line.endsWith(binaryPath));
  if (entries.length !== 1 || !/^[a-f0-9]{64}$/.test(entries[0].slice(0, 64)) ||
      entries[0].slice(64) !== `  ${binaryPath}`) throw new Error();
  const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const binarySha256 = digest(binaryPath);
  if (binarySha256 !== entries[0].slice(0, 64)) throw new Error();
  const identity = {
    sourceRepository: env.GITHUB_REPOSITORY,
    sourceWorkflowId: 359345717,
    sourceRun: env.SOURCE_RUN,
    sourceAttempt: 1,
    sourceSha: env.SOURCE_SHA,
    sourceArtifact: artifactName,
    [platform === 'android' ? 'apkSha256' : 'appZipSha256']: binarySha256,
    replayHarnessSha: env.GITHUB_SHA,
    replayScriptSha256: digest(`scripts/ci/replay-${platform}.sh`),
    artifactHelperSha256: digest('scripts/ci/replay-artifact.js'),
    startupFlowSha256: digest('.maestro/startup.yaml'),
    launcherRecoveryFlowSha256: digest('.maestro/dismiss-quickstep-anr.yaml'),
    ...(platform === 'ios' ? {
      simulatorUIHelperSha256: digest('scripts/ci/show-ios-simulator.sh'),
    } : {}),
    evidenceScope: 'Credential-free synthetic startup only; no Connect or cloud proof',
  };
  if (mode === 'verify') console.log(JSON.stringify(identity, null, 2));
} catch {
  console.error(`${label} replay binary identity or checksum rejected.`);
  process.exit(1);
}
