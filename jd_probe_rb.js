/*
 * jd_probe_rb.js —— 京东响应体探针（最终版）
 * 用途：抓取 client.action 各接口的响应体，判断哪个是价格接口、响应是否明文。
 * 使用前提：MitM 主机名添加 api.m.jd.com
 * 安全声明：仅在本地运行，不收集、不上传数据。
 */

var url = $request.url || '';
var body = $response.body || '';

var fid = url.match(/functionId=([a-zA-Z0-9_]+)/);
fid = fid ? fid[1] : '未知';

var isPlain = /^\s*[\[{]/.test(body);
var hasPrice = /price|skuId|wareId|lowPrice|currentPrice|originalPrice/.test(body);

var mark = '';
if (!isPlain) mark = '[疑似加密]';
else if (hasPrice) mark = '[含价格]';

$notify('京东探针', 'functionId=' + fid + ' ' + mark, body.slice(0, 200));

$done({});