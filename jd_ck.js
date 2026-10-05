/*
 * jd_ck.js —— 慢慢买 ck 捕获（新版接口版）
 * 拦截慢慢买所有接口的请求体，解析 c_mmbDevId 等参数并本地保存，
 * 供 jd_price_mmb.js 比价脚本使用。
 * 只提取设备ID等非敏感技术参数，不保存/不上传任何用户个人信息。
 * 安全声明：全部逻辑仅在本地设备运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';

// 慢慢买 ck 保存到本地（供比价脚本读取）
var manmanbuyKey = 'manmanbuy_val';

if (reqBody && reqBody.length > 3) {
  // 解析请求体参数（表单格式，如 c_mmbDevId=xxx&...）
  var params = {};
  try {
    reqBody.split('&').forEach(function (pair) {
      var idx = pair.indexOf('=');
      if (idx > 0) {
        var k = decodeURIComponent(pair.slice(0, idx));
        var v = decodeURIComponent(pair.slice(idx + 1));
        params[k] = v;
      }
    });
  } catch (e) {}

  // 只要包含设备ID就视为有效 ck，保存整段请求体
  if (params.c_mmbDevId || params.mmbDevId || /mmbDevId/i.test(reqBody)) {
    $prefs.setValueForKey(reqBody, manmanbuyKey);
    $notify('慢慢买ck', '获取成功🎉', '设备ID已保存，可以开始比价');
    $done({});
    return;
  }
}

// 其他慢慢买请求：静默放行（不再弹窗刷屏）
$done({});