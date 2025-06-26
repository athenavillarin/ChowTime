#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiManager.h>
#include <esp_http_server.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <FirebaseESP32.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

WiFiManager wifiManager;

// Firebase project credentials
FirebaseData cameraData;
FirebaseData feedData;
FirebaseData manualFeedData;
FirebaseData feederData;
FirebaseData settingsData;
FirebaseData flashData;
FirebaseConfig firebaseConfig;
FirebaseAuth firebaseAuth;

// Camera Model
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"
#define LED_GPIO_NUM   4

// Feeder settings
bool AUTO_FEEDER_ENABLED = false;
unsigned long FEEDER_INTERVAL = 0;
unsigned long LAST_FEED_TIME = 0;
int PORTION_SIZE = 1;
bool lastAutoFeederEnabled = false;
unsigned long lastFeederInterval = 0;
int lastPortionSize = 0;
bool manualFeedProcessed = false;
unsigned long manualFeedCooldown = 60000; // 1 minute cooldown for manual feed
unsigned long lastManualFeedTime = 0;

// Manual feed control
bool manualFeedEnabled = false; // Control manual feeding
unsigned long manualFeedDuration = 60000; // Duration for which manual feed is enabled (1 minute)
unsigned long manualFeedEndTime = 0;

// Camera server
httpd_handle_t server_httpd = NULL;

// Servo setup
Servo foodServo;

// NTP client setup
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "time.google.com", 21600, 60000);

void startCameraServer();
void feedPet(int portion);
void manualFeedPet(int portion); // New function for manual feeding
void toggleFlash(bool state);
void handleCameraUpdate(FirebaseData &data);
void handleFlashUpdate(FirebaseData &data);
void handleFeedUpdate(FirebaseData &data);
void handleManualFeedUpdate(FirebaseData &data);
void handleFeederUpdate(FirebaseData &data);
void handleSettingsUpdate(FirebaseData &data);
void handleStreamTimeout(bool timeout);

