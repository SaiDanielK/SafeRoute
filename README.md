# SafeRoute 🛡️

**AI-powered safety navigation for safer everyday journeys.**

SafeRoute is a student-built mobile app designed to help pedestrians and cyclists make more informed travel decisions. It prioritizes route safety information alongside travel time and distance.

## Features

- Walking, cycling, and driving route options
- Route safety scores and safety-focused route comparisons
- Current-location safety information
- Community hazard reports
- Weather alerts and AMBER Alert information
- AI-powered safety explanations
- Emergency tools and trusted contacts
- Trip history and saved destinations
- Voice-guided navigation features

Feature availability depends on device permissions, network connectivity, API configuration, and platform compatibility.

## Download SafeRoute

Open the **Releases** section of this GitHub repository and download the latest available Android APK.

### Install on Android

1. Download the SafeRoute `.apk` file from Releases.
2. Open the downloaded file on your Android device.
3. If Android asks, allow installation from that source in your device settings.
4. Return to the installer and tap Install.
5. Open SafeRoute and grant the permissions you want to use, such as location.
6. Test navigation and other features before relying on them.

Only install APKs from a source you trust. Android may display a security warning because the app was installed outside Google Play.

An APK is for compatible Android devices. It is not an iOS installer.

## Important compatibility disclaimer

SafeRoute currently uses Expo SDK 58.

Expo SDK 58 was officially announced on October 15, 2026. At the time of this project's release, the SDK 58 versions of Expo Go for the Google Play Store and Apple App Store were expected to become available in the following weeks. Availability may change; consult the official Expo documentation for the latest status.

Official references:
- https://expo.dev/changelog/sdk-58
- https://docs.expo.dev/versions/v58.0.0/

### Android maps and notifications

SafeRoute has known compatibility limitations with Android maps and notifications in certain Expo Go and older SDK 52–53 development environments.

- Android map rendering may not work correctly in some development environments.
- Remote push notifications are not supported in Expo Go on Android from SDK 53 onward; a compatible development build or standalone app is required for push notification functionality.
- A standalone APK does not guarantee that every feature will work. Device permissions, native dependencies, API credentials, and service availability also matter.
- Some notifications may require valid credentials and additional configuration.
- Maps and safety information depend on network connectivity and their respective data providers.

These limitations do not mean that all Android devices or all builds using those SDK versions will fail. Compatibility depends on the exact configuration and build.

## Can I downgrade Expo SDK?

Developers may experiment with an older SDK, but downgrading is not a guaranteed fix for maps or notifications.

**Important:** Users cannot downgrade the Expo SDK simply by changing a setting inside an installed APK. SDK downgrades require a developer to modify the source project's dependencies and generate a new compatible build.

If you are a developer who wants to experiment with SDK 53:

1. Clone or download the source code.
2. Create a separate Git branch for compatibility experiments.
3. Review the Expo SDK 53 migration guide and supported package versions.
4. Change the Expo dependency and align compatible Expo packages.
5. Review native modules and configuration plugins.
6. Build and test the application on a physical Android device.
7. Verify maps, location permissions, notifications, and navigation independently.

Do not assume the existing SDK 58 project can be downgraded without code or dependency changes. SDK 52 and SDK 53 also have different compatibility requirements.

Official upgrade guidance:
https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/

## Run from source

### Requirements

- Node.js compatible with the selected Expo SDK
- npm
- Git
- Expo Go compatible with the project SDK, or an appropriate development build
- API credentials for features that require them

### Installation

Clone this repository and open its directory:

```bash
git clone YOUR_REPOSITORY_URL
cd SafeRoute
npm install
```

Configure the environment variables required by the project. Use `.env.example` as a template if provided. Never publish private credentials or service-account keys.

Start the Expo development server:

```bash
npx expo start
```

Follow the terminal instructions to open the project on a supported device or development build.

Expo Go support depends on the SDK version and the native modules used by the project. Use a compatible build if Expo Go cannot run the project.

## Safety disclaimer

SafeRoute is an informational navigation aid and is not a guarantee of personal safety.

Safety scores, community reports, weather information, route suggestions, and AI-generated explanations may be incomplete, delayed, inaccurate, or unavailable. A route marked safer is not necessarily safe.

Always remain aware of your surroundings, obey local laws, and use your judgment. In an emergency, contact local emergency services. Do not rely solely on SafeRoute for emergency response or life-critical decisions.

Location-based features require appropriate permissions. Review the app's behavior and privacy implications before sharing location information with trusted contacts.

## Project status

SafeRoute is a student-built project developed for the Congressional App Challenge.

This repository is provided for educational, demonstration, and evaluation purposes. Platform support and feature availability may change as dependencies and services evolve.

## License

Choose and add a license before granting others permission to reuse, modify, or distribute this project.