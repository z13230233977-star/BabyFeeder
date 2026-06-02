/**
 * 主应用逻辑
 */

const App = {
  currentTab: 'record',

  init() {
    this.loadTab('record');
    this.bindEvents();
    this.updateDateTime();
    this.updateAgeBadge();
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

  updateAgeBadge() {
    const badge = document.getElementById('header-age-badge');
    if (!badge) return;
    const profile = BabyProfile.get();
    const ageLabel = BabyProfile.getAgeLabel();
    if (BabyProfile.hasBirthDate()) {
      badge.textContent = `${profile.name} · ${ageLabel}`;
      badge.style.display = 'block';
    } else {
      badge.textContent = '?? 请设置宝宝出生日期';
      badge.style.display = 'block';
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

    // 保存婴儿档案
    document.getElementById('btn-save-profile')?.addEventListener('click', () => this.saveProfile());
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
      case 'settings': this.renderSettingsTab(); break;
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
          <button class="btn-icon delete-btn" data-id="${r.id}" title="删除">???</button>
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
    document.getElementById('today-interval').textContent = stats.avgInterval !== null ? `${stats.avgInterval}分钟` : '--';
  },

  toggleBreastSide() {
    const val = document.querySelector('input[name="feed-type"]:checked')?.value;
    const options = document.getElementById('breast-side-options');
    options.style.display = val === 'breast' || val === 'both' ? 'block' : 'none';
  },

  submitRecord() {
    const type = document.querySelector('input[name="feed-type"]:checked')?.value || 'formula';
    const amount = parseFloat(document.getElementById('feed-amount').value) || 0;
    const breastSide = document.querySelector('input[name="breast-side"]:checked')?.value || '';
    const note = document.getElementById('feed-note').value.trim();

    if (type !== 'breast' && amount <= 0) {
      alert('请填写奶量');
      return;
    }

    DataManager.add({ type, amount, breastSide, note });
    document.getElementById('feed-amount').value = '';
    document.getElementById('feed-note').value = '';
    this.renderRecordTab();
    if (this.currentTab !== 'record') this.loadTab(this.currentTab);
  },

  // ==================== 历史标签页 ====================
  renderHistoryTab() {
    const records = DataManager.getAll();
    const sorted = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');

    list.innerHTML = '';
    if (sorted.length === 0) {
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

    Object.keys(groups).forEach(dateKey => {
      const records = groups[dateKey];
      const totalAmount = records.reduce((s, r) => s + (r.amount || 0), 0);
      const count = records.length;

      const header = document.createElement('div');
      header.className = 'history-date-header';
      header.textContent = `${dateKey} · ${count} 次 · ${totalAmount}ml`;
      list.appendChild(header);

      records.forEach(r => {
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
            <button class="btn-icon delete-btn" data-id="${r.id}" title="删除">???</button>
          </div>
        `;
        list.appendChild(div);
      });
    });

    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('确定删除这条记录？')) {
          DataManager.remove(e.currentTarget.dataset.id);
          this.renderHistoryTab();
        }
      });
    });
  },

  // ==================== 统计标签页 ====================
  renderStatsTab() {
    const records = DataManager.getAll();
    const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const totalDays = new Set(sorted.map(r => new Date(r.timestamp).toLocaleDateString())).size;
    const totalFeeds = sorted.length;
    const totalAmount = sorted.reduce((s, r) => s + (r.amount || 0), 0);
    const avgAmount = totalFeeds > 0 ? Math.round(totalAmount / totalFeeds) : 0;

    document.getElementById('stats-total-days').textContent = totalDays;
    document.getElementById('stats-total-feeds').textContent = totalFeeds;
    document.getElementById('stats-total-amount').textContent = totalAmount;
    document.getElementById('stats-avg-amount').textContent = avgAmount;

    // 月龄参考
    const ageRef = document.getElementById('stats-age-reference');
    const ageContent = document.getElementById('age-reference-content');
    const guideline = Predictor.getAgeGuidelines();
    const dailyRec = Predictor.getRecommendedDailyAmount();

    if (guideline && dailyRec) {
      ageRef.style.display = 'block';
      ageContent.innerHTML = `
        <div style="font-size:13px;line-height:1.8">
          <div>?? <b>${guideline.label}</b></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
            <div style="background:var(--primary-light);padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:11px;color:var(--text-secondary)">推荐间隔</div>
              <div style="font-size:16px;font-weight:700;color:var(--primary)">${guideline.minInterval}-${guideline.maxInterval}分钟</div>
            </div>
            <div style="background:var(--primary-light);padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:11px;color:var(--text-secondary)">推荐单次</div>
              <div style="font-size:16px;font-weight:700;color:var(--primary)">${guideline.minAmount}-${guideline.maxAmount}ml</div>
            </div>
            <div style="background:var(--primary-light);padding:10px;border-radius:8px;text-align:center;grid-column:span 2">
              <div style="font-size:11px;color:var(--text-secondary)">推荐每日总奶量</div>
              <div style="font-size:16px;font-weight:700;color:var(--primary)">${dailyRec.min}-${dailyRec.max}ml</div>
              <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${dailyRec.label}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      ageRef.style.display = 'none';
    }

    // 图表
    this.renderCharts();
  },

  renderCharts() {
    const dailyStats = Predictor.getDailyStats(14);
    if (typeof Chart === 'undefined') return;

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { grid: { display: false } }
      }
    };

    // 奶量趋势
    const ctx1 = document.getElementById('chart-amount');
    if (ctx1) {
      if (this._chartAmount) this._chartAmount.destroy();
      this._chartAmount = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: dailyStats.map(d => d.label),
          datasets: [{
            label: '总奶量 (ml)',
            data: dailyStats.map(d => d.totalAmount),
            backgroundColor: 'rgba(79, 172, 254, 0.6)',
            borderColor: '#4FACFE',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: { ...chartOptions }
      });
    }

    // 喂养次数
    const ctx2 = document.getElementById('chart-count');
    if (ctx2) {
      if (this._chartCount) this._chartCount.destroy();
      this._chartCount = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: dailyStats.map(d => d.label),
          datasets: [{
            label: '喂养次数',
            data: dailyStats.map(d => d.count),
            borderColor: '#764ba2',
            backgroundColor: 'rgba(118, 75, 162, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4
          }]
        },
        options: { ...chartOptions }
      });
    }

    // 时点分布
    const hourlyData = new Array(24).fill(0);
    DataManager.getAll().forEach(r => {
      const h = new Date(r.timestamp).getHours();
      hourlyData[h]++;
    });
    const hourLabels = Array.from({length: 24}, (_, i) => `${i}时`);

    const ctx3 = document.getElementById('chart-hourly');
    if (ctx3) {
      if (this._chartHourly) this._chartHourly.destroy();
      this._chartHourly = new Chart(ctx3, {
        type: 'bar',
        data: {
          labels: hourLabels,
          datasets: [{
            label: '喂养次数',
            data: hourlyData,
            backgroundColor: 'rgba(82, 196, 26, 0.5)',
            borderColor: '#52c41a',
            borderWidth: 1,
            borderRadius: 2
          }]
        },
        options: {
          ...chartOptions,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  },

  // ==================== 预测标签页 ====================
  renderPredictTab() {
    const container = document.getElementById('predict-result');
    const ageHint = document.getElementById('predict-age-hint');
    const ageHintContent = document.getElementById('age-hint-content');

    // 显示月龄提示
    const guideline = Predictor.getAgeGuidelines();
    if (guideline) {
      ageHint.style.display = 'block';
      ageHintContent.innerHTML = `
        <div style="font-size:13px;color:var(--text-secondary)">
          当前 <b>${BabyProfile.getAgeLabel()}</b> · 参考间隔 ${guideline.minInterval}-${guideline.maxInterval} 分钟 · 参考奶量 ${guideline.minAmount}-${guideline.maxAmount}ml
        </div>
      `;
    } else {
      ageHint.style.display = 'none';
    }

    const result = Predictor.predict();

    if (result.nextTime === null && result.nextAmount === null) {
      container.innerHTML = `
        <div class="predict-empty">
          <div class="predict-icon">??</div>
          <p>${result.insight}</p>
          ${!BabyProfile.hasBirthDate() ? '<p style="font-size:13px;color:var(--primary);margin-top:8px">?? 去 ?? 设置 填写出生日期获取月龄推荐</p>' : ''}
        </div>
      `;
      return;
    }

    let html = '<div class="predict-main">';

    if (result.nextTime) {
      const nextDate = new Date(result.nextTime);
      const timeStr = nextDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const now = new Date();
      const diffMs = nextDate - now;
      const diffMin = Math.round(diffMs / 60000);
      let countdown = '';
      if (diffMin > 0) {
        if (diffMin < 60) countdown = `还有约 ${diffMin} 分钟`;
        else countdown = `还有约 ${Math.floor(diffMin / 60)} 小时 ${diffMin % 60} 分钟`;
      } else {
        countdown = '已到预计时间';
      }

      html += `
        <div class="predict-time-label">预计下次喂养时间</div>
        <div class="predict-time">${timeStr}</div>
        <div class="predict-countdown">${countdown}</div>
      `;
    }

    html += '</div>';

    // 详细信息
    html += '<div class="predict-details">';
    if (result.avgInterval) {
      html += `
        <div class="predict-detail-item">
          <span class="predict-detail-label">? 平均间隔</span>
          <span class="predict-detail-value">${result.avgInterval} 分钟</span>
        </div>
      `;
    }
    if (result.nextAmount) {
      html += `
        <div class="predict-detail-item">
          <span class="predict-detail-label">?? 预计奶量</span>
          <span class="predict-detail-value">${result.nextAmount} ml</span>
        </div>
      `;
    }
    html += `
      <div class="predict-detail-item">
        <span class="predict-detail-label">?? 预测置信度</span>
        <span class="predict-detail-value">
          ${result.confidence}%
          <span class="confidence-bar"><span class="confidence-fill" style="width:${result.confidence}%"></span></span>
        </span>
      </div>
    `;
    html += '</div>';

    // 洞察
    if (result.insight) {
      html += `<div class="predict-insight">?? ${result.insight}</div>`;
    }

    container.innerHTML = html;
  },

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
        '<div style="font-size:13px;color:var(--text-secondary)">上次同步: ' + d.toLocaleString('zh-CN') +
        (config.lastSyncResult ? '<br>' + config.lastSyncResult : '') + '</div>';
    }

    // 重新绑定按钮（移除旧监听器）
    ['btn-sync','btn-sync-upload','btn-sync-download','btn-sync-ping'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { const clone = el.cloneNode(true); el.parentNode.replaceChild(clone, el); }
    });

    document.getElementById('btn-sync').addEventListener('click', () => this.doSync('all'));
    document.getElementById('btn-sync-upload').addEventListener('click', () => this.doSync('upload'));
    document.getElementById('btn-sync-download').addEventListener('click', () => this.doSync('download'));
    document.getElementById('btn-sync-ping').addEventListener('click', () => this.testSync());

    ['sync-server-url','sync-group-id'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.saveSyncConfig());
    });
    document.getElementById('sync-auto').addEventListener('change', () => this.saveSyncConfig());
  },

  saveSyncConfig() {
    const serverUrl = (document.getElementById('sync-server-url').value || '').trim();
    const groupId = (document.getElementById('sync-group-id').value || '').trim();
    const autoSync = document.getElementById('sync-auto').checked;
    SyncManager.updateSettings(serverUrl, groupId, autoSync);
  },

  async testSync() {
    this.saveSyncConfig();
    const statusCard = document.getElementById('sync-status-card');
    const statusEl = document.getElementById('sync-status');
    statusCard.style.display = 'block';
    statusEl.innerHTML = '测试连接中...';
    const result = await SyncManager.ping();
    if (result.success) {
      statusEl.innerHTML = '<div style="color:#52c41a;font-weight:600">? ' + result.message + '</div>';
    } else {
      statusEl.innerHTML = '<div style="color:#ff4d4f;font-weight:600">? ' + (result.error || '连接失败') + '</div>';
    }
  },

  doSync(mode) {
    this.saveSyncConfig();
    const config = SyncManager.getConfig();
    if (!config.serverUrl || !config.groupId) {
      alert('请填写服务器地址和群组码');
      return;
    }

    const statusCard = document.getElementById('sync-status-card');
    const statusEl = document.getElementById('sync-status');
    const btn = document.getElementById('btn-sync');
    statusCard.style.display = 'block';
    statusEl.innerHTML = '同步中...';
    btn.disabled = true;
    btn.textContent = '同步中...';

    const runSync = async () => {
      try {
        let result;
        if (mode === 'upload') result = await SyncManager.upload();
        else if (mode === 'download') result = await SyncManager.download();
        else result = await SyncManager.syncAll();

        if (result.success) {
          const label = mode === 'all' ? '双向同步' : (mode === 'upload' ? '上传' : '下载');
          statusEl.innerHTML = '<div style="color:#52c41a;font-weight:600">? ' + label + '完成</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">' +
            (result.count !== undefined ? '处理: ' + result.count + ' 条' : '') +
            (result.merged !== undefined ? ' · 总计: ' + result.merged + ' 条' : '') + '</div>' +
            '<div style="font-size:12px;color:#aaa;margin-top:4px">' + new Date().toLocaleString('zh-CN') + '</div>';
          if (this.currentTab === 'record' || this.currentTab === 'history') this.loadTab(this.currentTab);
        } else {
          statusEl.innerHTML = '<div style="color:#ff4d4f;font-weight:600">? ' + (result.error || '同步失败') + '</div>';
        }
      } catch (e) {
        statusEl.innerHTML = '<div style="color:#ff4d4f;font-weight:600">? 异常: ' + e.message + '</div>';
      }
      btn.disabled = false;
      btn.textContent = '?? 立即同步';
    };
    runSync();
  },

  // ==================== 设置标签页 ====================
  renderSettingsTab() {
    const profile = BabyProfile.get();
    const nameInput = document.getElementById('baby-name');
    const birthInput = document.getElementById('baby-birthdate');
    const ageDisplay = document.getElementById('baby-age-display');
    const guideTable = document.getElementById('feeding-guide-table');

    nameInput.value = profile.name || '';
    birthInput.value = profile.birthDate || '';

    const ageLabel = BabyProfile.getAgeLabel();
    ageDisplay.textContent = `当前月龄：${ageLabel}`;

    // 喂养参考表
    const allGuidelines = [
      { age: '新生儿（< 1个月）', interval: '2-3 小时', amount: '30-90ml' },
      { age: '1个月', interval: '3-4 小时', amount: '60-120ml' },
      { age: '2-3个月', interval: '3-4 小时', amount: '90-150ml' },
      { age: '4-5个月', interval: '4-5 小时', amount: '120-180ml' },
      { age: '6-11个月', interval: '4-6 小时', amount: '150-240ml（加辅食）' },
      { age: '1岁以上', interval: '4-6 小时', amount: '180-300ml（加辅食）' }
    ];

    guideTable.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse">
      <thead><tr style="background:var(--primary);color:white">
        <th style="padding:8px 10px;text-align:left">月龄</th>
        <th style="padding:8px 10px;text-align:center">推荐间隔</th>
        <th style="padding:8px 10px;text-align:center">推荐奶量</th>
      </tr></thead>
      <tbody>${allGuidelines.map(g => {
        const isCurrent = BabyProfile.hasBirthDate() && g.age.includes(Math.floor(BabyProfile.getAgeMonths() || 0).toString());
        return `<tr style="border-bottom:1px solid var(--border)${isCurrent ? ';background:var(--primary-light);font-weight:600' : ''}">
          <td style="padding:8px 10px">${g.age}</td>
          <td style="padding:8px 10px;text-align:center">${g.interval}</td>
          <td style="padding:8px 10px;text-align:center">${g.amount}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  },

  saveProfile() {
    const name = (document.getElementById('baby-name').value || '').trim() || '宝宝';
    const birthDate = document.getElementById('baby-birthdate').value || null;
    BabyProfile.save({ name, birthDate });
    this.renderSettingsTab();
    this.updateAgeBadge();
    alert('? 婴儿档案已保存！\n预测引擎将根据 ' + BabyProfile.getAgeLabel() + ' 提供精准建议。');
  },

  // ==================== 数据管理 ====================
  exportData() {
    const json = DataManager.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baby_feeder_${new Date().toISOString().slice(0, 10)}.json`;
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
