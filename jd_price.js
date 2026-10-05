/*
 * jd_price.js —— 京东商品比价脚本
 * 版本: 2.0.0
 *
 * 变更说明（v2.0.0）：
 *   - 京东商品详情接口已从老接口 client.action?functionId=wareBusiness
 *     升级为 api.m.jd.com/api?functionId=getWareBusiness，
 *     响应结构也从「floors 页面模块」改为纯 JSON 数据。
 *   - 原历史价格数据源（price.icharle.com）已停止服务（502），
 *     且页面内注入方式对纯数据接口不再适用。
 *   - 因此本版本改为「当前价 vs 原价」折扣比价，通过通知弹窗展示。
 *
 * 特点：
 *   - 完全不依赖任何第三方服务，安全、隐私、稳定
 *   - 打开京东商品详情页时，自动弹通知显示当前价 / 原价 / 直降金额
 *
 * 使用方法：
 *   1. 重写规则（见 jd_price.conf）：
 *      ^https?:\/\/api\.m\.jd\.com\/api\?.*functionId=getWareBusiness url script-response-body {本文件直链}
 *   2. MitM 主机名添加：api.m.jd.com
 *   3. 安装并在系统设置中信任 Quantumult X 根证书
 *
 * 安全声明：本脚本仅在本地设备运行，不收集、不上传任何数据。
 */

const url = $request.url;
const body = $response.body;

if (url.indexOf('functionId=getWareBusiness') !== -1) {
  run();
} else {
  // 非目标接口，放行原响应
  $done({});
}

function run() {
  let obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    $done({});
    return;
  }

  const skuId = extractSkuId(url);
  const info = extractPrice(obj);
  const msg = buildMessage(info);

  if (msg) {
    $notify('京东比价', skuId ? '商品 ' + skuId : '京东商品', msg);
  }
  $done({});
}

// 从 URL 中提取 skuId（商品 ID）
function extractSkuId(url) {
  const m = url.match(/[?&]skuId=(\d+)/);
  return m ? m[1] : '';
}

// 从响应中提取当前价 / 原价（兼容多种字段路径）
function extractPrice(obj) {
  const data = obj && typeof obj === 'object' && obj.data ? obj.data : (obj || {});
  const price = data && typeof data === 'object' && data.price ? data.price : {};

  let current = '';
  let original = '';

  // 当前售价：price.p 或 price.price 或 data.lowPrice
  if (price.p !== undefined && price.p !== '') current = price.p;
  else if (price.price !== undefined && price.price !== '') current = price.price;
  else if (data.lowPrice !== undefined && data.lowPrice !== '') current = data.lowPrice;

  // 原价：price.op 或 price.m
  if (price.op !== undefined && price.op !== '') original = price.op;
  else if (price.m !== undefined && price.m !== '') original = price.m;

  return { current, original };
}

// 生成比价通知内容
function buildMessage(info) {
  if (!info.current) return '';
  let msg = '当前价：¥' + info.current;
  if (info.original && info.original !== info.current) {
    msg += '\n原价：¥' + info.original;
    const d = sub(Number(info.original), Number(info.current));
    if (d > 0) msg += '\n直降：¥' + formatMoney(d);
  }
  return msg;
}

function formatMoney(n) {
  return String(n.toFixed ? n.toFixed(2) : n);
}

// 浮点减法（避免精度问题）
function sub(a, b) {
  return add(a, -Number(b));
}

// 浮点加法（避免精度问题）
function add(a, b) {
  a = a.toString();
  b = b.toString();
  const aArr = a.split('.');
  const bArr = b.split('.');
  const d1 = aArr.length === 2 ? aArr[1] : '';
  const d2 = bArr.length === 2 ? bArr[1] : '';
  const maxLen = Math.max(d1.length, d2.length);
  const m = Math.pow(10, maxLen);
  return Number(((Number(a) * m + Number(b) * m) / m).toFixed(maxLen));
}