/*
 * jd_probe5.js —— 京东接口探针（请求体阶段版）
 * 在请求阶段运行，$request.body 保证可读，能抓到 POST 请求体里的参数；
 * 并自动 URL 解码，兼容 body=%7B%22skuId%22%3A...%7D 这类编码格式。
 * 配套规则匹配 api.m.jd.com 全部路径（/api、/client.action 都能覆盖）。
 * 只显示 functionId / skuId 技术字段，绝不打印请求原文，保护隐私。
 * 安全声明：仅在本地设备运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';

// 请求体原文 + URL 解码版（双保险）
var bodyText = reqBody || '';
try {
  bodyText += '\n' + decodeURIComponent(reqBody);
} catch (e) {}

function grab(text, re) {
  var m = (text || '').match(re);
  return m ? m[1] : '';
}

// URL 里的 functionId
var urlFid = grab(url, /[?&]functionId=([a-zA-Z0-9_]+)/);

// 请求体里的 functionId（表单 / JSON / URL编码JSON 均兼容）
var reqFid = grab(bodyText, /functionId["']?\s*[:=]\s*["']?([a-zA-Z0-9_]+)/);

// 商品 ID：skuId / wareId / productId（URL 或请求体中查找）
var skuId = grab(url + '\n' + bodyText, /["']?(?:skuId|skuIds|wareId|productId|sku_id)["']?\s*[:=]\s*["']?\[?\s*["']?(\d+)/);

// 接口路径（api 还是 client.action）
var path = grab(url, /^https?:\/\/[^\/]+\/([^\?\s]*)/) || '无';

var fid = urlFid || reqFid || '';

// 价格/商品相关接口打 ★ 标记
var isPrice = /price|ware|sku|detail|product|business|infos|babel/i.test(fid) || !!skuId;

$notify(
  '京东探针' + (isPrice ? ' ★' : ''),
  'URL功能=' + (urlFid || '无') + ' | 体功能=' + (reqFid || '空'),
  'skuId=' + (skuId || '无') + ' | 路径=' + path
);

$done({});