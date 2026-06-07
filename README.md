# Thumbnail Archive 🖼️

A locally hosted, minimal web application to fetch and download the highest-resolution thumbnails from YouTube and Vimeo. Designed with a sleek, premium glassmorphism interface and native Windows system tray integration.

---

## 🌟 Features

- **High-Resolution Fetching**: Retrieves `maxresdefault.jpg` for YouTube and highest available for Vimeo.
- **Cross-Origin Download Proxy**: Built-in backend bypasses CORS to allow immediate, direct downloading and canvas processing of images.
- **System Tray Integration**: Minifies to the system tray for a background, always-ready experience.
- **Premium UI**: Sleek, modern interface supporting a dark/light mode toggle, toasts, download history, and option pills.
- **No API Keys Required**: Utilizes public oEmbed endpoints and checks, requiring zero setup or authentication overhead.

---

## 🛠️ Architecture & Tech Stack

This project is built using a clean, modular, and industry-standard layout:

* **Backend**: Node.js, Express.js.
  * Uses Node 18 native global `fetch()` for HTTP requests (no heavy external HTTP clients).
  * System tray integration via `systray2`.
* **Frontend**: Modern Vanilla JS (ES Modules) & HTML5/CSS3.
  * Structure split into clean modules: `main.js` (orchestrator), `api.js` (communications), `canvas.js` (WebP/PNG/JPG resizing & formats), and `ui.js` (theme, toasts, list rendering).
  * Clean **glassmorphism** design using CSS HSL tokens, animations, and transitions.

### Project Layout

```
├── dist/                          # Compiled binaries (ignored by Git)
├── node_modules/                  # Dependencies (ignored by Git)
├── src/                           # Application source
│   ├── backend/                   # Express backend & tray handler
│   │   ├── server.js
│   │   └── tray.js
│   └── frontend/                  # Web app static assets
│       ├── index.html
│       ├── css/
│       │   └── style.css          # Design system, themes & variables
│       └── js/                    # ES6 frontend modules
│           ├── api.js
│           ├── canvas.js
│           ├── ui.js
│           └── main.js
├── icon.ico                       # Native app icon
├── package.json                   # Build configs and dependencies
├── setup.iss                      # Inno Setup compilation file
└── silent.vbs                     # Background launcher utility
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or newer is required for native fetch).
- **Inno Setup 6** (optional, if you want to compile the installer).

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/4tboy/thumbnail-archive.git
cd thumbnail-archive
npm install
```

### 3. Run Locally
To run the server and open the web application:
```bash
npm start
```
The application will launch in your default browser at `http://ta.tool` (or fallback port `http://localhost:23456`), and a system tray icon will appear.

### Packaging into an Executable
To compile into a standalone Windows `.exe` using `pkg`:
```bash
npm run build
```

To compile the installer package:
```bash
npm run build:installer
```

---

## 🔒 Security & Policy

This repository complies with strict publishing rules:
* Excludes all secret tokens, credentials, and configuration files via a robust `.gitignore`.
* Does not collect or log personal user information or credentials.

---

## ⚖️ Disclaimer

This application is for educational and personal use only. The author of this software is not affiliated with YouTube, Google, Vimeo, or any associated platforms. 

All video titles, creator names, and thumbnails fetched by this tool remain the copyrighted property of their respective owners and platforms. By using this tool, you agree to respect copyright laws and the Terms of Service of the respective platforms. The author assumes no responsibility or liability for any misuse of this software.

---

## 📜 License

This project is licensed under a Custom Non-Commercial License (Modified MIT License prohibiting sales) - see the [LICENSE](LICENSE) file for details.
