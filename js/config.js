/* =====================================================================
 * config.js — 全站唯一可配置文件
 * ---------------------------------------------------------------------
 * 所有文案 / 链接 / 参数全部集中在这里。
 * 业务代码（main.js）只引用本文件里的变量，不写死任何显示内容。
 * 日常修改内容：只改这个文件即可，无需动其它代码。
 *
 * 注意：文件末尾保持 `window.CONFIG = CONFIG;` 这一行，不要删除。
 * ===================================================================== */

const CONFIG = (function () {
  "use strict";

  return {
    /* ---------- 1. 站点基本标识（右上角固定悬浮小字） ---------- */
    site: {
      author: "作者：跨世代",
      tagline: "引言：求是奋进",
      title: "个人社交名片 · 像素画板",
      footer: "© 2026 Jatt9520 · 用爱与像素搭建"
    },

    /* ---------- 2. 入场弹窗 ---------- */
    modal: {
      step1Title: "欢迎来到我的网站",
      step1Btn: "确定",
      step2Title: "关于这个网站",
      step2Desc:
        "这里是一位高中牲一时兴起创建的网站。" +
        "你可以在像素画板留下你的印记，也可以逛逛我的项目仓库，感谢你的到访。",
      step2Btn: "进入网站"
    },

    /* ---------- 3. 左侧联系方式栏 ---------- */
    contact: {
      title: "联系方式",
      items: [
        {
          label: "GitHub 主页",
          url: "https://github.com/Jatt9520"
        },
        {
          label: "邮箱",
          value: "hndg7433@foxmail.com",
          mailto: "hndg7433@foxmail.com"
        }
      ]
    },

    /* ---------- 4. 像素画板 ---------- */
    board: {
      cols: 500, // 逻辑网格列数（宽）
      rows: 500, // 逻辑网格行数（高）
      enterText: "进入", // 未激活时画板中央按钮文字
      inactiveHint: "点击「进入」后可放置像素", // 未激活时的提示
      activeHint: "点击网格放置像素 · 同一位置可直接覆盖", // 激活后的提示
      logoText: "像素画板", // 画板框内左上角小标题
      remainingText: "今日剩余像素：{n} 个" // {n} 会被替换为剩余数量
    },

    /* ---------- 5. 每日额度 ---------- */
    quota: {
      dailyLimit: 10, // 每位访客每日可放置数量
      storageKey: "qp_quota_v1", // localStorage 记录键（日期 + 已用量 + 彩蛋加成）
      exhaustedText: "今日像素已用完，明天再来吧",
      // —— 彩蛋：键盘输入 "100914" 增加 100 个像素 ——
      egg: {
        enabled: true,
        code: "100914",
        bonus: 100,
        hitText: "彩蛋触发！今日像素额度 +100",
        missText: "今天的彩蛋已触发过啦"
      }
    },

    /* ---------- 6. GitHub Gist 数据同步 ----------
     * pixels.json 内容格式：{ "x,y": "#色值" }，所有访客共享同一块画板。
     *
     * 配置方法：
     *   1. 打开 https://gist.github.com 新建一个 public Gist，
     *      建议文件名 pixels.json（也可自定义，与下面 pixelsFile 对应即可）。
     *   2. 复制该 Gist 的 ID（在 URL 里 gist.github.com/{你的用户名}/{GIST_ID}）。
     *   3. 生成一个只勾选 gist 权限的 Personal Access Token：
     *      GitHub → Settings → Developer settings → Personal access tokens。
     *      （Fine-grained token 仅授权 gist；或 classic token 只勾选 gist 权限。）
     *   4. 把两处占位文字替换为你自己的值。
     *
     * ⚠ 安全提醒：GitHub Pages 会把本站所有文件公开。
     *   请务必使用【只授予 gist 权限】的 Token，
     *   且不要勾选任何其它权限；如泄露请立刻在 GitHub 后台撤销并重新生成。
     */
    gist: {
      GIST_ID: "d6db8e01dabeeeb668ff070b2708d474", // ← 替换为你的 Gist ID
      GITHUB_TOKEN: "PASTE_YOUR_GITHUB_TOKEN_HERE", // ← 替换为你的只读 gist Token
      pixelsFile: "pixels.json",
      failureText: "网络波动中，你的像素已被暂存本地",
      retryMax: 5, // 写入失败时自动重试次数
      localFallbackKey: "qp_local_pixels_v1" // 写入失败时的本地兜底存储键
    },

    /* ---------- 7. 创作板块 ---------- */
    creation: {
      title: "创作初衷",
      text:
        "Hi 你好 我是一位高中牲这是我一时兴起创建的网站，谢谢你的访问 " +
        "有什么建议创意可以与我联系"
    },

    /* ---------- 8. 我的项目板块 ---------- */
    projects: {
      title: "我的项目",
      owner: "Jatt9520", // GitHub 用户名，用于实时拉取仓库信息
      repos: ["quasardb", "video-spider-installer", "MarkdownReader"], // 固定顺序
      fallbackText: "糟糕API好像获取失败了", // API 获取失败时的兜底文案
      noDescText: "暂无描述",
      noLangText: "未标注"
    },

    /* ---------- 9. Toast 全局提示 ---------- */
    toast: {
      duration: 3200 // 提示显示时长（毫秒）
    }
  };
})();

/* 全局暴露，main.js 通过 CONFIG 读取 */
window.CONFIG = CONFIG;
