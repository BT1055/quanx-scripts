/*
 * jd_probe6.js —— api.m.jd.com 价格接口定位探针（最短输出）
 * 只显示：功能名 / skuId / 是否含价格。不显示任何响应体内容，保护隐私。
 * 安全声明：仅在本地运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';
var respBody = $response.body || '';

function grab(text, re) {
  var m = (text || '').match(re);
  return m ? m[1] : '';
}

// 功能名：URL query 或 请求体 JSON
var urlFid = grab(url, /[?&]functionId=([a-zA-Z0-9_]+)/);
var reqFid = grab(reqBody, /functionId["']?\s*[:=]\s*["']?([a-zA-Z0-9_]+)/);
var fid = urlFid || reqFid || '';

// skuId：URL / 请求体 / 响应体
var sku = grab(url + '\n' + reqBody, /[?&]skuId=(\d+)/)
  || grab(url + '\n' + reqBody, /["']sku(?:Id|Ids)["']?\s*[:=]\s*["']?(\d+)/)
  || grab(respBody, /["']sku(?:Id|Ids)["']?\s*[:=]\s*["']?(\d+)/)
  || grab(respBody, /wareId["']?\s*[:=]\s*["']?(\d+)/);

// 是否含价格字段
var hasPrice = /price|lowPrice|currentPrice|originalPrice|warePrice|p["']\s*[:=]\s*["']?\d|op["']\s*[:=]\s*["']?\d/i.test(respBody);

if (fid || sku || hasPrice) {
  $notify(
    '京东探针' + (hasPrice ? ' ★含价' : ''),
    '功能=' + (fid || '无'),
    'sku=' + (sku || '无') + ' | 含价=' + (hasPrice ? '是' : '否')
  );
}
$done({});