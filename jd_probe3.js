/*
 * jd_probe3.js —— 京东价格接口探针（全量版）
 * 同时抓取：URL 顶层 functionId、请求体嵌套 functionId、skuId，
 * 只弹「价格相关」的通知，过滤掉首页/启动时的配置类噪声。
 * 使用前提：MitM 主机名添加 api.m.jd.com
 * 安全声明：仅在本地运行，不收集、不上传数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';
var respBody = $response.body || '';

function grab(text, re) {
  var m = (text || '').match(re);
  return m ? m[1] : '';
}

// URL 顶层 functionId（client.action 的业务名就在 URL 里）
var urlFid = grab(url, /[?&]functionId=([a-zA-Z0-9_]+)/);

// 请求体里可能再嵌套一层 functionId（兼容表单 / JSON 两种格式）
var reqFid = grab(reqBody, /functionId["']?\s*[:=]\s*["']?([a-zA-Z0-9_]+)/);

// skuId 可能在请求体或 URL 里
var skuId = grab(reqBody + '\n' + url, /["']?sku(?:Id|Ids|ids)["']?\s*[:=]\s*["']?\[?\s*["']?(\d+)/);

var isPlain = /^\s*[\[{]/.test(respBody);
var hasPrice = /"p"|"op"|"m"|price|lowPrice|currentPrice|originalPrice|skuId|wareId/i.test(respBody);

var fid = urlFid || reqFid || '未知';
var priceRel = hasPrice || /price|ware|sku|business|infos|detail|product/i.test(fid) || !!skuId;

if (priceRel) {
  var mark = isPlain ? (hasPrice ? '[含价格]' : '') : '[疑似加密]';
  var title = '京东探针 ' + mark;
  var sub = 'URL功能=' + (urlFid || '无')
          + '\n请求体功能=' + (reqFid || (reqBody ? '体长' + reqBody.length : '空'))
          + (skuId ? '\nskuId=' + skuId : '');
  var bodyText = respBody.slice(0, 600);
  $notify(title, sub, bodyText);
}

$done({});