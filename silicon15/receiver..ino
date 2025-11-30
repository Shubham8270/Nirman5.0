#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <PubSubClient.h> 

// **********************************************
// 1. CONFIGURATION SETTINGS (CHANGE THESE!)
// **********************************************

// --- LoRa Pins ---
#define SCLK 5
#define MISO 19
#define MOSI 27
#define NSS  18
#define RST  14
#define DIO0 26
#define BAND 433E6

// --- Wi-Fi Credentials ---
const char* ssid = "Vlsi";
const char* password = "vlsi80211";

// --- MQTT Broker Settings ---
// Use the IP address or hostname of your Broker
const char* mqtt_server = "broker.hivemq.com"; 
const int mqtt_port = 1883;
// This client ID MUST be unique on the broker
const char* mqtt_client_id = "ESP32_LoRa_Receiver_01"; 

// --- MQTT Topic ---
// The channel you will publish the LoRa data to
const char* mqtt_publish_topic = "lora/data/sensor1"; 

// **********************************************
// 2. GLOBAL OBJECTS
// **********************************************

WiFiClient espClient;
PubSubClient client(espClient);


// **********************************************
// 3. WIFI AND MQTT CONNECTION FUNCTIONS
// **********************************************

void setup_wifi() {
    delay(10);
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
}

void reconnect() {
    // Loop until we're reconnected
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        // Attempt to connect
        if (client.connect(mqtt_client_id)) {
            Serial.println("connected!");
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" trying again in 5 seconds");
            // Wait 5 seconds before retrying
            delay(5000);
        }
    }
}


// **********************************************
// 4. SETUP FUNCTION
// **********************************************

void setup() {
    Serial.begin(115200);
    while (!Serial);

    // --- LoRa Setup ---
    Serial.println("--- LoRa Receiver Initializing ---");
    SPI.begin(SCLK, MISO, MOSI, NSS);
    LoRa.setPins(NSS, RST, DIO0);
    
    if (!LoRa.begin(BAND)) {
        Serial.println("Starting LoRa failed!");
        while (1);
    }
    LoRa.setSyncWord(0xF3);
    Serial.println("LoRa Receiver Ready!");

    // --- Wi-Fi and MQTT Setup ---
    setup_wifi();
    client.setServer(mqtt_server, mqtt_port);
    
    Serial.println("--- System Initialized ---");
}


// **********************************************
// 5. LOOP FUNCTION
// **********************************************

void loop() {
    // 1. Maintain MQTT Connection
    if (!client.connected()) {
        reconnect();
    }
    client.loop(); 

    // 2. Check for LoRa Packet
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
        Serial.print("\n>>> Received LoRa packet (size ");
        Serial.print(packetSize);
        Serial.print("): ");

        String message = "";
        while (LoRa.available()) {
            message += (char)LoRa.read();
        }

        Serial.println(message);
        
        // 3. Publish Data to MQTT Broker
        // Convert the String to a C-style char array (required by client.publish)
        if (client.publish(mqtt_publish_topic, message.c_str())) {
            Serial.print("MQTT Publish SUCCESS on topic: ");
            Serial.println(mqtt_publish_topic);
        } else {
            Serial.println("MQTT Publish FAILED!");
        }

        Serial.print("RSSI: ");
        Serial.println(LoRa.packetRssi());
        Serial.println("---------------------------------");
    }
}