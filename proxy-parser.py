#!/usr/bin/env python3
"""
代理节点解析工具
支持协议: ss, ssr, vmess, trojan, vless, http, https, socks5
输出格式: Quantumult X server_local 格式 / JSON 格式

用法:
  python3 proxy-parser.py "ss://..."                # 解析单个节点
  python3 proxy-parser.py -f nodes.txt              # 从文件批量解析
  python3 proxy-parser.py -u "https://sub.example.com"  # 解析订阅链接
  python3 proxy-parser.py -f nodes.txt -o output.conf   # 输出到文件
  python3 proxy-parser.py -f nodes.txt --format json    # JSON 格式输出
"""

import argparse
import base64
import json
import sys
import urllib.parse
import urllib.request
import re
from typing import List, Dict, Optional, Tuple


def b64decode(data: str) -> str:
    """Base64 解码，自动处理 padding 和 URL-safe 编码"""
    data = data.strip()
    # 补 padding
    missing = len(data) % 4
    if missing:
        data += '=' * (4 - missing)
    # URL-safe base64
    data = data.replace('-', '+').replace('_', '/')
    try:
        return base64.b64decode(data).decode('utf-8')
    except Exception:
        try:
            return base64.b64decode(data).decode('latin-1')
        except Exception:
            return data


def parse_ss(url: str) -> Optional[Dict]:
    """解析 Shadowsocks 节点"""
    try:
        # 去掉 ss:// 前缀
        content = url[5:]
        # 分离 tag
        tag = ''
        if '#' in content:
            content, tag = content.split('#', 1)
            tag = urllib.parse.unquote(tag)

        # SIP002 格式: ss://base64(method:password)@host:port/?params
        if '@' in content:
            userinfo, hostinfo = content.rsplit('@', 1)
            decoded_userinfo = b64decode(userinfo)
            if ':' in decoded_userinfo:
                method, password = decoded_userinfo.split(':', 1)
            else:
                return None
            # 分离查询参数
            if '/?' in hostinfo:
                hostport, query = hostinfo.split('/?', 1)
            elif '?' in hostinfo:
                hostport, query = hostinfo.split('?', 1)
            else:
                hostport = hostinfo
                query = ''
            if ':' in hostport:
                host, port = hostport.rsplit(':', 1)
            else:
                return None

            # 解析 plugin 参数
            plugin = ''
            plugin_opts = ''
            if query:
                params = urllib.parse.parse_qs(query)
                plugin = params.get('plugin', [''])[0]
                if plugin:
                    plugin_opts = urllib.parse.unquote(params.get('plugin-opts', [''])[0])

            return {
                'type': 'ss',
                'tag': tag or f'{host}:{port}',
                'host': host,
                'port': int(port),
                'method': method,
                'password': password,
                'plugin': plugin,
                'plugin_opts': plugin_opts,
            }
        else:
            # 旧格式: ss://base64(method:password@host:port)
            decoded = b64decode(content)
            # 分离 tag
            if '#' in decoded:
                decoded, tag = decoded.split('#', 1)
                tag = urllib.parse.unquote(tag)
            if '@' in decoded:
                method_pwd, host_port = decoded.rsplit('@', 1)
                if ':' in method_pwd and ':' in host_port:
                    method, password = method_pwd.split(':', 1)
                    host, port = host_port.rsplit(':', 1)
                    return {
                        'type': 'ss',
                        'tag': tag or f'{host}:{port}',
                        'host': host,
                        'port': int(port),
                        'method': method,
                        'password': password,
                        'plugin': '',
                        'plugin_opts': '',
                    }
    except Exception as e:
        print(f"  ⚠️  SS 解析失败: {e}", file=sys.stderr)
    return None


