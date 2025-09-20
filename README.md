# LiveShield

**LiveShield** is a mobile application built with **React Native** and **Supabase** that empowers individuals to prepare for and respond to emergencies through learning, gamification, and quick-access safety tools.

It combines **educational quizzes, resource hubs, multilingual support, badges & achievements, and an emergency siren overlay** into one cohesive platform.

---

## ✨ Features

- **Quizzes & Learning**
  - Daily and topic-based quizzes
  - Explanations and answer reviews
  - Streaks and XP rewards for consistent learning

- **Gamification**
  - Badge system (first-step, quiz explorer, streak levels, etc.)
  - XP tracking and progress history

- **Resource Hub**
  - Curated first-aid and disaster-response guides
  - Interactive resource articles with quick steps & detailed sections
  - Rich media: images, news links, references

- **Emergency Tools**
  - **Emergency Siren** screen: siren + vibration + flashlight strobe (native) or screen alert (web)
  - Global 5-tap quick activation at any point in the app
  - Region detection and live condition indicators

- **Multilingual Interface**
  - English (en), Simplified Chinese (zh), Malay (ms), Tamil (ta)
  - Easily extensible with `translations/<lang>` files

- **Data & Storage**
  - Supabase for profiles, quiz results, badges
  - AsyncStorage for preferences & tutorial state
  - External APIs (NEA: rainfall, PM2.5, wind, humidity, temperature)
  - Bundled snapshot via `assets/env_snapshot.json`

---

## 🏗 Architecture

**Data Tier**
- Supabase tables: `profiles`, `quiz_results`, `user_disaster_badges`
- Local: AsyncStorage (preferences, flags)
- Static JSON: quizzes, checklists, translations
- External APIs: NEA endpoints for environment data
- Scripted snapshot: `scripts/snapshot.js` → `assets/env_snapshot.json`

**Logic Tier**
- Containers: orchestrate data + actions (e.g., `QuizGameContainer`, `InteractiveMapModalContainer`, `SettingsContainer`, `CertificatesContainer`)
- Services: `supabase.js`, env fetchers, badge/quiz utilities
- Caching: in-memory TTL + de-dup for network requests

**UI / Presentation Tier**
- Screens: Quizzes, Quiz Game, Quiz Set, History, Result Summary
- Resource Hub & Article, Home (dashboard), Settings, Certificates, Siren
- Components: cards, modals, progress bars, map views, lists

---

## 📂 Project Structure (simplified)

---

## 🚀 Run Locally

> **⚠️ SDK Version Notice:**  
> This project was built and tested using **Expo SDK 52**.  
> For best compatibility, please run the app using the Expo Go client for SDK 52:  
> [https://expo.dev/go?sdkVersion=52&platform=android&device=true](https://expo.dev/go?sdkVersion=52&platform=android&device=true)

To run **LiveShield** on your local machine using VS Code or any terminal:

Download the project (from Git, Snack or ZIP).

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

This project requires a .env file for Supabase and API keys. For testing/demo purposes, please refer to **Appendix B: Source Code and Demo Access** of the accompanying report, where a sample .env is provided.

### 3. Start the Development Server

```bash
npm start
```

This will launch the Expo Developer Tools in your browser.  
From here, you can run the app on:

- Android Emulator
- iOS Simulator
- Physical device via Expo Go app: Scan the QR with the Expo Go (v52) app to launch on your phone.

### 4. Run Tests

```bash
npm test
```

---

## 🧪 Testing Notes

- Uses **Jest** for unit and integration tests
- Run `npm test` to execute all test suites

---

## 👥 Demo Accounts for Testing

### Gmail (For Testing Supabase Password Reset)

- **Email:** liveshield34@gmail.com
- **Password:** password000.

### App Login

- **Username:** liveshield
- **Password:** test123

---


## 📚 Credits / Acknowledgments

- **Open Trivia DB** – For quiz content
- **Supabase** – For backend services (auth, storage, DB)
- **Vercel** – For hosting the password reset flow
- **Expo** – For push notification support and mobile development tools
