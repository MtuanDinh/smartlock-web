#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>      
#include <FirebaseESP8266.h>
#include <SoftwareSerial.h>
#include <LittleFS.h> 

#define FIREBASE_HOST "lock-iot-2a021-default-rtdb.asia-southeast1.firebasedatabase.app" 
#define FIREBASE_AUTH "K9VM9lsbwHAJtudp0Q3OUX1jLP7fjeCU2VXK5fIC" 

FirebaseData fbdo;       
FirebaseData stream;  
FirebaseAuth auth;
FirebaseConfig config;
SoftwareSerial uno(D5, D6); 
WiFiManager wm; 

bool isWifiConnected = false; 
bool isFirebaseInitialized = false; 
unsigned long lastHeartbeat = 0;

bool isLearningMode = false; 
String pendingCardName = "Nguoi dung moi"; 
String pendingUserId = ""; 

bool isLockdown = false; 
bool lastLockdownState = false; 

// ==============================================================
// 1. HÀM GHI LOG VÀ ĐẨY LOG OFFLINE
// ==============================================================
void ghiLog(String action, String user) {
  if (isWifiConnected && isFirebaseInitialized) {
    FirebaseJson json;
    json.set("action", action);
    json.set("user", user);
    json.set("timestamp/.sv", "timestamp"); 
    fbdo.clear(); 
    String uniqueLogPath = "/SmartLock/Logs/log_" + String(millis()) + "_" + String(random(1000, 9999));
    Firebase.setJSON(fbdo, uniqueLogPath, json);
  } else {
    // Lưu tạm vào ổ cứng ảo khi rớt mạng
    File f = LittleFS.open("/offline_logs.txt", "a");
    if (f) {
      f.println(action + " (Offline)|" + user); 
      f.close();
    }
  }
}

void dayLogOffline() {
  if (LittleFS.exists("/offline_logs.txt")) {
    File f = LittleFS.open("/offline_logs.txt", "r");
    if (f) {
      while (f.available()) {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() > 0 && line.indexOf('|') != -1) {
          int sep = line.indexOf('|');
          String action = line.substring(0, sep);
          String user = line.substring(sep + 1);
          
          FirebaseJson json;
          json.set("action", action);
          json.set("user", user);
          json.set("timestamp/.sv", "timestamp");
          fbdo.clear();
          Firebase.setJSON(fbdo, "/SmartLock/Logs/log_off_" + String(millis()) + "_" + String(random(100, 999)), json);
          delay(50); 
          yield(); // BẢN VÁ: Nhường nhịp cho CPU xử lý, chống Reset (Watchdog) khi đẩy 100+ logs
        }
      }
      f.close();
      LittleFS.remove("/offline_logs.txt"); 
      ghiLog("HỆ THỐNG", "Đã đồng bộ Log Offline");
    }
  }
}

// ==============================================================
// 2. HÀM QUẢN LÝ BỘ NHỚ CACHE (ĐÃ VÁ LỖI)
// ==============================================================
void dongBoDuLieu() {
  if (!isWifiConnected) return; // Chỉ cần có WiFi là đồng bộ, không chờ Stream
  
  // Tải Danh sách Mật khẩu
  if (Firebase.getJSON(fbdo, "/SmartLock/Passwords")) {
    if (fbdo.dataType() != "null") { // Có dữ liệu
      File f = LittleFS.open("/pass.json", "w");
      if (f) { f.print(fbdo.jsonString()); f.close(); }
    } else {
      LittleFS.remove("/pass.json"); // BẢN VÁ BẢO MẬT: Bị xóa sạch trên Cloud thì xóa sạch trong Cache
    }
  }
  
  // Tải Danh sách Thẻ RFID
  if (Firebase.getJSON(fbdo, "/SmartLock/RFID")) {
    if (fbdo.dataType() != "null") {
      File f = LittleFS.open("/rfid.json", "w");
      if (f) { f.print(fbdo.jsonString()); f.close(); }
    } else {
      LittleFS.remove("/rfid.json");
    }
  }
  
  fbdo.clear();
  Firebase.setBool(fbdo, "/SmartLock/Control/Need_Sync", false);
  ghiLog("HỆ THỐNG", "Đã làm mới Cache Offline");
}

