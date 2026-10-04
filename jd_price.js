/*
 * jd_price.js —— 京东商品历史价格比价脚本
 * 版本: 1.0.0
 *
 * 功能：
 *   拦截京东 App 商品详情接口，在商品页注入历史价格信息，包括：
 *   当前价、全网最低价（含日期）、30/90/180/360 天最低价、
 *   618 / 双 11 价格及与当前价的差价（↑ 表示当前价偏高，↓ 表示当前价偏低）。
 *
 * 数据源说明（隐私必读）：
 *   本脚本通过 https://price.icharle.com 查询商品历史价格，
 *   查询时会把京东商品的「分享链接」发送给该第三方服务。
 *   这是比价功能所必需的数据交换，请知悉。
 *   如果你有自己的历史价格服务，只需修改下方 CONFIG.historyPriceApi 即可。
 *
 * 使用方法：
 *   1. 在 Quantumult X「重写」中添加规则（见 rewrite.conf）：
 *      ^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=wareBusiness url script-response-body {本文件直链}
 *   2. 在「MitM」主机名中添加： api.m.jd.com
 *   3. 安装并信任证书，打开京东商品页即可看到比价信息
 *
 * 安全声明：本脚本仅在本地设备运行，不收集任何个人信息。
 */

const CONFIG = {
  enabled: true,
  // 历史价格数据源（第三方，仅接收商品链接用于查询历史价格）
  historyPriceApi: 'https://price.icharle.com/?product_id=',
  // 注入到商品页的文字颜色
  textColor: '#fe0000',
};

const reqUrl = $request.url;
const body = $response.body;

if (CONFIG.enabled && reqUrl.indexOf('functionId=wareBusiness') !== -1) {
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

  const shareUrl = extractShareUrl(obj);
  if (!shareUrl) {
    $done({});
    return;
  }

  requestHistoryPrice(shareUrl)
    .then((res) => {
      const msg =
        res && res.errno !== -1 && res.data
          ? priceSummary(res.data)
          : '暂无价格信息';
      inject(obj, msg);
    })
    .catch(() => {
      inject(obj, '暂无价格信息');
    });
}

// 从商品详情响应的最后一个 floor 中提取分享链接
function extractShareUrl(obj) {
  try {
    const floors = obj.floors;
    if (!Array.isArray(floors) || floors.length === 0) return '';
    const last = floors[floors.length - 1];
    return last && last.data && last.data.property
      ? last.data.property.shareUrl
      : '';
  } catch (e) {
    return '';
  }
}

// 将比价信息注入到商品页 floors 的合适位置
function inject(obj, msg) {
  const floors = obj.floors;
  if (!Array.isArray(floors)) {
    $done({});
    return;
  }
  const ad = buildAdword(msg);
  let idx = 0;
  for (let i = 0; i < floors.length; i++) {
    const el = floors[i];
    if (el && el.mId === ad.mId) {
      idx = i + 1;
      break;
    } else if (el && el.sortId > ad.sortId) {
      idx = i;
      break;
    }
  }
  floors.splice(idx, 0, ad);
  $done({ body: JSON.stringify(obj) });
}

// 构造一个京东「广告词」模块，利用京东原生渲染展示比价文本
function buildAdword(text) {
  return {
    bId: 'eCustom_flo_199',
    cf: {
      bgc: '#ffffff',
      spl: 'empty',
    },
    data: {
      ad: {
        adword: text,
        textColor: CONFIG.textColor,
        color: '#f23030',
        newALContent: true,
        hasFold: true,
        class: 'com.jd.app.server.warecoresoa.domain.AdWordInfo.AdWordInfo',
        adLinkContent: '',
        adLink: '',
      },
    },
    mId: 'bpAdword',
    refId: 'eAdword_0000000028',
    sortId: 13,
  };
}

// 生成比价摘要（多行文本）
function priceSummary(data) {
  let summary = `当前: ¥${data.CurrentPrice}   全网最低: ¥${data.LowestPrice} (${data.LowestDate})`;
  const list = historySummary(data.PricesHistory);
  list.forEach((item) => {
    summary += `\n${item.Name}    ${item.Price}    ${item.Date}    ${item.Difference}`;
  });
  return summary;
}

// 根据历史价格列表计算各维度最低价
function historySummary(list) {
  if (!Array.isArray(list)) return [];
  list = list.reverse().slice(0, 360);

  let currentPrice;
  let lowest30, lowest90, lowest180, lowest360, price11, price618;

  list.forEach((item, index) => {
    const date = item.Date;
    const price = item.Price;
    if (index === 0) {
      currentPrice = price;
      price618 = { Name: '六一八价格', Price: '-', Date: '-', Difference: '-', price: Infinity };
      price11 = { Name: '双十一价格', Price: '-', Date: '-', Difference: '-', price: Infinity };
      lowest30 = { Name: '三十天最低', Price: `¥${price}`, Date: date, Difference: '-', price };
      lowest90 = { Name: '九十天最低', Price: `¥${price}`, Date: date, Difference: '-', price };
      lowest180 = { Name: '一百八最低', Price: `¥${price}`, Date: date, Difference: '-', price };
      lowest360 = { Name: '三百六最低', Price: `¥${price}`, Date: date, Difference: '-', price };
    }
    if (date && date.indexOf('06-18') !== -1) {
      price618.price = price;
      price618.Price = `¥${price}`;
      price618.Date = date;
      price618.Difference = difference(currentPrice, price);
    }
    if (date && date.indexOf('11-11') !== -1) {
      price11.price = price;
      price11.Price = `¥${price}`;
      price11.Date = date;
      price11.Difference = difference(currentPrice, price);
    }
    if (index < 30 && price < lowest30.price) {
      lowest30.price = price;
      lowest30.Price = `¥${price}`;
      lowest30.Date = date;
      lowest30.Difference = difference(currentPrice, price);
    }
    if (index < 90 && price < lowest90.price) {
      lowest90.price = price;
      lowest90.Price = `¥${price}`;
      lowest90.Date = date;
      lowest90.Difference = difference(currentPrice, price);
    }
    if (index < 180 && price < lowest180.price) {
      lowest180.price = price;
      lowest180.Price = `¥${price}`;
      lowest180.Date = date;
      lowest180.Difference = difference(currentPrice, price);
    }
    if (index < 360 && price < lowest360.price) {
      lowest360.price = price;
      lowest360.Price = `¥${price}`;
      lowest360.Date = date;
      lowest360.Difference = difference(currentPrice, price);
    }
  });

  return [lowest30, lowest90, lowest180, lowest360, price618, price11].filter(Boolean);
}

// 计算当前价与历史价的差价符号
function difference(currentPrice, price) {
  const d = sub(currentPrice, price);
  if (d === 0) {
    return '-';
  }
  return `${d > 0 ? '↑' : '↓'}${Math.abs(d)}`;
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

// 请求历史价格服务
function requestHistoryPrice(shareUrl) {
  return new Promise((resolve, reject) => {
    $task.fetch({
      url: CONFIG.historyPriceApi + shareUrl,
      method: 'GET',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }).then(
      (response) => {
        try {
          resolve(JSON.parse(response.body));
        } catch (e) {
          reject(e);
        }
      },
      (reason) => reject(reason)
    );
  });
}