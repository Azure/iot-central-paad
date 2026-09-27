const fs = require('node:fs');
const {spawnSync} = require('node:child_process');

// Expo clean prebuild owns native project metadata, but a reviewed CocoaPods
// resolution must survive regeneration. Never bring legacy project files back.
const lockPath = 'ios/Podfile.lock';
const lock = fs.existsSync(lockPath) ? fs.readFileSync(lockPath) : undefined;
const result = spawnSync(
  process.execPath,
  [
    require.resolve('expo/bin/cli'),
    'prebuild',
    '--clean',
    '--no-install',
    '--template',
    'expo-template-bare-minimum@57.0.25',
    ...process.argv.slice(2),
  ],
  {stdio: 'inherit'},
);
if (lock) {
  fs.mkdirSync('ios', {recursive: true});
  fs.writeFileSync(lockPath, lock);
}
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
