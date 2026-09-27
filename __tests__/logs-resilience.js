import React from 'react';
import renderer, {act} from 'react-test-renderer';
import LogsProvider, {LogsContext, MAX_LOG_ENTRIES} from '../src/contexts/logs';
import {redactLog, Log, Debug} from '../src/tools/CustomLogger';

it.each([
  'deviceKey=private-fixture',
  '{"authKey":"private-fixture"}',
  'SharedAccessSignature sr=example&sig=private-fixture&se=123',
  'HostName=fixture.azure-devices.net;DeviceId=phone;SharedAccessKey=private-fixture',
  '{"connectionString":"HostName=example;SharedAccessKey=private-fixture"}',
  'https://example?sv=1&sig=private-fixture&se=123',
  'SharedAccessSignature=private-fixture',
  '{"password": "private-fixture", "primaryKey": "private-fixture"}',
  JSON.stringify(JSON.stringify({deviceKey: 'private-fixture'})),
  'Bearer private-fixture',
])('redacts credential representation %s', input => {
  expect(redactLog(input)).not.toContain('private-fixture');
  expect(redactLog(input)).toContain('[REDACTED');
});

it('redacts standalone synthetic base64 keys and both console logger paths', () => {
  const fixture = Buffer.alloc(32, 17).toString('base64');
  expect(redactLog(`key material ${fixture}`)).not.toContain(fixture);
  const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  Log('deviceKey=private-fixture');
  Debug('password=private-fixture', 'send', 'test');
  expect(JSON.stringify(consoleLog.mock.calls)).not.toContain(
    'private-fixture',
  );
  consoleLog.mockRestore();
});

it('retains only the latest 500 sanitized entries and does not retain caller objects', () => {
  let context;
  function Probe() {
    context = React.useContext(LogsContext);
    return null;
  }
  let view;
  act(() => {
    view = renderer.create(
      <LogsProvider>
        <Probe />
      </LogsProvider>,
    );
  });
  const item = {
    eventName: 'deviceKey=private-fixture',
    eventData: 'password=private-fixture',
  };
  act(() => {
    for (let index = 0; index < 550; index++) {
      context.append({eventName: 'INFO', eventData: `event-${index}`});
    }
    context.append(item);
  });
  expect(context.logs).toHaveLength(MAX_LOG_ENTRIES);
  expect(context.logs[0].logItem.eventData).toBe('event-51');
  expect(context.logs.at(-1).logItem).not.toBe(item);
  expect(new Set(context.logs.map(entry => entry.id)).size).toBe(
    MAX_LOG_ENTRIES,
  );
  const lastId = context.logs.at(-1).id;
  expect(JSON.stringify(context.logs)).not.toContain('private-fixture');
  act(() => context.clear());
  expect(context.logs).toHaveLength(1);
  expect(context.logs[0].id).toBeGreaterThan(lastId);
  act(() => view.unmount());
});
