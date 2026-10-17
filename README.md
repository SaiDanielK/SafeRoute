# SafeRoute 🛡️

### AI-Powered Safety Navigation for Safer Journeys

**SafeRoute** is a student-built mobile application designed to help people make safer travel decisions. Instead of focusing only on the fastest route, SafeRoute aims to prioritize personal safety by considering potential hazards, route conditions, community reports, and other available safety information.

Built as a Congressional App Challenge project, SafeRoute combines navigation, safety awareness, AI-assisted explanations, and emergency tools in one mobile experience.

> **Project goal:** Help people make more informed decisions about the routes they take when walking, biking, or driving.

---

## 📱 About the Project

Traditional navigation applications primarily emphasize travel time, distance, and traffic. SafeRoute explores a different approach: making safety a central part of the navigation experience.

The application is designed to help students, pedestrians, cyclists, and other travelers understand potential risks along their routes and access useful safety tools during a journey.

## ✨ Features

### 🗺️ Safety-Focused Navigation
- Walking, cycling, and driving route modes.
- Multiple route options when supported by the routing service.
- Route safety scores to help compare available routes.
- Route distance and estimated travel time.
- Current-location support and map-based navigation.
- Voice-guided directions and off-route detection.
- Rerouting support where available.

### 🚦 Route Safety Analysis
- Safety scores and explanations for route comparisons.
- Community-reported hazards and dangerous areas.
- Hazard severity and recency considerations.
- Route scoring that considers nearby reported hazards.
- Information to help users compare safety and convenience.

### 🌦️ Safety Alerts
- Severe weather information through the National Weather Service.
- Community hazard information.
- AMBER Alert information where available.
- Safety-related notification features.

### 🤖 AI-Powered Assistance
- AI-assisted explanations and safety-related questions.
- Context-aware responses using available weather and alert information.
- Gemini-powered AI integration.

### 🚨 Emergency and Personal Safety Tools
- Emergency-related tools and safety information.
- Trusted contacts.
- Trip-sharing functionality.
- Saved destinations.
- Completed-trip history.

### 👤 User Accounts and Data
- Guest authentication.
- Email-based authentication.
- Firebase-backed trip history and community reports.
- Profile settings and safety preferences.

**Note:** Feature availability depends on device permissions, connectivity, service availability, and the build being used. Some features may behave differently across Android and iOS.

---

## 🛠️ Technology Stack

SafeRoute uses a combination of mobile development frameworks, mapping services, cloud services, and external data sources.

| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile application |
| Expo | Development and application builds |
| Expo Router | File-based navigation |
| TypeScript | Application logic and type safety |
| OpenRouteService | Route directions |
| TomTom | Traffic information |
| Firebase Authentication | User authentication |
| Cloud Firestore | Trip history, community reports, and trusted-contact data |
| Google Gemini API | AI-assisted explanations |
| National Weather Service | Severe weather information |
| AMBER Alert information sources | Alert awareness |

The project is designed to use these services without requiring a paid Google Maps API integration. Individual services may have their own quotas, terms, or usage limits.

---

## 📂 Project Structure

The application uses Expo Router and a TypeScript-based source structure.

```text
SafeRoute/
├── src/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx
│   │   │   ├── safety.tsx
│   │   │   ├── trips.tsx
│   │   │   ├── emergency.tsx
│   │   │   └── profile.tsx
│   │   ├── ai.tsx
│   │   ├── auth.tsx
│   │   ├── map.tsx
│   │   └── report.tsx
│   └── firebase/
│       ├── firebaseConfig.ts
│       └── auth.ts
├── assets/
├── .env.example
├── .gitignore
├── app.json
├── eas.json
├── package.json
└── README.md
```

*The exact files and directories may vary between development versions.*

---

## 🚀 Getting Started

### Prerequisites

