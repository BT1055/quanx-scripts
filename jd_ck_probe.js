/*
 * jd_ck_probe.js —— 慢慢买 ck 获取探针（宽松版）
 * 匹配所有慢慢买域名，把实际请求的 URL 和请求体长度弹出来，
 * 用于定位新版慢慢买 App 的 ck 接口地址。
 * 只显示 URL 与 body 长度，不显示 body 原文，保护隐私。
 * 安全声明：仅在本地运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var method = $request.method || '';
var body = $request.body || '';

$notify(
  '慢慢买探针',
  method + ' ' + url.slice(0, 120),
  'body长度=' + (body ? body.length : 0) + (body && body.length > 3 ? '（有请求体，可能含ck）' : '（空请求体）')
);

$done({});