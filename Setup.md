# Setup Guide

This guide will help you install everything required and run the application.

* Note: This is for windows but you can use AI to translate it for your machine.

---

# Part 1: Setup

## 1. Install Required Software

Install the following:

* **Python** (version 3.12 or 3.13 recommended)
* **Node.js**

During installation, make sure both are added to your system **PATH**.

>If you are unsure how to do these, search on YouTube or Google
---

## 2. Open the Project Folder

Navigate to the project folder (the folder containing this `Setup.md` and `Readme.md` file).

Open a terminal in this folder.

>If you do not know how, search it up.

---

## 3. Create the Python Environment

Copy and paste the following commands into your terminal and hit `Enter` key to run, one at a time:

```bash
python -m venv .venv
```

```bash
".venv/Scripts/activate"
```

```bash
pip install -U "yt-dlp[all]"
```

Wait for the installation to finish before moving to the next step.

---

## 4. Open the App Directory

Run:

```bash
cd app
```

---

## 5. Install Node.js Packages

Run:

```bash
npm init -y
```

Then install the required packages:

```bash
npm install express cors
```

---

## 6. Install FFmpeg

FFmpeg is required for video and audio processing.

Run:

```bash
winget install --id Gyan.FFmpeg -e
```

Wait until the installation completes.

---

# Part 2: Verification

Restart your computer after completing the setup.

Open the terminal again in the project folder (containing `Readme.md`) and run:

```bash
.venv/Scripts/activate
```

```bash
cd app
```

### Verify Python Packages

```bash
pip list
```

You should see a list of installed packages, including items similar to:

* yt-dlp
* requests
* setuptools
* urllib3
* websockets

---

### Verify Node Packages

```bash
npm list
```

You should see:

* express
* cors

---

### Verify FFmpeg

```bash
ffmpeg -version
```

If FFmpeg is installed correctly, you will see version information and other text.

There should be no error messages.

---

# Part 3: Running the Application

To run the app, open a terminal in the project folder (containing `Readme.md`) and run:

```bash
.venv/Scripts/activate
```

```bash
cd app
```

```bash
node server.js
```

When the server starts successfully, you should see a message similar to:

```text
[Server] - Listening on port 3000
```

---

## Open the Application

Open your web browser and go to this url:

```text
http://localhost:3000
```

The application should now be running and ready to use.

* Warning: Excessive or automated usage may trigger rate limits, restrictions, or IP blocking from YouTube.
User at your OWN risk.