# 🧩 Drew — Visual Architecture Builder  
Turn ideas into clean architecture diagrams. Fast, minimal, Excalidraw-style.

Drew is a lightweight diagramming tool focused on speed and clarity.  
You can draw shapes, move them around, resize, edit text, and structure your thoughts into a proper system architecture.  

Perfect for brainstorming, planning app flow, designing systems, or quickly sketching technical ideas.

---

## 🚀 Features

### 🎨 Canvas & Drawing
- Create rectangles, circles, arrows, and text elements  
- Drag, resize, rotate (Excalidraw-style transformer)  
- Smooth interaction powered by **React + Konva**

### 💾 Persistence
- Every shape is automatically saved in **localStorage**  
- Close the tab → come back → continue exactly where you left off  

### 🔐 Authentication  
- Login system using **Supabase Auth**  
- Clean redirect handling  
- “Start Now” modal login system on hero page

### 💫 Hero Animation  
- Fully animated landing page using **GSAP + ScrollTrigger**  
- Auto-arranged icons, text fade-in, smooth transitions  
- Mobile-responsive layout improvements

### 🎥 About Section  
- Autoplay video (no refs, no GSAP)  
- Clean split layout

---

## 🛠 Tech Stack

| Area | Technologies |
|------|--------------|
| Frontend | React, TypeScript, Vite |
| Canvas Engine | Konva.js + react-konva |
| Animations | GSAP, ScrollTrigger |
| Auth | Supabase |
| Styling | TailwindCSS |
| Persistence | LocalStorage |
| Assets | MP4 autoplay video |

---

## 📦 Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/drew.git
cd drew
npm install
npm run dev
