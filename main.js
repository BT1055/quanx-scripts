/*
 * QuanX 个人脚本套件 - 主脚本
 * 功能：广告拦截 + 隐私保护 + 响应处理 + 自定义扩展
 * 
 * 使用说明：
 * 1. 修改下方 CONFIG 配置区即可自定义功能
 * 2. 在 Quantumult X 的「重写」中添加 rewrite.conf 的规则
 * 3. 在「MitM」中添加 mitm.conf 的主机名
 * 
 * 安全声明：本脚本仅在本地设备运行，不上传任何数据，不收集任何用户信息。
 */

(function () {
  'use strict';

  // ============================================================
  //  配置区 - 你只需要修改这里
  // ============================================================
  const CONFIG = {
    // ---------- 总开关 ----------
    masterSwitch: true,          // 总开关，false 则所有功能禁用
    debugLog: false,             // 调试日志（控制台输出）

    // ---------- 广告拦截 ----------
    adBlock: {
      enabled: true,
      // 广告域名黑名单（支持通配符 * 和 ?）
      blacklist: [
        '*.doubleclick.net',
        '*.googlesyndication.com',
        '*.googleadservices.com',
        '*.admob.com',
        '*.adservice.google.*',
        '*.adsrvr.org',
        '*.adnxs.com',
        '*.moatads.com',
        '*.umeng.com',
        '*.umengcloud.com',
        '*.tanx.com',
        '*.mmstat.com',
        '*.gdtimg.com',
        '*.qq.com/cgi-bin/report',
        '*.bilibili.com/x/report',
      ],
      // 白名单（即使匹配黑名单也不拦截）
      whitelist: [
        // '*.example.com',
      ],
      // 拦截时返回的状态码和内容
      blockStatus: 200,
      blockBody: '',
    },

    // ---------- 隐私保护 ----------
    privacy: {
      enabled: true,

      // 移除 URL 中的追踪参数
      removeTrackingParams: {
        enabled: true,
        params: [
          // Google Analytics
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
          'utm_id', 'utm_name', 'utm_cid',
          // Facebook
          'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
          // Microsoft / Bing
          'msclkid',
          // Mailchimp
          'mc_cid', 'mc_eid',
          // HubSpot
          '_hsenc', '_hsmi',
          // Marketo
          'mkt_tok',
          // Yandex
          'yclid', '_openstat',
          // 其他
          'gclid', 'dclid', 'gbraid', 'wbraid',
          'ref', 'referrer', 'source',
          'spm', 'scm', 'krnpr',
          'track', 'tracking',
        ],
      },

      // 屏蔽统计/分析上报域名
      blockAnalytics: {
        enabled: true,
        domains: [
          '*.google-analytics.com',
          '*.analytics.google.com',
          '*.googletagmanager.com',
          '*.hotjar.com',
          '*.mixpanel.com',
          '*.amplitude.com',
          '*.segment.io',
          '*.segment.com',
          '*.heap.io',
          '*.fullstory.com',
          '*.mouseflow.com',
          '*.crazyegg.com',
          '*.umeng.com',
          '*.umengcloud.com',
          '*.talkingdata.com',
          '*.bugly.qq.com',
          '*.bugly.qq.com/v2/report',
        ],
      },

      // 清理请求头中的隐私/追踪字段
      cleanHeaders: {
        enabled: true,
        // 要移除的请求头（不区分大小写）
        remove: [
          'X-Forwarded-For',
          'X-Real-IP',
          'X-Original-Forwarded-For',
          'X-Rewrite-URL',
        ],
        // 要修改的请求头（设为空字符串则移除）
        modify: {
          // 'Referer': '',          // 清空 Referer
          // 'User-Agent': '',       // 可自定义 UA
        },
      },
    },

    // ---------- 响应处理 ----------
    response: {
      enabled: true,

      // 从响应体中移除追踪脚本（正则匹配，匹配到的 <script> 标签会被移除）
      removeTrackingScripts: {
        enabled: true,
        patterns: [
          /googletagmanager\.com/i,
          /google-analytics\.com/i,
          /hotjar\.com/i,
          /mixpanel\.com/i,
          /umeng\.com/i,
          /talkingdata\.com/i,
        ],
      },

      // 自定义响应体处理（在下方 customResponseHandler 中实现）
      custom: {
        enabled: false,
      },
    },

    // ---------- 通知设置 ----------
    notify: {
      onBlock: false,      // 拦截时是否通知
      onError: true,       // 出错时是否通知
    },
  };

  // ============================================================
  //  工具函数
  // ============================================================
  const Utils = {
    // 日志输出
    log(...args) {
      if (CONFIG.debugLog) {
        console.log('[QuanX Suite]', ...args);
      }
    },

    // 通知
    notify(title, subtitle, body) {
      try {
        $notification.post(title, subtitle, body);
      } catch (e) {}
    },

    // 通配符匹配（* 匹配任意字符，? 匹配单个字符）
    wildcardMatch(pattern, str) {
      const regex = new RegExp(
        '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                     .replace(/\*/g, '.*')
                     .replace(/\?/g, '.') + '$',
        'i'
      );
      return regex.test(str);
    },

    // 检查域名是否匹配规则列表
    matchDomainList(domain, list) {
      if (!list || !list.length) return false;
      return list.some(pattern => this.wildcardMatch(pattern, domain));
    },

    // 从 URL 中提取域名
    getDomain(url) {
      try {
        const u = new URL(url);
        return u.hostname;
      } catch (e) {
        return '';
      }
    },

    // 从 URL 中移除指定查询参数
    removeUrlParams(url, paramsToRemove) {
      try {
        const u = new URL(url);
        const removed = [];
        paramsToRemove.forEach(param => {
          if (u.searchParams.has(param)) {
            u.searchParams.delete(param);
            removed.push(param);
          }
        });
        return { url: u.toString(), removed };
      } catch (e) {
        return { url, removed: [] };
      }
    },

    // 安全地解析 JSON
    safeParseJSON(str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        return null;
      }
    },
  };

  // ============================================================
  //  模块 1：广告拦截
  // ============================================================
  const AdBlocker = {
    process($request) {
      if (!CONFIG.adBlock.enabled) return null;

      const domain = Utils.getDomain($request.url);
      if (!domain) return null;

      // 白名单优先
      if (Utils.matchDomainList(domain, CONFIG.adBlock.whitelist)) {
        Utils.log('[AdBlock] 白名单放行:', domain);
        return null;
      }

      // 黑名单匹配
      if (Utils.matchDomainList(domain, CONFIG.adBlock.blacklist)) {
        Utils.log('[AdBlock] 拦截广告:', $request.url);
        if (CONFIG.notify.onBlock) {
          Utils.notify('🛡️ 广告拦截', '', domain);
        }
        return {
          response: {
            status: CONFIG.adBlock.blockStatus,
            headers: { 'Content-Type': 'text/plain' },
            body: CONFIG.adBlock.blockBody,
          },
        };
      }

      return null;
    },
  };

  // ============================================================
  //  模块 2：隐私保护
  // ============================================================
  const PrivacyProtector = {
    process($request) {
      if (!CONFIG.privacy.enabled) return { request: $request };

      let url = $request.url;
      let headers = Object.assign({}, $request.headers);
      let modified = false;

      // 2.1 屏蔽统计上报域名
      if (CONFIG.privacy.blockAnalytics.enabled) {
        const domain = Utils.getDomain(url);
        if (domain && Utils.matchDomainList(domain, CONFIG.privacy.blockAnalytics.domains)) {
          Utils.log('[Privacy] 屏蔽统计上报:', url);
          if (CONFIG.notify.onBlock) {
            Utils.notify('🔒 隐私保护', '已屏蔽统计上报', domain);
          }
          return {
            response: {
              status: 200,
              headers: { 'Content-Type': 'text/plain' },
              body: '',
            },
          };
        }
      }

      // 2.2 移除 URL 追踪参数
      if (CONFIG.privacy.removeTrackingParams.enabled) {
        const result = Utils.removeUrlParams(url, CONFIG.privacy.removeTrackingParams.params);
        if (result.removed.length > 0) {
          url = result.url;
          modified = true;
          Utils.log('[Privacy] 移除追踪参数:', result.removed.join(', '));
        }
      }

      // 2.3 清理请求头
      if (CONFIG.privacy.cleanHeaders.enabled) {
        // 移除指定头
        const toRemove = CONFIG.privacy.cleanHeaders.remove.map(h => h.toLowerCase());
        Object.keys(headers).forEach(key => {
          if (toRemove.includes(key.toLowerCase())) {
            delete headers[key];
            modified = true;
          }
        });
        // 修改指定头
        Object.entries(CONFIG.privacy.cleanHeaders.modify).forEach(([key, value]) => {
          if (value === '') {
            delete headers[key];
          } else {
            headers[key] = value;
          }
          modified = true;
        });
      }

      if (modified) {
        return { request: Object.assign({}, $request, { url, headers }) };
      }
      return { request: $request };
    },
  };

  // ============================================================
  //  模块 3：响应处理
  // ============================================================
  const ResponseHandler = {
    process($request, $response) {
      if (!CONFIG.response.enabled) return { response: $response };

      let body = $response.body;
      let headers = Object.assign({}, $response.headers);
      let modified = false;

      // 3.1 移除响应中的追踪脚本
      if (CONFIG.response.removeTrackingScripts.enabled && body) {
        const patterns = CONFIG.response.removeTrackingScripts.patterns;
        // 匹配 <script>...</script> 和 <script .../>
        const scriptRegex = /<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*\/>/gi;
        let matchCount = 0;
        body = body.replace(scriptRegex, (scriptTag) => {
          if (patterns.some(p => p.test(scriptTag))) {
            matchCount++;
            return '';
          }
          return scriptTag;
        });
        if (matchCount > 0) {
          modified = true;
          Utils.log('[Response] 移除追踪脚本数量:', matchCount);
        }
      }

      // 3.2 自定义响应处理
      if (CONFIG.response.custom.enabled) {
        const customResult = CustomHandlers.responseHandler($request, { status: $response.status, headers, body });
        if (customResult) {
          if (customResult.body !== undefined) body = customResult.body;
          if (customResult.headers) headers = customResult.headers;
          modified = true;
        }
      }

      if (modified) {
        // 更新 Content-Length
        if (headers['Content-Length'] !== undefined) {
          headers['Content-Length'] = String(
            typeof body === 'string' ? body.length : JSON.stringify(body).length
          );
        }
        return { response: { status: $response.status, headers, body } };
      }
      return { response: $response };
    },
  };

  // ============================================================
  //  自定义扩展区 - 在这里添加你自己的处理逻辑
  // ============================================================
  const CustomHandlers = {
    // 自定义请求处理（返回 { request } 或 { response } 或 null）
    // 示例：对特定域名添加自定义请求头
    requestHandler($request) {
      const domain = Utils.getDomain($request.url);

      // 示例：给特定域名添加请求头
      // if (domain === 'api.example.com') {
      //   const headers = Object.assign({}, $request.headers);
      //   headers['X-Custom-Header'] = 'my-value';
      //   return { request: Object.assign({}, $request, { headers }) };
      // }

      // 示例：重定向特定 URL
      // if ($request.url.includes('old-api.example.com')) {
      //   const newUrl = $request.url.replace('old-api.example.com', 'new-api.example.com');
      //   return { request: Object.assign({}, $request, { url: newUrl }) };
      // }

      return null;
    },

    // 自定义响应处理（返回 { body, headers } 或 null）
    responseHandler($request, response) {
      const domain = Utils.getDomain($request.url);

      // 示例：修改特定 API 的响应
      // if (domain === 'api.example.com' && response.body) {
      //   const data = Utils.safeParseJSON(response.body);
      //   if (data) {
      //     data.customField = 'modified';
      //     return { body: JSON.stringify(data) };
      //   }
      // }

      return null;
    },
  };

  // ============================================================
  //  主入口
  // ============================================================
  function main() {
    if (!CONFIG.masterSwitch) {
      $done({});
      return;
    }

    try {
      // 判断是请求阶段还是响应阶段
      const isRequestPhase = typeof $response === 'undefined';

      if (isRequestPhase) {
        // ===== 请求阶段 =====
        // 1. 广告拦截
        const adResult = AdBlocker.process($request);
        if (adResult) {
          $done(adResult);
          return;
        }

        // 2. 隐私保护
        const privacyResult = PrivacyProtector.process($request);
        if (privacyResult && privacyResult.response) {
          $done(privacyResult);
          return;
        }

        let currentRequest = privacyResult ? privacyResult.request : $request;

        // 3. 自定义请求处理
        const customResult = CustomHandlers.requestHandler(currentRequest);
        if (customResult) {
          $done(customResult);
          return;
        }

        // 正常放行
        $done({ request: currentRequest });
      } else {
        // ===== 响应阶段 =====
        const responseResult = ResponseHandler.process($request, $response);
        $done(responseResult);
      }
    } catch (e) {
      Utils.log('[Error]', e.message);
      if (CONFIG.notify.onError) {
        Utils.notify('⚠️ 脚本错误', 'QuanX Suite', e.message);
      }
      // 出错时放行，不影响正常使用
      if (typeof $response === 'undefined') {
        $done({ request: $request });
      } else {
        $done({ response: $response });
      }
    }
  }

  // 执行
  main();
})();
