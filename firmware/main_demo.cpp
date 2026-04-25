/*
 * Hangboard Force Measurement System - DEMO MODE
 * 
 * Simulates hang sessions without a load cell:
 *   - 7 seconds ON  (sine-wave force ramp, 3–90 kg range)
 *   - 3 seconds OFF (near-zero noise)
 * Sends data at 20 Hz over WebSocket, identical format to real firmware.
 *
 * Usage: rename this file to main.cpp (back up the original) or use
 *        platformio.ini env:esp32_demo to build.
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <math.h>
#include "config.h"

// ── WiFi Configuration (from config.h) ──────────────────────────────
const char* ssid       = WIFI_SSID;
const char* password   = WIFI_PASSWORD;
const char* ws_server  = WS_SERVER;
const int   ws_port    = WS_PORT;
const char* ws_path    = "/ws/esp";

// ── Demo Pattern ────────────────────────────────────────────────────
const float HANG_SECONDS  = 7.0;
const float REST_SECONDS  = 3.0;
const float CYCLE_SECONDS = HANG_SECONDS + REST_SECONDS;  // 10 s

// Force range (kg) – the backend will see "raw" values that are
// already in a realistic kg-equivalent range so the default
// calibration (scale=1, offset=0) shows sensible numbers.
const float FORCE_MIN_KG =  3.0;
const float FORCE_MAX_KG = 90.0;

// Output rate
const int   OUTPUT_RATE_HZ      = 20;
const unsigned long OUTPUT_INTERVAL_MS = 1000 / OUTPUT_RATE_HZ;

// Reconnection
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 5000;
const unsigned long WS_RECONNECT_INTERVAL_MS   = 3000;

// ── State ───────────────────────────────────────────────────────────
WebSocketsClient webSocket;
bool wifi_connected = false;
bool ws_connected   = false;
bool ws_started     = false;

unsigned long last_output_ms      = 0;
unsigned long last_wifi_attempt_ms = 0;
unsigned long cycle_start_ms      = 0;

// ── Helpers ─────────────────────────────────────────────────────────

/*
 * Generate a demo "raw" value based on where we are in the cycle.
 * During the HANG phase the force follows a sine half-wave
 * (smooth ramp up → peak → ramp down) between FORCE_MIN_KG and
 * FORCE_MAX_KG.  During REST the value is near zero with a tiny
 * bit of random noise so the chart looks realistic.
 *
 * The value is multiplied by 100 so the backend receives an integer
 * "raw" that maps to kg with scale≈0.01  (or you can set
 * calibration scale=1 and read centi-kg).
 */
int32_t generate_demo_value(unsigned long now_ms) {
  float elapsed = (now_ms - cycle_start_ms) / 1000.0;

  // wrap around
  if (elapsed >= CYCLE_SECONDS) {
    cycle_start_ms = now_ms;
    elapsed = 0.0;
  }

  float force_kg;

  if (elapsed < HANG_SECONDS) {
    // Sine half-wave over the hang window
    float phase = elapsed / HANG_SECONDS;           // 0 → 1
    float sine  = sin(phase * PI);                   // 0 → 1 → 0
    force_kg = FORCE_MIN_KG + (FORCE_MAX_KG - FORCE_MIN_KG) * sine;
  } else {
    // Rest phase – near zero with small noise
    force_kg = 0.2 + (random(0, 100) / 500.0);      // ~0.0–0.4 kg
  }

  // Return raw value scaled ×100 so integer has good resolution
  return (int32_t)(force_kg * 100.0);
}

// ── WiFi ────────────────────────────────────────────────────────────
void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  switch (event) {
    case SYSTEM_EVENT_STA_GOT_IP:
      Serial.print("WiFi connected. IP: ");
      Serial.println(WiFi.localIP());
      wifi_connected = true;
      if (!ws_started) {
        webSocket.begin(ws_server, ws_port, ws_path);
        webSocket.setReconnectInterval(WS_RECONNECT_INTERVAL_MS);
        ws_started = true;
      }
      break;
    case SYSTEM_EVENT_STA_DISCONNECTED:
      Serial.println("WiFi disconnected");
      wifi_connected = false;
      ws_connected   = false;
      break;
    default:
      break;
  }
}

// ── WebSocket ───────────────────────────────────────────────────────
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket connected – DEMO mode active");
      ws_connected = true;
      break;
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      ws_connected = false;
      break;
    case WStype_ERROR:
      Serial.println("WebSocket error");
      ws_connected = false;
      break;
    case WStype_TEXT:
      Serial.print("WS RX: ");
      Serial.println((char*)payload);
      break;
    default:
      break;
  }
}

// ── Send ────────────────────────────────────────────────────────────
void send_measurement(uint32_t timestamp_ms, int32_t raw) {
  if (!ws_connected) return;

  JsonDocument doc;
  doc["timestamp"] = timestamp_ms;
  doc["raw"]       = raw;

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);

  // Debug: print what we actually send
  Serial.print("TX: ");
  Serial.println(json);
}

// ── Setup ───────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\nHangboard Force Measurement – DEMO MODE");
  Serial.println("========================================");
  Serial.println("Pattern : 7 s hang / 3 s rest");
  Serial.printf ("Range   : %.0f – %.0f kg\n", FORCE_MIN_KG, FORCE_MAX_KG);
  Serial.printf ("Output  : %d Hz\n\n", OUTPUT_RATE_HZ);

  // WiFi
  WiFi.onEvent(onWiFiEvent);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  webSocket.onEvent(webSocketEvent);

  last_output_ms      = millis();
  last_wifi_attempt_ms = millis();
  cycle_start_ms      = millis();
}

// ── Loop ────────────────────────────────────────────────────────────
void loop() {
  unsigned long now_ms = millis();

  // WebSocket housekeeping
  if (wifi_connected && ws_started) {
    webSocket.loop();
  }

  // WiFi reconnect
  if (!wifi_connected && (now_ms - last_wifi_attempt_ms >= WIFI_RECONNECT_INTERVAL_MS)) {
    last_wifi_attempt_ms = now_ms;
    Serial.println("Attempting WiFi reconnect...");
    WiFi.begin(ssid, password);
  }

  // Output at 20 Hz
  if (now_ms - last_output_ms >= OUTPUT_INTERVAL_MS) {
    last_output_ms = now_ms;

    int32_t raw = generate_demo_value(now_ms);
    send_measurement((uint32_t)now_ms, raw);

    // Also print to serial for debugging
    Serial.printf("DEMO raw=%d  (≈%.1f kg)\n", raw, raw / 100.0);
  }

  yield();
}
