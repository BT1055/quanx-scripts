/*
 * jd_ck2.js —— 慢慢买 ck 捕获（始终弹窗诊断版）
 * 每次都弹窗显示：URL、body 长度、是否含设备ID。
 * 只有请求体含 c_mmbDevId 时才保存 ck，供比价脚本使用。
 * 只显示 URL/长度/是否含ID，不显示请求体原文，保护隐私。
 * 安全声明：仅在本地运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';
var manmanbuyKey = 'manmanbuy_val';

// 是否包含设备ID（慢慢买 ck 核心参数）
var hasDevId = /mmbDevId/i.test(reqBody);

// 包含设备ID → 保存 ck
if (hasDevId) {
  $prefs.setValueForKey(reqBody, manmanbuyKey);
}

$notify(
  '慢慢买ck' + (hasDevId ? ' ✅' : ''),
  (hasDevId ? '获取成功，已保存' : '未含设备ID，未保存'),
  'URL=' + url.slice(0, 100) + '\nbody长度=' + (reqBody ? reqBody.length : 0)
);

$done({});