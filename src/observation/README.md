# Device-side observations

`useConnectIoTCentralClient` decorates exactly one candidate with
`observeClient(candidate, simulated)` before calling `connect`. The decorated
client remains the shared `DeviceClient`; credential persistence, startup calls,
transport, authentication, arguments, results and original unsubscribe functions
are unchanged. No additional device listener, client, timer or cloud observer is
created. Proof and Bluetooth calls use the same public boundaries automatically.

## Public API

Import from `src/observation`:

```ts
observeClient(candidate: DeviceClient, simulated: boolean): DeviceClient
getObservationStore(client: DeviceClient | null | undefined): ObservationStore | null
useObservationSnapshot(client: DeviceClient | null | undefined): ObservationSnapshot
```

Stores belong to decorated clients through a `WeakMap`. Undecorated or missing
clients have no store; the hook returns a stable empty snapshot. The hook uses
`useSyncExternalStore`, and store snapshots are immutable and referentially stable
until changed. Stores are in-memory only, not an export or persistence facility.

Execution is separate from response submission:

```ts
const finish = getObservationStore(client)?.beginExecution(command);
// Await the existing device operation, without changing its behavior.
finish?.('completed'); // Or 'requested' / 'rejected', matching the actual handler.
```

`beginExecution(command): (outcome: ExecutionOutcome) => void` captures the
originating generation. Prefer it before asynchronous work.
`recordExecution(command, outcome): void` is also available; wrapped commands
retain their originating generation even if this method is called later.
`capture(): () => boolean` supplies a session guard for local async operations.
`getSnapshot()` and `subscribe(listener)` support non-hook consumers.
`start`, `invalidate`, `record`, `bindCommand` and `captureListener` are adapter-internal methods;
consumers should not create/reset session facts directly.

## Schema

`Observation` is a readonly discriminated union keyed by `kind`. Every record
includes `id`, `generation`, `observedAt` (app `Date.now()` milliseconds),
`observer: 'device-app'`, `simulated`, and an immutable actual assigned
`identity: {assignedHub, deviceId, modelId} | null`. Unknown or unsafe identity
fields are `null`, never copied from registration input or inferred.

| Kind                | Outcome                              | Safe metadata                                            |
| ------------------- | ------------------------------------ | -------------------------------------------------------- |
| `telemetry`         | `submitted`, `simulated`, `failed`   | Allowlisted `names`                                      |
| `reported-property` | `submitted`, `simulated`, `failed`   | Allowlisted `names`                                      |
| `twin-request`      | `submitted`, `simulated`, `failed`   | None                                                     |
| `command`           | `observed`                           | Allowlisted `name`, nullable `correlation`               |
| `command-reply`     | `submitted`, `simulated`, `failed`   | Command metadata, `response: success/error/unknown`      |
| `command-execution` | `completed`, `requested`, `rejected` | Command metadata                                         |
| `desired-property`  | `observed`                           | Allowlisted `name`, nullable `version`, `source`         |
| `property-ack`      | `submitted`, `simulated`, `failed`   | Property metadata                                        |
| `upload`            | `acknowledged`, `failed`             | Acknowledged HTTP `status`, otherwise no result metadata |

Only `failed` records contain `errorCode`, obtained from `safeError`; raw errors
are rethrown unchanged to existing callers, not retained. `submitted` means local
submission, never broker/cloud receipt. An acknowledged upload is the existing
HTTP result, not MQTT submission or downstream processing.

Property `source` is `twin`, `patch` or `unknown`. `IIoTCProperty.source` is optional
for compatibility, but the transport explicitly supplies `twin` for an initial
twin response and `patch` for a desired update. A twin value is not labeled a newly
issued cloud request. Duplicate versions remain observations, not deduced retries.

Command correlation is either `null` or `{category: 'requestId', value: string}`.
The ID must match the existing safe operation-ID character vocabulary and be
1-64 characters. No timing-based correlation, payload, proof nonce value,
coordinate, filename, file bytes, URL, response message or credential is stored.
Names come only from the fixed implemented phone/proof/Bluetooth capability
vocabulary in `types.ts`; unknown incoming names become `null`, unknown outbound
names are omitted. Payload getters are not evaluated for name discovery.

`ObservationSnapshot` contains `generation`, `active`, `simulated`, `identity`,
`latest` (optional record per kind), chronological `history`, and `bytes`.
`active` identifies an uninvalidated observation generation, not cloud receipt or
a separately verified connection state.

## Lifetime and bounds

Generation is allocated before initial connect/startup callbacks. Subsequent
connect attempts, including the same identity, reset facts. An overlapping SDK
`BUSY` rejection does not replace the already-running attempt. Cancel, disconnect,
abort and failed connect invalidate facts. The connection hook's existing
`onStage('error')` callback invalidates the candidate store before publishing the
stage/error, so a real connection-loss notification clears facts immediately
without waiting for a poll or render. Existing `isConnected()` polling remains a
fallback that invalidates on false, and every completion/callback also checks
actual connection and assigned identity. Once invalidated, reconnection is needed
for new facts; an old listener cannot attach itself to a newer generation.

Listeners registered before the first connect belong to that initial generation.
Listeners registered during a connected generation retain it; after reconnect,
the owner registers new listeners normally. Original unsubscribe functions and
subscription counts are preserved. Multiple listeners receiving the same command
or property object share a single incoming record and wrapped response boundary.

`OBSERVATION_LIMITS` is 120 history rows, 64 KiB of serialized snapshot data
(including latest facts), and 4 KiB per entry. History drops oldest rows to obey
both bounds. Successful/simulated telemetry is latest-only. Telemetry failures
also enter history, so a subsequent success does not erase historical issues.
Consecutive telemetry failures with the same safe error code retain only the
first still-retained failure in history; interleaved activity on other channels
does not multiply these rows. A success or different error code starts a new
sequence. If the representative is evicted by either bound, the next failure
creates a new history row. `latest.telemetry` always reflects the latest result,
including coalesced failures; no counts or additional outcomes are inferred.

The first failure in a sequence can appear in both latest and history. Consumers
rendering both should deduplicate matching generation/record IDs. A later
coalesced failure is a distinct latest fact while the earlier history fact
retains its original identity/timestamp for stable inspection.

Other latest channels survive history eviction. The `bytes` field is a
conservative serialized-size estimate after recording; empty generations contain
no retained rows. No raw payload is truncated and kept as a substitute.
