/*
 * jd_probe2.js —— 京东响应体探针（functionId 内联版）
 * 把 functionId 和标记直接放进通知正文，方便复制查看。
 * 使用前提：MitM 主机名添加 api.m.jd.com
 * 安全声明：仅在本地运行，不收集、不上传数据。
 */

var url = $request.url || '';
var body = $response.body || '';

var fid = url.match(/functionId=([a-zA-Z0-9_]+)/);
fid = fid ? fid[1] : '未知';

var isPlain = /^\s*[\[{]/.test(body);
var hasPrice = /price|skuId|wareId|lowPrice|currentPrice|originalPrice/.test(body);
var mark = isPlain ? (hasPrice ? '[含价格]' : '') : '[疑似加密]';

var msg = 'functionId=' + fid + ' ' + mark + '\n' + body.slice(0, 400);

$notify('京东探针', msg, '');

$done({});