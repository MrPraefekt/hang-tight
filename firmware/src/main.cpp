/*
 * Hangboard Force Measurement System - ESP32 Firmware
 * 
 * HX711 Load Cell Reader via WebSocket
 * - Samples at 80 Hz
 * - Outputs at 20 Hz (moving average of 4 samples)
 * - Sends raw values to backend for calibration
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "HX711.h"
#include "config.h"

// WiFi Configuration (from config.h)
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* ws_server = WS_SERVER;
const int ws_port = WS_PORT;
const char* ws_path = "/ws/esp";

// HX711 Configuration
const int LOADCELL_DOUT_PIN = 25;
const int LOADCELL_SCK_PIN = 26;

// Sampling Configuration
const int SAMPLE_RATE_HZ = 80;
const int MOVING_AVG_WINDOW = 4;
const int OUTPUT_RATE_HZ = 20;
const unsigned long SAMPLE_INTERVAL_US = 1000000 / SAMPLE_RATE_HZ;
const unsigned long OUTPUT_INTERVAL_MS = 1000 / OUTPUT_RATE_HZ;

// Reconnection
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 5000;
const unsigned long WS_RECONNECT_INTERVAL_MS = 3000;

// Circular buffer for moving average - HX711 is 24-bit, use int32_t
int32_t sample_buffer[4] = {0, 0, 0, 0};
uint8_t buffer_index = 0;

// Timing
unsigned long last_sample_us = 0;
unsigned long last_output_ms = 0;
unsigned long last_wifi_attempt_ms = 0;

// HX711 instance
HX711 scale;

// WebSocket instance
WebSocketsClient webSocket;

// Connection states
bool wifi_connected = false;
bool ws_connected = false;
bool ws_started = false;

/*
 * Moving average calculation
 */
int32_t add_sample(int32_t raw) {
  sample_buffer[buffer_index] = raw;
  buffer_index = (buffer_index + 1) % MOVING_AVG_WINDOW;
  
  int64_t sum = 0;
  for (int i = 0; i < MOVING_AVG_WINDOW; i++) {
    sum += sample_buffer[i];
  }
  return (int32_t)(sum / MOVING_AVG_WINDOW);
}

/*
 * WiFi event handler
 */
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
      ws_connected = false;
      break;
    
    default:
      break;
  }
}

/*
 * WebSocket event handler
 */
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
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
      Serial.print("WebSocket RX: ");
      Serial.println((char*)payload);
      break;
    
    default:
      break;
  }
}

/*
 * Send measurement - JSON: { "timestamp": number, "raw": number }
 */
void send_measurement(uint32_t timestamp_ms, int32_t raw) {
  if (!ws_connected) return;
  
  JsonDocument doc;
  doc["timestamp"] = timestamp_ms;
  doc["raw"] = raw;
  
  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);
}

/*
 * Initialize HX711
 */
void init_hx711() {
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  delay(1000);
  Serial.print("HX711 reading: ");
  Serial.println(scale.read());
  Serial.println("HX711 initialized");
}

/*
 * Initialize WiFi
 */
void init_wifi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.onEvent(onWiFiEvent);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
}

/*
 * Setup
 */
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\nHangboard Force Measurement System - ESP32");
  Serial.println("==========================================");
  
  init_hx711();
  init_wifi();
  webSocket.onEvent(webSocketEvent);

  last_sample_us = micros();
  last_output_ms = millis();
  last_wifi_attempt_ms = millis();

  // Dedicated FreeRTOS task for sampling + WebSocket at 80/20 Hz.
  // Runs on Core 1 so it doesn't compete with WiFi on Core 0.
  // vTaskDelayUntil yields the CPU between samples — no busy loop.
  xTaskCreatePinnedToCore(
    [](void*) {
      const TickType_t sampleInterval = pdMS_TO_TICKS(1000 / SAMPLE_RATE_HZ);
      TickType_t lastWake = xTaskGetTickCount();

      for (;;) {
        vTaskDelayUntil(&lastWake, sampleInterval);

        // WebSocket housekeeping
        if (wifi_connected && ws_started) {
          webSocket.loop();
        }

        // Sample at 80 Hz
        if (scale.is_ready()) {
          int32_t raw = (int32_t)scale.read();
          int32_t avg = add_sample(raw);

          // Output at 20 Hz
          unsigned long now_ms = millis();
          if (now_ms - last_output_ms >= OUTPUT_INTERVAL_MS) {
            last_output_ms = now_ms;
            send_measurement((uint32_t)now_ms, avg);
          }
        }
      }
    },
    "sample_task",
    4096,
    NULL,
    1,      // priority
    NULL,
    1       // core 1
  );
}

/*
 * Main loop — only handles WiFi reconnection
 */
void loop() {
  unsigned long now_ms = millis();

  if (!wifi_connected && (now_ms - last_wifi_attempt_ms >= WIFI_RECONNECT_INTERVAL_MS)) {
    last_wifi_attempt_ms = now_ms;
    Serial.println("Attempting WiFi reconnect...");
    WiFi.begin(ssid, password);
  }

  delay(1000);
}
