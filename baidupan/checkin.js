/*
 * 百度网盘会员成长签到（Loon）
 * 功能：签到、获取每日题目、自动答题、查询会员等级和成长值。
 */

const COOKIE_KEY = "baidupan_cookie";
const cookie = $persistentStore.read(COOKIE_KEY) || "";
const results = [];

const headers = {
  Accept: "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://pan.baidu.com/wap/svip/growth/task",
  "Accept-Language": "zh-CN,zh;q=0.9",
  Cookie: cookie
};

function finish(subtitle) {
  const body = results.length ? results.join("\n") : "没有可显示的执行结果";
  console.log(`[百度网盘签到] ${body}`);
  $notification.post("百度网盘签到", subtitle || "执行完成", body, {
    openUrl: "https://pan.baidu.com/wap/svip/growth/task"
  });
  $done();
}

function statusCode(response) {
  return Number((response && (response.status || response.statusCode)) || 0);
}

function parseJson(data) {
  try {
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

function findValue(object, names) {
  if (!object || typeof object !== "object") return undefined;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(object, name)) return object[name];
  }
  for (const key of Object.keys(object)) {
    const found = findValue(object[key], names);
    if (found !== undefined) return found;
  }
  return undefined;
}

function matchValue(text, pattern) {
  const matched = String(text || "").match(pattern);
  return matched ? matched[1] : undefined;
}

function get(url, callback) {
  $httpClient.get({ url, headers, timeout: 15000 }, (error, response, data) => {
    if (error) {
      callback(new Error(String(error)), null, "");
      return;
    }
    const status = statusCode(response);
    if (status !== 200) {
      callback(new Error(`HTTP ${status || "未知"}`), response, data || "");
      return;
    }
    callback(null, response, data || "");
  });
}

function queryUserInfo() {
  const url = "https://pan.baidu.com/rest/2.0/membership/user?app_id=250528&web=5&method=query";
  get(url, (error, _response, data) => {
    if (error) {
      results.push(`会员信息：失败（${error.message}）`);
      finish("部分任务失败");
      return;
    }
    const json = parseJson(data);
    const level = findValue(json, ["current_level"]) ?? matchValue(data, /current_level\"?\s*:\s*(\d+)/i);
    const value = findValue(json, ["current_value"]) ?? matchValue(data, /current_value\"?\s*:\s*(\d+)/i);
    results.push(`会员信息：等级 ${level ?? "未知"}，成长值 ${value ?? "未知"}`);
    finish(results.some((item) => item.includes("失败")) ? "部分任务失败" : "执行完成");
  });
}

function answerQuestion(askId, answer) {
  const url = `https://pan.baidu.com/act/v2/membergrowv2/answerquestion?app_id=250528&web=5&ask_id=${encodeURIComponent(askId)}&answer=${encodeURIComponent(answer)}`;
  get(url, (error, _response, data) => {
    if (error) {
      results.push(`每日答题：失败（${error.message}）`);
      queryUserInfo();
      return;
    }
    const json = parseJson(data);
    const score = findValue(json, ["score"]);
    const message = findValue(json, ["show_msg", "error_msg", "errmsg"]);
    results.push(`每日答题：${message || "请求成功"}${score !== undefined ? `，获得 ${score}` : ""}`);
    queryUserInfo();
  });
}

function getDailyQuestion() {
  const url = "https://pan.baidu.com/act/v2/membergrowv2/getdailyquestion?app_id=250528&web=5";
  get(url, (error, _response, data) => {
    if (error) {
      results.push(`获取题目：失败（${error.message}）`);
      queryUserInfo();
      return;
    }
    const json = parseJson(data);
    const askId = findValue(json, ["ask_id"]) ?? matchValue(data, /\"ask_id\"\s*:\s*(\d+)/i);
    const answer = findValue(json, ["answer"]) ?? matchValue(data, /\"answer\"\s*:\s*(\d+)/i);
    if (askId === undefined || answer === undefined) {
      results.push("每日答题：未获取到题目，可能今日已完成或接口已变化");
      queryUserInfo();
      return;
    }
    answerQuestion(askId, answer);
  });
}

function signIn() {
  const url = "https://pan.baidu.com/rest/2.0/membership/level?app_id=250528&web=5&method=signin";
  get(url, (error, _response, data) => {
    if (error) {
      results.push(`会员签到：失败（${error.message}）`);
      getDailyQuestion();
      return;
    }
    const json = parseJson(data);
    const points = findValue(json, ["points"]);
    const errno = findValue(json, ["errno", "error_code"]);
    const message = findValue(json, ["error_msg", "show_msg", "errmsg", "msg"]);
    if (points !== undefined) {
      results.push(`会员签到：成功，获得 ${points}`);
    } else if (message) {
      results.push(`会员签到：${message}${errno !== undefined ? `（${errno}）` : ""}`);
    } else {
      results.push("会员签到：请求成功，返回内容未识别");
    }
    getDailyQuestion();
  });
}

if (!cookie || !/(?:^|;\s*)BDUSS=/i.test(cookie)) {
  results.push("尚未获取 Cookie");
  results.push("请开启 MitM 后，用 Safari 登录并访问百度网盘会员成长任务页");
  finish("需要先获取 Cookie");
} else {
  signIn();
}

