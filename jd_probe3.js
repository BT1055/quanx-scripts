/*
 * jd_probe3.js —— 京东价格接口探针（隐私安全版）
 * 只显示 functionId 与 skuId 两个技术字段，
 * 绝不打印响应体原始内容，避免手机号/姓名/地址/定位等隐私出现在通知里。
 * 仅当命中「价格相关」接口时才通知，过滤首页/启动配置类噪声。
 * 安全声明：全部逻辑仅在本地设备运行，不收集、不上传任何数据。
 */

var url = $request.url || '';
var reqBody = $request.body || '';
var respBody = $response.body || '';

function grab(text, re) {
  var m = (text || '').match(re);
  return m ? m[1] : '';
}

// URL 顶层 functionId（client.action 的业务名就在 URL 里）
var urlFid = grab(url, /[?&]functionId=([a-zA-Z0-9_]+)/);

// 请求体里可能再嵌套一层 functionId
var reqFid = grab(reqBody, /functionId["']?\s*[:=]\s*["']?([a-zA-Z0-9_]+)/);

// skuId 商品 ID（非隐私，仅用于定位价格接口）
var skuId = grab(reqBody + '\n' + url, /["']?sku(?:Id|Ids|ids)["']?\s*[:=]\s*["']?\[?\s*["']?(\d+)/);

var fid = urlFid || reqFid || '未知';

// 判断是否为价格/商品相关接口（只看接口名 + skuId，不看 body，避免泄露隐私）
var priceRel = /price|ware|sku|detail|product|business|infos/i.test(fid) || !!skuId;

if (priceRel) {
  $notify(
    '京东价格接口',
    'URL功能=' + (urlFid || '无'),
    '请求体功能=' + (reqFid || '空') + (skuId ? '\nskuId=' + skuId : '')
  );
}

$done({});