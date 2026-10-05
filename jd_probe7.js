/*
 * jd_probe7.js —— 全域名价格接口探针（api/in/item.m.jd.com + p.3.cn）
 * 只在响应含 skuId 或价格字段时弹窗，输出最短信息。
 * 安全声明：仅在本地运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';
var respBody = $response.body || '';

function grab(text, re) {
  var m = (text || '').match(re);
  return m ? m[1] : '';
}

var text = url + '\n' + reqBody + '\n' + respBody;

// 域名标签
var host = url.replace(/^https?:\/\//, '').split('/')[0] || '';

// 功能名（仅对 api.m.jd.com 有意义）
var urlFid = grab(url, /[?&]functionId=([a-zA-Z0-9_]+)/);
var reqFid = grab(reqBody, /functionId["']?\s*[:=]\s*["']?([a-zA-Z0-9_]+)/);
var fid = urlFid || reqFid || '';

// skuId / wareId / sku
var sku = grab(url + '\n' + reqBody, /[?&]skuId=(\d+)/)
  || grab(text, /["']?sku(?:Id|Ids|id)["']?\s*[:=]\s*["']?\[?\s*["']?(\d+)/)
  || grab(text, /wareId["']?\s*[:=]\s*["']?(\d+)/)
  || grab(url, /\/(\d{8,15})\.html/);

// 价格字段（宽松）
var hasPrice = /price|lowPrice|currentPrice|originalPrice|warePrice|历史低价|当前到手价|"p"\s*:\s*"\d|"op"\s*:\s*"\d/i.test(respBody);

if (sku || hasPrice || (host.indexOf('p.3.cn') !== -1)) {
  $notify(
    '京东探针' + (hasPrice ? ' ★含价' : ''),
    '功能=' + (fid || '无') + ' | 域名=' + host,
    'sku=' + (sku || '无') + ' | 含价=' + (hasPrice ? '是' : '否')
  );
}
$done({});