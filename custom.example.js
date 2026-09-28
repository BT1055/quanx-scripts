/*
 * 自定义扩展示例
 * 这些代码片段可以复制到 main.js 的 CustomHandlers 中使用
 * 每个示例都有详细注释，请按需选择
 */

// ============================================================
//  示例 1：针对特定 App 的去广告规则
// ============================================================
function exampleAppAdBlock($request) {
  const url = $request.url;

  // 示例：拦截某视频 App 的广告接口
  if (url.includes('api.videoapp.com/ad/')) {
    return {
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 0, data: { ads: [] } }),
      },
    };
  }

  return null;
}

// ============================================================
//  示例 2：修改 API 响应数据
// ============================================================
function exampleModifyApiResponse($request, response) {
  const url = $request.url;

  // 示例：修改某社交 App 的时间线响应
  if (url.includes('api.socialapp.com/feed') && response.body) {
    const data = JSON.parse(response.body);
    // 移除推广内容
    if (data.data && data.data.feeds) {
      data.data.feeds = data.data.feeds.filter(item => !item.is_promoted);
    }
    return { body: JSON.stringify(data) };
  }

  return null;
}

// ============================================================
//  示例 3：请求头伪造 / 隐私增强
// ============================================================
function examplePrivacyHeaders($request) {
  const headers = Object.assign({}, $request.headers);

  // 移除所有 X- 开头的自定义头（可能包含追踪信息）
  Object.keys(headers).forEach(key => {
    if (key.toLowerCase().startsWith('x-')) {
      // 保留必要的 X- 头
      const keepList = ['x-requested-with'];
      if (!keepList.includes(key.toLowerCase())) {
        delete headers[key];
      }
    }
  });

  // 统一 User-Agent（可选）
  // headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ...';

  return { request: Object.assign({}, $request, { headers }) };
}

// ============================================================
//  示例 4：URL 重定向
// ============================================================
function exampleUrlRedirect($request) {
  let url = $request.url;

  // 示例：将移动版网页重定向到桌面版
  if (url.includes('m.example.com')) {
    url = url.replace('m.example.com', 'www.example.com');
    return { request: Object.assign({}, $request, { url }) };
  }

  // 示例：强制 HTTPS
  if (url.startsWith('http://') && !url.includes('localhost')) {
    url = url.replace('http://', 'https://');
    return { request: Object.assign({}, $request, { url }) };
  }

  return null;
}

// ============================================================
//  示例 5：按时间段启用/禁用功能
// ============================================================
function exampleTimeBasedRule($request) {
  const hour = new Date().getHours();

  // 示例：工作时间（9-18 点）屏蔽娱乐网站
  if (hour >= 9 && hour < 18) {
    const domain = Utils.getDomain($request.url);
    const entertainment = ['douyin.com', 'kuaishou.com', 'weibo.com'];
    if (entertainment.some(d => domain.includes(d))) {
      return {
        response: {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
          body: '<html><body><h1>工作时间，禁止访问</h1></body></html>',
        },
      };
    }
  }

  return null;
}

// ============================================================
//  示例 6：调试日志 - 打印所有请求
// ============================================================
function exampleDebugLog($request) {
  // 只在调试时启用
  if (CONFIG.debugLog) {
    console.log('[Request]', $request.method, $request.url);
    console.log('[Headers]', JSON.stringify($request.headers, null, 2));
  }
  return null;
}

/*
 * 使用方法：
 * 1. 选择你需要的示例函数
 * 2. 将其内容复制到 main.js 的 CustomHandlers 中
 * 3. 在 requestHandler 或 responseHandler 中调用
 *
 * 例如：
 *   requestHandler($request) {
 *     return exampleUrlRedirect($request) || examplePrivacyHeaders($request);
 *   }
 */
