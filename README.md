<div align="center">

# 🛡️ JoeScan

### Advanced Cybersecurity & OSINT Intelligence Platform

[![Live](https://img.shields.io/badge/🌐_Live_Platform-joescan.me-00f7b1?style=for-the-badge)](https://joescan.me)
[![Status](https://img.shields.io/badge/Status-Production-00f7b1?style=for-the-badge)](https://joescan.me)
[![License](https://img.shields.io/badge/License-Proprietary-ff3b3b?style=for-the-badge)](https://joescan.me)

**Enterprise-grade cybersecurity intelligence platform with deep OSINT capabilities, real-time threat monitoring, automated daily news pipeline, and a cinematic dark-mode interface.**

🔗 **[Visit the Live Platform →](https://joescan.me)**

</div>

---

## ⚠️ Proprietary Notice

> **This repository is strictly proprietary.** All source code, design systems, digital assets, and operational logic are the exclusive intellectual property of **JoeTech / JoeScan**. Cloning, forking, redistributing, reverse-engineering, or local execution of any files within this repository is **prohibited without explicit written consent**. This README exists solely as a public-facing showcase of the platform's capabilities.

---

## 📖 Table of Contents

- [Platform Overview](#-platform-overview)
- [Command Center](#-command-center)
- [Live Threat Watchlist](#-live-threat-watchlist)
- [Email Audit & Breach Scanner](#-email-audit--breach-scanner)
- [Password Vault Check](#-password-vault-check)
- [Phone Number OSINT](#-phone-number-osint)
- [Technology](#-technology)

---

## 🌟 Platform Overview

JoeScan is a full-stack cybersecurity and OSINT (Open Source Intelligence) platform built for analysts, penetration testers, and security-conscious individuals. It consolidates over **12 specialized security tools** into a single, unified command center — eliminating the need to jump between fragmented online scanners.

The platform runs entirely at **[joescan.me](https://joescan.me)** with Firebase-backed user authentication, persistent scan histories, exportable PDF reports, and a fully automated cybersecurity news engine that publishes fresh articles every single day without human intervention.

### Core Capabilities at a Glance

| Category | Tools |
|:---------|:------|
| **People OSINT** | Email Audit, Password Vault Check, Phone Number, OSINT Username |
| **Network & System** | Suspicious Link Scanner, Message Phishing Detector, IP Scan, Domain WHOIS |
| **Advanced** | Browser Fingerprint, Device Security, Social OSINT, Live Threat Watchlist |
| **Intelligence** | Cybersecurity Blog, Automated Daily News, Scan History & Analytics |

---

## 🎯 Command Center

The **Command Center** is the operational nerve center of JoeScan. It provides a bird's-eye view of your entire security posture in one glance.

<div align="center">
  <img src="docs/assets/dashboard.png" alt="JoeScan Command Center Dashboard" width="900">
</div>

<br>

**What you see here:**

- **Global Security Posture Score (78/100):** A dynamically calculated score based on all scans performed across every tool. The circular gauge turns from red to green as your digital hygiene improves, with actionable recommendations in the System Diagnosis panel.
- **Quick Stats Panel:** Instant visibility into total scans completed (49), current subscription tier (S), and the number of high-risk findings detected (5).
- **Risk Distribution Chart:** A donut chart breaking down your scan results by severity — green for safe, orange for warnings, and red for critical vulnerabilities.
- **Tools & Instruments Grid:** Quick-access cards for every tool in the platform, each showing the number of scans run, average risk score, and time since last audit.
- **Activity Timeline:** A historical line graph tracking scan activity over time, letting you spot trends in your security behavior.

---

## 🎯 Live Threat Watchlist

The **Live Threat Watchlist** is JoeScan's early-warning detection system for continuous infrastructure monitoring.

<div align="center">
  <img src="docs/assets/watchlist.png" alt="Live Threat Watchlist" width="900">
</div>

<br>

**What this tool does:**

- **Continuous Monitoring:** Map critical assets (IPv4 addresses, domains, email addresses) for around-the-clock surveillance. Once a target is deployed as a "sensor," JoeScan watches for newly exposed ports, unexpected DNS changes, certificate expirations, and breach appearances.
- **Asset Types Supported:** IPv4 Addresses, IPv6 Addresses, Domain Names, Email Addresses, and URL endpoints.
- **Sensor Array:** Each deployed target becomes an active sensor in the array. The "Sweep All" command triggers a simultaneous re-scan of every active sensor, giving you an instant snapshot of your infrastructure's health.
- **Automated Alerting:** When a watchlisted asset is detected in a new breach database or shows anomalous port activity, the system flags it on the Command Center dashboard.

---

## 📧 Email Audit & Breach Scanner

The **Email Audit** tool performs deep reconnaissance against global data leak repositories to determine if an email address has been compromised.

<div align="center">
  <img src="docs/assets/email_audit.png" alt="Email Audit Breach Scanner" width="900">
</div>

<br>

**How it works:**

- **Breach Detection Engine:** Enter any email address and hit "ANALYZE." The engine cross-references the target against massive global leak databases — covering password dumps, credential stuffing lists, dark web marketplaces, and corporate data breaches.
- **Risk Rating System:** Results are classified with a severity badge: `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`. The example shows `test@example.com` flagged as **HIGH** risk with a Security Posture Score of only **5/100**.
- **Score Factors & Remediation:** The right panel breaks down exactly *why* the score is low (multiple breaches, diverse compromised data types, recent activity) and provides a green "How To Improve" section with actionable recommendations.
- **PDF Export & Sharing:** Every scan result can be downloaded as a professional PDF report or shared directly via a unique link — perfect for including in client security assessments or compliance audits.
- **Scan History:** The platform remembers every scan with timestamps, allowing users to track whether remediation steps have improved security over time.

---

## 🔑 Password Vault Check

The **Password Vault Check** evaluates password strength algorithmically in real-time and audits credentials against neural-network breach databases.

<div align="center">
  <img src="docs/assets/password_vault.png" alt="Password Vault Check" width="900">
</div>

<br>

**Key Features:**

- **Real-Time Entropy Analysis:** As you type a password, the tool instantly calculates its cryptographic entropy, character diversity, length score, and estimated brute-force crack time — from seconds to centuries.
- **Breach Database Cross-Check:** Beyond just strength analysis, the tool checks the password hash (not the plaintext) against databases of known compromised credentials. If your exact password appears in a previous data breach, you'll know immediately.
- **Zero-Network Architecture:** Password evaluation happens entirely client-side. Your keystrokes are **never transmitted** over the network. The entropy calculation, pattern detection, and strength scoring all run locally in the browser — ensuring absolute privacy for the most sensitive input a user can provide.
- **Last 3 Scans History:** A collapsible panel tracks your recent password audits for comparison and improvement tracking.
- **Password Generator:** Built-in tools to generate cryptographically strong passwords that pass all security checks.

---

## 📱 Phone Number OSINT

The **Phone Number** tool performs intelligence gathering on cellular numbers across global telecom networks.

<div align="center">
  <img src="docs/assets/phone_number.png" alt="Phone Number OSINT Tool" width="900">
</div>

<br>

**Capabilities:**

- **Global Coverage:** Supports international phone formats with a country selector dropdown. Enter any number from any country and the system will normalize and process it.
- **Carrier & Line Identification:** Identifies the telecom carrier, line type (mobile, landline, VoIP), and registration region associated with the number.
- **Deep Intelligence Scan (OSINT):** Toggle on the "Deep Intelligence Scan" for an extended investigation that searches public directories, telemarketing leak databases, social media profile associations, and known dark web exposure records tied to the number.
- **Exposure Detection:** Flags whether the number has appeared in any known data breaches, SIM-swap attack databases, or spam/scam registries.
- **Last 5 Scans:** Persistent history of all phone audits with timestamps and results.

---

## ⚡ Technology

| Layer | Stack |
|:------|:------|
| **Frontend** | React 18 · TypeScript · Vite |
| **Styling** | TailwindCSS (custom dark theme with glassmorphism) |
| **Auth & Database** | Firebase Authentication · Firestore |
| **CI/CD** | GitHub Actions (automated builds + daily news pipeline) |
| **Hosting** | GitHub Pages with custom domain (`joescan.me`) |
| **News Automation** | RSS scraping → JSON normalization → auto-commit → instant deploy (daily at 8:00 AM EGY) |

---

<div align="center">
  <sub>© 2026 JoeScan by JoeTech. All rights reserved.</sub>
  <br>
  <sub>Built with obsession for Cybersecurity & OSINT.</sub>
</div>
