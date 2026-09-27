const fs = require('node:fs');
const yaml = require('js-yaml');
const read = file => fs.readFileSync(file, 'utf8');
const commands = file => yaml.loadAll(read(`.maestro/${file}`))[1];
const swift = read('scripts/ci/PaadLiveUITests.swift');

test('real live traversal runs after proof and before a genuine cold launch without weakening identity checks', () => {
  const flow = commands('live-device.yaml');
  const proof = flow.findIndex(
    step => step.extendedWaitUntil?.visible?.id === 'proof-status',
  );
  const experience = flow.findIndex(
    step => step.runFlow === 'experience-live.yaml',
  );
  const stop = flow.findIndex(step => step === 'stopApp');
  expect(experience).toBeGreaterThan(proof);
  expect(stop).toBeGreaterThan(experience);
  expect(flow[experience - 1]).toEqual({
    tapOn: {id: 'connection-details-close'},
  });
  expect(flow.slice(stop + 1)).toContainEqual({
    launchApp: {clearState: false, permissions: {all: 'deny'}},
  });
  const restoredMap = flow.findIndex(
    step => step.runFlow === 'experience-home.yaml',
  );
  expect(restoredMap).toBeGreaterThan(stop);
  for (const id of [
    'assigned-device-id',
    'assigned-hub',
    'model-id',
    'registration-id',
    'registry-status',
  ]) {
    expect(
      flow
        .slice(stop + 1, restoredMap)
        .some(
          step =>
            step.assertVisible?.id === id ||
            step.extendedWaitUntil?.visible?.id === id,
        ),
    ).toBe(true);
  }
  const live = swift
    .split('private func runLive(')[1]
    .split('// MARK: Flow steps')[0];
  expect(live.indexOf('try traverseExperience()')).toBeGreaterThan(
    live.indexOf('nonceSubmitted = true'),
  );
  expect(live.indexOf('try traverseExperience()')).toBeLessThan(
    live.indexOf('try terminateApp()'),
  );
  expect(live.lastIndexOf('try traverseHome()')).toBeGreaterThan(
    live.lastIndexOf('try requireIdentity(config)'),
  );
  expect(live).toContain('on: element(.registrationManual)');
  expect(live).toContain('coldRestored = true');
});

test('each real Home node opens its corresponding panel and returns through the visible Close control', () => {
  const flow = commands('experience-home.yaml');
  const home = swift
    .split('private func traverseHome()')[1]
    .split('@discardableResult')[0];
  for (const [id, target] of [
    ['phone', 'Phone'],
    ['dps', 'Dps'],
    ['hub', 'Hub'],
    ['adr', 'Adr'],
  ]) {
    const open = flow.findIndex(step => step.tapOn?.id === `home-node-${id}`);
    expect(flow[open + 1]).toEqual({assertVisible: {id: `home-panel-${id}`}});
    expect(flow.slice(open + 1, open + 6)).toContainEqual({
      tapOn: {id: 'home-panel-close'},
    });
    expect(flow.slice(open + 1, open + 6)).toContainEqual({
      assertNotVisible: {id: 'home-panel-close'},
    });
    expect(home).toContain(`(.homeNode${target}, .homePanel${target})`);
  }
  expect(home).toContain('try requireVisible(panel)');
  expect(home).toContain('try tapExperience(.homePanelClose)');
});