void setup() {
    Serial.begin(115200);
    Serial.println("Starting setup...");

    // Handle Wi-Fi Manager
    if (!wifiManager.autoConnect("ChowTime-Setup")) {
        Serial.println("Failed to connect, starting configuration portal...");
        wifiManager.startConfigPortal("ChowTime-Setup");
    }

    // Initialize NTP Client
    timeClient.begin();
    timeClient.setTimeOffset(7200);
    timeClient.update();
    Serial.print("Current time: ");
    Serial.println(timeClient.getFormattedTime());

    // Firebase configuration
    firebaseConfig.database_url = "Your link";
    firebaseConfig.api_key = "Your API key";
    firebaseAuth.user.email = "Your email";
    firebaseAuth.user.password = "Your password";

    // Initialize Firebase
    Firebase.begin(&firebaseConfig, &firebaseAuth);
    Firebase.reconnectNetwork(true);
    firebaseConfig.timeout.socketConnection = 20000;
    firebaseConfig.timeout.serverResponse = 20000;

    // Check if Firebase is initialized
    if (Firebase.ready()) {
        Serial.println("Firebase initialized successfully!");

        // Write the initial flash state to Firebase
        if (Firebase.setBool(flashData, "/feeder/flash", false)) {
            Serial.println("Initial flash state set to false in Firebase.");
        } else {
            Serial.print("Failed to set initial flash state: ");
            Serial.println(flashData.errorReason());
        }

        // Write the IP address to Firebase
        String cameraIp = WiFi.localIP().toString();
        if (Firebase.setString(cameraData, "/camera/ip", cameraIp)) {
            Serial.println("Camera IP written to Firebase successfully: " + cameraIp);
        } else {
            Serial.print("Failed to write camera IP to Firebase: ");
            Serial.println(cameraData.errorReason());
        }

        // Start listening to Firebase streams
        if (Firebase.beginStream(feedData, "/feed")) {
            Serial.println("Listening to /feed...");
        } else {
            Serial.println("Failed to start listening to /feed: " + feedData.errorReason());
        }

        if (Firebase.beginStream(manualFeedData, "/manual_feed")) { // Listen to manual feed
            Serial.println("Listening to /manual_feed...");
        } else {
            Serial.println("Failed to start listening to /manual_feed: " + manualFeedData.errorReason());
 }

        if (Firebase.beginStream(settingsData, "/settings/userSettings")) {
            Serial.println("Listening to /settings/userSettings...");
        } else {
            Serial.println("Failed to start listening to /settings/userSettings: " + settingsData.errorReason());
        }

        if (Firebase.beginStream(flashData, "/feeder/flash")) {
            Serial.println("Listening to /feeder/flash...");
        } else {
            Serial.println("Failed to start listening to /feeder/flash: " + flashData.errorReason());
        }
    } else {
        Serial.println("Failed to initialize Firebase.");
    }

    // Initialize Servo
    foodServo.attach(14);
    foodServo.write(0);
    Serial.println("Servo initialized successfully and set to position 0.");

    // Initialize flash pin
    pinMode(LED_GPIO_NUM, OUTPUT);
    digitalWrite(LED_GPIO_NUM, LOW); // Set flash to LOW (off)
    Serial.println("Flash pin initialized successfully and set to LOW.");

    // Initialize camera
    camera_config_t cameraConfig;
    cameraConfig.ledc_channel = LEDC_CHANNEL_0;
    cameraConfig.ledc_timer = LEDC_TIMER_0;
    cameraConfig.pin_d0 = Y2_GPIO_NUM;
    cameraConfig.pin_d1 = Y3_GPIO_NUM;
    cameraConfig.pin_d2 = Y4_GPIO_NUM;
    cameraConfig.pin_d3 = Y5_GPIO_NUM;
    cameraConfig.pin_d4 = Y6_GPIO_NUM;
    cameraConfig.pin_d5 = Y7_GPIO_NUM;
    cameraConfig.pin_d6 = Y8_GPIO_NUM;
    cameraConfig.pin_d7 = Y9_GPIO_NUM;
    cameraConfig.pin_xclk = XCLK_GPIO_NUM;
    cameraConfig.pin_pclk = PCLK_GPIO_NUM;
    cameraConfig.pin_vsync = VSYNC_GPIO_NUM;
    cameraConfig.pin_href = HREF_GPIO_NUM;
    cameraConfig.pin_sscb_sda = SIOD_GPIO_NUM;
    cameraConfig.pin_sscb_scl = SIOC_GPIO_NUM;
    cameraConfig.pin_pwdn = PWDN_GPIO_NUM;
    cameraConfig.pin_reset = RESET_GPIO_NUM;
    cameraConfig.xclk_freq_hz = 20000000;
    cameraConfig.pixel_format = PIXFORMAT_JPEG;

    if (psramFound()) {
        cameraConfig.frame_size = FRAMESIZE_SVGA;
        cameraConfig.jpeg_quality = 12;
        cameraConfig.fb_count = 2;
    } else {
        cameraConfig.frame_size = FRAMESIZE_QVGA;
        cameraConfig.jpeg_quality = 16;
        cameraConfig.fb_count = 1;
    }

    esp_err_t err = esp_camera_init(&cameraConfig);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed with error 0x%x\n", err);
        return;
    }
    Serial.println("Camera initialized successfully");

    // Start server
    startCameraServer();
}

void handleFeedUpdate(FirebaseData &data) {
    if (data.stringData().isEmpty()) {
        Serial.println("Received empty feed action update. Ignoring.");
        return;
    }

    Serial.println("Raw data fetched from Firebase: " + data.stringData());

    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, data.stringData());

    if (error) {
        Serial.print("Failed to parse feed action update JSON: ");
        Serial.println(error.c_str());
        return;
    }

    if (doc.containsKey("portionSize")) {
        int portionSize = doc["portionSize"];
        if (AUTO_FEEDER_ENABLED && portionSize != lastPortionSize) {
            feedPet(portionSize); // Only feed if the auto feeder is enabled
            LAST_FEED_TIME = millis();
            lastPortionSize = portionSize;
            Serial.print("Portion size set to: ");
            Serial.println(portionSize);
        }
    }

    if (doc.containsKey("enabled")) {
        bool enabled = doc["enabled"];
        if (enabled != lastAutoFeederEnabled) {
            AUTO_FEEDER_ENABLED = enabled;
            lastAutoFeederEnabled = enabled;
            Serial.printf("Auto feeder is now %s.\n", AUTO_FEEDER_ENABLED ? "enabled" : "disabled");
        }
    }

    if (doc.containsKey("interval")) {
        unsigned long interval = doc["interval"];
        if (interval != lastFeederInterval) {
            FEEDER_INTERVAL = interval;
            lastFeederInterval = interval;
            Serial.printf("Interval set to: %lu\n", FEEDER_INTERVAL);
        }
    }
}

