# PAAD device (local Expo module)

Expo autolinking discovers this module under the default `./modules` directory.
No dependency entry or config plugin is required. Rebuild the native development
client after adding the module; Expo Go does not contain it.

```ts
import {secureWebSocket, hasTorch} from './src/platform';
// Pass {secureWebSocket} to createDeviceClient's options.
// Replace the legacy native torch capability query with await hasTorch().
```

Importing these exports does not load the native module, open a connection,
request permission, or inspect camera hardware. `hasTorch()` is a capability-only
query and returns false when the module/hardware is unavailable. Camera access
permission and switching the torch remain the responsibility of the camera UI.

The MQTT constructor accepts `mqtt` / `mqttv3.1`, binary `ArrayBuffer` /
`Uint8Array`, and exposes the subset Paho uses. `binaryType` is `arraybuffer`;
Blob/text frames and arbitrary request headers are intentionally unsupported.
Only one-label Hub hosts and optional `.device` in `azure-devices.net`, `.cn`,
and `.us` are accepted, matching `src/connection/credentials.ts`. Explicit ports
(including 443), user information, fragments, and other hosts are rejected by
both JS and native code. Paths/queries are preserved but never logged.

Android uses OkHttp with both redirect flags disabled, and iOS declines every
URLSession redirect request before following. Both retain default TLS and
hostname validation and require the broker to negotiate a requested protocol.
Connects have a native 15-second deadline; close handshakes have a 5-second
cleanup deadline. Module destruction cancels every socket, timer and session.
Events intentionally omit native error strings and peer close reasons.

Validation: focused Jest tests exercise the JS bridge and native source guards;
Expo autolinking can be checked using `expo-modules-autolinking search --json`
for `--platform apple` and `--platform android`. These tests are not native TLS
or redirect integration tests. Native compilation and device validation belong
in CI (including redirect refusal, connection cancellation, binary MQTT frames,
and torch capabilities on real hardware). The explicit OkHttp dependency matches
React Native 0.86's 4.9.2 baseline and uses Gradle's normal version resolution.
