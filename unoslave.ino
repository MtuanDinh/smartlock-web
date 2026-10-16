#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_NeoPixel.h>
#include <SoftwareSerial.h>

void(* resetFunc) (void) = 0;

#define RST_PIN 9
#define SS_PIN 10
#define BUZZER_PIN 8
#define RELAY_PIN 7
#define LED_PIN 6
#define KEYPAD_PIN A0
#define BUTTON_PIN 4

SoftwareSerial wemos(2, 3);

#define NUMPIXELS 12
Adafruit_NeoPixel pixels(NUMPIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);
MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

String inputPassword = "";

const int keyValues[16] = { 1011, 990, 969, 948, 924, 905, 888, 871, 849, 834, 819, 805, 786, 773, 761, 749 };
const char keyChars[16] = { '1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D' };

char xacDinhPhim(int v) {
  int minDiff = 1024;
  char closestKey = '\0';
  for (int i = 0; i < 16; i++) {
    int diff = abs(v - keyValues[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closestKey = keyChars[i];
    }
  }
  return (minDiff <= 25) ? closestKey : '\0';
}

char getAnalogKey() {
  if (analogRead(KEYPAD_PIN) > 500) {
    delay(20);
    long tong = 0;
    for (int i = 0; i < 10; i++) {
      tong += analogRead(KEYPAD_PIN);
      delay(2);
    }
    char key = xacDinhPhim(tong / 10);
    while (analogRead(KEYPAD_PIN) > 500) { delay(10); }
    delay(30);
    return key;
  }
  return '\0';
}

void setLEDColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < NUMPIXELS; i++) { pixels.setPixelColor(i, pixels.Color(r, g, b)); }
  pixels.show();
}
void amThanhBamPhim() {
  tone(BUZZER_PIN, 2000, 25);
}
void nhacKhoiDong() {
  int nots[] = { 1046, 1318, 1568, 2093 };
  for (int i = 0; i < 4; i++) {
    tone(BUZZER_PIN, nots[i], 80);
    delay(100);
  }
}
void nhacMoCua() {
  int nots[] = { 1318, 1568, 2093, 2637 };
  for (int i = 0; i < 4; i++) {
    tone(BUZZER_PIN, nots[i], 120);
    delay(140);
  }
}

bool dangTraCuu = false;
unsigned long thoiGianBatDauTraCuu = 0;
unsigned long lanPingCuoi = 0;

unsigned long thoiGianNhanTinHieu = 0;
int trangThaiIoT = 3;  

void thayDoiTrangThaiIoT(int trangThaiMoi) {
  if (trangThaiIoT == trangThaiMoi) return; 

  trangThaiIoT = trangThaiMoi;

  if (trangThaiIoT == 0) {  
    hienThiManHinhCho();
  } else if (trangThaiIoT == 1) {                                         
    hienThiLoiHeThong("Loi phan cung!", "Lien he Admin...", 255, 0, 0);    
  } else if (trangThaiIoT == 2) {                                           
    // BẢN VÁ: Rớt mạng nhưng vẫn mời quẹt thẻ (màu đèn Cam)
    hienThiManHinhCho();  
  } else if (trangThaiIoT == 3) {                                           
    hienThiLoiHeThong("Khoi dong lai...", "Vui long doi...", 255, 200, 0);  
  }
}

void setup() {
  Serial.begin(9600);
  wemos.begin(9600);
  wemos.setTimeout(30);  

  SPI.begin();
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  pixels.begin();
  pixels.setBrightness(40);
  setLEDColor(0, 0, 0);
  rfid.PCD_Reset();
  delay(50);
  rfid.PCD_Init();
  Wire.begin();
  lcd.init();
  lcd.backlight();

  wemos.print("\n\n");
  delay(50);
  while (wemos.available()) wemos.read();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Khoi dong khoa..");
  lcd.setCursor(0, 1);
  lcd.print("Xin vui long doi");
  
  bool isReady = false;
  unsigned long lastPingTime = 0;
  unsigned long lastLedUpdate = 0;
  int pixelIdx = 0;
  long colorHue = 0;
  thoiGianNhanTinHieu = millis();

  while (!isReady) {
    if (millis() - lastPingTime > 1500) {
      wemos.print("\nPING_WEMOS\n");
      lastPingTime = millis();
    }

    if (millis() - lastPingTime > 800) {
      if (millis() - lastLedUpdate > 80) {
        lastLedUpdate = millis();
        pixels.clear();
        for (int i = 0; i < 4; i++) {
          int p = (pixelIdx - i + NUMPIXELS) % NUMPIXELS;
          pixels.setPixelColor(p, pixels.ColorHSV(colorHue, 255, 255 / (i + 1)));
        }
        pixels.show();
        pixelIdx = (pixelIdx + 1) % NUMPIXELS;
        colorHue += 2500;
        if (colorHue >= 65536) colorHue = 0;
      }
    }

    if (wemos.available()) {
      String cmd = wemos.readStringUntil('\n');
      if (cmd.length() > 2) thoiGianNhanTinHieu = millis(); 

      if (cmd.indexOf("SYS_READY") != -1) {
        isReady = true;
        trangThaiIoT = 0;  
      } else if (cmd.indexOf("SYS_NO_WIFI") != -1) {
        isReady = true;
        trangThaiIoT = 2;  
      }
    }

    if (millis() - thoiGianNhanTinHieu > 20000) {
      isReady = true;
      trangThaiIoT = 1;
    }
  }

  if (trangThaiIoT == 0) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Ket noi mang OK!");
    lcd.setCursor(0, 1);
    lcd.print("Khoa san sang!");
    setLEDColor(0, 255, 0);
    delay(1500);
    hienThiManHinhCho();
  } else {
    int trangThaiLuu = trangThaiIoT;
    trangThaiIoT = -1;  
    thayDoiTrangThaiIoT(trangThaiLuu);
  }
  nhacKhoiDong();
  thoiGianNhanTinHieu = millis();  
}

