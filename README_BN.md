# HABIB AI 🇧🇩 — মোবাইল ব্রাউজার থেকে ডিপ্লয়মেন্ট গাইড

এই প্রজেক্টটি একটি প্রিমিয়াম বাংলা ও ইংরেজি এআই অ্যাসিস্ট্যান্ট (HABIB AI)। এটি শুধুমাত্র একটি অ্যান্ড্রয়েড ফোন ব্যবহার করে কোনো কম্পিউটার বা টার্মিনাল ছাড়াই সরাসরি অনলাইনে ডিপ্লয় এবং ইনস্টল করা সম্ভব।

---

## ১. প্রজেক্ট ফাইল ডাউনলোড (Google AI Studio থেকে)
১. আপনার স্ক্রিনের ডানদিকের উপরে থাকা **Settings (গিয়ার ⚙ আইকন)** বা **Menu (⋮ তিনটি ডট)**-এ ক্লিক করুন।
২. মেনু থেকে **"Export as ZIP"** অথবা **"Download ZIP"** বাটনে চাপ দিন। আপনার ফোনে পুরো প্রজেক্ট জিপ ফাইল আকারে ডাউনলোড হয়ে যাবে।
৩. ফোনের File Manager (Files by Google) দিয়ে জিপটি Extract (আনজিপ) করুন।

---

## ২. GitHub-এ আপলোড (মোবাইল ব্রাউজার দিয়ে)
১. ফোনে Chrome খুলে যান: [github.com](https://github.com) (লগইন করুন)।
২. ডানদিকের উপরে **+** বাটনে চাপ দিয়ে **New repository** নির্বাচন করুন।
৩. Repository name দিন: `habib-ai`।
৪. **Private** অপশন বেছে নিন এবং নিচে **Create repository** বাটনে চাপ দিন।
৫. নতুন পেজে **"uploading an existing file"** লিঙ্কে চাপ দিন।
৬. আপনার ফোনের আনজিপ করা ফোল্ডার থেকে ফাইলগুলো সিলেক্ট করে আপলোড করে দিন (`package.json`, `server.js`, `public` ফোল্ডার)।
৭. নিচে সবুজ **Commit changes** বাটনে চাপ দিন।

---

## ৩. Render-এ ডিপ্লয় (ফ্রি ক্লাউড হোস্টিং)
১. ব্রাউজারে যান: [render.com](https://render.com) এবং GitHub দিয়ে সাইন ইন করুন।
২. ড্যাশবোর্ডে **New +** বাটনে চাপ দিয়ে **Web Service** সিলেক্ট করুন।
৩. **"Build and deploy from a Git repository"** সিলেক্ট করে আপনার `habib-ai` রিপোজিটরিটি কানেক্ট করুন।
৪. সেটিংস পেজে:
   - **Name:** `habib-ai`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
৫. নিচে **Environment Variables** সেকশনে যান:
   - **Add Environment Variable**-এ চাপ দিন।
   - Key: `GEMINI_API_KEY`
   - Value: আপনার Google AI Studio থেকে নেওয়া Gemini API Key দিন।
৬. সবার নিচে থাকা **Deploy Web Service** বাটনে চাপ দিন।
৭. ২-৩ মিনিটের মধ্যে Render আপনাকে একটি লাইভ লিঙ্ক দেবে (যেমন: `https://habib-ai.onrender.com`)।

---

## ৪. ফোনে হোম স্ক্রিনে অ্যাপ আকারে যুক্ত করা (PWA)
১. Render-এর তৈরি হওয়া লিঙ্কে আপনার ফোনের Chrome ব্রাউজারে যান।
২. ব্রাউজারের উপরে ডানদিকের তিনটি ডটে (⋮) চাপ দিন।
৩. মেনু থেকে **"Install app"** অথবা **"Add to Home screen"** নির্বাচন করুন।
৪. আপনার ফোনের অ্যাপ ড্রয়ারে এবং হোম স্ক্রিনে **HABIB AI 🇧🇩** নামে একটি আসল অ্যাপের মতো আইকন চলে আসবে।
