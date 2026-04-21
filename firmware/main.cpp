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

// WiFi Configuration
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* ws_server = "YOUR_BACKEND_URL";
const int ws_port = 80;
const char* ws_path = "/ws";

// HX711 Configuration
const int LOADCELL_DOUT_PIN = 25;
const int LOADCELL_SCK_PIN = 26;

// Sampling Configuration
const int SAMPLE_RATE_HZ = 80;           // Acquisition rate
const int MOVING_AVG_WINDOW = 4;         // Average window
const int OUTPUT_RATE_HZ = 20;           // Output rate (80/4)
const unsigned long SAMPLE_INTERVAL_US = 1000000 / SAMPLE_RATE_HZ;  // ~12.5ms
const unsigned long OUTPUT_INTERVAL_MS = 1000 / OUTPUT_RATE_HZ;     // ~50ms

// Circular buffer for moving average
int16_t sample_buffer[4] = {0, 0, 0, 0};
uint8_t buffer_index = 0;

// Timing
unsigned long last_sample_us = 0;
unsigned long last_output_ms = 0;
unsigned long loop_start_us = 0;

// HX711 instance
HX711 scale;

// WebSocket instance
WebSocketsClient webSocket;

// Connection states
bool wifi_connected = false;
bool ws_connected = false;

/*
 * Moving average calculation
 * Adds new sample and returns average
 */
int16_t add_sample(int16_t raw) {
  sample_buffer[buffer_index] = raw;
  buffer_index = (buffer_index + 1) % MOVING_AVG_WINDOW;
  
  int32_t sum = 0;
  for (int i = 0; i < MOVING_AVG_WINDOW; i++) {
    sum += sample_buffer[i];
  }
  return sum / MOVING_AVG_WINDOW;
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
      webSocket.begin(ws_server, ws_port, ws_path);
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
      // Echo for debugging
      Serial.print("WebSocket RX: ");
      Serial.println((char*)payload);
      break;
    
    default:
      break;
  }
}

/*
 * Send measurement data to WebSocket server
 */
void send_measurement(uint32_t timestamp_ms, int16_t raw) {
  if (!ws_connected) return;
  
  StaticJsonDocument<64> doc;
  doc["timestamp"] = timestamp_ms;
  doc["raw"] = raw;
  
  String json;
  serializeJson(doc, json);
  
  webSocket.sendTXT(json);
  Serial.print("TX: ");
  Serial.println(json);
}

/*
 * Initialize HX711
 */
void init_hx711() {
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  
  // Wait for stabilization
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
}

/*
 * Main loop - non-blocking sampling and output
 * 
 * Strategy:
 * 1. Sample at 80 Hz with microsecond precision
 * 2. Accumulate samples in moving average buffer
 * 3. Output smoothed value at 20 Hz
 */
void loop() {
  // Maintain WebSocket connection
  if (wifi_connected) {
    webSocket.loop();
  }
  
  // Reconnect WiFi if needed
  if (!wifi_connected && millis() % 10000 == 0) {
    Serial.println("Attempting WiFi reconnect...");
    WiFi.begin(ssid, password);
  }
  
  unsigned long now_us = micros();
  unsigned long now_ms = millis();
  
  // Sample at 80 Hz
  if (now_us - last_sample_us >= SAMPLE_INTERVAL_US) {
    last_sample_us = now_us;
    
    if (scale.is_ready()) {
      int16_t raw = scale.read();
      
      // Add to moving average buffer
      int16_t avg = add_sample(raw);
      
      // Output at 20 Hz (every 4th sample)
      if (now_ms - last_output_ms >= OUTPUT_INTERVAL_MS) {
        last_output_ms = now_ms;
        
        // Send to backend with millisecond timestamp
        send_measurement((uint32_t)now_ms, avg);
      }
    } else {
      Serial.println("HX711 not ready");
    }
  }
  
  // Yield to other tasks
  yield();
}
