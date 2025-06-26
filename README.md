# ChowTime
Automatic Pet Feeder Using IoT

ChowTime is an IoT-powered automatic pet feeder designed to help busy or away-from-home pet owners feed their pets on schedule. Built using the **ESP32-CAM**, this device dispenses food at set intervals, allows remote manual feeding via a mobile app, and streams a live view of the food bowl using a built-in camera.

Components
 - ESP32-CAM
 - Servo Motor
 - Jumper Wires
 - 5V Micro USB Charger

The mobile app (built using React Native) allows users to:

- Select portion size
- Set scheduled feed times
- Toggle flashlight
- View camera stream
- Manually trigger feeding

How to Set Up the Project:

Clone this repository:
git clone https://github.com/YOUR_USERNAME/ChowTime.git

Install mobile app dependencies:
cd app
npm install

Firebase Setup:

Go to firebase.google.com and create a new project.

Enable Realtime Database and set the security rules as needed.

Go to Project Settings > Service Accounts.

Click "Generate new private key" and download the JSON file.

Save it in a folder called 'secrets' as:
secrets/firebase-service-account.json

Create a .env file in the root of the project with this content:
GOOGLE_APPLICATION_CREDENTIALS=secrets/firebase-service-account.json

Important: Do not share or commit the secrets or .env file.

Running the Mobile App:

Install the Expo Go app on your smartphone.

In the 'app' folder, run:
npx expo start

Scan the QR code using Expo Go to open the app on your device.

Uploading Code to the ESP32-CAM:

Open the Arduino IDE.

Install the ESP32 board package.

Open the code in the Arduino/ folder.

Replace the Wi-Fi credentials and Firebase URLs with your own.

Select the board 'AI Thinker ESP32-CAM' and upload the code using a USB-to-TTL adapter.




Contributors:

 - Athena Villarin
 - Shane Canabo
 - Carl John Coopera
