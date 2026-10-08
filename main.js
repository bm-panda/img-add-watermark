#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const { render } = require('./src/renderer');
const { loadConfig } = require('./src/config');
const { resolveOutputPath } = require('./src/output');

function readPayload() {
  const payloadPath = process.argv[2];
  if (!payloadPath) return null;
  try {
    return JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));
  } catch (err) {
    console.error('参数文件解析失败:', err.message);
    return {};
  }
}

function notify(env, message, type) {
  const apiBase = (env && env.api_base) || 'http://127.0.0.1:9527';
  let url;
  try {
    url = new URL('/api/notify', apiBase);
  } catch {
    return;
  }
  const body = JSON.stringify({ message, notify_type: type || 'success', duration: 3000 });
  try {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => res.resume()
    );
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch {}
}

function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const DEFAULT_FONT = 48;

function pickParams(params) {
  const p = params || {};
  const out = {};
  if (p.type !== undefined && p.type !== '') out.watermarkType = String(p.type);
  if (p.text !== undefined) out.watermarkText = String(p.text);
  if (p.font_size !== undefined && p.font_size !== '') out.fontSize = toInt(p.font_size, DEFAULT_FONT);
  if (p.color !== undefined && p.color !== '') out.textColor = String(p.color);
  if (p.opacity !== undefined && p.opacity !== '') {
    const n = parseFloat(p.opacity);
    if (!Number.isNaN(n)) out.opacity = n;
  }
  if (p.rotation !== undefined && p.rotation !== '') out.rotation = toInt(p.rotation, 0);
  if (p.position !== undefined && p.position !== '') out.position = String(p.position);
  if (p.tile !== undefined) out.tileMode = (p.tile === true || p.tile === 'true');
  if (typeof p.image_path === 'string' && p.image_path) out.watermarkImagePath = p.image_path;
  if (p.scale !== undefined && p.scale !== '') out.watermarkScale = toInt(p.scale, 20);
  if (typeof p.output_dir === 'string') out.outputPath = p.output_dir;
  if (p.suffix !== undefined && p.suffix !== null) out.suffix = String(p.suffix);
  return out;
}

function writeEnvelope(env, payload) {
  if (!env || !env.output_json) return;
  try {
    fs.writeFileSync(env.output_json, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    console.error('信封写入失败:', e.message);
  }
}

async function processHeadless(files, env, params, isNode) {
  const config = { ...loadConfig(), ...pickParams(params) };
  const results = [];

  for (const input of files) {
    try {
      const buffer = fs.readFileSync(input);
      const result = await render(buffer, config);
      const target = resolveOutputPath(input, path.basename(input), config);
      if (target.error) throw new Error(target.error);
      fs.mkdirSync(path.dirname(target.output), { recursive: true });
      fs.writeFileSync(target.output, result.buffer);
      results.push({ input, output: target.output, status: 'ok' });
    } catch (e) {
      results.push({ input, status: 'error', error: e.message });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const outputs = results.filter((r) => r.status === 'ok').map((r) => r.output);
  const noInput = files.length === 0;
  const success = !noInput && ok === results.length;
  const msg = noInput ? '未提供图片' : (success ? 'ok' : `部分失败: ${results.length - ok} 个`);

  if (isNode) {
    writeEnvelope(env, { code: success ? 0 : 1, msg, files: outputs, count: ok });
  } else {
    notify(env, noInput ? '未提供图片' : `水印处理完成: ${ok}/${results.length} 个文件成功`, success ? 'success' : 'error');
  }

  process.exit(success ? 0 : 1);
}

function main() {
  const payload = readPayload();
  const env = (payload && payload.environment) || {};
  const data = (payload && payload.data) || {};
  const params = (payload && payload.params) || {};
  const mode = env.invoke_mode;
  const files = Array.isArray(data.target_paths) ? data.target_paths.filter(Boolean) : [];

  if (mode === 'node') {
    processHeadless(files, env, params, true);
    return;
  }
  if (mode === 'scheduled') {
    processHeadless(files, env, params, false);
    return;
  }

  require('./src/server').start(files);
}

if (require.main === module) {
  main();
}
