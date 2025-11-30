#include <SPI.h>
#include <LoRa.h>
#include "DHT.h"

// --------------------
// DHT11 setup
// --------------------
#define DHTPIN 23
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// --------------------
// Gas sensor setup
// --------------------
#define GAS_PIN 34  // Analog pin

// --------------------
// LoRa pins & frequency
// --------------------
#define LORA_SCK  5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_SS   18
#define LORA_RST  14
#define LORA_DIO0 26
#define BAND 433E6  // 433 MHz

void setup() {
  Serial.begin(115200);
  while (!Serial);

  dht.begin();
  pinMode(GAS_PIN, INPUT);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  Serial.println("LoRa + DHT11 + Gas Sensor TX");

  if (!LoRa.begin(BAND)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }

  LoRa.setSyncWord(0xF3);  // Sync word for receiver
  Serial.println("LoRa TX OK");
}

void loop() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int gasValue = analogRead(GAS_PIN);

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read DHT sensor!");
    delay(2000);
    return;
  }

  // Create message
  String message = String(temperature) + "," + String(humidity) + "," + String(gasValue);

  // Send message via LoRa
  LoRa.beginPacket();
  LoRa.print(message);
  LoRa.endPacket();

  Serial.println("Sent: " + message);
  delay(5000); // Send every 5 seconds
}