def parse_ssr(url: str) -> Optional[Dict]:
    """解析 ShadowsocksR 节点"""
    try:
        content = url[6:]
        decoded = b64decode(content)
        # 格式: host:port:protocol:method:obfs:password_base64/?params
        if '/?' in decoded:
            main_part, query = decoded.split('/?', 1)
        elif '?' in decoded:
            main_part, query = decoded.split('?', 1)
        else:
            main_part = decoded
            query = ''

        parts = main_part.split(':')
        if len(parts) < 6:
            return None

        host, port, protocol, method, obfs, password_b64 = parts[:6]
        password = b64decode(password_b64)

        # 解析额外参数
        tag = ''
        obfs_param = ''
        protocol_param = ''
        if query:
            params = urllib.parse.parse_qs(query)
            tag = urllib.parse.unquote(params.get('remarks', [''])[0])
            obfs_param = b64decode(params.get('obfsparam', [''])[0]) if params.get('obfsparam') else ''
            protocol_param = b64decode(params.get('protoparam', [''])[0]) if params.get('protoparam') else ''

        return {
            'type': 'ssr',
            'tag': tag or f'{host}:{port}',
            'host': host,
            'port': int(port),
            'method': method,
            'password': password,
            'protocol': protocol,
            'obfs': obfs,
            'obfs_param': obfs_param,
            'protocol_param': protocol_param,
        }
    except Exception as e:
        print(f"  ⚠️  SSR 解析失败: {e}", file=sys.stderr)
    return None


def parse_vmess(url: str) -> Optional[Dict]:
    """解析 VMess 节点"""
    try:
        content = url[8:]
        decoded = b64decode(content)
        data = json.loads(decoded)

        # 标准 VMess JSON 格式
        return {
            'type': 'vmess',
            'tag': data.get('ps', '') or f"{data.get('add', '')}:{data.get('port', '')}",
            'host': data.get('add', ''),
            'port': int(data.get('port', 0)),
            'uuid': data.get('id', ''),
            'alter_id': int(data.get('aid', 0)),
            'security': data.get('scy', 'auto'),
            'network': data.get('net', 'tcp'),
            'header_type': data.get('type', 'none'),  # 伪装类型
            'ws_host': data.get('host', ''),
            'path': data.get('path', ''),
            'tls': data.get('tls', ''),
            'sni': data.get('sni', ''),
        }
    except Exception as e:
        print(f"  ⚠️  VMess 解析失败: {e}", file=sys.stderr)
    return None


def parse_trojan(url: str) -> Optional[Dict]:
    """解析 Trojan 节点"""
    try:
        content = url[9:]
        # 分离 tag
        tag = ''
        if '#' in content:
            content, tag = content.split('#', 1)
            tag = urllib.parse.unquote(tag)

        # 分离查询参数
        if '?' in content:
            userinfo_host, query = content.split('?', 1)
        else:
            userinfo_host = content
            query = ''

        # 分离密码和地址
        if '@' in userinfo_host:
            password, hostport = userinfo_host.rsplit('@', 1)
            password = urllib.parse.unquote(password)
        else:
            return None

        if ':' in hostport:
            host, port = hostport.rsplit(':', 1)
        else:
            return None

        # 解析参数
        params = urllib.parse.parse_qs(query) if query else {}
        network = params.get('type', ['tcp'])[0]
        sni = params.get('sni', [''])[0]
        tls = 'tls' if params.get('security', ['tls'])[0] == 'tls' else ''

        return {
            'type': 'trojan',
            'tag': tag or f'{host}:{port}',
            'host': host,
            'port': int(port),
            'password': password,
            'network': network,
            'sni': sni,
            'tls': tls,
        }
    except Exception as e:
        print(f"  ⚠️  Trojan 解析失败: {e}", file=sys.stderr)
    return None


def parse_vless(url: str) -> Optional[Dict]:
    """解析 VLESS 节点"""
    try:
        content = url[8:]
        # 分离 tag
        tag = ''
        if '#' in content:
            content, tag = content.split('#', 1)
            tag = urllib.parse.unquote(tag)

        # 分离查询参数
        if '?' in content:
            userinfo_host, query = content.split('?', 1)
        else:
            userinfo_host = content
            query = ''

        # 分离 UUID 和地址
        if '@' in userinfo_host:
            uuid, hostport = userinfo_host.rsplit('@', 1)
            uuid = urllib.parse.unquote(uuid)
        else:
            return None

        if ':' in hostport:
            host, port = hostport.rsplit(':', 1)
        else:
            return None

        # 解析参数
        params = urllib.parse.parse_qs(query) if query else {}
        network = params.get('type', ['tcp'])[0]
        security = params.get('security', [''])[0]
        sni = params.get('sni', [''])[0]
        flow = params.get('flow', [''])[0]
        fp = params.get('fp', [''])[0]

        # Reality 参数
        pbk = params.get('pbk', [''])[0]
        sid = params.get('sid', [''])[0]
        spx = params.get('spx', [''])[0]

        return {
            'type': 'vless',
            'tag': tag or f'{host}:{port}',
            'host': host,
            'port': int(port),
            'uuid': uuid,
            'network': network,
            'security': security,
            'sni': sni,
            'flow': flow,
            'fp': fp,
            'pbk': pbk,
            'sid': sid,
            'spx': spx,
        }
    except Exception as e:
        print(f"  ⚠️  VLESS 解析失败: {e}", file=sys.stderr)
    return None