void loop() {
  if (!dangTraCuu) {
    if (millis() - lanPingCuoi > 3000) {
      wemos.print("\nPING_WEMOS\n");
      lanPingCuoi = millis();
    }
    if (millis() - thoiGianNhanTinHieu > 15000) {
      thayDoiTrangThaiIoT(1);
    }
  }

  if (wemos.available()) {
    String cmd = wemos.readStringUntil('\n');

    if (cmd.indexOf("SYS_READY") != -1) {
      thoiGianNhanTinHieu = millis();
      thayDoiTrangThaiIoT(0);
    } else if (cmd.indexOf("SYS_NO_WIFI") != -1) {
      thoiGianNhanTinHieu = millis();
      thayDoiTrangThaiIoT(2);
    } else if (cmd.indexOf("SYS_BOOTING") != -1) {
      thoiGianNhanTinHieu = millis();
      thayDoiTrangThaiIoT(3);
    }
    else if (cmd.indexOf("LOCKDOWN") != -1) {
      baoLoiGiaoDich("HE THONG KHOA!", "Lien he Admin..");
      hienThiManHinhCho();
      dangTraCuu = false;
    } 
    else if (cmd.indexOf("OPEN_DOOR") != -1) {
      String userName = "Khach"; 
      if (cmd.indexOf(":") != -1) {
        userName = cmd.substring(cmd.indexOf(":") + 1);
        userName.trim();
      }
      moCua("Xin chao:", userName); 
      hienThiManHinhCho();
      dangTraCuu = false;
    } 
    else if (cmd.indexOf("WRONG_PASS") != -1) {
      baoLoiGiaoDich("Sai mat khau!", "Vui long thu lai");
      hienThiManHinhCho();
      dangTraCuu = false;
    } else if (cmd.indexOf("WRONG_CARD") != -1) {
      baoLoiGiaoDich("The khong hop le", "Tu choi truy cap");
      hienThiManHinhCho();
      dangTraCuu = false;
    } else if (cmd.indexOf("LEARN_MODE") != -1) {
      setLEDColor(0, 0, 255);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("CHE DO THEM THE:");
      lcd.setCursor(0, 1);
      lcd.print("Moi quet the...");
    } 
    else if (cmd.indexOf("CARD_EXISTS") != -1) {
      baoLoiGiaoDich("THE DA BI TRUNG!", "Vui long doi the");
      hienThiManHinhCho();
      dangTraCuu = false; 
    }
    else if (cmd.indexOf("CANCEL_LEARN") != -1) {
      hienThiManHinhCho();
      dangTraCuu = false; 
    }
    else if (cmd.indexOf("ADD_SUCCESS") != -1) {
      setLEDColor(0, 255, 0);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("DA LUU THE MOI!");
      lcd.setCursor(0, 1);
      lcd.print("Thanh cong!");
      nhacKhoiDong();
      delay(2000);
      hienThiManHinhCho();
      dangTraCuu = false;
    }
    else if (cmd.indexOf("RESTART_SYS") != -1) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Dang Reset...");
      lcd.setCursor(0, 1);
      lcd.print("Vui long doi!");
      setLEDColor(255, 200, 0); // Đèn vàng báo reset
      
      delay(1500); // Hiển thị chữ cho người dùng đọc kịp
      resetFunc(); // KÍCH HOẠT RESET UNO NGAY LẬP TỨC!
    }
  }

  if (dangTraCuu && (millis() - thoiGianBatDauTraCuu > 5000)) {
    baoLoiGiaoDich("Mat ket noi!", "Vui long thu lai"); 
    hienThiManHinhCho();
    dangTraCuu = false;
    inputPassword = "";
  }

  // ==============================================================
  // BẢN VÁ TƯỜNG LỬA CHUẨN: CHỈ CHẶN KHI CHẾT WEMOS HOẶC BOOTING
  // ==============================================================
  if (dangTraCuu || trangThaiIoT == 1 || trangThaiIoT == 3) return;

  if (digitalRead(BUTTON_PIN) == LOW) {
    tone(BUZZER_PIN, 2000, 50);
    moCua("Mo bang nut bam", "Xin moi vao!"); 
    wemos.print("\nDOOR_OPENED\n");
    while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
    hienThiManHinhCho();
  }

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    tone(BUZZER_PIN, 1500, 100);
    String uidString = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      uidString += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
      uidString += String(rfid.uid.uidByte[i], HEX);
    }
    uidString.toUpperCase();
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    hienThiDangXuLy();
    wemos.print("\nUID:" + uidString + "\n");
    dangTraCuu = true;
    thoiGianBatDauTraCuu = millis();
  }

  char key = getAnalogKey();
  if (key != '\0') {
    amThanhBamPhim();
    if (key == '#') {
      if (inputPassword == "BABABC") {
        hienThiDangXuLy();
        lcd.clear();
        lcd.print("Xoa thiet lap...");
        lcd.setCursor(0, 1);
        lcd.print("Mang Wi-Fi...");
        wemos.print("\nRESET_WIFI\n");
        inputPassword = "";
        delay(2000);
        hienThiManHinhCho();
      } 
      else if (inputPassword == "999999") { 
        moCua("Xin chao:", "Admin (Master)");
        wemos.print("\nDOOR_OPENED\n"); 
        inputPassword = "";
        hienThiManHinhCho();
      } 
      else if (inputPassword.length() > 0) {
        hienThiDangXuLy();
        wemos.print("\nPASS:" + inputPassword + "\n");
        inputPassword = "";
        dangTraCuu = true;
        thoiGianBatDauTraCuu = millis();
      }
    } else if (key == '*') {
      inputPassword = "";
      hienThiManHinhCho();
    } else if ((key >= '0' && key <= '9') || (key >= 'A' && key <= 'D')) {
      if (inputPassword.length() < 6) {
        inputPassword += key;
        delay(10);
        lcd.setCursor(0, 1);
        lcd.print("Pass:           ");
        lcd.setCursor(6, 1);
        for (int i = 0; i < inputPassword.length(); i++) { lcd.print("*"); }
      }
    }
  }
}