void handleManualFeedUpdate(FirebaseData &data) {
    if (data.stringData().isEmpty()) {
        Serial.println("Received empty manual feed update. Ignoring.");
        return;
    }

    Serial.println("Raw data fetched from manual feed: " + data.stringData());

    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, data.stringData());

    if (error) {
        Serial.print("Failed to parse manual feed JSON: ");
        Serial.println(error.c_str());
        return;
    }

    if (doc.containsKey("portionSize") && doc.containsKey("isFeeding")) {
        int portionSize = doc["portionSize"];
        bool isFeeding = doc["isFeeding"]; // Read the boolean value
        unsigned long timestamp = doc["timestamp"];

        Serial.printf("Manual feed requested with portion size: %d at timestamp: %lu, isFeeding: %s\n", 
                      portionSize, timestamp, isFeeding ? "true" : "false");

        if (isFeeding) {
            // Trigger the manual feed
            manualFeedEnabled = true; // Set manual feed to true
            manualFeedEndTime = millis() + manualFeedDuration; // Set end time
            manualFeedPet(portionSize); // Call the manual feed function
        }
    } else {
        Serial.println("Invalid manual feed data structure. Ignoring.");
    }
}

void manualFeedPet(int portion) {
    Serial.print("Manually feeding portion: ");
    Serial.println(portion);
    int openDuration = 0;
    String portionText;

    if (portion == 1) {
        openDuration = 2000; // 2 seconds
        portionText = "Feeding Small portion!";
    } else if (portion == 2) {
        openDuration = 4000; // 4 seconds
        portionText = "Feeding Medium portion!";
    } else if (portion == 3) {
        openDuration = 6000; // 6 seconds
        portionText = "Feeding Large portion!";
    } else {
        Serial.println("Invalid portion size. Feeding aborted.");
        return;
    }

    foodServo.write(90);  
    delay(openDuration);
    foodServo.write(0);
    LAST_FEED_TIME = millis();
    Serial.println("Feeding complete");

    // Send the notification as a simple string
    String notificationKey = String(millis());
    if (Firebase.setString(feedData, "/notifications/" + notificationKey, portionText)) {
        Serial.println("Notification sent to Firebase: " + portionText);
    } else {
        Serial.print("Error sending notification: ");
        Serial.println(feedData.errorReason());
    }

    // Optionally update the feeding state in Firebase
    if (Firebase.setBool(feedData, "/manual_feed/enabled", false)) {
        Serial.println("Manual feed state sent to Firebase: false");
    } else {
        Serial.print("Error sending manual feed state to Firebase: ");
        Serial.println(feedData.errorReason());
    }
}

void handleFlashUpdate(FirebaseData &data) {
    if (data.stringData().isEmpty()) {
        Serial.println("Received empty flash update. Ignoring.");
        return;
    }

    Serial.println("Raw data fetched from flash update: " + data.stringData());

    bool flashState = false;
    if (data.dataType() == "boolean") {
        flashState = data.boolData();
        toggleFlash(flashState);
        Serial.printf("Flash is now %s.\n", flashState ? "ON" : "OFF");
    } else {
        Serial.println("Flash state is not a boolean.");
    }
}

void toggleFlash(bool state) {
    digitalWrite(LED_GPIO_NUM, state ? HIGH : LOW);
}

