// shipper-monitor-version: 2026-03-09-v4
(function () {
  "use strict";

  const MONITOR_VERSION = "2026-03-09-v4";
  const PREVIEW_POPUP_MESSAGE_TYPE = "PREVIEW_POPUP_REQUESTED";
  const PREVIEW_POPUP_WINDOW_NAME = "shipper-preview-popup";
  const OTT_QUERY_PARAM = "ott";

  const CONFIG = {
    ALLOWED_ORIGINS: ["https://app.shipper.now","https://app.shipper.now","https://staging.shipper.now"],
    DEBOUNCE_DELAY: 250,
    MAX_STRING_LENGTH: 10000,
    HIGHLIGHT_COLOR: "#3b82f6",
    VISUAL_EDIT_ENABLED: false,
  };

  // Post message to parent window
  // Uses "*" target origin to work with any deployment URL (Vercel previews, etc.)
  // This is safe because we control the message content and only the parent receives it
  // Incoming commands (ENABLE_VISUAL_EDIT, etc.) still have strict origin validation
  function postToParent(message) {
    try {
      if (window.parent) {
        window.parent.postMessage(
          {
            ...message,
            timestamp: new Date().toISOString(),
          },
          "*"
        );
      }
    } catch (err) {
      console.error("Failed to send message to parent:", err);
    }
  }

  // Detect blank screen — uses same broad selector as checkContentLoaded()
  function isBlankScreen() {
    const root = document.querySelector(
      '#root, [id*="root"], [class*="root"], body > div:first-child'
    );
    return root ? root.childElementCount === 0 : false;
  }

  // Serialize complex objects for transmission
  function serializeValue(value, depth = 0, seen = new WeakMap()) {
    if (depth > 5) return "[Max Depth Reached]";

    if (value === undefined) return { _type: "undefined" };
    if (value === null) return null;
    if (typeof value === "string") {
      return value.length > CONFIG.MAX_STRING_LENGTH
        ? value.slice(0, CONFIG.MAX_STRING_LENGTH) + "..."
        : value;
    }
    if (typeof value === "number") {
      if (Number.isNaN(value)) return { _type: "NaN" };
      if (!Number.isFinite(value))
        return { _type: value > 0 ? "Infinity" : "-Infinity" };
      return value;
    }
    if (typeof value === "boolean") return value;
    if (typeof value === "bigint")
      return { _type: "BigInt", value: value.toString() };
    if (typeof value === "symbol")
      return { _type: "Symbol", value: value.toString() };
    if (typeof value === "function") {
      return {
        _type: "Function",
        name: value.name || "anonymous",
        stringValue: value.toString().slice(0, 100),
      };
    }

    if (value && typeof value === "object") {
      if (seen.has(value)) return { _type: "Circular", ref: seen.get(value) };
      seen.set(value, "ref_" + depth);
    }

    if (value instanceof Error) {
      return {
        _type: "Error",
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value instanceof Date) {
      return { _type: "Date", iso: value.toISOString() };
    }

    if (value instanceof RegExp) {
      return { _type: "RegExp", source: value.source, flags: value.flags };
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 100)
        .map((item) => serializeValue(item, depth + 1, seen));
    }

    if (value && typeof value === "object") {
      const result = {};
      const keys = Object.keys(value).slice(0, 100);
      keys.forEach((key) => {
        try {
          result[key] = serializeValue(value[key], depth + 1, seen);
        } catch (err) {
          result[key] = { _type: "Error", message: "Failed to serialize" };
        }
      });
      return result;
    }

    return value;
  }

  // ===== Runtime Error Tracking =====
  function setupErrorTracking() {
    const errorCache = new Set();
    const getCacheKey = (msg, file, line, col) =>
      `${msg}|${file}|${line}|${col}`;

    window.addEventListener(
      "error",
      (event) => {
        // Check if this is a resource loading error (script, img, link, etc.)
        if (event.target && event.target !== window) {
          const element = event.target;
          const tagName = element.tagName?.toLowerCase();
          const src = element.src || element.href;

          const cacheKey = `resource|${tagName}|${src}`;
          if (errorCache.has(cacheKey)) return;
          errorCache.add(cacheKey);
          setTimeout(() => errorCache.delete(cacheKey), 5000);

          postToParent({
            type: "RESOURCE_LOAD_ERROR",
            data: {
              message: `Failed to load ${tagName}: ${src}`,
              tagName,
              src,
              blankScreen: isBlankScreen(),
            },
          });
          return;
        }

        // Regular runtime error
        const cacheKey = getCacheKey(
          event.message,
          event.filename,
          event.lineno,
          event.colno
        );

        if (errorCache.has(cacheKey)) return;
        errorCache.add(cacheKey);
        setTimeout(() => errorCache.delete(cacheKey), 5000);

        postToParent({
          type: "RUNTIME_ERROR",
          data: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
            blankScreen: isBlankScreen(),
          },
        });
      },
      true
    ); // Use capture phase to catch resource errors

    window.addEventListener("unhandledrejection", (event) => {
      const stack = event.reason?.stack || String(event.reason);
      if (errorCache.has(stack)) return;
      errorCache.add(stack);
      setTimeout(() => errorCache.delete(stack), 5000);

      postToParent({
        type: "UNHANDLED_PROMISE_REJECTION",
        data: {
          message: event.reason?.message || "Unhandled promise rejection",
          stack: event.reason?.stack || String(event.reason),
        },
      });
    });
  }

  // ===== Network Monitoring =====
  function setupNetworkMonitoring() {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const startTime = Date.now();
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const method = args[1]?.method || "GET";

      let requestBody;
      if (args[1]?.body) {
        try {
          if (typeof args[1].body === "string") {
            requestBody = args[1].body;
          } else if (args[1].body instanceof FormData) {
            requestBody =
              "FormData: " +
              Array.from(args[1].body.entries())
                .map(([k, v]) => `${k}=${v}`)
                .join("&");
          } else if (args[1].body instanceof URLSearchParams) {
            requestBody = args[1].body.toString();
          } else {
            requestBody = JSON.stringify(args[1].body);
          }
        } catch {
          requestBody = "Could not serialize request body";
        }
      }

      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;

        let responseBody;
        try {
          if (response.clone) {
            responseBody = await response.clone().text();
          }
        } catch (err) {
          responseBody = "[Clone failed]";
        }

        postToParent({
          type: "NETWORK_REQUEST",
          data: {
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            requestBody,
            responseBody: responseBody?.slice(0, CONFIG.MAX_STRING_LENGTH),
            duration,
            timestamp: new Date().toISOString(),
          },
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        postToParent({
          type: "NETWORK_REQUEST",
          data: {
            url,
            method,
            requestBody,
            duration,
            timestamp: new Date().toISOString(),
            error: {
              message: error?.message || "Unknown error",
              stack: error?.stack,
            },
          },
        });

        throw error;
      }
    };
  }

  // ===== Console Output Capture =====
  function setupConsoleCapture() {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    const consoleBuffer = [];
    let consoleFlushTimer = null;

    const levelMap = {
      log: "info",
      warn: "warning",
      error: "error",
    };

    function flushConsoleBuffer() {
      if (consoleBuffer.length === 0) {
        consoleFlushTimer = null;
        return;
      }

      const messages = [...consoleBuffer];
      consoleBuffer.length = 0;
      consoleFlushTimer = null;

      postToParent({
        type: "CONSOLE_OUTPUT",
        data: { messages },
      });
    }

    ["log", "warn", "error"].forEach((level) => {
      console[level] = (...args) => {
        // Call original console method
        originalConsole[level].apply(console, args);

        // Serialize arguments
        const serialized = args.map((arg) => serializeValue(arg));
        const messageText = args
          .map((arg) =>
            typeof arg === "string"
              ? arg
              : JSON.stringify(serializeValue(arg), null, 2)
          )
          .join(" ")
          .slice(0, CONFIG.MAX_STRING_LENGTH);

        consoleBuffer.push({
          level: levelMap[level],
          message: messageText,
          logged_at: new Date().toISOString(),
          raw: serialized,
        });

        // Debounce flush
        if (consoleFlushTimer === null) {
          consoleFlushTimer = setTimeout(
            flushConsoleBuffer,
            CONFIG.DEBOUNCE_DELAY
          );
        }
      };
    });
  }

  // ===== URL Change Tracking =====
  function tryParseUrl(value, baseUrl) {
    if (!value || typeof value !== "string") return null;
    try {
      return new URL(value, baseUrl || window.location.href);
    } catch {
      return null;
    }
  }

  function isLocalAuthInitiationUrl(url) {
    const parsed = tryParseUrl(url);
    if (!parsed) return false;

    const path = parsed.pathname.toLowerCase();
    return (
      path.includes("/api/auth/login") ||
      path.includes("/api/auth/sign-in") ||
      path.includes("/oauth/login")
    );
  }

  function isPopupRedirectUrl(url) {
    const parsed = tryParseUrl(url);
    if (!parsed) return false;

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    return (
      parsed.origin !== window.location.origin ||
      isLocalAuthInitiationUrl(parsed.toString())
    );
  }

  function buildPopupFeatures(width, height) {
    const left = Math.max(
      0,
      (window.screenX || 0) + ((window.outerWidth || width) - width) / 2,
    );
    const top = Math.max(
      0,
      (window.screenY || 0) + ((window.outerHeight || height) - height) / 2,
    );

    return [
      "popup=yes",
      "toolbar=no",
      "menubar=no",
      "resizable=yes",
      "scrollbars=yes",
      `width=${Math.round(width)}`,
      `height=${Math.round(height)}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
    ].join(",");
  }

  function maybeClosePopup(popup) {
    if (!popup || popup.closed) return;
    try {
      popup.close();
    } catch {
      // Ignore popup close failures.
    }
  }

  function setupPreviewPopupRouting() {
    if (!window.parent || window.parent === window) {
      return;
    }

    let popupPollInterval = null;
    let popupPollDeadline = 0;
    const handledOttTokens = new Set();

    const stopPopupOttPolling = () => {
      if (popupPollInterval !== null) {
        clearInterval(popupPollInterval);
        popupPollInterval = null;
      }
    };

    const applyOttToPreviewUrl = (ottToken) => {
      try {
        const previewUrl = new URL(window.location.href);
        if (previewUrl.searchParams.get(OTT_QUERY_PARAM) === ottToken) {
          return true;
        }
        previewUrl.searchParams.set(OTT_QUERY_PARAM, ottToken);
        window.location.assign(previewUrl.toString());
        return true;
      } catch {
        return false;
      }
    };

    const startPopupOttPolling = (popup) => {
      stopPopupOttPolling();
      if (!popup || popup.closed) return;

      popupPollDeadline = Date.now() + 3 * 60 * 1000;
      popupPollInterval = setInterval(() => {
        if (!popup || popup.closed || Date.now() > popupPollDeadline) {
          stopPopupOttPolling();
          return;
        }

        let popupUrl = null;
        try {
          popupUrl = tryParseUrl(popup.location.href);
        } catch {
          return;
        }
        if (!popupUrl) return;

        const ottToken = popupUrl.searchParams.get(OTT_QUERY_PARAM);
        if (!ottToken || handledOttTokens.has(ottToken)) {
          return;
        }
        handledOttTokens.add(ottToken);

        const applied = applyOttToPreviewUrl(ottToken);
        if (!applied) {
          return;
        }

        maybeClosePopup(popup);
        stopPopupOttPolling();
      }, 500);
    };

    const openPreviewPopup = (url, source, existingPopup) => {
      if (!isPopupRedirectUrl(url)) return false;

      const parsed = tryParseUrl(url);
      if (!parsed) {
        maybeClosePopup(existingPopup);
        return false;
      }

      let popup = existingPopup && !existingPopup.closed ? existingPopup : null;

      if (popup) {
        try {
          popup.location.href = parsed.toString();
        } catch {
          popup = null;
        }
      }

      if (!popup) {
        popup = window.open(
          parsed.toString(),
          PREVIEW_POPUP_WINDOW_NAME,
          buildPopupFeatures(520, 720),
        );
      }
      const opened = Boolean(popup);
      if (opened && typeof popup.focus === "function") {
        popup.focus();
      }
      if (opened) {
        startPopupOttPolling(popup);
      }

      postToParent({
        type: PREVIEW_POPUP_MESSAGE_TYPE,
        data: {
          url: parsed.toString(),
          opened,
          source,
        },
      });

      return opened;
    };

    try {
      const originalAssign = window.location.assign.bind(window.location);
      const originalReplace = window.location.replace.bind(window.location);

      window.location.assign = (url) => {
        const nextUrl = String(url);
        if (isPopupRedirectUrl(nextUrl)) {
          openPreviewPopup(nextUrl, "location-navigation");
          return;
        }
        return originalAssign(url);
      };

      window.location.replace = (url) => {
        const nextUrl = String(url);
        if (isPopupRedirectUrl(nextUrl)) {
          openPreviewPopup(nextUrl, "location-navigation");
          return;
        }
        return originalReplace(url);
      };
    } catch {
      // Ignore if navigation methods are not patchable in this runtime.
    }

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const anchor = target.closest("a[href]");
        if (!anchor) return;

        const href = anchor.getAttribute("href");
        if (
          !href ||
          href.startsWith("#") ||
          href.toLowerCase().startsWith("javascript:")
        ) {
          return;
        }

        if (isPopupRedirectUrl(href)) {
          openPreviewPopup(href, "anchor-click");
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
        }
      },
      true,
    );

    if (typeof window.fetch !== "function") {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/json")) {
        return response;
      }

      let payload = null;
      try {
        payload = await response.clone().json();
      } catch {
        return response;
      }

      if (!payload || typeof payload !== "object") {
        return response;
      }

      const readCandidateUrl = (value) => {
        if (!value || typeof value !== "object") return null;
        if (typeof value.url === "string") return value.url;
        if (typeof value.redirectUrl === "string") return value.redirectUrl;
        if (typeof value.redirectTo === "string") return value.redirectTo;
        if (typeof value.location === "string") return value.location;
        if (typeof value.redirect === "string") return value.redirect;
        return null;
      };

      const redirectUrl =
        readCandidateUrl(payload) ||
        (payload.data && typeof payload.data === "object"
          ? readCandidateUrl(payload.data)
          : null);
      const shouldRedirect =
        typeof redirectUrl === "string" ||
        payload.redirect === true ||
        (payload.data &&
          typeof payload.data === "object" &&
          payload.data.redirect === true);
      if (!redirectUrl || !shouldRedirect || !isPopupRedirectUrl(redirectUrl)) {
        return response;
      }

      openPreviewPopup(redirectUrl, "fetch-response");

      const headers = new Headers(response.headers);
      headers.delete("content-length");

      const nextPayload =
        payload.data && typeof payload.data === "object"
          ? {
              ...payload,
              data: {
                ...payload.data,
                redirect: false,
              },
              redirect: false,
            }
          : { ...payload, redirect: false };

      return new Response(JSON.stringify(nextPayload), {
        status: 200,
        statusText: "OK",
        headers,
      });
    };
  }

  function setupNavigationTracking() {
    let currentUrl = document.location.href;

    const observer = new MutationObserver(() => {
      if (currentUrl !== document.location.href) {
        currentUrl = document.location.href;
        postToParent({
          type: "URL_CHANGED",
          data: { url: currentUrl },
        });
      }
    });

    const body = document.querySelector("body");
    if (body) {
      observer.observe(body, {
        childList: true,
        subtree: true,
      });
    }
  }

  // ===== Content Load Detection =====
  function checkContentLoaded() {
    const root = document.querySelector(
      '#root, [id*="root"], [class*="root"], body > div:first-child'
    );
    const rootElementExists = !!root;
    const rootHasChildren = root ? root.childElementCount > 0 : false;

    // Check if HMR is complete (Vite-specific)
    const hmrComplete =
      !window.__vite_plugin_react_preamble_installed__ ||
      (window.import &&
        window.import.meta &&
        !window.import.meta.hot?.data?.pending);

    // Check if React is ready (look for React root or hydration)
    const reactReady =
      rootHasChildren &&
      (!!root?.querySelector("[data-reactroot], [data-react-helmet]") ||
        root?.textContent?.trim().length > 0);

    const hasContent =
      rootElementExists && rootHasChildren && hmrComplete && reactReady;

    return {
      hasContent,
      rootElementExists,
      rootHasChildren,
      hmrComplete,
      reactReady,
    };
  }

  function setupContentDetection() {
    let lastContentState = checkContentLoaded();
    let contentLoadNotified = false;

    // Check immediately
    const initialState = checkContentLoaded();
    if (initialState.hasContent && !contentLoadNotified) {
      postToParent({
        type: "CONTENT_LOADED",
        data: initialState,
      });
      contentLoadNotified = true;
    }

    // Watch for content changes
    const observer = new MutationObserver(() => {
      const currentState = checkContentLoaded();

      // Notify when content becomes available
      if (currentState.hasContent && !contentLoadNotified) {
        postToParent({
          type: "CONTENT_LOADED",
          data: currentState,
        });
        contentLoadNotified = true;
      }

      // Also notify if content disappears (blank screen)
      if (!currentState.hasContent && lastContentState.hasContent) {
        postToParent({
          type: "BLANK_SCREEN_DETECTED",
          data: currentState,
        });
        contentLoadNotified = false;
      }

      lastContentState = currentState;
    });

    // Observe the entire document for changes
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    // Also check after a short delay for HMR scenarios
    setTimeout(() => {
      const state = checkContentLoaded();
      if (state.hasContent && !contentLoadNotified) {
        postToParent({
          type: "CONTENT_LOADED",
          data: state,
        });
        contentLoadNotified = true;
      }
    }, 1000);

    // Check periodically during first 10 seconds (for slow HMR)
    let checkCount = 0;
    const periodicCheck = setInterval(() => {
      checkCount++;
      const state = checkContentLoaded();

      // If content is loaded and we haven't notified yet, send event and stop
      if (state.hasContent && !contentLoadNotified) {
        postToParent({
          type: "CONTENT_LOADED",
          data: state,
        });
        contentLoadNotified = true;
        clearInterval(periodicCheck);
        return;
      }

      // If we've already notified (from mutation observer or timeout), stop checking
      if (contentLoadNotified) {
        clearInterval(periodicCheck);
        return;
      }

      // Stop after 10 seconds (20 checks × 500ms)
      if (checkCount >= 20) {
        clearInterval(periodicCheck);
      }
    }, 500);
  }

  // ===== VISUAL EDITOR =====
  let visualEditorState = {
    enabled: false,
    selectedElement: null,
    highlightOverlay: null,
    hoverOverlay: null,
    repeatedHoverOverlays: [], // Array of overlays for repeated elements
  };

  // Create overlay elements for visual editing
  function createVisualEditorOverlays() {
    // Hover overlay (blue outline when hovering)
    visualEditorState.hoverOverlay = document.createElement("div");
    visualEditorState.hoverOverlay.id = "shipper-visual-editor-hover";
    visualEditorState.hoverOverlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px dashed ${CONFIG.HIGHLIGHT_COLOR};
      background: rgba(59, 130, 246, 0.1);
      z-index: 999999;
      transition: all 0.1s ease;
      display: none;
    `;
    document.body.appendChild(visualEditorState.hoverOverlay);

    // Selection overlay (dotted border when selected, no background)
    visualEditorState.highlightOverlay = document.createElement("div");
    visualEditorState.highlightOverlay.id = "shipper-visual-editor-selection";
    visualEditorState.highlightOverlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px dashed ${CONFIG.HIGHLIGHT_COLOR};
      background: transparent;
      z-index: 999998;
      display: none;
    `;
    document.body.appendChild(visualEditorState.highlightOverlay);
  }

  // Get element position
  function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  }

  // Update overlay position
  function updateOverlay(overlay, element) {
    const pos = getElementPosition(element);
    overlay.style.left = pos.x + "px";
    overlay.style.top = pos.y + "px";
    overlay.style.width = pos.width + "px";
    overlay.style.height = pos.height + "px";
    overlay.style.display = "block";
  }

  // Create or get hover overlay for repeated elements
  function getOrCreateRepeatedHoverOverlay(index) {
    if (!visualEditorState.repeatedHoverOverlays[index]) {
      const overlay = document.createElement("div");
      overlay.className = "shipper-visual-editor-repeated-hover";
      overlay.style.cssText = `
        position: absolute;
        pointer-events: none;
        border: 2px dashed ${CONFIG.HIGHLIGHT_COLOR};
        background: rgba(59, 130, 246, 0.1);
        z-index: 999999;
        transition: all 0.1s ease;
        display: none;
      `;
      document.body.appendChild(overlay);
      visualEditorState.repeatedHoverOverlays[index] = overlay;
    }
    return visualEditorState.repeatedHoverOverlays[index];
  }

  // Hide all repeated hover overlays
  function hideRepeatedHoverOverlays() {
    visualEditorState.repeatedHoverOverlays.forEach((overlay) => {
      if (overlay) {
        overlay.style.display = "none";
      }
    });
  }

  // Generate CSS selector for element
  function getSelector(element) {
    if (element.id) return "#" + element.id;

    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .trim()
          .split(/\s+/)
          .filter((c) => c);
        // Filter out classes with invalid CSS selector characters (like square brackets in bg-[#color], colons in md:grid-cols-4)
        const validClasses = classes.filter((c) => !/[\[\]#:]/.test(c));
        if (validClasses.length > 0) {
          selector += "." + validClasses.slice(0, 3).join(".");
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  // Generate XPath for element (absolute path from document root)
  function getXPath(element) {
    if (element.id) return `//*[@id="${element.id}"]`;

    const parts = [];
    let current = element;
    while (current && current.nodeType === 1) {
      let index = 0;
      let sibling = current.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      const tagName = current.tagName.toLowerCase();
      parts.unshift(`${tagName}[${index + 1}]`);
      current = current.parentElement;
    }
    return "/" + parts.join("/");
  }

  // Extract Tailwind classes
  function getTailwindClasses(element) {
    if (!element.className || typeof element.className !== "string") return [];

    const classes = element.className
      .trim()
      .split(/\s+/)
      .filter((c) => c);
    // Basic heuristic: Tailwind classes often have patterns like bg-, text-, flex-, etc.
    return classes.filter(
      (c) =>
        /^(bg|text|border|rounded|p|m|w|h|flex|grid|gap|space|shadow|opacity|transition|hover|focus|active|disabled|cursor|overflow|absolute|relative|fixed|sticky|z|top|bottom|left|right|inset|transform|scale|rotate|translate|skew|origin)-/.test(
          c
        ) || /^(sm|md|lg|xl|2xl):/.test(c)
    );
  }

  // Get computed styles (serializable)
  function getComputedStyles(element) {
    const computed = window.getComputedStyle(element);
    const styles = {};
    const importantProps = [
      "backgroundColor",
      "color",
      "borderRadius",
      "opacity",
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "margin",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "width",
      "height",
      "display",
      "position",
      "fontSize",
      "fontWeight",
      "border",
      "borderWidth",
      "borderColor",
      "borderStyle",
    ];

    importantProps.forEach((prop) => {
      styles[prop] = computed[prop];
    });

    return styles;
  }

  // Get inline styles
  function getInlineStyles(element) {
    const styles = {};
    if (element.style && element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const prop = element.style[i];
        styles[prop] = element.style[prop];
      }
    }
    return styles;
  }

  // Check if element has direct text content (not from children)
  function hasDirectTextContent(element) {
    // Check if element has direct text nodes as children
    // (not just child elements that contain text)
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (
        node.nodeType === Node.TEXT_NODE &&
        node.textContent.trim().length > 0
      ) {
        return true;
      }
    }
    return false;
  }

  // Extract element info
  function getElementInfo(element) {
    const attributes = {};
    Array.from(element.attributes).forEach((attr) => {
      attributes[attr.name] = attr.value;
    });

    const textContent = element.textContent?.slice(0, 5000);
    const hasDirectText = hasDirectTextContent(element);
    const shipperId = element.getAttribute("data-shipper-id") || null;
    const shipperUsage = element.getAttribute("data-shipper-usage") || null;

    // Parse usage info if present
    // Format: "type:line:column" (e.g., "map:63:7")
    let usageInfo = null;
    if (shipperUsage) {
      try {
        const parts = shipperUsage.split(":");
        if (parts.length === 3) {
          usageInfo = {
            type: parts[0],
            line: parseInt(parts[1], 10),
            column: parseInt(parts[2], 10),
          };
        }
      } catch (e) {
        console.warn("[getElementInfo] Failed to parse usage info:", e);
      }
    }

    // Check if this element is part of a repeated set (same shipper ID appears multiple times)
    let isRepeated = false;
    let instanceIndex = null;
    let totalInstances = 1;
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        `[data-shipper-id="${shipperId}"]`
      );
      totalInstances = elementsWithSameId.length;
      if (elementsWithSameId.length > 1) {
        isRepeated = true;
        // Find the index of this element in the set
        for (let i = 0; i < elementsWithSameId.length; i++) {
          if (elementsWithSameId[i] === element) {
            instanceIndex = i;
            break;
          }
        }
      }
    }

    // Also check if usage info indicates repetition (e.g., inside .map())
    if (usageInfo && usageInfo.type === "map") {
      isRepeated = true;
    }

    return {
      selector: getSelector(element),
      xpath: getXPath(element),
      shipperId: shipperId,
      componentName:
        element.dataset?.componentName || element.dataset?.component || element.tagName.toLowerCase(),
      currentStyles: {
        computed: getComputedStyles(element),
        tailwindClasses: getTailwindClasses(element),
        inlineStyles: getInlineStyles(element),
      },
      position: getElementPosition(element),
      textContent: textContent,
      hasDirectText: hasDirectText,
      isRepeated: isRepeated,
      instanceIndex: instanceIndex,
      totalInstances: totalInstances,
      usageInfo: usageInfo, // Include usage info if present
      attributes,
    };
  }

  // Check if an element is "meaningful" (should be selected directly)
  function isMeaningfulElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    
    // Has classes (likely styled/important)
    if (element.className && typeof element.className === 'string' && element.className.trim().length > 0) {
      return true;
    }
    
    // Has direct text content (not just from children)
    if (hasDirectTextContent(element)) {
      return true;
    }
    
    // Interactive elements
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'label'];
    if (interactiveTags.includes(element.tagName.toLowerCase())) {
      return true;
    }
    
    // Has meaningful attributes
    if (element.id || element.getAttribute('role') || element.getAttribute('aria-label')) {
      return true;
    }
    
    return false;
  }

  // Find the nearest ancestor element with a data-shipper-id attribute
  // Combines: meaningful element preference + root layout skipping
  function findElementWithShipperId(element, maxDepth = 20) {
    let current = element;
    let depth = 0;

    // If starting from a text node, move to parent element
    if (current && current.nodeType !== Node.ELEMENT_NODE) {
      current = current.parentElement;
    }

    // Store the original target element as fallback
    const originalElement = current;
    const isOriginalMeaningful = isMeaningfulElement(originalElement);

    // Patterns that indicate root/layout files that shouldn't be selected
    // when clicking on their children (the child content doesn't have shipper IDs)
    const rootLayoutPatterns = [
      /__root[.:]/, // TanStack Router root: routes/__root.tsx or routes/__root:line:col
      /_layout[.:]/, // Layout files
      /^layout[.:]/, // Next.js style layouts
      /^root[.:]/,   // Generic root files
    ];

    function isRootLayoutId(shipperId) {
      return rootLayoutPatterns.some(pattern => pattern.test(shipperId));
    }

    // First, check if the clicked element itself has a shipperId
    if (originalElement && originalElement.nodeType === Node.ELEMENT_NODE) {
      const directShipperId = originalElement.getAttribute("data-shipper-id");
      if (directShipperId && !isRootLayoutId(directShipperId)) {
        return { element: originalElement, shipperId: directShipperId };
      }
    }

    while (current && current !== document.body && depth < maxDepth) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const shipperId = current.getAttribute("data-shipper-id");
        if (shipperId) {
          // Skip root layout elements - they're too high-level to be useful selections
          // This happens when code-split route files don't get shipper IDs
          if (isRootLayoutId(shipperId)) {
            // Continue traversing to see if there's nothing else, but we won't use this
            current = current.parentElement;
            depth++;
            continue;
          }
          // Found an ancestor with shipperId
          // But if original element is meaningful, prefer it (even without shipperId)
          if (isOriginalMeaningful && depth > 2) {
            // Original element is meaningful and we've walked up more than 2 levels
            // Prefer the original element to avoid selecting a distant ancestor
            return { element: originalElement, shipperId: null };
          }
          return { element: current, shipperId };
        }
      }
      current = current.parentElement;
      depth++;
    }

    // No ancestor has data-shipper-id within max depth
    // Prefer original element if it's meaningful, otherwise return it anyway
    return { element: originalElement, shipperId: null };
  }

  // Handle element hover
  function handleVisualEditorMouseMove(event) {
    if (!visualEditorState.enabled) return;

    const target = event.target;
    if (
      target === visualEditorState.hoverOverlay ||
      target === visualEditorState.highlightOverlay
    )
      return;

    // Skip overlays and visual editor elements
    if (target.id?.startsWith("shipper-visual-editor")) return;
    if (target.classList?.contains("shipper-visual-editor-repeated-hover"))
      return;

    // Find the element with data-shipper-id (could be target or an ancestor)
    const { element: elementWithId, shipperId } =
      findElementWithShipperId(target);

    if (shipperId && elementWithId) {
      const elementsWithSameId = document.querySelectorAll(
        `[data-shipper-id="${shipperId}"]`
      );

      if (elementsWithSameId.length > 1) {
        // Show hover overlay on all repeated elements (dashed border for hover)
        hideRepeatedHoverOverlays();
        elementsWithSameId.forEach((element, index) => {
          const overlay = getOrCreateRepeatedHoverOverlay(index);
          // Use dashed border for hover (different from selection)
          overlay.style.border = `2px dashed ${CONFIG.HIGHLIGHT_COLOR}`;
          overlay.style.background = "rgba(59, 130, 246, 0.1)";
          updateOverlay(overlay, element);
        });
        // Hide the single hover overlay
        if (visualEditorState.hoverOverlay) {
          visualEditorState.hoverOverlay.style.display = "none";
        }
        return;
      }
    }

    // Single element - hide repeated overlays and show single overlay
    // Use elementWithId if found, otherwise use target
    hideRepeatedHoverOverlays();
    if (visualEditorState.hoverOverlay) {
      const elementToHighlight = elementWithId || target;
      updateOverlay(visualEditorState.hoverOverlay, elementToHighlight);
    }
  }

  // Handle element click
  function handleVisualEditorClick(event) {
    if (!visualEditorState.enabled) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    if (
      target === visualEditorState.hoverOverlay ||
      target === visualEditorState.highlightOverlay
    )
      return;
    if (target.id?.startsWith("shipper-visual-editor")) return;
    if (target.classList?.contains("shipper-visual-editor-repeated-hover"))
      return;

    // Find the element with data-shipper-id (could be target or an ancestor)
    // This ensures clicking on child elements selects the correct parent element
    const { element: elementToSelect, shipperId } =
      findElementWithShipperId(target);
    const selectedElement = elementToSelect || target;

    visualEditorState.selectedElement = selectedElement;

    // Hide hover overlay when element is selected
    if (visualEditorState.hoverOverlay) {
      visualEditorState.hoverOverlay.style.display = "none";
    }

    // Check if this element is part of a repeated set
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        `[data-shipper-id="${shipperId}"]`
      );

      if (elementsWithSameId.length > 1) {
        // Show highlight overlay on all repeated elements
        hideRepeatedHoverOverlays();
        elementsWithSameId.forEach((element, index) => {
          const overlay = getOrCreateRepeatedHoverOverlay(index);
          // Use a different style for selection (solid border, not dashed)
          overlay.style.border = `2px solid ${CONFIG.HIGHLIGHT_COLOR}`;
          overlay.style.background = "rgba(59, 130, 246, 0.15)";
          updateOverlay(overlay, element);
        });
        // Hide the single highlight overlay
        if (visualEditorState.highlightOverlay) {
          visualEditorState.highlightOverlay.style.display = "none";
        }
      } else {
        // Single element - hide repeated overlays and show single overlay
        hideRepeatedHoverOverlays();
        updateOverlay(visualEditorState.highlightOverlay, selectedElement);
      }
    } else {
      // No shipperId - use single overlay
      hideRepeatedHoverOverlays();
      updateOverlay(visualEditorState.highlightOverlay, selectedElement);
    }

    // Send element info to parent
    const elementInfo = getElementInfo(selectedElement);
    postToParent({
      type: "ELEMENT_SELECTED",
      payload: elementInfo,
    });
  }

  // Find element using multiple methods (most reliable first)
  function findElement(identifiers) {
    // 1. Try shipperId first (most reliable IF unique)
    // Note: shipperId may not be unique for repeating elements from same source line
    if (identifiers.shipperId) {
      try {
        const elements = document.querySelectorAll(
          `[data-shipper-id="${identifiers.shipperId}"]`
        );
        // Only use shipperId if it matches exactly one element
        if (elements.length === 1) {
          return elements[0];
        }
        // If multiple elements match, shipperId isn't unique - fall through to XPath
        if (elements.length > 1) {
          console.warn(
            `Multiple elements found with shipperId "${identifiers.shipperId}", using XPath instead`
          );
        }
      } catch (e) {
        console.warn("shipperId lookup failed:", e);
      }
    }

    // 2. Try XPath (most reliable for repeating elements - unique per DOM position)
    if (identifiers.xpath) {
      try {
        // Try absolute XPath first
        let result = document.evaluate(
          identifiers.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (result.singleNodeValue) return result.singleNodeValue;

        // If absolute XPath fails, try relative to body
        if (
          identifiers.xpath.startsWith("/") &&
          !identifiers.xpath.startsWith("//")
        ) {
          const bodyResult = document.evaluate(
            identifiers.xpath,
            document.body,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (bodyResult.singleNodeValue) return bodyResult.singleNodeValue;
        }
      } catch (e) {
        console.warn("XPath evaluation failed:", e, identifiers.xpath);
      }
    }

    // 3. Fall back to CSS selector (least reliable, skip if contains invalid chars)
    if (identifiers.selector) {
      // Skip selector if it contains invalid characters (like colons in class names)
      const hasInvalidChars = /[\[\]#:]/.test(identifiers.selector);
      if (!hasInvalidChars) {
        try {
          const element = document.querySelector(identifiers.selector);
          if (element) return element;
        } catch (e) {
          console.warn("CSS selector failed (invalid syntax):", e.message);
        }
      } else {
        console.warn(
          "Skipping CSS selector due to invalid characters:",
          identifiers.selector
        );
      }
    }

    return null;
  }

  // Apply style changes
  function applyVisualEditorStyle(styleUpdate) {
    const { selector, shipperId, xpath, changes } = styleUpdate;

    console.log("[Shipper Visual Editor] applyVisualEditorStyle called:", {
      shipperId,
      xpath: xpath?.substring(0, 50) + (xpath?.length > 50 ? "..." : ""),
      selector: selector?.substring(0, 50) + (selector?.length > 50 ? "..." : ""),
      changeCount: Object.keys(changes || {}).length,
      changes,
    });

    // Prefer the direct DOM reference (set at click time) over re-finding via
    // identifiers, which can resolve to the wrong element when multiple elements
    // share the same selector/class structure.
    const element = visualEditorState.selectedElement || findElement({ selector, shipperId, xpath });

    if (!element) {
      console.warn("[Shipper Visual Editor] Element not found using any method:", {
        shipperId,
        xpath,
        selector,
      });
      return;
    }

    console.log("[Shipper Visual Editor] Element found:", element.tagName, element.className);

    // Check if this element is part of a repeated set
    let elementsToUpdate = [element];
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        `[data-shipper-id="${shipperId}"]`
      );

      if (elementsWithSameId.length > 1) {
        // Apply changes to ALL repeated elements
        elementsToUpdate = Array.from(elementsWithSameId);
      }
    }

    // Apply style changes to all elements that should be updated
    if (!changes || typeof changes !== "object") return;
    console.log("[Shipper Visual Editor] Applying styles to", elementsToUpdate.length, "element(s)");
    elementsToUpdate.forEach((el, idx) => {
      Object.entries(changes).forEach(([prop, value]) => {
        // Handle "inherit" or empty string to remove inline styles
        if (value === "inherit" || value === "") {
          el.style[prop] = "";
        } else {
          el.style[prop] = value;
        }
        console.log("[Shipper Visual Editor] Applied " + prop + "=" + value + " to element " + idx);
      });
    });

    // Update highlight overlays - maintain selection state
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        `[data-shipper-id="${shipperId}"]`
      );

      if (elementsWithSameId.length > 1) {
        // Check if this element is currently selected
        const isSelected = element === visualEditorState.selectedElement;

        if (isSelected) {
          // Maintain selection overlays on all repeated elements
          elementsWithSameId.forEach((el, index) => {
            const overlay = getOrCreateRepeatedHoverOverlay(index);
            overlay.style.border = `2px solid ${CONFIG.HIGHLIGHT_COLOR}`;
            overlay.style.background = "rgba(59, 130, 246, 0.15)";
            updateOverlay(overlay, el);
          });
          // Hide the single highlight overlay
          if (visualEditorState.highlightOverlay) {
            visualEditorState.highlightOverlay.style.display = "none";
          }
        } else {
          // Not selected - hide repeated overlays
          hideRepeatedHoverOverlays();
        }
      } else {
        // Single element - update single highlight overlay
        if (element === visualEditorState.selectedElement) {
          updateOverlay(visualEditorState.highlightOverlay, element);
        }
      }
    } else {
      // No shipperId - update single highlight overlay
      if (element === visualEditorState.selectedElement) {
        updateOverlay(visualEditorState.highlightOverlay, element);
      }
    }
  }

  // Update only direct text nodes of an element, preserving child elements.
  // If the element has no text nodes but has child elements, prepends a text
  // node instead of using textContent (which would destroy children).
  function setDirectTextContent(el, newText) {
    var textNodes = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
        textNodes.push(el.childNodes[i]);
      }
    }
    if (textNodes.length === 0) {
      if (el.children && el.children.length > 0) {
        el.insertBefore(document.createTextNode(newText), el.firstChild);
      } else {
        el.textContent = newText;
      }
      return;
    }
    textNodes[0].textContent = newText;
    for (var j = 1; j < textNodes.length; j++) {
      textNodes[j].textContent = "";
    }
  }

  // Apply text content changes
  function applyVisualEditorText(textUpdate) {
    var textContent = textUpdate.textContent;
    if (textContent == null) return;

    // ONLY update the currently-selected element. Text edits are always scoped
    // to a single element — the panel already blocks text changes for repeated
    // elements, so there is no need to fan out to siblings by shipperId here.
    var element = visualEditorState.selectedElement;

    if (!element) {
      console.warn("[Shipper Visual Editor] No selected element for text update");
      return;
    }

    setDirectTextContent(element, textContent);

    // Update highlight overlay on the selected element
    if (visualEditorState.highlightOverlay) {
      updateOverlay(visualEditorState.highlightOverlay, element);
    }
  }

  // Enable visual editing mode
  function enableVisualEditor() {
    if (visualEditorState.enabled) return;

    visualEditorState.enabled = true;

    // Create overlays if they don't exist
    if (!visualEditorState.hoverOverlay) {
      createVisualEditorOverlays();
    }

    // Add event listeners
    document.addEventListener("mousemove", handleVisualEditorMouseMove);
    document.addEventListener("click", handleVisualEditorClick, true);

    // Notify parent that visual editor is ready
    postToParent({
      type: "VISUAL_EDIT_READY",
      data: { url: window.location.href },
    });

    console.log("[Shipper Visual Editor] Enabled");
  }

  // Disable visual editing mode
  function disableVisualEditor() {
    if (!visualEditorState.enabled) return;

    visualEditorState.enabled = false;

    // Hide overlays
    if (visualEditorState.hoverOverlay) {
      visualEditorState.hoverOverlay.style.display = "none";
    }
    if (visualEditorState.highlightOverlay) {
      visualEditorState.highlightOverlay.style.display = "none";
    }
    hideRepeatedHoverOverlays();

    // Clean up repeated hover overlays
    visualEditorState.repeatedHoverOverlays.forEach((overlay) => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    visualEditorState.repeatedHoverOverlays = [];

    // Remove event listeners
    document.removeEventListener("mousemove", handleVisualEditorMouseMove);
    document.removeEventListener("click", handleVisualEditorClick, true);

    visualEditorState.selectedElement = null;

    console.log("[Shipper Visual Editor] Disabled");
  }

  // Helper function to check if an origin is allowed using pattern matching
  // This provides dynamic origin validation without build-time dependencies
  function isAllowedOrigin(origin) {
    if (!origin) return false;

    // Check exact matches in CONFIG.ALLOWED_ORIGINS first
    if (CONFIG.ALLOWED_ORIGINS.includes(origin)) {
      return true;
    }

    // Pattern matching for dynamic preview domains
    // Localhost (any port)
    const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
    
    // Shipper domains (shipper.now and subdomains)
    const isShipperDomain = /^https?:\/\/([a-z0-9-]+\.)?shipper\.now$/.test(origin);
    
    // Vercel domains - allow all .vercel.app origins (production, preview, and any subdomain format)
    // This matches all Vercel deployment formats including:
    // - your-app.vercel.app (production)
    // - your-app-git-branch-username.vercel.app (preview)
    // - shipper-webapp-nc4n6bkdr-shippernow.vercel.app (preview with multiple segments)
    // - any-subdomain.vercel.app (any valid subdomain structure)
    const isVercelDomain = /^https?:\/\/.+\.vercel\.app$/.test(origin);
    
    // Railway preview domains
    const isRailwayDomain = /^https?:\/\/[a-z0-9-]+\.up\.railway\.app$/.test(origin);
    
    // Modal host domains (for sandbox previews)
    const isModalDomain = /^https?:\/\/[a-z0-9-]+\.w\.modal\.host$/.test(origin);

    // Parent origin detection for cross-origin iframes
    // This is the most reliable method for iframe scenarios
    let isParentOrigin = false;
    try {
      if (window.parent && window.parent !== window) {
        // Try to access parent origin directly (works for same-origin)
        try {
          isParentOrigin = origin === window.parent.location.origin;
        } catch (e) {
          // Cross-origin iframe - cannot access parent.location directly
          // Try referrer fallback (most reliable for cross-origin)
          const referrer = document.referrer;
          if (referrer) {
            try {
              const referrerOrigin = new URL(referrer).origin;
              isParentOrigin = origin === referrerOrigin;
            } catch (referrerError) {
              // Referrer URL parsing failed, try string matching as fallback
              if (referrer.includes(origin)) {
                isParentOrigin = true;
              }
            }
          }
        }
      }
    } catch (e2) {
      // All parent origin detection methods failed, continue with other checks
    }

    return isLocalhost || isShipperDomain || isVercelDomain || isRailwayDomain || isModalDomain || isParentOrigin;
  }

  // Listen for messages from parent
  window.addEventListener("message", (event) => {
    const { type, payload } = event.data;

    // Handle monitor config updates (hot reload without iframe refresh)
    if (type === "UPDATE_MONITOR_CONFIG") {
      const originAllowed = isAllowedOrigin(event.origin);
      if (!originAllowed) {
        console.warn(
          "[Shipper Monitor] UPDATE_MONITOR_CONFIG blocked from unauthorized origin:",
          event.origin
        );
        return;
      }

      if (payload && Array.isArray(payload.allowedOrigins)) {
        console.log("[Shipper Monitor] Updating allowed origins:", payload.allowedOrigins);
        CONFIG.ALLOWED_ORIGINS = payload.allowedOrigins;
        console.log("[Shipper Monitor] Monitor config updated successfully");
        
        // Notify parent that config was updated
        postToParent({
          type: "MONITOR_CONFIG_UPDATED",
          data: { allowedOrigins: CONFIG.ALLOWED_ORIGINS },
        });
      }
      return;
    }

    // Only process visual editor messages
    if (
      type === "ENABLE_VISUAL_EDIT" ||
      type === "DISABLE_VISUAL_EDIT" ||
      type === "APPLY_STYLE" ||
      type === "APPLY_TEXT" ||
      type === "SELECT_PARENT"
    ) {
      console.log(
        "[Shipper Visual Editor] Received message:",
        type,
        "from origin:",
        event.origin
      );

      // Validate origin - all messages require proper origin validation
      // This ensures shipper domains and vercel domains are allowed
      const originAllowed = isAllowedOrigin(event.origin);

      // Only allow if origin is validated
      const isAllowed = originAllowed;

      // Detailed logging for debugging
      console.log("[Shipper Visual Editor] Origin validation:", {
        origin: event.origin,
        messageType: type,
        originAllowed: originAllowed,
        isAllowed: isAllowed,
        allowedOrigins: CONFIG.ALLOWED_ORIGINS,
        parentWindow: window.parent !== window ? "exists" : "same",
        referrer: document.referrer || "none",
      });

      if (!isAllowed) {
        console.warn(
          "[Shipper Visual Editor] Message blocked from unauthorized origin:",
          event.origin,
          "Message type:",
          type
        );
        return;
      }

      if (type === "ENABLE_VISUAL_EDIT") {
        console.log("[Shipper Visual Editor] Enabling visual editor...");
        enableVisualEditor();
      } else if (type === "DISABLE_VISUAL_EDIT") {
        console.log("[Shipper Visual Editor] Disabling visual editor...");
        disableVisualEditor();
      } else if (type === "APPLY_STYLE") {
        applyVisualEditorStyle(payload);
      } else if (type === "APPLY_TEXT") {
        applyVisualEditorText(payload);
      } else if (type === "SELECT_PARENT") {
        // Select the parent element of the currently selected element
        if (!visualEditorState.selectedElement) {
          console.warn("[Shipper Visual Editor] No element selected, cannot select parent");
          return;
        }

        const currentElement = visualEditorState.selectedElement;
        let parentElement = currentElement.parentElement;

        // Skip non-meaningful parents (like wrapper divs without classes)
        // and try to find a parent with a shipper ID if possible
        let searchDepth = 0;
        const maxSearchDepth = 10;
        while (parentElement && parentElement !== document.body && searchDepth < maxSearchDepth) {
          const hasShipperId = parentElement.getAttribute("data-shipper-id");
          const hasMeaningfulClasses = parentElement.className &&
            typeof parentElement.className === "string" &&
            parentElement.className.trim().length > 0;

          // Accept this parent if it has a shipper ID or meaningful classes
          if (hasShipperId || hasMeaningfulClasses) {
            break;
          }

          // Otherwise, try the next parent
          parentElement = parentElement.parentElement;
          searchDepth++;
        }

        if (!parentElement || parentElement === document.body) {
          console.warn("[Shipper Visual Editor] No parent element available");
          return;
        }

        console.log("[Shipper Visual Editor] Selecting parent element:", parentElement.tagName, parentElement.className);

        // Update selection state
        visualEditorState.selectedElement = parentElement;

        // Hide hover overlay
        if (visualEditorState.hoverOverlay) {
          visualEditorState.hoverOverlay.style.display = "none";
        }

        // Update highlight overlay
        const shipperId = parentElement.getAttribute("data-shipper-id");
        if (shipperId) {
          const elementsWithSameId = document.querySelectorAll(
            `[data-shipper-id="${shipperId}"]`
          );

          if (elementsWithSameId.length > 1) {
            // Show highlight overlay on all repeated elements
            hideRepeatedHoverOverlays();
            elementsWithSameId.forEach((element, index) => {
              const overlay = getOrCreateRepeatedHoverOverlay(index);
              overlay.style.border = `2px solid ${CONFIG.HIGHLIGHT_COLOR}`;
              overlay.style.background = "rgba(59, 130, 246, 0.15)";
              updateOverlay(overlay, element);
            });
            if (visualEditorState.highlightOverlay) {
              visualEditorState.highlightOverlay.style.display = "none";
            }
          } else {
            hideRepeatedHoverOverlays();
            updateOverlay(visualEditorState.highlightOverlay, parentElement);
          }
        } else {
          hideRepeatedHoverOverlays();
          updateOverlay(visualEditorState.highlightOverlay, parentElement);
        }

        // Send element info to parent window
        const elementInfo = getElementInfo(parentElement);
        postToParent({
          type: "ELEMENT_SELECTED",
          payload: elementInfo,
        });
      }
    }
  });

  // ===== Initialize All Monitoring =====
  function init() {
    setupErrorTracking();
    setupNetworkMonitoring();
    setupConsoleCapture();
    setupPreviewPopupRouting();
    setupNavigationTracking();
    setupContentDetection();

    // Notify parent that monitoring is active
    postToParent({
      type: "MONITOR_INITIALIZED",
      data: { url: window.location.href },
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();