Before running the source code, install:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Expo Go](https://expo.dev/go) or a compatible development build
- A code editor, such as [Visual Studio Code](https://code.visualstudio.com/)

### 1. Clone the repository

```bash
git clone https://github.com/SaiDanielK/SafeRoute.git
cd SafeRoute
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root using `.env.example` as a template.

Add the API keys and configuration values required by the services you want to use:

```dotenv
EXPO_PUBLIC_ORS_API_KEY=
EXPO_PUBLIC_TOMTOM_API_KEY=
EXPO_PUBLIC_GEMINI_API_KEY=
```

Configure Firebase using the project's Firebase configuration files and the appropriate Firebase project settings.

**Important:** Never commit your real `.env` file, private credentials, service-account keys, or other secrets to GitHub. Review `.gitignore` before committing.

Variables prefixed with `EXPO_PUBLIC_` are included in client-side application code and should not be considered secret. Restrict API keys where supported, monitor usage, and never put privileged server credentials in the mobile app.

### 4. Start the development server

```bash
npx expo start
```

Follow the Expo CLI instructions to open the application on a compatible device or development environment.

**Compatibility note:** The primary source project uses Expo SDK 58. The Android APK distributed with the initial test release was built from a separate SDK 51 backup. Expo Go must support the SDK used by the project; an APK installed directly on Android does not require Expo Go.

---

## 📦 Android APK

An Android test build has been produced using Expo Application Services (EAS Build).

- **Platform:** Android
- **Application version:** 1.0.0
- **Build profile:** `saferoute-apk`
- **Expo SDK:** 51.0.0
- **Distribution:** Internal testing

Download the APK from the repository's **GitHub Releases** section.

To install it on a compatible Android device:

1. Download the `.apk` file from the release.
2. Open the downloaded file on your Android device.
3. Follow Android's installation prompts.
4. Open SafeRoute and grant the permissions needed for the features you want to test.

Android may require permission to install applications from the browser or file manager you used to download the APK.

The SDK 51 APK is a separate compatibility build and does not represent the SDK version of the main source project. Its features should be tested on the target device before relying on them.

### iOS Availability

An Android APK cannot be installed on an iPhone. An iOS build must be created and distributed separately using an appropriate Apple signing and distribution method, such as TestFlight.

---

## 🔐 Privacy and Safety

SafeRoute may use location information to provide navigation and safety-related functionality. Location permissions should be granted only when appropriate for the features being used.

- Review app permissions before use.
- Protect API keys and Firebase configuration.
- Avoid publishing personal information in community reports.
- Use trusted contacts responsibly.
- Review the privacy policies and terms of any integrated third-party services.

SafeRoute is a student project and is not a substitute for emergency services, official public safety instructions, or personal judgment.

**If you are in immediate danger, contact the appropriate emergency services.**

---

## ⚠️ Limitations and Disclaimer

SafeRoute is intended as a safety-awareness and navigation assistance tool.

- Safety scores are estimates based on the information available to the application; they do not guarantee that a route is safe.
- Community reports may be incomplete, outdated, inaccurate, or unverified.
- Weather and alert data may be delayed or unavailable.
- Routing, traffic, AI, notifications, and location features depend on third-party services, permissions, connectivity, and device compatibility.
- AI-generated information may be incorrect and should be independently verified when safety is at stake.
- A route with a higher safety score is not necessarily risk-free.
- Do not interact with the application while driving or in a situation where doing so could put you at risk.

Use your judgment, follow official guidance, and choose routes appropriate to your circumstances.

---

## 🧪 Project Status

SafeRoute has reached a completed project milestone, with additional packaging and device-compatibility testing ongoing.

The repository includes the main development project, while separately built releases may use different Expo SDK versions for compatibility testing.

Bug reports, reproducible issues, and constructive feedback are welcome.

---

## 🤝 Contributions and Feedback

If you would like to contribute:

1. Fork the repository.
2. Create a branch for your changes.
3. Make and test your changes.
4. Submit a pull request describing the improvements.

Please do not commit API keys, private credentials, personal location data, or other sensitive information.

---

## 📄 License

SafeRoute is intended to be distributed under the **MIT License** if the repository owner chooses to make the project available under those terms.

See the [`LICENSE`](LICENSE) file in the repository for the actual license terms.

Copyright (c) 2026 SafeRoute project contributors.

---

**Built to explore how technology can help people make safer travel decisions.** 🛡️
