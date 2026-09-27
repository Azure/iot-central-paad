package expo.modules.paaddevice

import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.Looper
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import okio.ByteString.Companion.toByteString
import java.net.URI
import java.util.concurrent.TimeUnit

class PaadDeviceModule : Module() {
  private class SocketState {
    var socket: WebSocket? = null
    var open = false
    var closing = false
    var timer: Runnable? = null
  }

  private val lock = Any()
  private val sockets = mutableMapOf<String, SocketState>()
  private val handler = Handler(Looper.getMainLooper())
  private var client: OkHttpClient? = null
  private var destroyed = false
  private val hostPattern = Regex(
    "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.(?:device\\.)?azure-devices\\.(?:net|cn|us)$"
  )

  override fun definition() = ModuleDefinition {
    Name("PaadDevice")
    Events("socketEvent")

    Function("connect") { id: String, url: String, protocols: List<String> ->
      synchronized(lock) {
        require(!destroyed && id.isNotEmpty() && !sockets.containsKey(id)) { "Invalid socket state" }
        val uri = try { URI(url) } catch (_: Exception) { null }
        require(
          uri != null && uri.scheme == "wss" && uri.host != null &&
            hostPattern.matches(uri.host.lowercase()) && uri.rawUserInfo == null &&
            uri.port == -1 && uri.rawAuthority.equals(uri.host, ignoreCase = true) &&
            uri.rawFragment == null && url.none { it <= ' ' || it == '\\' } &&
            protocols.isNotEmpty() && protocols.distinct().size == protocols.size &&
            protocols.all { it == "mqtt" || it == "mqttv3.1" }
        ) { "Unsafe MQTT endpoint or protocol" }
        val state = SocketState()
        sockets[id] = state
        if (client == null) {
          // Do not install trust managers, hostname verifiers, interceptors or credentials.
          client = OkHttpClient.Builder()
            .followRedirects(false)
            .followSslRedirects(false)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()
        }
        val timeout = Runnable {
          synchronized(lock) {
            if (sockets[id] === state) fail(id)
          }
        }
        state.timer = timeout
        handler.postDelayed(timeout, 15_000)
        try {
          val request = Request.Builder().url(url)
            .header("Sec-WebSocket-Protocol", protocols.joinToString(", "))
            .build()
          state.socket = client!!.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
              synchronized(lock) {
                if (sockets[id] !== state || state.closing) {
                  webSocket.cancel()
                  return
                }
                val selected = response.header("Sec-WebSocket-Protocol")
                if (selected == null || !protocols.contains(selected)) {
                  fail(id)
                  return
                }
                state.timer?.let { handler.removeCallbacks(it) }
                state.timer = null
                state.open = true
                emit(id, "open", mapOf("protocol" to selected))
              }
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
              synchronized(lock) {
                if (sockets[id] === state && state.open && !state.closing) {
                  emit(id, "message", mapOf("data" to bytes.base64()))
                }
              }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
              synchronized(lock) {
                if (sockets[id] === state) fail(id)
              }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
              synchronized(lock) {
                if (sockets[id] !== state) return
                state.closing = true
                // A peer can send an empty close frame (reported as reserved 1005).
                webSocket.close(if (code == 1005) 1000 else code, null)
                armCloseTimeout(id, state)
              }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
              synchronized(lock) {
                if (sockets[id] === state) finish(id, code, true)
              }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
              synchronized(lock) {
                if (sockets[id] === state) fail(id)
              }
            }
          })
        } catch (_: Exception) {
          fail(id)
        }
      }
    }

    Function("send") { id: String, base64: String ->
      synchronized(lock) {
        val state = sockets[id]
        check(state != null && state.open && !state.closing) { "Socket is not open" }
        try {
          val bytes = Base64.decode(base64, Base64.NO_WRAP).toByteString()
          if (state.socket?.send(bytes) != true) fail(id)
        } catch (_: Exception) {
          fail(id)
        }
      }
    }

    Function("close") { id: String, code: Int, reason: String ->
      synchronized(lock) {
        require((code == 1000 || code in 3000..4999) && reason.toByteArray(Charsets.UTF_8).size <= 123) {
          "Invalid close parameters"
        }
        val state = sockets[id]
        if (state != null && !state.closing) {
          state.closing = true
          if (!state.open) {
            finish(id, 1006, false)
          } else if (state.socket?.close(code, reason) == true) {
            armCloseTimeout(id, state)
          } else {
            finish(id, 1006, false)
          }
        }
      }
    }

    AsyncFunction("hasTorch") {
      val context = appContext.reactContext
      if (context == null || !context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)) {
        false
      } else {
        try {
          val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
          manager.cameraIdList.any {
            val camera = manager.getCameraCharacteristics(it)
            camera.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK &&
              camera.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
          }
        } catch (_: Exception) {
          false
        }
      }
    }

    OnDestroy {
      synchronized(lock) {
        destroyed = true
        sockets.values.forEach {
          it.timer?.let { timer -> handler.removeCallbacks(timer) }
          it.socket?.cancel()
        }
        sockets.clear()
        client?.dispatcher?.cancelAll()
        client?.connectionPool?.evictAll()
        client?.dispatcher?.executorService?.shutdown()
        client = null
      }
    }
  }

  private fun armCloseTimeout(id: String, state: SocketState) {
    state.timer?.let { handler.removeCallbacks(it) }
    val timer = Runnable {
      synchronized(lock) {
        if (sockets[id] === state) finish(id, 1006, false)
      }
    }
    state.timer = timer
    handler.postDelayed(timer, 5_000)
  }

  private fun fail(id: String) {
    if (!sockets.containsKey(id)) return
    emit(id, "error")
    finish(id, 1006, false)
  }

  private fun finish(id: String, code: Int, clean: Boolean) {
    val state = sockets.remove(id) ?: return
    state.timer?.let { handler.removeCallbacks(it) }
    state.socket?.cancel()
    emit(id, "close", mapOf("code" to code, "wasClean" to clean))
  }

  private fun emit(id: String, type: String, fields: Map<String, Any> = emptyMap()) {
    if (!destroyed) {
      sendEvent("socketEvent", mapOf("id" to id, "type" to type) + fields)
    }
  }
}
