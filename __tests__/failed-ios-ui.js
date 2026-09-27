const {captureFailedIosUi} = require('../scripts/ci/capture-failed-ios-ui');
const {LIMITS} = require('../scripts/ci/live-diagnostics');

const input = {
  platform: 'ios', startedAt: 1000, privateDirectory: '/private/owned',
  maestro: '/trusted/maestro', device: 'owned-uuid',
};
const canary = 'PRIVATE_CAPTURE_CANARY';
const tree = {
  attributes: {'resource-id': 'model-id', text: canary},
  children: [{attributes: {'resource-id': 'connection-deviceKey', text: canary}}],
};
let run;
let write;
let now;
beforeEach(() => {
  run = jest.fn(() => ({status: 0, stdout: JSON.stringify(tree), stderr: canary}));
  write = jest.fn();
  now = () => 101000;
});
const capture = (overrides = {}) => captureFailedIosUi({...input, ...overrides}, {run, write, now});

test('uses the owned device and emits only sanitized post-failure UI fields', () => {
  expect(capture()).toBe('captured');
  expect(run.mock.calls[0].slice(0, 2)).toEqual([
    '/trusted/maestro', ['--device', 'owned-uuid', 'hierarchy', '--no-ansi'],
  ]);
  expect(run.mock.calls[0][2]).toMatchObject({
    timeout: 270000, killSignal: 'SIGKILL', maxBuffer: LIMITS.fileBytes,
    env: {MAESTRO_DRIVER_STARTUP_TIMEOUT: '240000'},
  });
  expect(write.mock.calls[0]).toEqual([
    '/private/owned/results/post-failure-ui.json',
    JSON.stringify({source: 'post-failure-ios-hierarchy', ui: {observedTargets: ['model-id']}}),
    {flag: 'wx', mode: 0o600},
  ]);
  expect(JSON.stringify(write.mock.calls)).not.toContain(canary);
});

test('shares the existing fifteen-minute deadline instead of adding an unbounded retry', () => {
  now = () => 841000;
  expect(capture()).toBe('captured');
  expect(run.mock.calls[0][2]).toMatchObject({
    timeout: 60000, env: {MAESTRO_DRIVER_STARTUP_TIMEOUT: '50000'},
  });
  run.mockClear();
  now = () => 880000;
  expect(capture()).toBe('budget-exhausted');
  expect(run).not.toHaveBeenCalled();
  expect(capture({platform: 'android'})).toBe('not-ios');
});

test.each([
  {status: 1, stderr: canary},
  {status: 0, signal: 'SIGKILL'},
  {error: new Error(canary)},
])('does not copy failed driver output (%#)', result => {
  run.mockReturnValue(result);
  expect(capture()).toBe('driver-unavailable');
  expect(write).not.toHaveBeenCalled();
});

test.each([canary, 'null', JSON.stringify(Array(5).fill(canary)), 'x'.repeat(LIMITS.fileBytes + 1)])(
  'rejects unsupported hierarchy output without logging it (%#)', stdout => {
    run.mockReturnValue({status: 0, stdout});
    expect(capture()).toBe('invalid-hierarchy');
    expect(write).not.toHaveBeenCalled();
  },
);

test('propagates output-path failures rather than claiming successful capture', () => {
  write.mockImplementation(() => { throw new Error('Write failed'); });
  expect(() => capture()).toThrow('Write failed');
});