def parse_http(url: str, scheme: str) -> Optional[Dict]:
    """解析 HTTP/HTTPS 代理节点"""
    try:
        parsed = urllib.parse.urlparse(url)
        tag = parsed.fragment or f'{parsed.hostname}:{parsed.port}'
        return {
            'type': scheme,
            'tag': tag,
            'host': parsed.hostname,
            'port': parsed.port or (443 if scheme == 'https' else 80),
            'username': parsed.username or '',
            'password': parsed.password or '',
        }
    except Exception as e:
        print(f"  ⚠️  HTTP 解析失败: {e}", file=sys.stderr)
    return None


def parse_socks5(url: str) -> Optional[Dict]:
    """解析 SOCKS5 代理节点"""
    try:
        parsed = urllib.parse.urlparse(url)
        tag = parsed.fragment or f'{parsed.hostname}:{parsed.port}'
        return {
            'type': 'socks5',
            'tag': tag,
            'host': parsed.hostname,
            'port': parsed.port or 1080,
            'username': parsed.username or '',
            'password': parsed.password or '',
        }
    except Exception as e:
        print(f"  ⚠️  SOCKS5 解析失败: {e}", file=sys.stderr)
    return None


def parse_single(url: str) -> Optional[Dict]:
    """解析单个代理节点 URL"""
    url = url.strip()
    if not url:
        return None

    if url.startswith('ss://'):
        return parse_ss(url)
    elif url.startswith('ssr://'):
        return parse_ssr(url)
    elif url.startswith('vmess://'):
        return parse_vmess(url)
    elif url.startswith('trojan://'):
        return parse_trojan(url)
    elif url.startswith('vless://'):
        return parse_vless(url)
    elif url.startswith('http://'):
        return parse_http(url, 'http')
    elif url.startswith('https://'):
        return parse_http(url, 'https')
    elif url.startswith('socks5://'):
        return parse_socks5(url)
    else:
        return None