// ==============================================================
// GIAO DIỆN CHỜ: PHÂN BIỆT MÀU SẮC ONLINE / OFFLINE CACHE
// ==============================================================
void hienThiManHinhCho() {
  if (trangThaiIoT == 2) {
    setLEDColor(255, 100, 0); // Vàng cam báo Offline Cache
  } else {
    setLEDColor(0, 0, 50);    // Xanh dương nhạt báo Online
  }
  
  lcd.clear();
  lcd.setCursor(0, 0);
  if (trangThaiIoT == 2) lcd.print("Offline Mode..."); // Báo khách biết đang Offline nhưng vẫn quẹt được
  else lcd.print("Nhap Pass / The:");
  
  if (inputPassword.length() > 0) {
    lcd.setCursor(0, 1);
    lcd.print("Pass:           ");
    lcd.setCursor(6, 1);
    for (int i = 0; i < inputPassword.length(); i++) { lcd.print("*"); }
  } else if (trangThaiIoT == 2) {
    lcd.setCursor(0, 1);
    lcd.print("Nhap Pass / The:");
  }
}

void hienThiDangXuLy() {
  setLEDColor(200, 100, 0);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Xin vui long doi"); 
  lcd.setCursor(0, 1);
  lcd.print("Dang xu ly...");   
}

void baoLoiGiaoDich(String msg1, String msg2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(msg1);
  lcd.setCursor(0, 1);
  lcd.print(msg2);
  setLEDColor(255, 0, 0);
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 600, 100);
    delay(120);
    tone(BUZZER_PIN, 400, 100);
    delay(120);
  }
  delay(1000);
}

void hienThiLoiHeThong(String msg1, String msg2, uint8_t r, uint8_t g, uint8_t b) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(msg1);
  lcd.setCursor(0, 1);
  lcd.print(msg2);
  setLEDColor(r, g, b);
  tone(BUZZER_PIN, 400, 800);
}

void moCua(String msg1, String msg2) {
  setLEDColor(0, 255, 0);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(msg1); 
  lcd.setCursor(0, 1);
  if(msg2.length() > 16) msg2 = msg2.substring(0, 16); 
  lcd.print(msg2); 
  
  nhacMoCua();
  digitalWrite(RELAY_PIN, HIGH);
  delay(3000);
  digitalWrite(RELAY_PIN, LOW);
  delay(500);

  SPI.begin();          // Kích hoạt lại bus SPI
  rfid.PCD_Reset();     // Reset cứng module RFID
  delay(20);
  rfid.PCD_Init(); // Thiết lập lại cấu hình thanh ghi cho RC522
  lcd.init();           // Khởi tạo lại LCD phòng trường hợp nhiễu làm mờ chữ
  lcd.backlight();
}