String docCache(String type, String keyToFind) {
  String fileName = (type == "PASS") ? "/pass.json" : "/rfid.json";
  if (!LittleFS.exists(fileName)) return ""; // Tránh lỗi mở file không tồn tại
  
  File f = LittleFS.open(fileName, "r");
  if (!f) return "";
  
  String json = f.readString();
  f.close();
  
  String searchPattern = "\"" + keyToFind + "\":\"";
  int startPos = json.indexOf(searchPattern);
  if (startPos == -1) return "";
  
  startPos += searchPattern.length();
  int endPos = json.indexOf("\"", startPos);
  if (endPos == -1) return "";
  
  return json.substring(startPos, endPos);
}

void setup() {
  Serial.begin(9600); 
  uno.begin(9600);
  uno.setTimeout(30); 
  randomSeed(analogRead(0)); 
  
  LittleFS.begin(); 

  uno.print("\n\nSYS_BOOTING\n");

  wm.setConfigPortalBlocking(false);
  wm.setAPCallback([](WiFiManager *myWiFiManager) {
    uno.print("\nSYS_NO_WIFI\n"); 
  });
  
  wm.autoConnect("SmartLock_Setup", "12345678");
}

void loop() {
  quanLyKetNoi();      
  langNgheMachUno();   
  langNgheWebApp();    
  bomNhipTim();        
}

void quanLyKetNoi() {
  wm.process(); 
  if (WiFi.status() == WL_CONNECTED) {
    if (!isWifiConnected) {
      isWifiConnected = true;
      uno.print("\nSYS_READY\n"); 
    }
    
    if (!isFirebaseInitialized) {
      config.database_url = FIREBASE_HOST;
      config.signer.tokens.legacy_token = FIREBASE_AUTH;
      
      Firebase.begin(&config, &auth);
      Firebase.reconnectWiFi(true); 
      isFirebaseInitialized = true; // Bật cờ sẵn sàng cho các hàm bên dưới
      
      // BẢN VÁ LOGIC: THỰC HIỆN CÁC TÁC VỤ NẶNG TRƯỚC KHI MỞ STREAM
      dongBoDuLieu();  
      dayLogOffline(); 
      
      fbdo.clear();
      if (Firebase.getBool(fbdo, "/SmartLock/Control/Lockdown")) {
        isLockdown = fbdo.boolData();
        lastLockdownState = isLockdown; 
      }

      // MỞ STREAM SAU CÙNG: Để độc chiếm SSL RAM
      Firebase.beginStream(stream, "/SmartLock/Control");
      ghiLog("Hệ thống khởi động", "Wemos D1 Mini"); 
    }
  } else {
    if (isWifiConnected) {
      isWifiConnected = false;
      isFirebaseInitialized = false;
      uno.print("\nSYS_NO_WIFI\n"); 
    }
  }
}

void langNgheMachUno() {
  if (uno.available()) {
    String data = uno.readStringUntil('\n'); 
    if (data.length() < 2) return; 
    
    if (data.indexOf("RESET_WIFI") != -1) {
      ghiLog("Cảnh báo", "Xóa cấu hình Wi-Fi");
      wm.resetSettings(); 
      LittleFS.format(); 
      ESP.restart();      
    }
    else if (data.indexOf("PING_WEMOS") != -1) {
       delay(5); 
       if (isWifiConnected) uno.print("\nSYS_READY\n"); 
       else uno.print("\nSYS_NO_WIFI\n"); 
    }
    else if (data.indexOf("DOOR_OPENED") != -1) {
       ghiLog("Mở bằng nút bấm", "Người trong nhà"); 
    }
    else if (data.indexOf("PASS:") != -1) {
      if (isLockdown) { 
         uno.print("\nLOCKDOWN\n");
         ghiLog("Cảnh báo Đột nhập", "Nhập mã khi Đang Khóa");
      } else {
         int pos = data.indexOf("PASS:");
         String pass = data.substring(pos + 5); pass.trim(); 
         
         String userName = docCache("PASS", pass);
         if (userName != "") {
           uno.print("\nOPEN_DOOR:" + userName + "\n"); 
           ghiLog("Mở bằng Mật khẩu", userName);
         } else {
           uno.print("\nWRONG_PASS\n"); 
           ghiLog("Cảnh báo: Sai Pass", "Khách lạ");
         }
      }
    }
    else if (data.indexOf("UID:") != -1) {
      if (isLockdown) { 
         uno.print("\nLOCKDOWN\n");
         ghiLog("Cảnh báo Đột nhập", "Quẹt thẻ khi Đang Khóa");
      } else {
         int pos = data.indexOf("UID:");
         String uid = data.substring(pos + 4); uid.trim();
         
         if (isLearningMode && isWifiConnected) { 
           String ownerName = docCache("RFID", uid); 
           if (ownerName != "") {
               uno.print("\nCARD_EXISTS\n"); 
               ghiLog("Cảnh báo An ninh", "Cố gắng thêm thẻ bị trùng của: " + ownerName);
               isLearningMode = false; 
               fbdo.clear();
               Firebase.setBool(fbdo, "/SmartLock/Control/Add_Card_Mode", false);
           } else {
               fbdo.clear();
               Firebase.setString(fbdo, "/SmartLock/RFID/" + uid, pendingCardName);
               fbdo.clear();
               Firebase.setString(fbdo, "/SmartLock/Users/" + pendingUserId + "/card", uid);
               
               uno.print("\nADD_SUCCESS\n"); 
               ghiLog("Thêm thẻ mới", pendingCardName);
               
               isLearningMode = false; 
               fbdo.clear();
               Firebase.setBool(fbdo, "/SmartLock/Control/Add_Card_Mode", false);
               dongBoDuLieu(); 
           }
         } else {
           String userName = docCache("RFID", uid);
           if (userName != "") {
             uno.print("\nOPEN_DOOR:" + userName + "\n"); 
             ghiLog("Mở bằng Thẻ từ", userName);
           } else {
             uno.print("\nWRONG_CARD\n"); 
             ghiLog("Cảnh báo: Sai Thẻ", "Khách lạ");
           }
         }
      }
    }
  }
}