void handleFeederUpdate(FirebaseData &data) {
    if (data.stringData().isEmpty()) {
        Serial.println("Received empty feeder update. Ignoring.");
        return;
    }

    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, data.stringData());
    if (!error) {
        if (doc.containsKey("enabled")) {
            AUTO_FEEDER_ENABLED = doc["enabled"];
        }
        if (doc.containsKey("interval")) {
            FEEDER_INTERVAL = doc["interval"];
        }

        if (Firebase.getInt(settingsData, "/settings/userSettings")) {
            PORTION_SIZE = settingsData.intData();
        } else {
            Serial.println("Failed to read portionSize from settings.");
            return;
        }

        Serial.printf("Auto Feeder Enabled: %s, Interval: %lu, Portion Size: %d\n", 
                      AUTO_FEEDER_ENABLED ? "true" : "false", 
                      FEEDER_INTERVAL, 
                      PORTION_SIZE);

        if (AUTO_FEEDER_ENABLED && (millis() - LAST_FEED_TIME >= FEEDER_INTERVAL)) {
            feedPet(PORTION_SIZE);
            LAST_FEED_TIME = millis();
        }
    } else {
        Serial.print("Failed to parse feeder update JSON: ");
        Serial.println(error.c_str());
    }
}

void loop() {
    timeClient.update();

    static unsigned long lastTimeLog = 0;
    if (millis() - lastTimeLog > 600000) {
        lastTimeLog = millis();
        Serial.print("Current time: ");
        Serial.println(timeClient.getFormattedTime());
    }

    if (Firebase.ready()) {
        // Check manual feed updates first
        if (Firebase.readStream(manualFeedData)) {
            if (manualFeedData.dataAvailable()) {
                handleManualFeedUpdate(manualFeedData);
            }
        } else {
            Serial.println("Failed to read /manual_feed stream: " + manualFeedData.errorReason());
        }

        // Check feed updates
        if (Firebase.readStream(feedData)) {
            if (feedData.dataAvailable()) {
                handleFeedUpdate(feedData);
            }
        } else {
            Serial.println("Failed to read /feed stream: " + feedData.errorReason());
        }
        
        // Read settings and flash updates
        if (Firebase.readStream(settingsData)) {
            if (settingsData.dataAvailable()) {
                handleSettingsUpdate(settingsData);
            }
        } else {
            Serial.println("Failed to read /settings/userSettings stream: " + settingsData.errorReason());
        }

        if (Firebase.readStream(flashData)) {
            if (flashData.dataAvailable()) {
                handleFlashUpdate(flashData);
            }
        } else {
            Serial.println("Failed to read /feeder/flash stream: " + flashData.errorReason());
        }
    }

    // Reset manual feed state after the cooldown period
    if (manualFeedEnabled && millis() >= manualFeedEndTime) {
        manualFeedEnabled = false; // Reset manual feed state
        Serial.println("Manual feed duration expired. Auto feeder can resume.");
    }

    // Auto feeder logic only if no manual feed is active
    if (!manualFeedEnabled && AUTO_FEEDER_ENABLED && FEEDER_INTERVAL > 0) {
        unsigned long currentMillis = millis();
        if (currentMillis - LAST_FEED_TIME >= FEEDER_INTERVAL) {
            feedPet(PORTION_SIZE);
            LAST_FEED_TIME = currentMillis;
            Serial.printf("Auto-fe eding triggered. Portion Size: %d\n", PORTION_SIZE);
        }
    }

    delay(100);
}

void handleSettingsUpdate(FirebaseData &data) {
    if (data.stringData().isEmpty()) {
        Serial.println("Received empty settings update. Ignoring.");
        return;
    }

    Serial.println("Raw JSON: " + data.stringData());

    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, data.stringData());
    if (!error) {
        if (doc.containsKey("enabled")) {
            bool newAutoFeederEnabled = doc["enabled"].as<bool>();
            if (newAutoFeederEnabled != lastAutoFeederEnabled) {
                AUTO_FEEDER_ENABLED = newAutoFeederEnabled;
                lastAutoFeederEnabled = newAutoFeederEnabled; 
                Serial.printf("Auto feeder is now %s.\n", AUTO_FEEDER_ENABLED ? "enabled" : "disabled");
            }
        }

        if (doc.containsKey("interval")) {
            unsigned long newFeederInterval = doc["interval"];
            if (newFeederInterval != lastFeederInterval) {
                FEEDER_INTERVAL = newFeederInterval;
                lastFeederInterval = newFeederInterval;
                Serial.printf("Interval set to: %lu\n", FEEDER_INTERVAL);
            }
        }

        if (doc.containsKey("portionSize")) {
            int newPortionSize = doc["portionSize"];
            if (newPortionSize != lastPortionSize) {
                PORTION_SIZE = newPortionSize;
                lastPortionSize = newPortionSize;
                Serial.printf("Portion size set to: %d\n", PORTION_SIZE);
            }
        }
    } else {
        Serial.print("Failed to parse settings update JSON: ");
        Serial.println(error.c_str());
    }
}

