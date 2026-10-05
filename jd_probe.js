/*
 * jd_probe.js —— 京东接口探针脚本（请求体版）
 * 用途：在请求体阶段(script-request-body)读取 POST 请求体，
 *       从中提取 functionId / 商品ID，并把 body 原文显示出来，
 *       用于定位京东商品价格接口的真实参数。
 *
 * 使用前提：MitM 主机名添加 api.m.jd.com
 * 安全声明：仅在本地运行，不收集、不上传数据。
 */

var url = $request.url || '';
var body = $request.body || '';

// 提取 functionId（优先 URL，其次 body）
var fid = url.match(/functionId=([a-zA-Z0-9_]+)/);
if (!fid && body) {
  fid = body.match(/functionId["']?\s*[:=]\s*["']?([a-zA-Z0-9_]+)/);
}

// 提取商品 ID（多种字段名，6 位以上数字）
var text = url + '\n' + body;
var idMatch = text.match(/(?:skuId|sku|wareId|ware_id|productId|itemId|ware)["']?\s*[:=]\s*["']?([0-9]{6,})/);

var msg = 'ID=' + (idMatch ? idMatch[1] : '无');
msg += '\nBODY=' + (body ? body.slice(0, 300) : '(空)');
msg += '\nURL=' + url;

$notify('京东探针', 'functionId=' + (fid ? fid[1] : '未知'), msg);

$done({});