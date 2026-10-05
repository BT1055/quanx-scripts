/*
 * jd_probe.js —— 京东接口探针脚本
 * 用途：在请求头阶段(script-request-header)直接从 URL 提取 functionId，
 *       弹通知显示，用于定位商品价格接口的真实 functionId。
 *
 * 说明：functionId 就在 URL query 里，请求头阶段即可拿到，
 *      不依赖响应体解密，可靠性最高。
 * 使用前提：MitM 主机名添加 api.m.jd.com
 * 安全声明：仅在本地运行，不收集、不上传数据。
 */

var url = $request.url || '';

// 提取 functionId
var fid = url.match(/functionId=([a-zA-Z0-9_]+)/);

// 提取可能的商品 ID 字段
var sku = url.match(/[?&](?:skuId|sku|wareId|ware_id)=([0-9]+)/);

if (fid) {
  $notify('京东探针', 'functionId=' + fid[1], 'ID=' + (sku ? sku[1] : '无') + '\nURL=' + url);
}

$done({});