def to_quantumult_x(node: Dict) -> str:
    """将节点转换为 Quantumult X server_local 格式"""
    t = node['type']
    tag = node['tag']

    if t == 'ss':
        # shadowsocks=host:port, method=xxx, password=xxx, obfs=xxx, obfs-host=xxx, obfs-uri=xxx, tag=xxx
        parts = [f"shadowsocks={node['host']}:{node['port']}"]
        parts.append(f"method={node['method']}")
        parts.append(f"password={node['password']}")
        if node.get('plugin'):
            if 'obfs' in node['plugin']:
                parts.append(f"obfs={node['plugin'].split('-')[1] if '-' in node['plugin'] else node['plugin']}")
            elif 'v2ray' in node['plugin'] or 'ws' in node['plugin']:
                parts.append("obfs=ws")
        if node.get('plugin_opts'):
            opts = urllib.parse.parse_qs(node['plugin_opts'].replace(';', '&'))
            if 'mode' in opts:
                parts.append(f"obfs-host={opts['mode'][0]}")
            if 'path' in opts:
                parts.append(f"obfs-uri={opts['path'][0]}")
        parts.append(f"tag={tag}")
        return ','.join(parts)

    elif t == 'ssr':
        # shadowsocks=host:port, method=xxx, password=xxx, ssr-protocol=xxx, obfs=xxx, obfs-host=xxx, tag=xxx
        parts = [f"shadowsocks={node['host']}:{node['port']}"]
        parts.append(f"method={node['method']}")
        parts.append(f"password={node['password']}")
        parts.append(f"ssr-protocol={node['protocol']}")
        if node.get('protocol_param'):
            parts.append(f"ssr-protocol-param={node['protocol_param']}")
        parts.append(f"obfs={node['obfs']}")
        if node.get('obfs_param'):
            parts.append(f"obfs-host={node['obfs_param']}")
        parts.append(f"tag={tag}")
        return ','.join(parts)

    elif t == 'vmess':
        # vmess=host:port, method=none, password=uuid, obfs=xxx, obfs-host=xxx, obfs-uri=xxx, tag=xxx
        parts = [f"vmess={node['host']}:{node['port']}"]
        parts.append("method=none")
        parts.append(f"password={node['uuid']}")
        net = node.get('network', 'tcp')
        tls = node.get('tls', '')
        ws_host = node.get('ws_host', '')
        path = node.get('path', '')

        if net == 'ws' and tls == 'tls':
            parts.append("obfs=wss")
            if ws_host:
                parts.append(f"obfs-host={ws_host}")
            if path:
                parts.append(f"obfs-uri={path}")
            parts.append("tls-verification=true")
        elif net == 'ws':
            parts.append("obfs=ws")
            if ws_host:
                parts.append(f"obfs-host={ws_host}")
            if path:
                parts.append(f"obfs-uri={path}")
        elif net == 'http':
            parts.append("obfs=http")
            if ws_host:
                parts.append(f"obfs-host={ws_host}")
            if path:
                parts.append(f"obfs-uri={path}")
        elif tls == 'tls':
            parts.append("obfs=over-tls")
            if node.get('sni'):
                parts.append(f"tls-host={node['sni']}")
            parts.append("tls-verification=true")

        if node.get('alter_id'):
            parts.append(f"aead={node['alter_id']}")
        parts.append(f"tag={tag}")
        return ','.join(parts)

    elif t == 'trojan':
        # trojan=host:port, password=xxx, over-tls=true, tls-host=xxx, tag=xxx
        parts = [f"trojan={node['host']}:{node['port']}"]
        parts.append(f"password={node['password']}")
        parts.append("over-tls=true")
        if node.get('sni'):
            parts.append(f"tls-host={node['sni']}")
        parts.append("tls-verification=true")
        if node.get('network') == 'ws':
            parts.append("obfs=wss")
        parts.append(f"tag={tag}")
        return ','.join(parts)

    elif t == 'vless':
        # vless=host:port, method=none, password=uuid, obfs=xxx, tag=xxx
        parts = [f"vless={node['host']}:{node['port']}"]
        parts.append("method=none")
        parts.append(f"password={node['uuid']}")
        security = node.get('security', '')
        if security == 'tls':
            parts.append("obfs=over-tls")
            if node.get('sni'):
                parts.append(f"obfs-host={node['sni']}")
            parts.append("tls-verification=true")
        elif security == 'reality':
            parts.append("obfs=over-tls")
            if node.get('sni'):
                parts.append(f"obfs-host={node['sni']}")
            if node.get('pbk'):
                parts.append(f"reality-base64-pubkey={node['pbk']}")
            if node.get('sid'):
                parts.append(f"reality-hex-shortid={node['sid']}")
        elif node.get('network') == 'ws':
            parts.append("obfs=ws")
        if node.get('flow'):
            parts.append(f"vless-flow={node['flow']}")
        parts.append(f"tag={tag}")
        return ','.join(parts)

    elif t in ('http', 'https'):
        # http(s)=host:port, username=xxx, password=xxx, tag=xxx
        scheme = 'https' if t == 'https' else 'http'
        parts = [f"{scheme}={node['host']}:{node['port']}"]
        if node.get('username'):
            parts.append(f"username={node['username']}")
        if node.get('password'):
            parts.append(f"password={node['password']}")
        if t == 'https':
            parts.append("over-tls=true")
            parts.append("tls-verification=true")
        parts.append(f"tag={tag}")
        return ','.join(parts)

    elif t == 'socks5':
        # socks5=host:port, username=xxx, password=xxx, tag=xxx
        parts = [f"socks5={node['host']}:{node['port']}"]
        if node.get('username'):
            parts.append(f"username={node['username']}")
        if node.get('password'):
            parts.append(f"password={node['password']}")
        parts.append(f"tag={tag}")
        return ','.join(parts)

    return f"# 不支持的节点类型: {t} - {tag}"


