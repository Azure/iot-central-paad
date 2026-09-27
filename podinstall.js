'use strict';
const {spawnSync} = require('child_process');
const path = require('path');

if (process.env.PAAD_SKIP_POD_INSTALL === '1') {
  console.log(
    'Skipping automatic pods; run bundle exec pod install explicitly.',
  );
} else if (process.platform === 'darwin') {
  const result = spawnSync('bundle', ['exec', 'pod', 'install'], {
    cwd: path.join(__dirname, 'ios'),
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(result.error);
  }
  process.exitCode = result.status === null ? 1 : result.status;
}
