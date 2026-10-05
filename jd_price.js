/*
 * jd_price.js —— 京东商品比价脚本
 * 版本: 2.2.0（自诊断版）
 *
 * 本版本在正常比价基础上增加了「自诊断」：
 *   - 若命中 getWareBusiness 接口 → 正常弹「京东比价」通知
 *   - 若命中 api.m.jd.com/api 但 functionId 不是 getWareBusiness
 *     → 弹「京东调试」通知，把真实的 functionId / skuId 显示出来，
 *       用于定位不同京东版本里的真实接口名。
 *
 * 安全声明：本脚本仅在本地设备运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';
var body = $response.body || '';

// 目标接口判断：functionId=getWareBusiness 可能出现在 URL 或请求体中
if (url.indexOf('getWareBusiness') !== -1 || reqBody.indexOf('getWareBusiness') !== -1) {
  runCompare();
} else {
  // 自诊断：非目标接口，但提取到了 functionId/skuId 时，弹调试通知
  var fid = extractFunctionId(url, reqBody);
  var sku = extractSkuId(url + '\n' + reqBody);
  if (fid || sku) {
    $notify('京东调试', 'functionId=' + (fid || '未知'), 'skuId=' + (sku || '未知') + '\nURL=' + url);
  }
  $done({});
}

// ===== 正常比价逻辑 =====
function runCompare() {
  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    $done({});
    return;
  }

  var skuId = extractSkuId(url + '\n' + reqBody);
  var info = extractPrice(obj);
  var msg = buildMessage(info);

  if (msg) {
    $notify('京东比价', skuId ? '商品 ' + skuId : '京东商品', msg);
  }
  $done({});
}

// 提取 functionId（兼容 query / 表单 / JSON 三种形式）
function extractFunctionId(url, reqBody) {
  var text = url + '\n' + (reqBody || '');
  var m = text.match(/functionId["']?\s*[:=]\s*["']?([a-zA-Z0-9_]+)/);
  return m ? m[1] : '';
}

// 从 URL 或请求体中提取 skuId（兼容 query、表单、JSON 三种形式）
function extractSkuId(text) {
  var m = text.match(/[?&]skuId=(\d+)/);
  if (m) return m[1];
  m = text.match(/["']?skuId["']?\s*[:=]\s*["']?(\d+)/);
  return m ? m[1] : '';
}

// 从响应中提取当前价 / 原价（兼容多种字段路径）
function extractPrice(obj) {
  var data = obj && typeof obj === 'object' && obj.data ? obj.data : (obj || {});
  var price = data && typeof data === 'object' && data.price ? data.price : {};

  var current = '';
  var original = '';

  if (price.p !== undefined && price.p !== '') current = price.p;
  else if (price.price !== undefined && price.price !== '') current = price.price;
  else if (data.lowPrice !== undefined && data.lowPrice !== '') current = data.lowPrice;

  if (price.op !== undefined && price.op !== '') original = price.op;
  else if (price.m !== undefined && price.m !== '') original = price.m;

  return { current: current, original: original };
}

function buildMessage(info) {
  if (!info.current) return '';
  var msg = '当前价：¥' + info.current;
  if (info.original && info.original !== info.current) {
    msg += '\n原价：¥' + info.original;
    var d = sub(Number(info.original), Number(info.current));
    if (d > 0) msg += '\n直降：¥' + formatMoney(d);
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