def to_json(node: Dict) -> str:
    """输出 JSON 格式"""
    return json.dumps(node, ensure_ascii=False, indent=2)


def parse_batch(text: str) -> List[Dict]:
    """批量解析节点列表（支持纯文本列表和 base64 编码的订阅内容）"""
    nodes = []
    lines = text.strip().splitlines()

    # 尝试检测是否是 base64 编码的订阅
    if len(lines) == 1 and not any(lines[0].startswith(p) for p in ['ss://', 'ssr://', 'vmess://', 'trojan://', 'vless://', 'http://', 'https://', 'socks5://']):
        try:
            decoded = b64decode(lines[0])
            lines = decoded.splitlines()
        except Exception:
            pass

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 跳过注释
        if line.startswith(('#', ';', '//')):
            continue
        node = parse_single(line)
        if node:
            nodes.append(node)
        else:
            print(f"  ⚠️  跳过无法识别的行: {line[:60]}...", file=sys.stderr)

    return nodes


def fetch_subscription(url: str) -> str:
    """获取订阅链接内容"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'QuantumultX/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode('utf-8')
    except Exception as e:
        print(f"  ❌ 获取订阅失败: {e}", file=sys.stderr)
        return ''


def main():
    parser = argparse.ArgumentParser(description='代理节点解析工具 - 支持 ss/ssr/vmess/trojan/vless/http/socks5')
    parser.add_argument('url', nargs='?', help='单个代理节点 URL')
    parser.add_argument('-f', '--file', help='从文件读取节点列表')
    parser.add_argument('-u', '--subscription', help='订阅链接 URL')
    parser.add_argument('-o', '--output', help='输出到文件')
    parser.add_argument('--format', choices=['qx', 'json'], default='qx',
                        help='输出格式: qx (Quantumult X) 或 json (默认: qx)')
    parser.add_argument('-v', '--verbose', action='store_true', help='显示详细信息')

    args = parser.parse_args()

    # 收集所有节点
    nodes = []

    if args.url:
        node = parse_single(args.url)
        if node:
            nodes.append(node)
        else:
            print("❌ 无法解析该节点", file=sys.stderr)
            sys.exit(1)

    if args.file:
        try:
            with open(args.file, 'r', encoding='utf-8') as f:
                content = f.read()
            file_nodes = parse_batch(content)
            nodes.extend(file_nodes)
            print(f"📄 从文件解析到 {len(file_nodes)} 个节点", file=sys.stderr)
        except FileNotFoundError:
            print(f"❌ 文件不存在: {args.file}", file=sys.stderr)
            sys.exit(1)

    if args.subscription:
        print(f"🌐 获取订阅: {args.subscription}", file=sys.stderr)
        content = fetch_subscription(args.subscription)
        if content:
            sub_nodes = parse_batch(content)
            nodes.extend(sub_nodes)
            print(f"📡 从订阅解析到 {len(sub_nodes)} 个节点", file=sys.stderr)

    if not nodes:
        print("❌ 没有解析到任何节点", file=sys.stderr)
        sys.exit(1)

    # 生成输出
    output_lines = []
    output_lines.append(f"# ============================================================")
    output_lines.append(f"# 代理节点解析结果")
    output_lines.append(f"# 共 {len(nodes)} 个节点")
    output_lines.append(f"# 生成时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output_lines.append(f"# ============================================================")
    output_lines.append("")

    for i, node in enumerate(nodes, 1):
        if args.verbose:
            print(f"  [{i}/{len(nodes)}] {node['type'].upper():6} {node['tag']}", file=sys.stderr)

        if args.format == 'qx':
            output_lines.append(to_quantumult_x(node))
        else:
            output_lines.append(to_json(node))
            output_lines.append("")

    result = '\n'.join(output_lines)

    # 输出
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"✅ 已输出到: {args.output}", file=sys.stderr)
    else:
        print(result)

    print(f"\n✅ 共解析 {len(nodes)} 个节点", file=sys.stderr)


if __name__ == '__main__':
    main()
