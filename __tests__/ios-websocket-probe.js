const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const yaml = require('js-yaml');

test('the isolated socket probe rejects unsupported environments before creating a simulator', () => {
  const result = spawnSync(process.execPath, ['scripts/ci/probe-ios-websocket.js'], {
    encoding: 'utf8', timeout: 5000,
    env: {...process.env, DEVELOPER_DIR: '/not-approved'},
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim()).toBe('PROBE_ENVIRONMENT_REJECTED');
});

test('the manual probe is owner-gated, uses existing tools, and has no device inputs', () => {
  const workflow = yaml.load(fs.readFileSync('.github/workflows/probe-ios-websocket.yml', 'utf8'));
  expect(workflow.permissions).toEqual({contents: 'read'});
  expect(workflow.jobs.probe.if).toContain("github.event_name == 'workflow_dispatch'");
  expect(workflow.jobs.probe.if).toContain('github.triggering_actor == github.repository_owner');
  expect(workflow.jobs.probe['timeout-minutes']).toBe(15);
  expect(JSON.stringify(workflow)).not.toContain('secrets.');
  for (const step of workflow.jobs.probe.steps.filter(step => step.uses)) {
    expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
  }
  const source = fs.readFileSync('scripts/ci/probe-ios-websocket.js', 'utf8');
  expect(source).toContain("host: '127.0.0.1', port: 0");
  expect(source).toContain("['simctl', 'create', 'PAAD-WebSocket-Idle-Probe'");
  expect(source).toContain("['simctl', 'delete', device]");
  expect(source).toContain("'MAESTRO_DEVICE_KEY' in process.env");
  expect(source).toContain("'PAAD_LIVE_CONFIG' in process.env");
});
