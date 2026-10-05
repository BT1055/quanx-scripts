/*
 * jd_compare.js —— 京东商品比价（全接口扫描版 v1.0）
 * 思路：不再猜测 functionId，直接扫描 api.m.jd.com 的所有响应体，
 * 只要发现「skuId + 价格字段」就弹比价通知，并附上接口名便于诊断。
 *
 * 通知分两种：
 *   「京东比价」—— 成功解析出价格
 *   「京东调试」—— 响应里有 skuId 但没找到价格（把接口名报回来即可）
 *
 * 安全声明：全部逻辑仅在本地设备运行，不收集、不上传任何数据，
 *           绝不在通知中显示手机号/姓名/地址等隐私字段。
 */

var url = $request.url || '';
var body = $response.body || '';

// URL 里的 functionId（仅作诊断标签）
var urlFid = (url.match(/[?&]functionId=([a-zA-Z0-9_]+)/) || [])[1] || '未知';

// skuId：优先从 URL 取，其次从响应体取
var skuId = (url.match(/[?&]skuId=(\d+)/) || [])[1]
         || (body.match(/"skuId"\s*:\s*\[?\s*"?(\d+)/) || [])[1]
         || '';

if (!skuId) {
  // 与商品无关的响应，直接放行
  $done({});
} else {
  var info = extractPrice(body);
  if (info) {
    $notify('京东比价', '商品 ' + skuId + ' | 接口 ' + urlFid, buildMessage(info));
  } else {
    $notify('京东调试', '接口 ' + urlFid, '发现商品 ' + skuId + '，但未找到价格字段');
  }
  $done({});
}

// ===== 价格提取：多模式兜底 =====
function extractPrice(body) {
  var cur = '';
  var orig = '';
  var m;

  // 模式1：京东典型价格对象 "price":{"p":"1099.00","op":"1399.00",...}
  m = body.match(/"price"\s*:\s*\{[^{}]*?"p"\s*:\s*"?(\d+(?:\.\d+)?)"?[^{}]*?"op"\s*:\s*"?(\d+(?:\.\d+)?)"?/);
  if (m) { cur = m[1]; orig = m[2]; }

  // 模式2：p / op 相邻出现（不含 price 包裹层）
  if (!cur) {
    m = body.match(/"p"\s*:\s*"?(\d+(?:\.\d+)?)"?[^{}]{0,80}"op"\s*:\s*"?(\d+(?:\.\d+)?)"?/);
    if (m) { cur = m[1]; orig = m[2]; }
  }

  // 模式3：currentPrice / originalPrice
  if (!cur) {
    var c = (body.match(/"currentPrice"\s*:\s*"?(\d+(?:\.\d+)?)"?/) || [])[1];
    var o = (body.match(/"originalPrice"\s*:\s*"?(\d+(?:\.\d+)?)"?/) || [])[1];
    if (c) { cur = c; orig = o || ''; }
  }

  // 模式4：单一价格字段兜底（至少要有当前价才算数）
  if (!cur) {
    cur = (body.match(/"(?:p|jdPrice|salePrice|priceShow|mobilePrice)"\s*:\s*"?(\d+(?:\.\d+)?)"?/) || [])[1] || '';
  }

  if (!cur || Number(cur) <= 0) return null;
  return { current: cur, original: orig };
}

// ===== 通知文案 =====
function buildMessage(info) {
  var msg = '当前价：¥' + info.current;
  var o = Number(info.original);
  var c = Number(info.current);
  if (info.original && o > c) {
    msg += '\n原价：¥' + info.original;
    msg += '\n直降：¥' + formatMoney(sub(o, c));
  }
  return msg;
}

function formatMoney(n) {
  return String(n.toFixed ? n.toFixed(2) : n);
}

function sub(a, b) {
  return add(a, -Number(b));
}

function add(a, b) {
  a = a.toString();
  b = b.toString();
  var aArr = a.split('.');
  var bArr = b.split('.');
  var d1 = aArr.length === 2 ? aArr[1] : '';
  var d2 = bArr.length === 2 ? bArr[1] : '';
  var maxLen = Math.max(d1.length, d2.length);
  var m = Math.pow(10, maxLen);
  return Number(((Number(a) * m + Number(b) * m) / m).toFixed(maxLen));
}