void langNgheWebApp() {
  if (isWifiConnected && isFirebaseInitialized) {
    if (Firebase.readStream(stream)) {
      if (stream.eventType() == "put" || stream.eventType() == "patch") {
        String path = stream.dataPath(); 
        
        if (path == "/Need_Sync" && stream.dataType() == "boolean" && stream.boolData() == true) {
            dongBoDuLieu();
        }
        else if (path == "/Lockdown") {
           if (stream.dataType() == "boolean") {
             isLockdown = stream.boolData();
             if (isLockdown != lastLockdownState) {
               lastLockdownState = isLockdown;
               if (isLockdown) ghiLog("HỆ THỐNG", "BẬT chế độ Khóa khẩn cấp");
               else ghiLog("HỆ THỐNG", "TẮT chế độ Khóa khẩn cấp");
             }
           }
        }
        else if (path == "/Remote_Open" && stream.dataType() == "boolean" && stream.boolData() == true) {
          uno.print("\nOPEN_DOOR:Admin\n"); 
          ghiLog("Mở cửa qua Web", "Admin (Remote)");
          fbdo.clear();
          Firebase.setBool(fbdo, "/SmartLock/Control/Remote_Open", false); 
        }
        else if (path == "/Restart" && stream.dataType() == "boolean" && stream.boolData() == true) {
          uno.print("\nRESTART_SYS\n"); // Hét sang Uno bảo nó khởi động lại
          ghiLog("HỆ THỐNG", "Khởi động lại từ xa");
          fbdo.clear();
          Firebase.setBool(fbdo, "/SmartLock/Control/Restart", false); // Tắt cờ trên Firebase
          
          delay(1000); // Chờ 1 giây để Uno kịp nghe lệnh
          ESP.restart(); // Wemos kích hoạt lệnh tự khởi động lại phần cứng!
        }
        else if (path == "/Add_Card_Mode" && stream.dataType() == "boolean") {
          if (stream.boolData() == true) {
            if (!isLearningMode) { 
              isLearningMode = true;
              fbdo.clear();
              if (Firebase.getString(fbdo, "/SmartLock/Control/Target_Name")) pendingCardName = fbdo.stringData();
              fbdo.clear();
              if (Firebase.getString(fbdo, "/SmartLock/Control/Target_User")) pendingUserId = fbdo.stringData();
              uno.print("\nLEARN_MODE\n");
            }
          } else {
            if (isLearningMode) {
              isLearningMode = false;
              uno.print("\nCANCEL_LEARN\n"); 
              ghiLog("HỆ THỐNG", "Hủy chế độ thêm thẻ");
            }
          }
        }
      }
    }
  }
}

void bomNhipTim() {
  if (isWifiConnected && isFirebaseInitialized) {
    if (millis() - lastHeartbeat > 15000) {
      lastHeartbeat = millis();
      fbdo.clear();
      Firebase.setTimestamp(fbdo, "/SmartLock/System/Last_Beat");
    }
  }
}