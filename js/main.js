/* =====================================================================
 * main.js — 交互逻辑 / 像素画板 / 数据同步
 * ---------------------------------------------------------------------
 * 分区：
 *   ① 工具函数与全局引用
 *   ② Toast 提示
 *   ③ 入场弹窗
 *   ④ 静态内容渲染（固定标识 / 联系方式栏 / 各部分文案）
 *   ⑤ 像素画板（渲染 / 放置 / 激活）
 *   ⑥ 每日额度（localStorage + 零点重置 + 彩蛋）
 *   ⑦ GitHub Gist 数据同步（读取 / 合并 / 写入 / 重试 / 本地兜底）
 *   ⑧ 我的项目卡片（GitHub API 动态拉取）
 *   ⑨ 平滑滚动
 *   ⑩ 初始化
 * 说明：所有文案与参数仅来自 config.js（CONFIG），本文件不写死内容。
 * ===================================================================== */

(function () {
  "use strict";

  /* =====================================================================
   * ① 工具函数与全局引用
   * ===================================================================== */

  const CFG = window.CONFIG;

  const $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  const $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  const clamp = function (v, min, max) {
    return Math.max(min, Math.min(max, v));
  };
  const pad2 = function (n) {
    return String(n).padStart(2, "0");
  };
  const todayStr = function () {
    const d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  };
  const sleep = function (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  };

  /* =====================================================================
   * ② Toast 提示
   * ===================================================================== */
  const toastEl = $("#toast");
  let toastTimer = null;

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, CFG.toast.duration);
  }

  /* =====================================================================
   * ③ 入场弹窗
   *   - 第一步：欢迎语 + 「确定」
   *   - 第二步：平滑切换为网站介绍 + 「进入网站」
   *   - 第三步：弹窗淡出，展示主页
   * ===================================================================== */
  const modalEl = $("#modalOverlay");
  const modalTitle = $("#modalTitle");
  const modalDesc = $("#modalDesc");
  const modalBtn = $("#modalBtn");
  let modalStep = 1;

  function animateStep(el) {
    el.classList.remove("step-swap");
    // 强制重排后重新加类，保证动画每次都能触发
    void el.offsetWidth;
    el.classList.add("step-swap");
  }

  function closeModal() {
    modalEl.classList.add("closed");
    document.body.style.overflow = ""; // 恢复页面滚动
    setTimeout(function () {
      modalEl.style.display = "none";
    }, 520);
  }

  function setupModal() {
    var m = CFG.modal;
    modalTitle.textContent = m.step1Title;
    modalDesc.style.display = "none"; // 第一步不展示介绍文字
    modalBtn.textContent = m.step1Btn;

    modalBtn.addEventListener("click", function () {
      if (modalStep === 1) {
        // 第二步：切换为网站介绍
        modalStep = 2;
        modalTitle.textContent = m.step2Title;
        modalDesc.style.display = "";
        modalDesc.textContent = m.step2Desc;
        modalBtn.textContent = m.step2Btn;
        animateStep(modalTitle);
        animateStep(modalDesc);
        animateStep(modalBtn);
      } else if (modalStep === 2) {
        // 第三步：关闭弹窗，初始化画板数据
        modalStep = 3;
        closeModal();
        initBoardData(); // 进入网站后开始拉取画板数据
      }
    });
  }

  /* =====================================================================
   * ④ 静态内容渲染（固定标识 / 联系方式栏 / 各部分标题文案）
   * ===================================================================== */
  function renderStatics() {
    // 右上角固定标识
    $("#fixedTag").textContent =
      CFG.site.author + " ｜ " + CFG.site.tagline;

    // 页面标题
    document.title = CFG.site.title;

    // 左侧联系方式栏
    var bar = $("#contactBar");
    bar.className = "contact-bar";
    bar.innerHTML = "";
    var titleEl = document.createElement("div");
    titleEl.className = "contact-title";
    titleEl.textContent = CFG.contact.title;
    bar.appendChild(titleEl);

    CFG.contact.items.forEach(function (item) {
      var el = document.createElement(item.url ? "a" : "span");
      el.className = "contact-item";
      el.textContent = item.label + "：" + (item.value || item.url || "");
      if (item.url) {
        el.href = item.url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      } else if (item.mailto) {
        el.href = "mailto:" + item.mailto;
      }
      bar.appendChild(el);
    });

    // 画板内部文案
    $("#boardLogo").textContent = CFG.board.logoText;
    $("#enterBtn").textContent = CFG.board.enterText;
    $("#boardHint").textContent = CFG.board.inactiveHint;

    // 创作板块
    $("#creation .section-title").textContent = CFG.creation.title;
    $("#creation .creation-text").textContent = CFG.creation.text;

    // 我的项目板块标题
    $("#projects .section-title").textContent = CFG.projects.title;

    // 底栏
    $("#siteFooter").textContent = CFG.site.footer;
  }

  /* =====================================================================
   * ⑤ 像素画板
   *   - 逻辑网格 500×500，离屏 500×500 画布作为像素源数据
   *   - 展示画布等比缩放，单格尺寸随容器自适应，完整显示不溢出
   *   - 未激活时仅可查看；点击「进入」后激活放置
   * ===================================================================== */
  const display = $("#pixelCanvas");
  const enterBtn = $("#enterBtn");
  const HOVER_COLOR = "#d97757"; // 悬停格高亮描边色
  let boardActive = false;
  let hoverCell = null;

  // 离屏像素源画布（500×500，一格=一个像素）
  const offCtx = (function () {
    var c = document.createElement("canvas");
    c.width = CFG.board.cols;
    c.height = CFG.board.rows;
    return c.getContext("2d");
  })();

  // 当前展示的像素集合：key = "x,y"，value = "#色值"
  // 统一以「逻辑 500×500」坐标系为准
  const pixels = new Map();
  // 待同步（尚未成功写入 Gist）的像素集合
  const pending = new Map();

  function setBufferPixel(key, color) {
    var parts = key.split(",");
    var x = parseInt(parts[0], 10);
    var y = parseInt(parts[1], 10);
    if (isNaN(x) || isNaN(y)) return;
    offCtx.fillStyle = color;
    offCtx.fillRect(x, y, 1, 1);
  }

  // 把整个像素集合绘制进离屏画布（用于加载远程 / 本地数据后重建）
  function rebuildBuffer() {
    offCtx.clearRect(0, 0, CFG.board.cols, CFG.board.rows);
    pixels.forEach(function (color, key) {
      setBufferPixel(key, color);
    });
  }

  function renderCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var w = display.clientWidth;
    var h = display.clientHeight;
    if (w === 0 || h === 0) return;

    display.width = Math.round(w * dpr);
    display.height = Math.round(h * dpr);
    var ctx = display.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // 底色（米白）→ 像素源 → 网格线 → 悬停高亮
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, display.width, display.height);
    ctx.drawImage(offCtx.canvas, 0, 0, display.width, display.height);

    drawGrid(ctx, w, h, dpr);

    if (boardActive && hoverCell) {
      var gw = w / CFG.board.cols;
      var gh = h / CFG.board.rows;
      ctx.strokeStyle = HOVER_COLOR;
      ctx.lineWidth = Math.max(1, 2 * dpr);
      ctx.strokeRect(
        hoverCell.x * gw * dpr,
        hoverCell.y * gh * dpr,
        gw * dpr,
        gh * dpr
      );
    }
  }

  // 极浅参考网格：每 25 格一条线
  function drawGrid(ctx, w, h, dpr) {
    var gap = 25;
    var step = w / CFG.board.cols * gap;
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    for (var x = step; x < w; x += step) {
      ctx.moveTo(x * dpr, 0);
      ctx.lineTo(x * dpr, display.height);
    }
    for (var y = step; y < h; y += step) {
      ctx.moveTo(0, y * dpr);
      ctx.lineTo(display.width, y * dpr);
    }
    ctx.stroke();
  }

  function canvasToCell(e) {
    var rect = display.getBoundingClientRect();
    var col = clamp(
      Math.floor(((e.clientX - rect.left) / rect.width) * CFG.board.cols),
      0,
      CFG.board.cols - 1
    );
    var row = clamp(
      Math.floor(((e.clientY - rect.top) / rect.height) * CFG.board.rows),
      0,
      CFG.board.rows - 1
    );
    return { x: col, y: row, key: col + "," + row };
  }

  // 画板激活
  enterBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    boardActive = true;
    enterBtn.classList.add("hidden");
    $("#boardHint").textContent = CFG.board.activeHint;
    display.style.cursor = "crosshair";
    renderCanvas();
  });

  // 悬停显示逻辑格高亮（未激活也显示，方便定位）
  display.addEventListener("mousemove", function (e) {
    hoverCell = canvasToCell(e);
    renderCanvas();
  });
  display.addEventListener("mouseleave", function () {
    hoverCell = null;
    renderCanvas();
  });

  // 放置像素
  display.addEventListener("mousedown", function (e) {
    e.preventDefault();
    if (e.target === enterBtn) return; // 「进入」按钮自身的点击，不当作画布放置
    if (!boardActive) {
      showToast(CFG.board.inactiveHint);
      return;
    }
    if (getRemaining() <= 0) {
      showToast(CFG.quota.exhaustedText);
      return;
    }
    var cell = canvasToCell(e);
    var color = $("#colorPicker").value;

    placePixel(cell.key, color);
  });

  function placePixel(key, color) {
    pixels.set(key, color);
    pending.set(key, color);
    setBufferPixel(key, color);
    renderCanvas();

    // 消耗额度
    var q = getQuota();
    q.used += 1;
    saveQuota(q);
    updateBadge();

    requestSync(); // 异步写入 Gist
  }

  /* =====================================================================
   * ⑥ 每日额度
   *   - 通过 localStorage 记录「日期 + 已使用数量」，刷新不清零
   *   - 自然日自动重置；次日零点自动恢复
   *   - 彩蛋：键盘输入「100914」→ 今日额度 +100（每天一次）
   * ===================================================================== */
  function getQuota() {
    var raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(CFG.quota.storageKey) || "null");
    } catch (err) {
      raw = null;
    }
    var today = todayStr();
    if (!raw || raw.date !== today) {
      raw = { date: today, used: 0, bonus: 0, eggFired: false };
    }
    return raw;
  }

  function saveQuota(q) {
    try {
      localStorage.setItem(CFG.quota.storageKey, JSON.stringify(q));
    } catch (err) {
      /* 存储失败不影响使用 */
    }
  }

  function getRemaining() {
    var q = getQuota();
    return CFG.quota.dailyLimit + (q.bonus || 0) - (q.used || 0);
  }

  function updateBadge() {
    var el = $("#remainingBadge");
    el.textContent = CFG.board.remainingText.replace(
      "{n}",
      String(Math.max(0, getRemaining()))
    );
  }

  // 零点自动恢复额度
  function scheduleMidnightReset() {
    var now = new Date();
    var next = new Date(now);
    next.setHours(24, 0, 1, 0);
    setTimeout(function () {
      getQuota(); // 日期变化时 getQuota 自动重建额度
      updateBadge();
      scheduleMidnightReset();
    }, next.getTime() - now.getTime());
  }

  // —— 彩蛋：监听键盘输入 ——
  function setupEasterEgg() {
    var egg = CFG.quota.egg;
    if (!egg.enabled) return;
    var buffer = "";
    document.addEventListener("keydown", function (e) {
      // 输入框等场景不触发彩蛋，避免干扰
      var tag = (e.target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      buffer = buffer + e.key;
      if (buffer.length > egg.code.length) {
        buffer = buffer.slice(-egg.code.length);
      }
      if (buffer === egg.code) {
        buffer = "";
        var q = getQuota();
        if (q.eggFired) {
          showToast(egg.missText);
          return;
        }
        q.bonus = (q.bonus || 0) + egg.bonus;
        q.eggFired = true;
        saveQuota(q);
        updateBadge();
        showToast(egg.hitText);
      }
    });
  }

  /* =====================================================================
   * ⑦ GitHub Gist 数据同步
   *   - 读取：GET gist → 解析 pixels.json → 渲染
   *   - 写入：先 GET 最新数据合并 → PATCH 整体写入（避免覆盖他人像素）
   *   - 容错：失败自动重试 N 次；仍失败则本地暂存 + 提示
   * ===================================================================== */

  // 读取远端像素
  async function fetchRemotePixels() {
    var g = CFG.gist;
    var res = await fetch(
      "https://api.github.com/gists/" + encodeURIComponent(g.GIST_ID),
      {
        headers: {
          Authorization: "token " + g.GITHUB_TOKEN,
          Accept: "application/vnd.github+json"
        }
      }
    );
    if (!res.ok) throw new Error("Gist GET failed: " + res.status);
    var data = await res.json();
    var file = data.files && data.files[g.pixelsFile];
    if (!file || !file.content) return {};
    return JSON.parse(file.content || "{}");
  }

  // 把合并后的对象整体写入远端
  async function patchRemotePixels(obj) {
    var g = CFG.gist;
    var payload = {};
    payload[g.pixelsFile] = { content: JSON.stringify(obj) };
    var res = await fetch(
      "https://api.github.com/gists/" + encodeURIComponent(g.GIST_ID),
      {
        method: "PATCH",
        headers: {
          Authorization: "token " + g.GITHUB_TOKEN,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json"
        },
        body: JSON.stringify({ files: payload })
      }
    );
    if (!res.ok) throw new Error("Gist PATCH failed: " + res.status);
    var data = await res.json();
    var file = data.files && data.files[g.pixelsFile];
    return file ? JSON.parse(file.content || "{}") : obj;
  }

  // 本地兜底存储（写入失败时暂存全部像素）
  function saveLocalFallback(data) {
    try {
      localStorage.setItem(CFG.gist.localFallbackKey, JSON.stringify(data));
    } catch (err) {
      /* 空间不足等异常忽略 */
    }
  }

  function loadLocalFallback() {
    try {
      var raw = localStorage.getItem(CFG.gist.localFallbackKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  let syncBusy = false;
  let syncDirty = false;

  // 请求一次同步（若正在同步则标记稍后再跑）
  function requestSync() {
    if (!isSyncEnabled()) return;
    if (syncBusy) {
      syncDirty = true;
      return;
    }
    sync();
  }

  function isSyncEnabled() {
    var g = CFG.gist;
    return (
      g.GIST_ID &&
      g.GIST_ID.indexOf("PASTE_") !== 0 &&
      g.GITHUB_TOKEN &&
      g.GITHUB_TOKEN.indexOf("PASTE_") !== 0
    );
  }

  // 核心同步流程：GET 最新 → 合并 pending → PATCH → 成功清空 pending
  async function sync() {
    syncBusy = true;
    try {
      var merged = await fetchRemotePixels();
      pending.forEach(function (color, key) {
        merged[key] = color; // 本地待写入像素优先合并（直接覆盖旧值）
      });
      await patchRemotePixels(merged);
      pending.clear(); // 写入成功，清除待同步标记
      showToast("像素已同步");
    } catch (err) {
      // 自动重试
      var retried = 0;
      var ok = false;
      while (retried < CFG.gist.retryMax) {
        retried += 1;
        await sleep(1200 * retried); // 递增等待：1.2s / 2.4s / ...
        try {
          var merged2 = await fetchRemotePixels();
          pending.forEach(function (color, key) {
            merged2[key] = color;
          });
          await patchRemotePixels(merged2);
          pending.clear();
          ok = true;
          break;
        } catch (err2) {
          /* 继续重试 */
        }
      }
      if (!ok) {
        // 全部失败 → 本地兜底
        var fallback = {};
        pixels.forEach(function (color, key) {
          fallback[key] = color;
        });
        saveLocalFallback(fallback);
        showToast(CFG.gist.failureText);
      }
    } finally {
      syncBusy = false;
      if (syncDirty) {
        syncDirty = false;
        sync();
      }
    }
  }

  // 页面进入后初始化画板数据（远端优先 + 本地兜底）
  async function initBoardData() {
    updateBadge();

    if (!isSyncEnabled()) {
      console.warn(
        "[config.js] 尚未配置 GIST_ID / GITHUB_TOKEN，画板将仅使用本地数据。" +
          "如需多人共享画板，请按 config.js 中说明填写。"
      );
      // 仍然加载本地兜底像素
      var localOn = loadLocalFallback();
      if (localOn) {
        Object.keys(localOn).forEach(function (key) {
          pixels.set(key, localOn[key]);
          pending.set(key, localOn[key]);
        });
        rebuildBuffer();
      }
      renderCanvas();
      if (pending.size) requestSync();
      return;
    }

    try {
      // 先读本地兜底（让页面尽快有内容），再以远端为准合并
      var localFirst = loadLocalFallback();
      if (localFirst) {
        Object.keys(localFirst).forEach(function (key) {
          pixels.set(key, localFirst[key]);
          pending.set(key, localFirst[key]);
        });
        rebuildBuffer();
      }

      var remote = await fetchRemotePixels();
      Object.keys(remote).forEach(function (key) {
        // 远端数据为准，但本会话刚放置（pending）的像素不被覆盖
        if (!pending.has(key)) {
          pixels.set(key, remote[key]);
        }
      });
      rebuildBuffer();
      renderCanvas();
      if (pending.size) requestSync(); // 把残留的本地兜底同步上去
    } catch (err) {
      // 远端拉取失败：展示本地兜底
      var fb = loadLocalFallback();
      if (fb) {
        Object.keys(fb).forEach(function (key) {
          pixels.set(key, fb[key]);
          pending.set(key, fb[key]);
        });
        rebuildBuffer();
        renderCanvas();
        requestSync();
      }
    }
  }

  /* =====================================================================
   * ⑧ 我的项目卡片（GitHub API 动态拉取）
   *   - 基于用户名实时获取仓库描述、编程语言标签
   *   - 点击卡片在新标签页打开对应仓库
   *   - API 失败时显示兜底文案，并保留名称卡片可点击
   * ===================================================================== */
  async function loadProjects() {
    var grid = $("#projectGrid");
    var p = CFG.projects;
    grid.innerHTML = "";

    var repoMap = new Map();
    var apiFailed = false;

    try {
      var res = await fetch(
        "https://api.github.com/users/" + encodeURIComponent(p.owner) + "/repos?per_page=100",
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) throw new Error("repos fetch failed: " + res.status);
      var list = await res.json();
      list.forEach(function (r) {
        repoMap.set(r.name, r);
      });
    } catch (err) {
      apiFailed = true;
    }

    if (apiFailed) {
      var note = document.createElement("p");
      note.className = "project-fallback";
      note.textContent = p.fallbackText;
      grid.appendChild(note);
    }

    p.repos.forEach(function (name) {
      var repo = repoMap.get(name) || null;
      grid.appendChild(buildCard(name, repo, p));
    });
  }

  function buildCard(name, repo, p) {
    var a = document.createElement("a");
    a.className = "project-card";
    a.href = repo ? repo.html_url : "https://github.com/" + p.owner + "/" + name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    var h3 = document.createElement("h3");
    h3.textContent = name;

    var desc = document.createElement("div");
    desc.className = "project-desc";
    desc.textContent = repo && repo.description ? repo.description : p.noDescText;

    var lang = document.createElement("span");
    lang.className = "lang-badge";
    lang.textContent = repo && repo.language ? repo.language : p.noLangText;

    a.appendChild(h3);
    a.appendChild(desc);
    a.appendChild(lang);
    return a;
  }

  /* =====================================================================
   * ⑨ 平滑滚动（导航框 → 对应内容区）
   * ===================================================================== */
  function setupSmoothScroll() {
    $$(".nav-box").forEach(function (box) {
      box.addEventListener("click", function (e) {
        e.preventDefault();
        var target = box.getAttribute("data-target");
        if (!target) return;
        var el = document.getElementById(target);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // 窗口尺寸变化时重绘画板（等比自适应）
  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCanvas, 120);
  });

  /* =====================================================================
   * ⑩ 初始化
   * ===================================================================== */
  function init() {
    renderStatics();
    setupModal();
    document.body.style.overflow = "hidden"; // 弹窗期间锁定背景滚动
    setupSmoothScroll();
    setupEasterEgg();
    scheduleMidnightReset();
    loadProjects(); // 项目卡片后台拉取
    renderCanvas(); // 先渲染空画板（待进入弹窗后再填充数据）
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();