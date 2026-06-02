/**
 * BabyFeeder 数据同步服务器
 *
 * 使用方法：
 *   node sync-server.js
 *   服务器运行在 http://0.0.0.0:8081
 *
 * 部署到云服务器（使用 PM2）：
 *   npm install -g pm2
 *   pm2 start sync-server.js --name baby-feeder-sync
 */

const http = require('http');
const url = require('url');

const PORT = 8081;

// 内存存储：按群组码存储记录
const store = new Map();

// CORS 头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

function sendJSON(res, status, data) {
  res.writeHead(status, CORS_HEADERS);
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('无效的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const query = parsed.query;
  const group = query.group || 'default';

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  try {
    // 心跳检测
    if (path === '/ping' && req.method === 'GET') {
      return sendJSON(res, 200, {
        success: true,
        message: '服务器运行正常',
        groups: store.size,
        uptime: process.uptime()
      });
    }

    // 同步接口
    if (path === '/sync') {
      if (req.method === 'POST') {
        // 上传数据
        const body = await parseBody(req);
        const records = body.records || body;

        if (!Array.isArray(records)) {
          return sendJSON(res, 400, { success: false, error: '数据格式错误，需要数组' });
        }

        // 合并存储：按 ID 去重，保留最新的
        const existing = store.get(group) || [];
        const incomingMap = new Map(records.map(r => [r.id, r]));
        // 保留已有的但不在上传中的记录
        const merged = existing.filter(r => !incomingMap.has(r.id));

        // 合并现有 + 新上传（上传的记录优先覆盖）
        records.forEach(r => {
          const idx = merged.findIndex(e => e.id === r.id);
          if (idx >= 0) {
            merged[idx] = r; // 覆盖
          } else {
            merged.push(r);
          }
        });

        store.set(group, merged);

        console.log(`[${new Date().toISOString()}] 群组 "${group}" 上传 ${records.length} 条，总计 ${merged.length} 条`);

        return sendJSON(res, 200, {
          success: true,
          count: records.length,
          total: merged.length,
          message: `成功接收 ${records.length} 条记录`
        });

      } else if (req.method === 'GET') {
        // 下载数据
        const records = store.get(group) || [];

        console.log(`[${new Date().toISOString()}] 群组 "${group}" 下载 ${records.length} 条`);

        return sendJSON(res, 200, {
          success: true,
          records,
          count: records.length
        });
      }
    }

    // 状态页面
    if (path === '/status' && req.method === 'GET') {
      const info = {};
      for (const [g, records] of store) {
        info[g] = { count: records.length };
      }
      return sendJSON(res, 200, {
        success: true,
        groups: info,
        uptime: process.uptime(),
        memory: process.memoryUsage().rss
      });
    }

    // 404
    sendJSON(res, 404, { success: false, error: '未知接口' });

  } catch (e) {
    console.error(`[${new Date().toISOString()}] 错误:`, e.message);
    sendJSON(res, 500, { success: false, error: '服务器内部错误: ' + e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('?? BabyFeeder 同步服务器已启动');
  console.log('================================');
  console.log(`  地址: http://0.0.0.0:${PORT}`);
  console.log(`  心跳: http://localhost:${PORT}/ping`);
  console.log(`  同步: http://localhost:${PORT}/sync?group=你的群组码`);
  console.log(`  状态: http://localhost:${PORT}/status`);
  console.log('================================');
  console.log('  在 App 的同步设置中填写:');
  console.log(`  服务器: http://你的电脑IP:${PORT}`);
  console.log('  群组码: 任意自定义名称（多设备保持一致）');
  console.log('================================');
  console.log('');
});
