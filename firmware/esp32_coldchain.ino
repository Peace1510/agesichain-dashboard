/**
 * ============================================================================
 * AGESICHAIN COLD-CHAIN KINETIC MONITORING SYSTEM
 * Unified Production ESP32 Firmware
 * ============================================================================
 * 
 * Hardware Pin Connections (Customized for your build):
 * ────────────────────────────────────────────────────────────────────────────
 * 1. OLED Display (0.91-inch, I2C, 128x32):
 *    - VCC  -> 3V3
 *    - GND  -> GND
 *    - SDA  -> GPIO 21 (D21)
 *    - SCL  -> GPIO 22 (D22)
 *    - Address: 0x3C
 * 
 * 2. DHT11 Temperature & Humidity Sensor:
 *    - VCC (+)    -> 3V3
 *    - GND (-)    -> GND
 *    - DATA / OUT -> GPIO 2 (D2)
 * 
 * 3. Buzzer:
 *    - Signal (+) -> GPIO 32 (D32)
 *    - GND (-)    -> GND
 * 
 * 4. Neo-6M GPS Module (HardwareSerial 2):
 *    - VCC -> 3V3 / 5V
 *    - GND -> GND
 *    - TX  -> GPIO 16 (ESP32 RX2)
 *    - RX  -> GPIO 17 (ESP32 TX2)
 * 
 * Target Cloud Server:
 * ────────────────────────────────────────────────────────────────────────────
 * https://ageischain.kirmadaa.tech/api/telemetry
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPS++.h>
#include "DHT.h"

// ────────────────────────────────────────────────────────────────────────────
// 1. WI-FI & CLOUD SERVER CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────

// Your Hotspot Credentials:
const char* ssid     = "Pratik's S22";
const char* password = "COMPUTERguy";

// Live Production Cloud Server:
const char* SERVER_URL = "https://ageischain.kirmadaa.tech/api/telemetry";

// Device Identifier
const char* DEVICE_ID = "ESP32_01";

// 1-second transmission interval for responsive closed-loop buzzer control
const unsigned long readInterval = 1000;

// ────────────────────────────────────────────────────────────────────────────
// 2. HARDWARE PIN DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────

#define DHTPIN      2        // DHT11 DATA pin on GPIO 2
#define DHTTYPE     DHT11    // DHT 11
#define BUZZER_PIN  32       // Buzzer Signal pin on GPIO 32

// GPS HardwareSerial 2 pins
#define RXD2        16       // Connect to Neo-6M GPS TX
#define TXD2        17       // Connect to Neo-6M GPS RX

// OLED 0.91-inch Display (128x32)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
#define OLED_RESET    -1
#define OLED_ADDR     0x3C
#define SDA_PIN       21
#define SCL_PIN       22

// ────────────────────────────────────────────────────────────────────────────
// 3. OBJECTS & STATE VARIABLES
// ────────────────────────────────────────────────────────────────────────────

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial neogps(2);

// OLED Animation variables
const int cx = 64;
const int cy = 16;
const int radius = 11;
int angle = 0;
unsigned long startTime;

// Telemetry & Closed-Loop state
unsigned long lastReadTime = 0;
bool buzzerActiveFromServer = false;
float lastViability = 100.0;
float lastTimeToSpoil = 0.0;
int packetCount = 0;

// Persistent HTTPS client — reused across requests to avoid TLS re-handshake every cycle
// This is the main fix for the connect/disconnect flicker on mobile hotspot.
WiFiClientSecure secureClient;
bool clientReady = false;

// ────────────────────────────────────────────────────────────────────────────
// 4. OLED ANIMATION FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────

void drawLoading() {
  display.clearDisplay();

  // Rotating circular loading indicator
  for (int i = 0; i < 270; i += 5) {
    float a = (angle + i) * PI / 180.0;
    int x = cx + round(radius * cos(a));
    int y = cy + round(radius * sin(a));
    display.drawPixel(x, y, SSD1306_WHITE);
  }

  // Rotating head
  float a = angle * PI / 180.0;
  int x = cx + round(radius * cos(a));
  int y = cy + round(radius * sin(a));
  display.fillCircle(x, y, 2, SSD1306_WHITE);

  display.display();
  angle = (angle + 15) % 360;
}

void drawTick() {
  display.clearDisplay();
  display.drawLine(43, 17, 55, 27, SSD1306_WHITE);
  display.drawLine(55, 27, 84, 5, SSD1306_WHITE);
  display.display();
}

void drawCross() {
  display.clearDisplay();
  display.drawLine(49, 5, 79, 27, SSD1306_WHITE);
  display.drawLine(79, 5, 49, 27, SSD1306_WHITE);
  display.display();
}

void showIP() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 2);
  display.println(F("WiFi Connected!"));
  display.setCursor(0, 17);
  display.print(WiFi.localIP());
  display.display();

  Serial.print(F("ESP32 IP: "));
  Serial.println(WiFi.localIP());
}

// ────────────────────────────────────────────────────────────────────────────
// 5. RUNTIME OLED DASHBOARD SCREEN
// ────────────────────────────────────────────────────────────────────────────

void showLiveDashboard(float temp, float hum, bool hasLoc, double lat, double lng) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Line 1: Temperature & Humidity
  display.setCursor(0, 0);
  display.print(F("T:"));
  display.print(temp, 1);
  display.print(F("C H:"));
  display.print(hum, 0);
  display.print(F("%"));

  // Line 1 Right: Status Badge
  display.setCursor(86, 0);
  if (buzzerActiveFromServer) {
    display.print(F("[ALARM]"));
  } else if (WiFi.status() == WL_CONNECTED) {
    display.print(F("[OK]"));
  } else {
    display.print(F("[DISC]"));
  }

  // Line 2: Potency Viability & Time to Spoil (received from cloud kinetics engine)
  display.setCursor(0, 11);
  display.print(F("V:"));
  display.print(lastViability, 1);
  display.print(F("% TTS:"));
  if (lastTimeToSpoil > 0) {
    display.print(lastTimeToSpoil, 1);
    display.print(F("h"));
  } else {
    display.print(F("--"));
  }

  // Line 3: GPS Coordinates or Searching status
  display.setCursor(0, 22);
  if (hasLoc) {
    display.print(F("GPS:"));
    display.print(lat, 4);
    display.print(F(","));
    display.print(lng, 4);
  } else {
    display.print(F("GPS:Acquiring Fix..."));
  }

  display.display();
}

// ────────────────────────────────────────────────────────────────────────────
// 6. CLOUD RESPONSE PARSER (Buzzer & Kinetic State)
// ────────────────────────────────────────────────────────────────────────────

void parseServerResponse(const String& payload) {
  // 1. Extract buzzer command from server and update pin immediately
  if (payload.indexOf("\"buzzer_active\":true") >= 0 || payload.indexOf("\"buzzer_active\": true") >= 0) {
    buzzerActiveFromServer = true;
    digitalWrite(BUZZER_PIN, HIGH);
  } else if (payload.indexOf("\"buzzer_active\":false") >= 0 || payload.indexOf("\"buzzer_active\": false") >= 0) {
    buzzerActiveFromServer = false;
    digitalWrite(BUZZER_PIN, LOW); // Cut off buzzer immediately!
  }

  Serial.print(F("[CLOUD SYNC] Buzzer: "));
  Serial.print(buzzerActiveFromServer ? F("ACTIVE (BUZZING)") : F("SILENT/OFF"));

  // 2. Extract cumulative viability fraction (e.g. 0.9984 -> 99.8%)
  int vIdx = payload.indexOf("\"cumulative_viability\":");
  if (vIdx > 0) {
    int start = vIdx + 23;
    while (start < payload.length() && (payload[start] == ' ' || payload[start] == ':')) start++;
    int end = start;
    while (end < payload.length() && (isdigit(payload[end]) || payload[end] == '.' || payload[end] == 'e' || payload[end] == 'E' || payload[end] == '-' || payload[end] == '+')) end++;
    float vVal = payload.substring(start, end).toFloat();
    if (vVal > 0) {
      lastViability = vVal * 100.0;
    }
  }

  // 3. Extract time to spoil
  int ttsIdx = payload.indexOf("\"time_to_spoil_hours\":");
  if (ttsIdx > 0) {
    int start = ttsIdx + 22;
    while (start < payload.length() && (payload[start] == ' ' || payload[start] == ':')) start++;
    int end = start;
    while (end < payload.length() && (isdigit(payload[end]) || payload[end] == '.' || payload[end] == 'e' || payload[end] == 'E' || payload[end] == '-' || payload[end] == '+')) end++;
    lastTimeToSpoil = payload.substring(start, end).toFloat();
  }

  Serial.print(F(" | Viability: "));
  Serial.print(lastViability, 1);
  Serial.print(F("% | TTS: "));
  Serial.print(lastTimeToSpoil, 1);
  Serial.println(F("h"));
}

// ────────────────────────────────────────────────────────────────────────────
// 7. SETUP
// ────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  // Buzzer on GPIO 32 - Quick boot beep to verify wiring
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(120);
  digitalWrite(BUZZER_PIN, LOW);

  // OLED Display on GPIO 21 (SDA) & GPIO 22 (SCL)
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("OLED initialization failed!"));
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(12, 12);
  display.println(F("Starting WiFi..."));
  display.display();

  // DHT11 Sensor on GPIO 2
  dht.begin();

  // Neo-6M GPS on HardwareSerial 2 (RX2 16, TX2 17)
  neogps.begin(9600, SERIAL_8N1, RXD2, TXD2);

  // Connect to Pratik's S22 Mobile Hotspot with Animated Screen
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  startTime = millis();
  Serial.println(F("Connecting to Pratik's S22..."));

  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startTime >= 30000) {
      Serial.println(F("WiFi connection timeout!"));
      drawCross();
      delay(2000);
      break;
    }
    drawLoading();
    delay(50);
  }

  if (WiFi.status() == WL_CONNECTED) {
    drawTick();
    delay(1000);
    showIP();
    delay(2000);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 8. MAIN LOOP
// ────────────────────────────────────────────────────────────────────────────

void loop() {
  // Feed GPS serial stream continuously
  while (neogps.available() > 0) {
    gps.encode(neogps.read());
  }

  // Active Buzzer on GPIO 32 (Pulsed alert when cloud signals decay alarm)
  if (buzzerActiveFromServer) {
    digitalWrite(BUZZER_PIN, (millis() / 250) % 2 == 0 ? HIGH : LOW);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  // Periodic Telemetry Execution every 1 second
  if (millis() - lastReadTime >= readInterval) {
    lastReadTime = millis();

    // 1. Read DHT11 Sensor
    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();

    if (isnan(temp)) temp = 4.5; // Nominal WHO vaccine temperature fallback if unplugged
    if (isnan(hum))  hum  = 50.0;

    // 2. Read GPS Location
    bool hasLoc = gps.location.isValid() && gps.location.age() < 5000;
    double lat  = hasLoc ? gps.location.lat() : 18.5204;
    double lng  = hasLoc ? gps.location.lng() : 73.8567;
    float speed = (gps.speed.isValid() && gps.speed.age() < 5000) ? (float)gps.speed.kmph() : 0.0;

    // 3. Build single-line JSON payload for the cloud API
    String jsonPayload = "{\"device_id\":\"";
    jsonPayload += DEVICE_ID;
    jsonPayload += "\",\"timestamp\":0"; // 0 tells cloud server to stamp with atomic server clock
    jsonPayload += ",\"temperature\":";
    jsonPayload += String(temp, 2);
    jsonPayload += ",\"humidity\":";
    jsonPayload += String(hum, 1);
    jsonPayload += ",\"latitude\":";
    jsonPayload += String(lat, 5);
    jsonPayload += ",\"longitude\":";
    jsonPayload += String(lng, 5);
    jsonPayload += ",\"speed_kmh\":";
    jsonPayload += String(speed, 1);
    jsonPayload += "}";

    // Print to Serial monitor
    Serial.print(F("[TX #"));
    Serial.print(++packetCount);
    Serial.print(F("] "));
    Serial.println(jsonPayload);

    // 4. Send HTTP POST to Cloud Server (https://ageischain.kirmadaa.tech/api/telemetry)
    if (WiFi.status() == WL_CONNECTED) {
      // Initialise the persistent TLS client once (avoids full re-handshake every cycle)
      if (!clientReady) {
        secureClient.setInsecure(); // Trust Cloudflare certificate without CA bundle
        clientReady = true;
        Serial.println(F("[TLS] Secure client initialised"));
      }

      HTTPClient http;
      http.setReuse(true); // Keep-alive TLS connection across cycles
      if (http.begin(secureClient, SERVER_URL)) {
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Connection", "keep-alive");
        http.setTimeout(3500);
        http.setConnectTimeout(3500);

        int httpResponseCode = http.POST(jsonPayload);
        if (httpResponseCode > 0) {
          String response = http.getString();
          parseServerResponse(response);
          Serial.print(F("[HTTP] Response code: "));
          Serial.println(httpResponseCode);
        } else {
          Serial.print(F("[HTTP ERROR] Code: "));
          Serial.print(httpResponseCode);
          Serial.println(F(" — retrying next cycle"));
          // Reset client so next cycle re-initialises TLS if connection broke
          clientReady = false;
        }
        http.end();
      } else {
        Serial.println(F("[HTTP] Failed to begin — resetting TLS client"));
        clientReady = false;
      }
    } else {
      // WiFi dropped — reconnect and reset TLS client
      Serial.println(F("[WiFi] Disconnected — reconnecting..."));
      clientReady = false;
      WiFi.reconnect();
    }

    // 5. Update 0.91-inch OLED Display with Live Stats
    showLiveDashboard(temp, hum, hasLoc, lat, lng);
  }
}
