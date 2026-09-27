const {spawnSync} = require('child_process');

jest.mock('child_process', () => ({spawnSync: jest.fn()}));

describe('CocoaPods installation', () => {
  const originalPlatform = process.platform;
  const originalExitCode = process.exitCode;
  const originalSkip = process.env.PAAD_SKIP_POD_INSTALL;

  beforeEach(() => {
    spawnSync.mockReset();
    delete process.env.PAAD_SKIP_POD_INSTALL;
    Object.defineProperty(process, 'platform', {value: 'darwin'});
    process.exitCode = undefined;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {value: originalPlatform});
    process.exitCode = originalExitCode;
    if (originalSkip === undefined) {
      delete process.env.PAAD_SKIP_POD_INSTALL;
    } else {
      process.env.PAAD_SKIP_POD_INSTALL = originalSkip;
    }
    jest.restoreAllMocks();
  });

  const install = () => jest.isolateModules(() => require('../podinstall'));

  it.each([0, 1, 42])('propagates the pod exit status %s', status => {
    spawnSync.mockReturnValue({status});
    install();
    expect(spawnSync).toHaveBeenCalledWith(
      'bundle',
      ['exec', 'pod', 'install'],
      {cwd: expect.stringMatching(/[/\\]ios$/), stdio: 'inherit'},
    );
    expect(process.exitCode).toBe(status);
  });

  it('fails and reports an unavailable Bundler executable', () => {
    const error = new Error('spawnSync bundle ENOENT');
    const report = jest.spyOn(console, 'error').mockImplementation(() => {});
    spawnSync.mockReturnValue({status: null, error});
    install();
    expect(report).toHaveBeenCalledWith(error);
    expect(process.exitCode).toBe(1);
  });

  it('fails when the child is terminated without an exit status', () => {
    spawnSync.mockReturnValue({status: null, signal: 'SIGTERM'});
    install();
    expect(process.exitCode).toBe(1);
  });

  it('only skips automatically installing pods when explicitly requested', () => {
    process.env.PAAD_SKIP_POD_INSTALL = '1';
    install();
    expect(spawnSync).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('does not attempt CocoaPods on Linux', () => {
    Object.defineProperty(process, 'platform', {value: 'linux'});
    install();
    expect(spawnSync).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });
});
