/*
 * jd_fields.js —— 京东响应字段名探针（只列 key 名，不显示值，隐私安全）
 *
 * 目的：不再猜价格字段叫什么，直接把响应 JSON 里所有字段名弹出来。
 * 只要看到 key 列表，就能定位价格/原价字段名，然后写精准提取。
 *
 * 安全声明：只显示字段名（key），绝不显示任何字段值，
 *           手机号/姓名/地址等隐私数据不会出现在通知里。
 *           全部逻辑仅在本地设备运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var body = $response.body || '';

// URL 里的 functionId（诊断标签）
var urlFid = (url.match(/[?&]functionId=([a-zA-Z0-9_]+)/) || [])[1] || '无';

// skuId（URL 或响应体）
var skuId = (url.match(/[?&]skuId=(\d+)/) || [])[1]
         || (body.match(/"skuId"\s*:\s*\[?\s*"?(\d+)/) || [])[1]
         || '无';

// 响应体是否为 JSON
var isJSON = /^\s*[\[{]/.test(body);

var keys = '';
var note = '';

if (isJSON) {
  try {
    var obj = JSON.parse(body);
    var all = [];
    collectKeys(obj, all, 0);
    // 去重、排序
    all = all.filter(function (v, i) { return all.indexOf(v) === i; }).sort();
    // 只保留看起来与价格/商品相关的 key，优先显示
    var priceLike = all.filter(function (k) {
      return /price|^p$|^op$|^m$|cost|sale|discount|jd|mall|ware|sku|amount|money|yuan/i.test(k);
    });
    var rest = all.filter(function (k) { return priceLike.indexOf(k) === -1; });
    keys = priceLike.concat(rest).join(',');
    if (keys.length > 380) keys = keys.slice(0, 380) + '…';
    note = 'JSON有效';
  } catch (e) {
    note = 'JSON解析失败';
  }
} else {
  note = '非JSON（疑似加密或HTML）';
}

// 标题放接口名，正文放字段名列表
$notify(
  '🔑' + urlFid,
  'skuId=' + skuId + ' | ' + note,
  keys || '（无字段名）'
);

$done({});

// 递归收集所有 key 名（只收名字不收值）
function collectKeys(o, out, depth) {
  if (depth > 6) return;
  if (o === null || o === undefined) return;
  var t = typeof o;
  if (t === 'object') {
    if (Array.isArray(o)) {
      if (o.length) collectKeys(o[0], out, depth + 1);
      return;
    }
    for (var k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k)) {
        out.push(k);
        collectKeys(o[k], out, depth + 1);
      }
    }
  }
}