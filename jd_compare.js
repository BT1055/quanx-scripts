/*
 * jd_compare.js —— 京东商品比价 + 接口诊断（v2.0 始终弹窗版）
 *
 * 逻辑：
 *   1. 始终弹窗，确保规则生效可见（绝不再静默吞掉）
 *   2. 若响应里同时出现 skuId + 价格字段 → 弹「京东比价」通知，显示价格
 *   3. 否则弹「京东探针」通知，只显示 functionId / skuId / 是否含价格关键词
 *
 * 安全声明：全部逻辑仅在本地设备运行，不收集、不上传任何数据，
 *           绝不在通知中显示手机号/姓名/地址等隐私字段。
 */

var url = $request.url || '';
var body = $response.body || '';

// URL 里的 functionId（诊断标签）
var urlFid = (url.match(/[?&]functionId=([a-zA-Z0-9_]+)/) || [])[1] || '无';

// skuId：URL 或响应体中查找
var skuId = (url.match(/[?&]skuId=(\d+)/) || [])[1]
         || (body.match(/"skuId"\s*:\s*\[?\s*"?(\d+)/) || [])[1]
         || '';

// 是否含价格关键词（宽松判断：只要响应里出现 price 这个词就标记）
var hasPriceKW = /price/i.test(body);

// 路径
var path = (url.match(/\/(client\.action|api)(?:\?|$)/) || [])[1] || '其他';

// === 优先：若同时有 skuId + 价格 → 弹比价 ===
if (skuId && hasPriceKW) {
  var info = extractPrice(body);
  if (info) {
    $notify('京东比价', '商品 ' + skuId + ' | 接口 ' + urlFid, buildMessage(info));
    $done({});
    return;
  }
}

// === 否则：弹诊断通知（始终弹，确保规则可见）===
// 接口名直接放通知标题，方便用户看 / 截图
// 副标题显示 skuId 和含价格标记，正文显示完整字段拼成的单行
$notify(
  '🔍' + urlFid,
  'skuId=' + (skuId || '无') + (hasPriceKW ? ' | ★含价' : ''),
  'URL功能=' + urlFid + ' | skuId=' + (skuId || '无') + ' | 路径=' + path + ' | 含价格=' + (hasPriceKW ? '是' : '否')
);

$done({});

// ===== 价格提取：多模式兜底 =====
function extractPrice(body) {
  var cur = '';
  var orig = '';
  var m;

  m = body.match(/"price"\s*:\s*\{[^{}]*?"p"\s*:\s*"?(\d+(?:\.\d+)?)"?[^{}]*?"op"\s*:\s*"?(\d+(?:\.\d+)?)"?/);
  if (m) { cur = m[1]; orig = m[2]; }

  if (!cur) {
    m = body.match(/"p"\s*:\s*"?(\d+(?:\.\d+)?)"?[^{}]{0,80}"op"\s*:\s*"?(\d+(?:\.\d+)?)"?/);
    if (m) { cur = m[1]; orig = m[2]; }
  }

  if (!cur) {
    var c = (body.match(/"currentPrice"\s*:\s*"?(\d+(?:\.\d+)?)"?/) || [])[1];
    var o = (body.match(/"originalPrice"\s*:\s*"?(\d+(?:\.\d+)?)"?/) || [])[1];
    if (c) { cur = c; orig = o || ''; }
  }

  if (!cur) {
    cur = (body.match(/"(?:p|jdPrice|salePrice|priceShow|mobilePrice)"\s*:\s*"?(\d+(?:\.\d+)?)"?/) || [])[1] || '';
  }

  if (!cur || Number(cur) <= 0) return null;
  return { current: cur, original: orig };
}

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