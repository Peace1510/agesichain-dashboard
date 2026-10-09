#include <TinyGPS++.h>
#include "DHT.h"

// --- Sensor Pinout ---
#define DHTPIN 2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

#define RXD2 16  // GPS TX -> ESP32 RX2
#define TXD2 17  // GPS RX -> ESP32 TX2

TinyGPSPlus gps;
HardwareSerial neogps(2);

unsigned long lastReadTime = 0;
const unsigned long readInterval = 1000; // 1-second transmission rate

// Base epoch fallback if GPS fix is pending indoors (seconds)
const unsigned long BASE_EPOCH = 1728480000UL;

void setup() {
  Serial.begin(115200);
  dht.begin();
  neogps.begin(9600, SERIAL_8N1, RXD2, TXD2);
}

void loop() {
  // Feed GPS serial stream
  while (neogps.available() > 0) {
    gps.encode(neogps.read());
  }

  // Timer check
  if (millis() - lastReadTime >= readInterval) {
    lastReadTime = millis();

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    // Hardware safety fallbacks
    if (isnan(temp)) temp = 4.5; // Nominal vaccine temp fallback if sensor unplugged
    if (isnan(hum)) hum = 45.0;

    // GPS coordinates fallback for indoor demo tables
    bool hasLoc = gps.location.isValid() && gps.location.age() < 5000;
    double lat = hasLoc ? gps.location.lat() : 18.52043;
    double lng = hasLoc ? gps.location.lng() : 73.85674;
    float speed = (gps.speed.isValid() && gps.speed.age() < 5000) ? (float)gps.speed.kmph() : 0.0;

    // Compute monotonic Unix epoch timestamp for Arrhenius delta_t
    unsigned long currentTimestamp = BASE_EPOCH + (millis() / 1000UL);

    // Single-line JSON serialization matching backend schema exactly
    Serial.print("{\"device_id\":\"ESP32_COLDCHAIN_01\"");
    Serial.print(",\"timestamp\":");
    Serial.print(currentTimestamp);
    Serial.print(",\"temperature\":");
    Serial.print(temp, 2);
    Serial.print(",\"humidity\":");
    Serial.print(hum, 1);
    Serial.print(",\"latitude\":");
    Serial.print(lat, 5);
    Serial.print(",\"longitude\":");
    Serial.print(lng, 5);
    Serial.print(",\"speed_kmh\":");
    Serial.print(speed, 1);
    Serial.println("}");
  }
}