void handleStreamTimeout(bool timeout) {
    if (timeout) {
        Serial.println("Stream timeout. Attempting to reconnect...");
        delay(5000);
        Firebase.endStream(cameraData);
        Firebase.endStream(feedData);
        Firebase.endStream(manualFeedData);
        Firebase.endStream(feederData);
        Firebase.endStream(settingsData);
        Firebase.beginStream(cameraData, "/camera");
        Firebase.beginStream(feedData, "/feed");
        Firebase.beginStream(manualFeedData, "/manual_feed");
        Firebase.beginStream(feederData, "/feeder");
        Firebase.beginStream(settingsData, "/settings");
    }
}

void feedPet(int portion) {
    Serial.print("Feeding portion: ");
    Serial.println(portion);
    int openDuration = 0;
    String portionText;

    if (portion == 1) {
        openDuration = 2000; // 2 seconds
        portionText = "Feeding Small portion!";
    } else if (portion == 2) {
        openDuration = 4000; // 4 seconds
        portionText = "Feeding Medium portion!";
    } else if (portion == 3) {
        openDuration = 6000; // 6 seconds
        portionText = "Feeding Large portion!";
    } else {
        Serial.println("Invalid portion size. Feeding aborted.");
        return;
    }

    foodServo.write(90);  
    delay(openDuration);
    foodServo.write(0);
    LAST_FEED_TIME = millis();
    Serial.println("Feeding complete");

    // Send the notification as a simple string
    String notificationKey = String(millis());
    if (Firebase.setString(feedData, "/notifications/" + notificationKey, portionText)) {
        Serial.println("Notification sent to Firebase: " + portionText);
    } else {
        Serial.print("Error sending notification: ");
        Serial.println(feedData.errorReason());
    }
}

// Start server for camera streaming
void startCameraServer() {
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;

    // Start the HTTP server
    if (httpd_start(&server_httpd, &config) == ESP_OK) {
        // Register the camera stream URI handler
        httpd_uri_t stream_uri = {
            .uri = "/",
            .method = HTTP_GET,
            .handler = [](httpd_req_t* req) -> esp_err_t {
                camera_fb_t* fb = NULL;
                esp_err_t res = ESP_OK;

                httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=frame");

                uint8_t* _jpg_buf = NULL;
                size_t _jpg_buf_len = 0;
                char part_buf[64];

                while (true) {
                    fb = esp_camera_fb_get();
                    if (!fb) {
                        Serial.println("Camera capture failed");
                        res = ESP_FAIL;
                    } else {
                        _jpg_buf = fb->buf;
                        _jpg_buf_len = fb->len;

                        // Prepare the header with the JPEG image's length
                        size_t hlen = snprintf(part_buf, sizeof(part_buf), "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", _jpg_buf_len);
                        res = httpd_resp_send_chunk(req, part_buf, hlen);
                        if (res == ESP_OK) {
                            res = httpd_resp_send_chunk(req, (const char*)_jpg_buf, _jpg_buf_len);
                        }
                        if (res == ESP_OK) {
                            res = httpd_resp_send_chunk(req, "\r\n", 2);
                        }

                        esp_camera_fb_return(fb);
                    }
                    if (res != ESP_OK) break;
                }
                return res;
            },
            .user_ctx = NULL
        };

        httpd_register_uri_handler(server_httpd, &stream_uri);
    }
}