test('Explore opens all four existing tools and Activity retains filters, Latest and safe log details', () => {
  const flow = commands('experience-live.yaml');
  for (const id of [
    'tab-explore',
    'explore-tool-telemetry',
    'explore-tool-properties',
    'explore-tool-image',
    'explore-tool-bluetooth',
    'tab-activity',
    'activity-filter-issues',
    'activity-filter-all',
    'activity-latest',
    'activity-diagnostics',
    'logs-filter-issues',
    'logs-filter-all',
    'logs-latest',
    'activity-observations',
    'tab-home',
  ])
    expect(flow).toContainEqual({tapOn: {id}});
  for (const id of [
    'telemetry-tool',
    'sensor-toggle-accelerometer',
    'properties-tool',
    'property-input-readOnlyProp',
    'image-upload-card',
    'logs-list',
  ]) {
    expect(flow).toContainEqual({assertVisible: {id}});
    expect(swift).toContain(`= "${id}"`);
  }
  expect(flow.filter(step => step.tapOn?.id === 'explore-back')).toHaveLength(
    5,
  );
  expect(flow).toContainEqual({
    assertVisible: {id: 'property-name-readOnlyProp', text: '^readOnlyProp$'},
  });
  expect(flow).toContainEqual({
    assertVisible: {id: 'bluetooth-tool-title', text: '^Nearby devices$'},
  });
  const bluetooth = flow.findIndex(step => step.tapOn?.id === 'explore-tool-bluetooth');
  expect(flow.slice(bluetooth + 1, bluetooth + 5)).toEqual([
    {runFlow: 'dismiss-android-permissions.yaml'},
    {assertVisible: {id: 'bluetooth-tool-title', text: '^Nearby devices$'}},
    {tapOn: {id: 'explore-back'}},
    {assertVisible: {id: 'explore-directory'}},
  ]);
  expect(read('src/bluetooth/Bluetooth.tsx')).toContain(
    'testID="bluetooth-tool-title"',
  );
  expect(flow).toContainEqual({assertVisible: {id: 'log-payload-[0-9]+'}});
  expect(flow).toContainEqual({assertVisible: {id: 'activity-details-[0-9]+'}});
  const traversal = swift
    .split('private func traverseExperience()')[1]
    .split('private func launchApp()')[0];
  expect(traversal).toContain(
    'try inspectDetail(in: .logsList, togglePrefix: "log-toggle-", detailPrefix: "log-payload-")',
  );
  expect(traversal).toContain(
    'try inspectDetail(in: .activityList, togglePrefix: "activity-toggle-", detailPrefix: "activity-details-")',
  );
  expect(traversal).toContain(
    'try requireUnique(query, target: target)',
  );
  expect(traversal).toContain('try requireVisible(.bluetoothTitle)');
  expect(traversal).toContain(
    'try requireExactText(.bluetoothTitle, text: "Nearby devices")',
  );
  expect(traversal).not.toContain('app.staticTexts.matching');
  const disclosure = traversal.split('private func inspectDetail(')[1];
  expect(disclosure).toContain('let list = try requireVisible(target)');
  expect(disclosure).toContain('toggles.element(boundBy: count - 1)');
  expect(disclosure).toContain('hittable(recent, scrolling: list)');
  expect(disclosure).toContain('hittable(payload, scrolling: list)');
  expect(disclosure).toContain('hittable(toggle, scrolling: list)');
  expect(disclosure).not.toMatch(/app\.buttons|app\.descendants|app\.swipe/);
  expect(traversal).toContain('guard settled == .completed, query.count == 1 else {');
  expect(traversal).toContain('return try hittable(query.element)');
  expect(traversal).toContain('throw Failure.ambiguousElement');
  expect(traversal).not.toMatch(
    /captureApprovedFailure|screenshot|debugDescription|\.value\b|\.label\b|coordinate|launchArguments|launchEnvironment/,
  );
  const source =
    read('.maestro/experience-live.yaml') +
    read('.maestro/experience-home.yaml');
  expect(source).not.toMatch(
    /takeScreenshot|startRecording|copyTextFrom|setClipboard|openLink|clearState/,
  );
  expect(flow.filter(step => step.inputText)).toEqual([
    {inputText: 'paad-unsent-draft'},
  ]);
  expect(flow).toContainEqual({
    assertVisible: {
      id: 'property-input-readOnlyProp',
      text: '^paad-unsent-draft$',
    },
  });
  expect(traversal).toContain(
    'try enterExactText(.propertyInput, text: propertyDraft)',
  );
  expect(traversal).toContain(
    'try requireExactText(.propertyInput, text: propertyDraft)',
  );
  expect(
    flow.some(step =>
      [
        'image-upload-card',
        'property-submit-readOnlyProp',
        'sensor-toggle-accelerometer',
      ].includes(step.tapOn?.id),
    ),
  ).toBe(false);
});

test('ordinary credential-free startup does not silently enable simulation or submit cloud fixtures', () => {
  const startup = commands('startup.yaml');
  expect(startup.some(step => step.tapOn?.id === 'connection-submit')).toBe(
    false,
  );
  expect(read('.maestro/startup.yaml')).not.toMatch(
    /experience-live|simulation|proof-send/i,
  );
  const smoke = swift
    .split('private func runSmoke(')[1]
    .split('private func runLive(')[0];
  expect(smoke).not.toContain('traverseExperience');
  expect(smoke).not.toContain('tap(.formSubmit)');
});

test('ordinary iOS startup declines only the known save sheet without skipping return or cold-launch assertions', () => {
  const flow = commands('startup.yaml');
  const back = flow.findIndex(step => step.tapOn?.id === 'registration-back');
  expect(flow.slice(back + 1, back + 5)).toEqual([
    {runFlow: 'dismiss-ios-password-save.yaml'},
    {assertVisible: '.*Start here.*'},
    {assertVisible: 'Connect manually'},
    'stopApp',
  ]);
  expect(flow[back + 5].launchApp.clearState).toBe(false);
  const decline = commands('dismiss-ios-password-save.yaml');
  expect(decline).toEqual([
    {
      runFlow: {
        when: {
          platform: 'iOS',
          visible: {text: '^Save Password\\?$'},
          notVisible: {id: 'connection-deviceKey'},
        },
        commands: [
          {assertVisible: {text: '^Save$'}},
          {tapOn: {text: '^Not Now$', retryTapIfNoChange: false}},
          {assertNotVisible: {text: '^Save Password\\?$'}},
        ],
      },
    },
  ]);
});
