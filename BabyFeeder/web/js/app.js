/**
 * 主应用逻辑
 */

const App = {
  currentTab: 'record',

  init() {
    this.loadTab('record');
    this.bindEvents();
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 10000);
  },

  updateDateTime() {
    const el = document.getElementById('current-datetime');
    if (el) {
      const now = new Date();
      const opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
      const dateStr = now.toLocaleDateString('zh-CN', opts);
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      el.textContent = `${dateStr} ${timeStr}`;
    }
  },

  bindEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.dataset.tab);
      });
    });

    // 提交记录
    document.getElementById('form-submit')?.addEventListener('click', () => this.submitRecord());

    // 快捷键 Enter 提交
    document.getElementById('feed-amount')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitRecord();
    });

    // 喂养类型切换
    document.querySelectorAll('input[name="feed-type"]').forEach(el => {
      el.addEventListener('change', () => this.toggleBreastSide());
    });

    // 导出
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportData());
    document.getElementById('btn-import')?.addEventListener('click', () => this.importData());
    document.getElementById('btn-clear')?.addEventListener('click', () => this.clearData());

    // 数据导入文件选择
    document.getElementById('import-file')?.addEventListener('change', (e) => this.handleImportFile(e));
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    this.loadTab(tab);
  },

  loadTab(tab) {
    switch (tab) {
      case 'record': this.renderRecordTab(); break;
      case 'history': this.renderHistoryTab(); break;
      case 'stats': this.renderStatsTab(); break;
      case 'predict': this.renderPredictTab(); break;
      case 'sync': this.renderSyncTab(); break;
    }
  },

  // ==================== 记录标签页 ====================
  renderRecordTab() {
    this.renderTodayList();
    this.updateTodaySummary();
  },

  renderTodayList() {
    const list = document.getElementById('today-list');
    const empty = document.getElementById('today-empty');
    const records = DataManager.getToday();
    const sorted = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    list.innerHTML = '';
    if (sorted.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    sorted.forEach(r => {
      const time = new Date(r.timestamp);
      const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const typeLabel = r.type === 'formula' ? '奶粉' : r.type === 'breast' ? '母乳' : '混合';
      const sideLabel = r.breastSide ? ` (${r.breastSide === 'left' ? '左' : r.breastSide === 'right' ? '右' : '双侧'})` : '';

      const div = document.createElement('div');
      div.className = 'feed-item';
      div.innerHTML = `
        <div class="feed-item-left">
          <div class="feed-item-time">${timeStr}</div>
          <div class="feed-item-meta">${typeLabel}${sideLabel}${r.note ? ' · ' + r.note : ''}</div>
        </div>
        <div class="feed-item-right">
          <span class="feed-item-amount">${r.amount || '-'} ml</span>
          <button class="btn-icon delete-btn" data-id="${r.id}" title="删除">✕</button>
        </div>
      `;
      list.appendChild(div);
    });

    // 绑定删除事件
    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('确定删除这条记录？')) {
          DataManager.remove(e.currentTarget.dataset.id);
          this.renderRecordTab();
          // 如果当前在其他标签页，刷新它们
          if (this.currentTab !== 'record') this.loadTab(this.currentTab);
        }
      });
    });
  },

  updateTodaySummary() {
    const stats = Predictor.getTodayStats();
    document.getElementById('today-count').textContent = stats.count;
    document.getElementById('today-total').textContent = stats.totalAmount;
    document.getElementById('today-avg').textContent = stats.avgAmount;
    document.getElementById('today-interval').textContent = stats.avgInterval !== null ? `${stats.avgInterval} 分钟` : '--';
  },

  submitRecord() {
    const amount = parseFloat(document.getElementById('feed-amount').value);
    const type = document.querySelector('input[name="feed-type"]:checked').value;
    const breastSide = document.querySelector('input[name="breast-side"]:checked')?.value || '';
    const note = document.getElementById('feed-note').value.trim();

    if (type === 'formula' && (!amount || amount <= 0)) {
      alert('请输入奶粉量');
      return;
    }

    const record = {
      timestamp: new Date().toISOString(),
      amount: type === 'breast' ? 0 : amount,
      type,
      breastSide: type === 'formula' ? '' : breastSide,
      note
    };

    DataManager.add(record);

    // 清空表单
    document.getElementById('feed-amount').value = '';
    document.getElementById('feed-note').value = '';
    document.getElementById('feed-amount').focus();

    this.renderRecordTab();
    // 小动画反馈
    const btn = document.getElementById('form-submit');
    btn.textContent = '✓ 已记录';
    setTimeout(() => { btn.textContent = '记录喂养'; }, 1500);
  },

  toggleBreastSide() {
    const type = document.querySelector('input[name="feed-type"]:checked').value;
    const breastOptions = document.getElementById('breast-side-options');
    breastOptions.style.display = type === 'breast' || type === 'both' ? 'flex' : 'none';
  },

  // ==================== 历史标签页 ====================
  renderHistoryTab() {
    const records = DataManager.getAll();
    const sorted = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const container = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');

    if (sorted.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    // 按日期分组
    const groups = {};
    sorted.forEach(r => {
      const dateKey = new Date(r.timestamp).toLocaleDateString('zh-CN');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(r);
    });

    container.innerHTML = '';
    Object.entries(groups).forEach(([dateKey, items]) => {
      const total = items.reduce((s, r) => s + (r.amount || 0), 0);
      const count = items.length;
      const section = document.createElement('div');
      section.className = 'history-date-group';
      section.innerHTML = `
        <div class="history-date-header">
          <span>${dateKey}</span>
          <span class="history-date-summary">${count} 次 · 总计 ${total}ml</span>
        </div>
      `;
      const list = document.createElement('div');
      list.className = 'history-items';
      items.forEach(r => {
        const time = new Date(r.timestamp);
        const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const typeLabel = r.type === 'formula' ? '奶粉' : r.type === 'breast' ? '母乳' : '混合';
        const sideLabel = r.breastSide ? (r.breastSide === 'left' ? '左' : r.breastSide === 'right' ? '右' : '双侧') : '';
        const item = document.createElement('div');
        item.className = 'feed-item history-item';
        item.innerHTML = `
          <div class="feed-item-left">
            <div class="feed-item-time">${timeStr}</div>
            <div class="feed-item-meta">${typeLabel}${sideLabel ? ' · ' + sideLabel : ''}${r.note ? ' · ' + r.note : ''}</div>
          </div>
          <div class="feed-item-right">
            <span class="feed-item-amount">${r.amount || '-'} ml</span>
            <button class="btn-icon delete-btn" data-id="${r.id}" title="删除">✕</button>
          </div>
        `;
        list.appendChild(item);
      });
      section.appendChild(list);
      container.appendChild(section);
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('确定删除这条记录？')) {
          DataManager.remove(e.currentTarget.dataset.id);
          this.renderHistoryTab();
          if (this.currentTab !== 'history') this.loadTab(this.currentTab);
        }
      });
    });
  },

  // ==================== 统计标签页 ====================
  renderStatsTab() {
    const dailyStats = Predictor.getDailyStats(14);
    const todayStats = Predictor.getTodayStats();
    const records = DataManager.getAll();

    // 概要统计
    document.getElementById('stats-total-days').textContent = this._countActiveDays(records);
    document.getElementById('stats-total-feeds').textContent = records.length;
    document.getElementById('stats-total-amount').textContent = records.reduce((s, r) => s + (r.amount || 0), 0);
    const avgPerFeed = records.length > 0 ? Math.round(records.reduce((s, r) => s + (r.amount || 0), 0) / records.length) : 0;
    document.getElementById('stats-avg-amount').textContent = avgPerFeed;

    // 渲染图表
    setTimeout(() => {
      ChartModule.renderAmountTrend('chart-amount', dailyStats);
      ChartModule.renderCountTrend('chart-count', dailyStats);
      ChartModule.renderHourlyDist('chart-hourly');
    }, 50);
  },

  _countActiveDays(records) {
    if (records.length === 0) return 0;
    const days = new Set();
    records.forEach(r => {
      days.add(new Date(r.timestamp).toLocaleDateString('zh-CN'));
    });
    return days.size;
  },

  // ==================== 预测标签页 ====================
  renderPredictTab() {
    const result = Predictor.predict(7);
    const el = document.getElementById('predict-result');

    if (!result.nextTime) {
      el.innerHTML = `
        <div class="predict-empty">
          <div class="predict-icon">📊</div>
          <p>${result.insight}</p>
          <p class="predict-hint">当前记录数：${DataManager.getAll().length} 条</p>
        </div>
      `;
      return;
    }

    const nextTime = new Date(result.nextTime);
    const now = new Date();
    const diffMs = nextTime - now;
    const diffMins = Math.round(diffMs / 60000);

    let countdownText = '';
    if (diffMins > 0) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      countdownText = `约 ${hours} 小时 ${mins} 分钟后`;
    } else {
      countdownText = '预计已到喂养时间';
    }

    const timeStr = nextTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // 获取最近一次喂养信息
    const recent = DataManager.getRecent(1);
    let lastFeedStr = '--';
    if (recent.length > 0) {
      const t = new Date(recent[0].timestamp);
      if (t.toDateString() === now.toDateString()) {
        lastFeedStr = t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      } else {
        lastFeedStr = t.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      }
    }

    el.innerHTML = `
      <div class="predict-card">
        <div class="predict-main">
          <div class="predict-time-label">预计下次喂养时间</div>
          <div class="predict-time">${timeStr}</div>
          <div class="predict-countdown">${countdownText}</div>
        </div>
        <div class="predict-details">
          <div class="predict-detail-item">
            <span class="predict-detail-label">预计奶量</span>
            <span class="predict-detail-value">${result.nextAmount} ml</span>
          </div>
          <div class="predict-detail-item">
            <span class="predict-detail-label">平均间隔</span>
            <span class="predict-detail-value">${result.avgInterval} 分钟</span>
          </div>
          <div class="predict-detail-item">
            <span class="predict-detail-label">预测置信度</span>
            <span class="predict-detail-value">
              <span class="confidence-bar"><span class="confidence-fill" style="width:${result.confidence}%"></span></span>
              ${result.confidence}%
            </span>
          </div>
          <div class="predict-detail-item">
            <span class="predict-detail-label">上次喂养</span>
            <span class="predict-detail-value">${lastFeedStr}</span>
          </div>
        </div>
        <div class="predict-insight">
          <strong>💡 分析</strong>
          <p>${result.insight}</p>
        </div>
      </div>
    `;

    // 自动刷新倒计时
    if (this._predictTimer) clearTimeout(this._predictTimer);
    this._predictTimer = setTimeout(() => this.renderPredictTab(), 30000);
  },

  // ==================== 数据管理 ====================
  exportData() {
    const json = DataManager.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `婴儿喂养记录_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData() {
    document.getElementById('import-file').click();
  },

  handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const success = DataManager.importJSON(ev.target.result);
      if (success) {
        alert('导入成功！');
        this.loadTab(this.currentTab);
      } else {
        alert('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },

  clearData() {
    if (confirm('确定要清空所有数据？此操作不可撤销！')) {
      if (confirm('再次确认：清空所有喂养记录？')) {
        DataManager.clear();
        this.loadTab(this.currentTab);
        alert('数据已清空');
      }
    }
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());

  // ==================== 同步标签页 ====================
  renderSyncTab() {
    const config = SyncManager.getConfig();
    document.getElementById('sync-server-url').value = config.serverUrl || '';
    document.getElementById('sync-group-id').value = config.groupId || '';
    document.getElementById('sync-auto').checked = config.autoSync || false;

    if (config.lastSync) {
      const d = new Date(config.lastSync);
      document.getElementById('sync-status-card').style.display = 'block';
      document.getElementById('sync-status').innerHTML =
        '<div style="font-size:13px;color:var(--text-secondary)">上次同步: ' + d.toLocaleString('zh-CN') + '</div>';
    }

    const btns = ['btn-sync','btn-sync-upload','btn-sync-download'];
    btns.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) { const newEl = el.cloneNode(true); el.parentNode.replaceChild(newEl, el); }
    });

    document.getElementById('btn-sync').addEventListener('click', function() { App.doSync('all'); });
    document.getElementById('btn-sync-upload').addEventListener('click', function() { App.doSync('upload'); });
    document.getElementById('btn-sync-download').addEventListener('click', function() { App.doSync('download'); });

    ['sync-server-url','sync-group-id'].forEach(function(id) {
      document.getElementById(id).addEventListener('input', function() { App.saveSyncConfig(); });
    });
    document.getElementById('sync-auto').addEventListener('change', function() { App.saveSyncConfig(); });
  },

  saveSyncConfig() {
    const serverUrl = (document.getElementById('sync-server-url').value || '').trim();
    const groupId = (document.getElementById('sync-group-id').value || '').trim();
    const autoSync = document.getElementById('sync-auto').checked;
    SyncManager.updateSettings(serverUrl, groupId, autoSync);
  },

  doSync: function(mode) {
    this.saveSyncConfig();
    const config = SyncManager.getConfig();
    if (!config.serverUrl || !config.groupId) { alert('请填写服务器地址和群组码'); return; }

    const statusCard = document.getElementById('sync-status-card');
    const statusEl = document.getElementById('sync-status');
    const btn = document.getElementById('btn-sync');
    statusCard.style.display = 'block';
    statusEl.innerHTML = '同步中...';
    btn.disabled = true;
    btn.textContent = '同步中...';

    const self = this;
    async function runSync() {
      try {
        let result;
        if (mode === 'upload') result = await SyncManager.upload();
        else if (mode === 'download') result = await SyncManager.download();
        else result = await SyncManager.syncAll();

        if (result.success) {
          const label = mode === 'all' ? '双向同步' : (mode === 'upload' ? '上传' : '下载');
          statusEl.innerHTML = '<div style="color:#52c41a;font-weight:600">' + label + '完成</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">' +
            (result.count !== undefined ? '记录: ' + result.count + ' 条' : '') +
            (result.merged !== undefined ? ' 总计: ' + result.merged + ' 条' : '') + '</div>' +
            '<div style="font-size:12px;color:#aaa;margin-top:4px">' + new Date().toLocaleString('zh-CN') + '</div>';
          if (self.currentTab === 'record' || self.currentTab === 'history') self.loadTab(self.currentTab);
        } else {
          statusEl.innerHTML = '<div style="color:#ff4d4f;font-weight:600">' + (result.error || '同步失败') + '</div>';
        }
      } catch (e) {
        statusEl.innerHTML = '<div style="color:#ff4d4f;font-weight:600">异常: ' + e.message + '</div>';
      }
      btn.disabled = false;
      btn.textContent = '立即同步';
    }
    runSync();
  }