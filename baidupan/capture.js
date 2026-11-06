/*
 * 百度网盘 Cookie / APP 签到请求捕获脚本（Loon）
 * 敏感信息仅保存在 Loon 的 $persistentStore 中。
 */

const COOKIE_KEY = "baidupan_cookie";
const APP_REQUEST_KEY = "baidupan_app_sign_request";
const NOTIFY_TIME_KEY = "baidupan_capture_notify_time";
const NOTIFY_COOLDOWN = 5 * 60 * 1000;

function getHeader(headers, name) {
  if (!headers) return "";
  const target = name.toLowerCase();
  const key = Object.keys(headers).find((item) => item.toLowerCase() === target);
  return key ? String(headers[key] || "") : "";
}

function sanitizeHeaders(headers) {
  const ignored = ["content-length", "host", ":authority", ":method", ":path", ":scheme"];
  const output = {};
  Object.keys(headers || {}).forEach((key) => {
    if (!ignored.includes(key.toLowerCase())) output[key] = headers[key];
  });
  return output;
}

function getCookieValue(cookie, name) {
  const target = name.toLowerCase();
  const parts = String(cookie || "").split(";");
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim().toLowerCase() === target) {
      return part.slice(index + 1).trim();
    }
  }
  return "";
}

function appRequestSignature(template) {
  if (!template || typeof template !== "object") return "";
  return JSON.stringify({
    url: template.url || "",
    method: template.method || "GET",
    headers: template.headers || {},
    body: template.body || "",
    deviceParams: template.deviceParams || {}
  });
}

function extractDeviceParams(rawUrl) {
  const result = {};
  const query = String(rawUrl || "").split("?")[1] || "";
  query.split("&").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = decodeURIComponent(part.slice(0, index));
    if (["cuid", "devuid", "idfv"].includes(key.toLowerCase())) {
      result[key.toLowerCase()] = decodeURIComponent(part.slice(index + 1));
    }
  });
  return result;
}

try {
  const url = String($request.url || "");
  const headers = $request.headers || {};
  const cookie = getHeader(headers, "Cookie");
  const messages = [];

  if (cookie && /(?:^|;\s*)BDUSS=/i.test(cookie)) {
    const oldCookie = $persistentStore.read(COOKIE_KEY) || "";
    const oldBduss = getCookieValue(oldCookie, "BDUSS");
    const oldStoken = getCookieValue(oldCookie, "STOKEN");
    const newBduss = getCookieValue(cookie, "BDUSS");
    const newStoken = getCookieValue(cookie, "STOKEN");
    const credentialsChanged = !oldCookie || oldBduss !== newBduss || (newStoken && oldStoken !== newStoken);
    if (credentialsChanged && $persistentStore.write(cookie, COOKIE_KEY)) {
      messages.push("Cookie 已更新");
    }
  }

  if (/\/coins\/taskcenter\/signin/i.test(url)) {
    const requestTemplate = {
      capturedAt: new Date().toISOString(),
      url,
      method: String($request.method || "GET").toUpperCase(),
      headers: sanitizeHeaders(headers),
      body: typeof $request.body === "string" ? $request.body : "",
      deviceParams: extractDeviceParams(url)
    };
    const serialized = JSON.stringify(requestTemplate);
    const oldTemplate = $persistentStore.read(APP_REQUEST_KEY) || "";
    let oldSignature = "";
    try {
      oldSignature = appRequestSignature(JSON.parse(oldTemplate));
    } catch (_) {}
    if (oldSignature !== appRequestSignature(requestTemplate) && $persistentStore.write(serialized, APP_REQUEST_KEY)) {
      messages.push("APP 签到请求模板已保存");
    }
  }

  if (messages.length) {
    const now = Date.now();
    const lastNotifyTime = Number($persistentStore.read(NOTIFY_TIME_KEY) || 0);
    if (!lastNotifyTime || now - lastNotifyTime >= NOTIFY_COOLDOWN) {
      $persistentStore.write(String(now), NOTIFY_TIME_KEY);
      $notification.post("百度网盘", "自动获取成功", messages.join("\n"));
    }
  }
} catch (error) {
  console.log(`[百度网盘捕获] ${error && error.message ? error.message : error}`);
}

$done({});

