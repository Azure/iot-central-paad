import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IoTCContext} from '../src/contexts/iotc';
import {StorageContext} from '../src/contexts/storage';
import {useIoTCentralClient} from '../src/hooks/iotc';
import {createSimulatedClient} from '../src/mocks/iotcMock';
import {observeClient} from '../src/observation';
import {ConnectionError} from '../src/connection/errors';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
};
const connectedClient = async deviceId => {
  const client = observeClient(createSimulatedClient({deviceId}), true);
  await client.connect();
  return client;
};
function Probe({onRefresh}) {
  useIoTCentralClient(onRefresh);
  return null;
}

describe('connection refresh effect ownership', () => {
  let tree;
  let setError;
  let setClient;
  const render = (client, onRefresh) => {
    const element = (
      <StorageContext.Provider value={{credentials: null}}>
        <IoTCContext.Provider value={{client, setClient, setError}}>
          <Probe onRefresh={onRefresh} />
        </IoTCContext.Provider>
      </StorageContext.Provider>
    );
    act(() => {
      if (tree) {
        tree.update(element);
      } else {
        tree = renderer.create(element);
      }
    });
  };
  const tick = async (duration = 3000) => {
    await act(async () => {
      jest.advanceTimersByTime(duration);
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    setError = jest.fn();
    setClient = jest.fn();
  });
  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    jest.runAllTicks();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it.each([
    'client replacement',
    'client removal',
    'callback replacement',
    'callback removal',
    'unmount',
  ])('ignores a late refresh failure after %s', async change => {
    const client = await connectedClient('refresh-original');
    const next = await connectedClient('refresh-replacement');
    const gate = deferred();
    const refresh = jest.fn(() => gate.promise);
    const replacement = jest.fn(async () => {});
    render(client, refresh);
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(client);
    if (change === 'client replacement') {
      render(next, replacement);
    } else if (change === 'client removal') {
      render(null, refresh);
    } else if (change === 'callback replacement') {
      render(client, replacement);
    } else if (change === 'callback removal') {
      render(client, undefined);
    } else {
      act(() => tree.unmount());
      tree = undefined;
    }
    await act(async () => gate.reject(new ConnectionError('TIMEOUT')));
    expect(setError).not.toHaveBeenCalled();
    await tick();
    expect(replacement).toHaveBeenCalledTimes(
      change === 'client replacement' || change === 'callback replacement'
        ? 1
        : 0,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retains current errors while suppressing an older client refresh failure', async () => {
    const previous = await connectedClient('refresh-previous');
    const current = await connectedClient('refresh-current');
    const oldWork = deferred();
    const currentWork = deferred();
    const refresh = jest
      .fn()
      .mockReturnValueOnce(oldWork.promise)
      .mockReturnValueOnce(currentWork.promise);
    render(previous, refresh);
    await tick();
    render(current, refresh);
    await tick();
    const currentFailure = new ConnectionError('NETWORK_ERROR');
    await act(async () => currentWork.reject(currentFailure));
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenLastCalledWith(currentFailure);
    await act(async () => oldWork.reject(new ConnectionError('TIMEOUT')));
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenLastCalledWith(currentFailure);
  });

  it('still sanitizes active failures and neither overlaps refreshes nor adds retries', async () => {
    const client = await connectedClient('refresh-active');
    const gate = deferred();
    const refresh = jest.fn(() => gate.promise);
    render(client, refresh);
    await tick(12000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => gate.reject(new Error('private transport detail')));
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError.mock.calls[0][0]).toBeInstanceOf(ConnectionError);
    expect(setError.mock.calls[0][0].code).toBe('OPERATION_FAILED');
    expect(setError.mock.calls[0][0].message).not.toContain('private');
    await tick(12000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
