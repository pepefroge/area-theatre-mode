(() => {
  if (document.getElementById("area-theatre-overlay")) return;

  window.__areaTheatreState = window.__areaTheatreState || {
    isZoomed: false,
    savedRect: null,
    lastCropRatio: null,
    currentScale: 1,
    targetVideo: null,
    originalVideoStyles: null,
    originalVideoRect: null,
    originalParent: null,
    originalNextSibling: null,
    keyHandler: null,
    resizeHandler: null,
    watchdogInterval: null
  };

  const state = window.__areaTheatreState;

  function restoreVideoElement(videoEl, styles, parent, nextSibling) {
    if (!videoEl) return;
    if (styles) {
      Object.assign(videoEl.style, styles);
    }
    if (parent && document.body.contains(parent)) {
      if (nextSibling && nextSibling.parentNode === parent) {
        parent.insertBefore(videoEl, nextSibling);
      } else {
        parent.appendChild(videoEl);
      }
    }
    if (videoEl.paused && videoEl.readyState >= 2) {
      videoEl.play().catch(() => {});
    }
  }

  function resetZoom(clearMemory = false) {
    const html = document.documentElement;
    html.style.transform = "";
    html.style.transformOrigin = "";
    html.style.overflow = "";
    html.style.backgroundColor = "";

    restoreVideoElement(
      state.targetVideo,
      state.originalVideoStyles,
      state.originalParent,
      state.originalNextSibling
    );

    ["area-theatre-mask", "area-theatre-backdrop", "area-theatre-hud"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    if (state.keyHandler) {
      window.removeEventListener("keydown", state.keyHandler);
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
    }
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }

    const preservedMemory = clearMemory ? null : state.lastCropRatio;

    window.__areaTheatreState = {
      isZoomed: false,
      savedRect: null,
      lastCropRatio: preservedMemory,
      currentScale: 1,
      targetVideo: null,
      originalVideoStyles: null,
      originalVideoRect: null,
      originalParent: null,
      originalNextSibling: null,
      keyHandler: null,
      resizeHandler: null,
      watchdogInterval: null
    };
  }

  if (state.isZoomed) {
    resetZoom(false);
    return;
  }

  let {
    savedRect,
    currentScale,
    targetVideo,
    originalVideoStyles,
    originalVideoRect,
    originalParent,
    originalNextSibling
  } = state;

  function getActualVideoMetrics(videoEl) {
    const vRect = videoEl.getBoundingClientRect();
    const natW = videoEl.videoWidth || vRect.width;
    const natH = videoEl.videoHeight || vRect.height;
    const natRatio = natW / natH;
    const boxRatio = vRect.width / vRect.height;

    let actualW = vRect.width;
    let actualH = vRect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (boxRatio > natRatio) {
      actualW = vRect.height * natRatio;
      offsetX = (vRect.width - actualW) / 2;
    } else if (boxRatio < natRatio) {
      actualH = vRect.width / natRatio;
      offsetY = (vRect.height - actualH) / 2;
    }

    return { vRect, actualW, actualH, offsetX, offsetY };
  }

  function setupVideoTarget(videoEl, clientRect) {
    const { vRect, actualW, actualH, offsetX, offsetY } = getActualVideoMetrics(videoEl);

    originalVideoRect = { width: actualW, height: actualH };
    originalParent = videoEl.parentNode;
    originalNextSibling = videoEl.nextSibling;

    originalVideoStyles = {
      position: videoEl.style.position,
      top: videoEl.style.top,
      left: videoEl.style.left,
      width: videoEl.style.width,
      height: videoEl.style.height,
      maxWidth: videoEl.style.maxWidth,
      maxHeight: videoEl.style.maxHeight,
      minWidth: videoEl.style.minWidth,
      minHeight: videoEl.style.minHeight,
      transform: videoEl.style.transform,
      zIndex: videoEl.style.zIndex,
      objectFit: videoEl.style.objectFit,
      display: videoEl.style.display,
      visibility: videoEl.style.visibility
    };

    savedRect = {
      left: clientRect.left - (vRect.left + offsetX),
      top: clientRect.top - (vRect.top + offsetY),
      width: clientRect.width,
      height: clientRect.height
    };

    document.body.appendChild(videoEl);
  }

  function saveCropToMemory() {
    if (targetVideo && originalVideoRect) {
      state.lastCropRatio = {
        isVideo: true,
        leftRatio: savedRect.left / originalVideoRect.width,
        topRatio: savedRect.top / originalVideoRect.height,
        widthRatio: savedRect.width / originalVideoRect.width,
        heightRatio: savedRect.height / originalVideoRect.height
      };
    } else if (savedRect) {
      state.lastCropRatio = {
        isVideo: false,
        left: savedRect.left,
        top: savedRect.top,
        width: savedRect.width,
        height: savedRect.height
      };
    }
  }

  function findPrimaryVideo(excludeVideo = null) {
    const videos = Array.from(document.querySelectorAll("video")).filter((v) => {
      if (v === excludeVideo) return false;
      const r = v.getBoundingClientRect();
      return r.width > 50 && r.height > 50 && v.readyState > 0;
    });
    videos.sort(
      (a, b) =>
        b.getBoundingClientRect().width * b.getBoundingClientRect().height -
        a.getBoundingClientRect().width * a.getBoundingClientRect().height
    );
    return videos[0] || null;
  }

  function attachVideoFromRatio(videoEl, ratioObj) {
    targetVideo = videoEl;
    const { vRect, actualW, actualH, offsetX, offsetY } = getActualVideoMetrics(videoEl);
    const reconstructedClientRect = {
      left: vRect.left + offsetX + ratioObj.leftRatio * actualW,
      top: vRect.top + offsetY + ratioObj.topRatio * actualH,
      width: ratioObj.widthRatio * actualW,
      height: ratioObj.heightRatio * actualH
    };
    setupVideoTarget(targetVideo, reconstructedClientRect);
  }
  function startStreamWatchdog() {
    if (state.watchdogInterval) clearInterval(state.watchdogInterval);

    state.watchdogInterval = setInterval(() => {
      if (!state.isZoomed || !state.lastCropRatio || !state.lastCropRatio.isVideo) return;

      const currentDead =
        !targetVideo ||
        !document.body.contains(targetVideo) ||
        targetVideo.readyState === 0 ||
        targetVideo.videoWidth === 0;

      const replacementVideo = findPrimaryVideo(targetVideo);

      if (currentDead && replacementVideo) {
        if (targetVideo) targetVideo.remove();
        attachVideoFromRatio(replacementVideo, state.lastCropRatio);
        applyTheatreMode();
      } else if (!currentDead && replacementVideo && replacementVideo.readyState >= 2) {
        restoreVideoElement(
          targetVideo,
          originalVideoStyles,
          originalParent,
          originalNextSibling
        );
        attachVideoFromRatio(replacementVideo, state.lastCropRatio);
        applyTheatreMode();
      }
      updateHudInfo();
    }, 1000);
  }

  function triggerSiteQualityMenu(targetLabel) {
    const settingsBtn =
      document.querySelector('[data-a-target="player-settings-button"]') ||
      document.querySelector(".ytp-settings-button");

    if (!settingsBtn) return false;
    settingsBtn.click();

    setTimeout(() => {
      const qualityMenuBtn =
        document.querySelector('[data-a-target="player-settings-menu-item-quality"]') ||
        Array.from(document.querySelectorAll(".ytp-menuitem")).find((el) =>
          el.textContent.toLowerCase().includes("quality")
        );

      if (qualityMenuBtn) {
        qualityMenuBtn.click();
        setTimeout(() => {
          const options = Array.from(
            document.querySelectorAll(
              '[data-a-target="player-settings-submenu-quality-option"] input, [data-a-target="player-settings-submenu-quality-option"], .ytp-quality-menu .ytp-menuitem'
            )
          );
          const match = options.find((el) =>
            el.textContent.toLowerCase().includes(targetLabel.toLowerCase())
          );
          if (match) match.click();
          else settingsBtn.click();
        }, 120);
      } else {
        settingsBtn.click();
      }
    }, 120);
    return true;
  }

  function updateHudInfo() {
    const resTag = document.getElementById("area-theatre-res-label");
    if (resTag && targetVideo && targetVideo.videoHeight) {
      resTag.textContent = `${targetVideo.videoHeight}p`;
    }
  }

  function createFloatingHud() {
    if (document.getElementById("area-theatre-hud")) return;

    const hud = document.createElement("div");
    hud.id = "area-theatre-hud";
    Object.assign(hud.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "5px 10px",
      backgroundColor: "rgba(18, 18, 22, 0.85)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      borderRadius: "20px",
      color: "#efeff1",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "12px",
      zIndex: "2147483647",
      opacity: "0.22",
      transition: "opacity 0.2s ease",
      userSelect: "none"
    });

    hud.addEventListener("mouseenter", () => (hud.style.opacity = "1"));
    hud.addEventListener("mouseleave", () => (hud.style.opacity = "0.22"));

    if (targetVideo) {
      const muteBtn = document.createElement("button");
      const updateMuteIcon = () => {
        muteBtn.textContent =
          targetVideo.muted || targetVideo.volume === 0 ? "🔇" : "🔊";
      };
      updateMuteIcon();
      Object.assign(muteBtn.style, {
        background: "none",
        border: "none",
        color: "#fff",
        cursor: "pointer",
        padding: "0",
        fontSize: "13px"
      });
      muteBtn.title = "Mute / Unmute";
      muteBtn.addEventListener("click", () => {
        targetVideo.muted = !targetVideo.muted;
        updateMuteIcon();
      });

      const volSlider = document.createElement("input");
      volSlider.type = "range";
      volSlider.min = "0";
      volSlider.max = "1";
      volSlider.step = "0.05";
      volSlider.value = targetVideo.muted ? "0" : String(targetVideo.volume);
      Object.assign(volSlider.style, {
        width: "56px",
        height: "4px",
        accentColor: "#00ffcc",
        cursor: "pointer"
      });
      volSlider.title = "Volume";
      volSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        targetVideo.volume = val;
        targetVideo.muted = val === 0;
        updateMuteIcon();
      });

      const resSelect = document.createElement("select");
      resSelect.id = "area-theatre-res-select";
      Object.assign(resSelect.style, {
        backgroundColor: "#26262c",
        color: "#efeff1",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "4px",
        fontSize: "11px",
        padding: "2px 4px",
        cursor: "pointer",
        outline: "none"
      });
      resSelect.title = "Stream Quality";

      const qualities = [
        { label: "Auto / Current", val: "" },
        { label: "1080p", val: "1080" },
        { label: "720p", val: "720" },
        { label: "480p", val: "480" },
        { label: "Auto", val: "auto" }
      ];
      qualities.forEach((q) => {
        const opt = document.createElement("option");
        opt.value = q.val;
        opt.textContent = q.label;
        resSelect.appendChild(opt);
      });

      resSelect.addEventListener("change", (e) => {
        if (e.target.value) {
          triggerSiteQualityMenu(e.target.value);
        }
      });

      const resLabel = document.createElement("span");
      resLabel.id = "area-theatre-res-label";
      resLabel.style.color = "#00ffcc";
      resLabel.style.fontWeight = "600";
      resLabel.textContent = targetVideo.videoHeight ? `${targetVideo.videoHeight}p` : "";

      hud.append(muteBtn, volSlider, resLabel, resSelect);
    }

    const redrawBtn = document.createElement("button");
    redrawBtn.textContent = "⛶";
    redrawBtn.title = "Select New Area (Shift+R)";
    Object.assign(redrawBtn.style, {
      background: "none",
      border: "none",
      color: "#efeff1",
      cursor: "pointer",
      fontSize: "13px",
      padding: "0 2px"
    });
    redrawBtn.addEventListener("click", () => {
      resetZoom(true);
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.title = "Exit Theatre Mode (Esc)";
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      color: "#ff6b6b",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "bold",
      padding: "0 2px"
    });
    closeBtn.addEventListener("click", () => resetZoom(false));

    hud.append(redrawBtn, closeBtn);
    document.body.appendChild(hud);
  }
  if (state.lastCropRatio) {
    if (state.lastCropRatio.isVideo) {
      const existingVideo = findPrimaryVideo();
      if (existingVideo) {
        attachVideoFromRatio(existingVideo, state.lastCropRatio);
        applyTheatreMode();
        createFloatingHud();
        startStreamWatchdog();
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", handleResize);
        return;
      }
    } else {
      savedRect = {
        left: state.lastCropRatio.left,
        top: state.lastCropRatio.top,
        width: state.lastCropRatio.width,
        height: state.lastCropRatio.height
      };
      applyTheatreMode();
      createFloatingHud();
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", handleResize);
      return;
    }
  }

  const overlay = document.createElement("div");
  overlay.id = "area-theatre-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    cursor: "crosshair",
    zIndex: "2147483647"
  });

  const selectionBox = document.createElement("div");
  Object.assign(selectionBox.style, {
    position: "fixed",
    border: "2px dashed #00ffcc",
    backgroundColor: "rgba(0, 255, 204, 0.1)",
    display: "none",
    pointerEvents: "none"
  });

  overlay.appendChild(selectionBox);
  document.body.appendChild(overlay);

  let startX = 0,
    startY = 0,
    isDragging = false;

  overlay.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    Object.assign(selectionBox.style, {
      left: `${startX}px`,
      top: `${startY}px`,
      width: "0px",
      height: "0px",
      display: "block"
    });
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    Object.assign(selectionBox.style, {
      left: `${Math.min(startX, currentX)}px`,
      top: `${Math.min(startY, currentY)}px`,
      width: `${Math.abs(currentX - startX)}px`,
      height: `${Math.abs(currentY - startY)}px`
    });
  });

  overlay.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;

    const rect = selectionBox.getBoundingClientRect();
    overlay.remove();

    if (rect.width < 20 || rect.height < 20) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const videos = Array.from(document.querySelectorAll("video"));

    targetVideo = videos.find((v) => {
      const vRect = v.getBoundingClientRect();
      return (
        vRect.width > 0 &&
        centerX >= vRect.left &&
        centerX <= vRect.right &&
        centerY >= vRect.top &&
        centerY <= vRect.bottom
      );
    });

    if (targetVideo) {
      setupVideoTarget(targetVideo, rect);
    } else {
      savedRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };
    }

    saveCropToMemory();
    applyTheatreMode();
    createFloatingHud();
    startStreamWatchdog();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
  });
  function applyTheatreMode() {
    if (!savedRect) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const scaleX = viewportW / savedRect.width;
    const scaleY = viewportH / savedRect.height;
    currentScale = Math.min(scaleX, scaleY);

    if (targetVideo && originalVideoRect) {
      const scaledVideoW = originalVideoRect.width * currentScale;
      const scaledVideoH = originalVideoRect.height * currentScale;

      const scaledCropW = savedRect.width * currentScale;
      const scaledCropH = savedRect.height * currentScale;
      const scaledCropLeft = savedRect.left * currentScale;
      const scaledCropTop = savedRect.top * currentScale;

      const viewportCropLeft = (viewportW - scaledCropW) / 2;
      const viewportCropTop = (viewportH - scaledCropH) / 2;

      const videoLeft = viewportCropLeft - scaledCropLeft;
      const videoTop = viewportCropTop - scaledCropTop;

      let backdrop = document.getElementById("area-theatre-backdrop");
      if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.id = "area-theatre-backdrop";
        Object.assign(backdrop.style, {
          position: "fixed",
          top: "0",
          left: "0",
          width: "100vw",
          height: "100vh",
          backgroundColor: "#000000",
          zIndex: "2147483644"
        });
        document.body.appendChild(backdrop);
      }

      Object.assign(targetVideo.style, {
        position: "fixed",
        left: `${videoLeft}px`,
        top: `${videoTop}px`,
        width: `${scaledVideoW}px`,
        height: `${scaledVideoH}px`,
        maxWidth: "none",
        maxHeight: "none",
        minWidth: "0",
        minHeight: "0",
        transform: "none",
        objectFit: "fill",
        display: "block",
        visibility: "visible",
        zIndex: "2147483645"
      });

      if (targetVideo.paused && targetVideo.readyState >= 2) {
        targetVideo.play().catch(() => {});
      }

      document.documentElement.style.overflow = "hidden";

      updateBlackoutMask(
        {
          left: viewportCropLeft,
          top: viewportCropTop,
          width: scaledCropW,
          height: scaledCropH
        },
        true
      );
    } else {
      const html = document.documentElement;
      html.style.transform = "none";
      window.scrollTo(0, 0);

      const rectCenterX = savedRect.left + savedRect.width / 2;
      const rectCenterY = savedRect.top + savedRect.height / 2;

      const translateX = viewportW / 2 - rectCenterX;
      const translateY = viewportH / 2 - rectCenterY;

      html.style.backgroundColor = "#000000";
      html.style.overflow = "hidden";
      html.style.transformOrigin = `${rectCenterX}px ${rectCenterY}px`;
      html.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;

      updateBlackoutMask(savedRect, false);
    }

    Object.assign(state, {
      isZoomed: true,
      savedRect,
      currentScale,
      targetVideo,
      originalVideoStyles,
      originalVideoRect,
      originalParent,
      originalNextSibling,
      keyHandler: handleKeyDown,
      resizeHandler: handleResize
    });
  }

  function updateBlackoutMask(rect, isFixedViewport) {
    let mask = document.getElementById("area-theatre-mask");
    if (!mask) {
      mask = document.createElement("div");
      mask.id = "area-theatre-mask";
      document.body.appendChild(mask);
      enablePanningAndWheelZoom(mask);
      createCropHandles(mask);
    }

    const borderSize = isFixedViewport ? 1.5 : Math.max(0.5, 1.5 / currentScale);

    Object.assign(mask.style, {
      position: isFixedViewport ? "fixed" : "absolute",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      boxShadow: "0 0 0 99999px #000000",
      border: `${borderSize}px solid rgba(255, 255, 255, 0.25)`,
      boxSizing: "border-box",
      pointerEvents: "auto",
      cursor: "grab",
      zIndex: "2147483646"
    });

    const handleSize = isFixedViewport ? 14 : Math.max(4, 14 / currentScale);
    const offset = -(handleSize / 2);

    mask.querySelectorAll(".area-theatre-handle").forEach((handle) => {
      handle.style.width = `${handleSize}px`;
      handle.style.height = `${handleSize}px`;
      const pos = handle.dataset.pos;
      handle.style.top = pos.includes("n") ? `${offset}px` : "auto";
      handle.style.bottom = pos.includes("s") ? `${offset}px` : "auto";
      handle.style.left = pos.includes("w") ? `${offset}px` : "auto";
      handle.style.right = pos.includes("e") ? `${offset}px` : "auto";
    });
  }

  function enablePanningAndWheelZoom(mask) {
    mask.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 0.94 : 1.06;
        const newW = Math.max(30, savedRect.width * zoomFactor);
        const newH = Math.max(30, savedRect.height * zoomFactor);
        savedRect.left += (savedRect.width - newW) / 2;
        savedRect.top += (savedRect.height - newH) / 2;
        savedRect.width = newW;
        savedRect.height = newH;
        saveCropToMemory();
        applyTheatreMode();
      },
      { passive: false }
    );

    mask.addEventListener("mousedown", (e) => {
      if (e.target !== mask) return;
      e.preventDefault();
      mask.style.cursor = "grabbing";

      const initMouseX = e.clientX;
      const initMouseY = e.clientY;
      const initRect = { ...savedRect };

      function onMouseMove(moveEvent) {
        const dx = (moveEvent.clientX - initMouseX) / currentScale;
        const dy = (moveEvent.clientY - initMouseY) / currentScale;

        savedRect.left = initRect.left - dx;
        savedRect.top = initRect.top - dy;

        if (targetVideo && originalVideoRect) {
          const scaledCropW = savedRect.width * currentScale;
          const scaledCropH = savedRect.height * currentScale;
          const viewportCropLeft = (window.innerWidth - scaledCropW) / 2;
          const viewportCropTop = (window.innerHeight - scaledCropH) / 2;

          targetVideo.style.left = `${viewportCropLeft - savedRect.left * currentScale}px`;
          targetVideo.style.top = `${viewportCropTop - savedRect.top * currentScale}px`;
        } else {
          applyTheatreMode();
        }
      }

      function onMouseUp() {
        mask.style.cursor = "grab";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        saveCropToMemory();
        applyTheatreMode();
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  function createCropHandles(mask) {
    const corners = [
      { pos: "nw", cursor: "nwse-resize" },
      { pos: "ne", cursor: "nesw-resize" },
      { pos: "sw", cursor: "nesw-resize" },
      { pos: "se", cursor: "nwse-resize" }
    ];

    corners.forEach(({ pos, cursor }) => {
      const handle = document.createElement("div");
      handle.className = "area-theatre-handle";
      handle.dataset.pos = pos;

      Object.assign(handle.style, {
        position: "absolute",
        backgroundColor: "rgba(0, 255, 204, 0.4)",
        border: "1px solid #00ffcc",
        borderRadius: "2px",
        cursor: cursor,
        pointerEvents: "auto",
        opacity: "0.35",
        transition: "opacity 0.15s"
      });

      handle.addEventListener("mouseenter", () => (handle.style.opacity = "1"));
      handle.addEventListener("mouseleave", () => (handle.style.opacity = "0.35"));

      handle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();

        const initMouseX = e.clientX;
        const initMouseY = e.clientY;
        const initRect = { ...savedRect };

        function onMouseMove(moveEvent) {
          const dx = (moveEvent.clientX - initMouseX) / currentScale;
          const dy = (moveEvent.clientY - initMouseY) / currentScale;

          if (pos.includes("e")) {
            savedRect.width = Math.max(20, initRect.width + dx);
          }
          if (pos.includes("s")) {
            savedRect.height = Math.max(20, initRect.height + dy);
          }
          if (pos.includes("w")) {
            const newWidth = Math.max(20, initRect.width - dx);
            savedRect.left = initRect.left + (initRect.width - newWidth);
            savedRect.width = newWidth;
          }
          if (pos.includes("n")) {
            const newHeight = Math.max(20, initRect.height - dy);
            savedRect.top = initRect.top + (initRect.height - newHeight);
            savedRect.height = newHeight;
          }

          if (targetVideo) {
            mask.style.left = `${savedRect.left * currentScale + parseFloat(targetVideo.style.left)}px`;
            mask.style.top = `${savedRect.top * currentScale + parseFloat(targetVideo.style.top)}px`;
            mask.style.width = `${savedRect.width * currentScale}px`;
            mask.style.height = `${savedRect.height * currentScale}px`;
          } else {
            mask.style.left = `${savedRect.left}px`;
            mask.style.top = `${savedRect.top}px`;
            mask.style.width = `${savedRect.width}px`;
            mask.style.height = `${savedRect.height}px`;
          }
        }

        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          saveCropToMemory();
          applyTheatreMode();
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      mask.appendChild(handle);
    });
  }

  function handleResize() {
    applyTheatreMode();
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      resetZoom(false);
    } else if (e.key === "R" && e.shiftKey) {
      resetZoom(true);
    }
  }
})();
