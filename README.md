<div align="center">
  <img src="https://raw.githubusercontent.com/Youssef1703-2023/joescan/main/public/logo.png" alt="JoeScan Logo" width="120" style="margin-bottom: 20px;" onerror="this.style.display='none'">

  # 🛡️ JoeScan — AI Cybersecurity & OSINT Intelligence Platform

  **Advanced threat detection, Open Source Intelligence (OSINT), and daily automated cyber news—built with a cinematic luxury UI.**

  [![Live Site](https://img.shields.io/badge/Live_Site-joescan.me-00f7b1?style=for-the-badge&logoUrl=https://cdn-icons-png.flaticon.com/512/3222/3222791.png)](https://joescan.me)
  [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  
</div>

---

## 🌟 Overview
**JoeScan** is an all-in-one, AI-driven cybersecurity and OSINT (Open Source Intelligence) platform designed for both security analysts and regular users. The platform provides a suite of deeply integrated tools to investigate digital footprints, analyze threats, and stay updated on the ever-evolving cyber landscape. 

The application is built with a premium **"English-First"** approach, backed by a breathtaking dark-mode layout focusing on glassmorphism and smooth, hardware-accelerated animations.

## 🚀 Key Features

### 🔍 Advanced OSINT Capabilities
*   **Email Audit & Breach Scanner:** Deep scanning of email addresses across known databases to expose leaked passwords and breached accounts.
*   **Phone Number Analysis:** Carrier lookup and vulnerability tracking for global cell formats.
*   **Username Reconnaissance:** Tracking specific handles and digital footprints across social and deep-web platforms.

### 🛡️ Core Cybersecurity Utilities
*   **Password Vault Integrator:** Advanced local entropy calculations to test password strength and breach velocity without sending user keystrokes over the network.
*   **Suspicious Link/URL Scanner:** Deep inspection of URLs for phishing and malware signatures using integrated threat intelligence APIs.
*   **Domain WHOIS & IP Scanners:** Real-time lookup of infrastructure points, reverse IP, and domain registration anomalies.

### 📰 Automated Auto-Fetching Cyber Blog
*   **Zero-Touch Content Pipeline:** A 100% automated GitHub Actions workflow runs every day at 05:00 UTC (8:00 AM Egypt Summer Time) to scrape, normalize, and publish the latest news from top-tier security sources.
*   **Dynamic Data Culling:** Automatically purges out-of-date news (older than 14 days) to keep the feed fresh, preventing database bloat.
*   **Seamless Reading UX:** Integrated custom Markdown parser and clever scroll-to-top architecture keeps the user engaged within an immersive, single-page reading experience.

### 🧠 Gemini AI Integration
Cutting-edge AI integration to analyze raw vulnerability outputs and translate them into actionable, human-readable insights directly on the dashboard.

## 🛠️ Tech Stack & Architecture
*   **Frontend:** React 18, Vite, TypeScript
*   **Styling:** TailwindCSS (Hyper-customized with specific hex gradients and blur utilities)
*   **State Management & Logic:** Custom React Contexts (Language, Theme, Auth)
*   **Backend & DB:** Firebase Auth & Database architectures
*   **CI/CD Pipeline:** Fully automated via GitHub Actions (building, fetching news updates, and pushing to GitHub Pages)

## 💻 Run Locally

To get a local instance of JoeScan running smoothly:

**Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) installed.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Youssef1703-2023/joescan.git
   cd joescan
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your API keys:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. **Boot the development server:**
   ```bash
   npm run dev
   ```

## 📜 License
This project is proprietary. All digital assets, source code, and design architecture belonging to the JoeTech/JoeScan label are strictly private unless explicitly open-sourced.

---
<div align="center">
  <sub>Built with passion for Cybersecurity & OSINT</sub>
</div>
