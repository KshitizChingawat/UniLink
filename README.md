# 🚀 UniLink — Universal Cross-Device Connectivity Platform

[![Live Demo](https://img.shields.io/badge/Live-Demo-green?style=for-the-badge)](https://unilink-frontend-omky.onrender.com/)

✨ **Live, deployed full-stack application enabling seamless cross-device connectivity**

---

## 🌐 Overview

**UniLink** is a platform that allows users to connect multiple devices and share data instantly — without ecosystem restrictions.

It enables:

* 📁 File transfer
* 📋 Clipboard sync
* 🔗 Device pairing
* 🔐 Secure storage

All across platforms like **Windows, macOS, Linux, Android, iOS, and browsers**.

---

## 🎯 Key Features

### 🔗 QR-Based Device Pairing

* Instant connection via QR scan
* No manual setup required
* Secure session-based linking

### 📁 File Transfer

* Send files between connected devices
* Supports large file uploads
* Cross-platform compatibility

### 📋 Clipboard Sync

* Copy on one device → paste on another
* Automatic synchronization

### 🔐 Secure Vault

* Encrypted storage for sensitive data
* Multi-device access

### 🤖 AI Assistant

* Smart suggestions for content organization
* Intelligent workflow assistance

### 📡 Device Management

* Track all connected devices
* Monitor activity and status

---

## 🏗️ Tech Stack

### Frontend

* React + TypeScript
* Vite
* Tailwind CSS

### Backend

* Node.js + Express
* TypeScript

### Database

* Supabase

### Deployment

* Render (Frontend + Backend, using `npm ci` + `npm run build`)

---

## ⚙️ Project Structure

```
UniLink/
│
├── frontend/        # React frontend
├── backend/         # Express backend
├── integrations/    # Supabase integration
└── README.md
```

## 🌍 Live Demo

🚀 **Try UniLink Now:**
👉 https://unilink-frontend-omky.onrender.com/

> ⚠️ Use the frontend link for full experience.

## 🔄 How It Works

1. User logs in
2. Generates QR code
3. Second device scans QR
4. Devices get connected
5. Files & data sync across devices

---

## 📈 Future Enhancements

* ⚡ Real-time transfer using WebSockets
* 🔗 Peer-to-peer file transfer
* 📱 Native mobile apps
* 💳 Subscription system
* 🌐 Custom domain

---

## 🧠 Vision

UniLink aims to become a **universal connectivity layer across devices**, eliminating ecosystem barriers and redefining device interaction.

---

## 👨‍💻 Author

**Kshitiz Chingawat**
Final Year B.Tech (CSE)

📧 Email: [kshitizchingawat5704@gmail.com](mailto:kshitizchingawat5704@gmail.com)
📞 Contact: +91 8269653513

🔗 GitHub: https://github.com/KshitizChingawat


## 💡 Final Note

> UniLink is not just an app — it’s a step toward a unified digital ecosystem.

### Authentication on Render

Use Node 22.9 or newer and run the build and start commands from the repository root. Keep the same Supabase project and private `unilink-db` bucket across deployments. Accounts and verification records live in `db.json` in that bucket. Run one backend instance because updates to this shared object use a process-local write lock.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in the Render service environment. Use a sender authorized by your mail provider. For Mailtrap Email Sending, a Mailtrap SMTP hostname with username `api` selects the HTTPS delivery path. Signup and password recovery require email delivery in production. Codes expire after ten minutes, and resending replaces the previous code.

After deploying, register with an inbox you control, sign out, sign in again, and complete password recovery using the new email code. Keep service credentials in Render environment settings.
