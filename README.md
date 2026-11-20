# Area Theatre Mode

A lightweight, zero-overhead Chrome extension (Manifest V3) that lets you select any region of a webpage or video stream—such as a streamer's picture-in-picture webcam—and expand it to fill your browser window with blackout theatre bars.

---

## Features

* **True-Aspect Video Expansion:** Resizes `<video>` elements directly in the DOM rather than using CSS transforms, keeping CPU/RAM usage near zero and allowing GPU driver upscaling (Intel VSR, Nvidia RTX VSR, AMD Video Upscale) to engage automatically.
* **Theatre Blackout Mask:** Blacks out everything outside your selected crop region while keeping playback active.
* **Tab Memory:** Remembers your crop coordinates per tab so you can toggle theatre mode on and off instantly without redrawing the selection box.
* **Live Adjustment Controls:**
  * **Click & Drag** inside the frame to pan.
  * **Scroll Wheel** to smoothly zoom in or out.
  * **Corner Handles** to resize and fine-tune crop edges.
  * **Responsive Window Scaling:** Automatically recalculates zoom and centering when resizing the browser window.
* **Auto-Hiding Floating HUD:** Subtle top-right pill with mute/unmute, volume slider, live resolution badge, stream quality switcher (Twitch/YouTube), redraw trigger, and exit button.
* **Stream Recovery Watchdog:** Automatically re-attaches to recovered `<video>` elements if a stream buffers, drops, or switches after an ad break.
* **100% Private & Local:** No external network requests, no analytics, and no persistent user tracking.

---

## Installation (Developer Mode)

1. Download or clone this repository folder (`area-theatre-mode`) to your computer.
2. Open Chrome (or any Chromium-based browser such as Edge, Brave, or Vivaldi) and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the `area-theatre-mode` folder.
5. *(Optional)* Pin **Area Theatre Mode** to your browser toolbar for one-click access.

---

## Controls & Shortcuts

| Action | Shortcut / Interaction |
| :--- | :--- |
| **Activate / Toggle Theatre Mode** | Click toolbar icon or press `Alt + Z` |
| **Exit Theatre Mode (Keep Memory)** | `Escape`, `Alt + Z`, or click `✕` in top-right HUD |
| **Clear Memory & Redraw Selection** | `Shift + R` (while zoomed) or click `⛶` in top-right HUD |
| **Pan View** | Click and drag inside the cropped frame |
| **Zoom In / Out** | Scroll mouse wheel up / down inside the frame |
| **Resize Crop Edges** | Drag any of the 4 teal corner handles |

*(Note: You can customize the `Alt + Z` keyboard shortcut anytime at `chrome://extensions/shortcuts`.)*

---

## File Structure

```text
area-theatre-mode/
├── manifest.json    # Extension configuration, permissions, and shortcuts (Manifest V3)
├── background.js    # Service worker handling toolbar clicks and shortcut triggers
├── content.js       # Selection overlay, video scaling, blackout mask, and floating HUD
├── icon16.png       # Toolbar icon (16x16)
├── icon48.png       # Extensions management icon (48x48)
├── icon128.png      # Chrome Web Store / detail view icon (128x128)
└── README.md        # Documentation
```

---

## Hardware Upscaling Compatibility

Because this extension modifies the `<video>` element's rendered dimensions directly, Chromium passes the target resolution to your GPU's native media engine:
* **Intel Arc / 10th Gen+ GPUs:** Enable *Process video automatically to enhance it* in Windows **Settings > Apps > Video playback** and launch Chrome with `--enable-features=IntelVpSuperResolution`.
* **Nvidia RTX (30/40/50 Series):** Enable **RTX Video Super Resolution** in the Nvidia Control Panel.
* **AMD Radeon:** Enable **Video Upscale** in AMD Software: Adrenalin Edition.
* **Other Hardware / Apple Silicon:** Falls back automatically to Chrome's hardware-composited scaler with minimal resource usage.

