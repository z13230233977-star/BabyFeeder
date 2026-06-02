/**
 * 数据管理模块 - 使用 localStorage 存储喂养记录和婴儿档案
 */

const DB_KEY = 'baby_feeder_records';
const BABY_PROFILE_KEY = 'baby_feeder_profile';

const DataManager = {
  /**
   * 获取所有记录
   */
  getAll() {
    try {
      const data = localStorage.getItem(DB_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('读取数据失败:', e);
      return [];
    }
  },

  /**
   * 添加一条喂养记录
   */
  add(record) {
    const records = this.getAll();
    const newRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: record.timestamp || new Date().toISOString(),
      amount: parseFloat(record.amount) || 0,
      type: record.type || 'formula',
      breastSide: record.breastSide || '',
      note: record.note || '',
      createdAt: new Date().toISOString()
    };
    records.push(newRecord);
    this._save(records);
    return newRecord;
  },

  /**
   * 删除一条记录
   */
  remove(id) {
    const records = this.getAll().filter(r => r.id !== id);
    this._save(records);
  },

  /**
   * 更新一条记录
   */
  update(id, updates) {
    const records = this.getAll();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...updates, updatedAt: new Date().toISOString() };
    this._save(records);
    return records[idx];
  },

  /**
   * 按日期范围查询
   */
  getByDateRange(startDate, endDate) {
    const records = this.getAll();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + 86400000;
    return records.filter(r => {
      const t = new Date(r.timestamp).getTime();
      return t >= start && t < end;
    });
  },

  /**
   * 获取今日记录
   */
  getToday() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return this.getByDateRange(start.toISOString(), start.toISOString());
  },

  /**
   * 获取最近 N 条记录
   */
  getRecent(n) {
    const records = this.getAll();
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return records.slice(0, n);
  },

  /**
   * 清空所有数据
   */
  clear() {
    localStorage.removeItem(DB_KEY);
  },

  /**
   * 导出数据为 JSON
   */
  exportJSON() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  /**
   * 从 JSON 导入数据
   */
  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) throw new Error('格式错误');
      this._save(data);
      return true;
    } catch (e) {
      console.error('导入失败:', e);
      return false;
    }
  },

  _save(records) {
    localStorage.setItem(DB_KEY, JSON.stringify(records));
  }
};

/**
 * 婴儿档案管理
 */
const BabyProfile = {
  /**
   * 获取婴儿档案
   */
  get() {
    try {
      const data = localStorage.getItem(BABY_PROFILE_KEY);
      return data ? JSON.parse(data) : { name: '宝宝', birthDate: null };
    } catch (e) {
      return { name: '宝宝', birthDate: null };
    }
  },

  /**
   * 保存婴儿档案
   */
  save(profile) {
    localStorage.setItem(BABY_PROFILE_KEY, JSON.stringify(profile));
  },

  /**
   * 更新婴儿档案字段
   */
  update(updates) {
    const profile = this.get();
    Object.assign(profile, updates);
    this.save(profile);
    return profile;
  },

  /**
   * 获取婴儿月龄（精确到月）
   */
  getAgeMonths() {
    const profile = this.get();
    if (!profile.birthDate) return null;
    const birth = new Date(profile.birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12
      + (now.getMonth() - birth.getMonth())
      + (now.getDate() >= birth.getDate() ? 0 : -0.5);
    return Math.max(0, months);
  },

  /**
   * 获取月龄描述
   */
  getAgeLabel() {
    const months = this.getAgeMonths();
    if (months === null) return '未设置';
    if (months < 1) return '新生儿（< 1个月）';
    if (months < 2) return '1个月';
    if (months < 3) return '2个月';
    if (months < 4) return '3个月';
    if (months < 5) return '4个月';
    if (months < 6) return '5个月';
    if (months < 7) return '6个月';
    if (months < 12) return `${Math.floor(months)}个月`;
    const years = Math.floor(months / 12);
    const remainMonths = Math.floor(months % 12);
    return remainMonths > 0 ? `${years}岁${remainMonths}个月` : `${years}岁`;
  },

  /**
   * 判断是否已经设置出生日期
   */
  hasBirthDate() {
    const profile = this.get();
    return !!profile.birthDate;
  }
};

/**
 * 同步管理 - 多设备数据共享
 */
const SYNC_CONFIG_KEY = 'baby_feeder_sync_config';

const SyncManager = {
  /**
   * 获取同步配置
   */
  getConfig() {
    try {
      const data = localStorage.getItem(SYNC_CONFIG_KEY);
      return data ? JSON.parse(data) : { serverUrl: '', groupId: '', autoSync: false, lastSync: null, lastSyncResult: '' };
    } catch (e) {
      return { serverUrl: '', groupId: '', autoSync: false, lastSync: null, lastSyncResult: '' };
    }
  },

  /**
   * 保存同步配置
   */
  saveConfig(config) {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  },

  /**
   * 更新同步设置
   */
  updateSettings(serverUrl, groupId, autoSync) {
    const config = this.getConfig();
    config.serverUrl = serverUrl.replace(/\/+$/, '');
    config.groupId = groupId;
    config.autoSync = autoSync;
    this.saveConfig(config);
  },

  /**
   * 上传数据到服务器
   */
  async upload() {
    const config = this.getConfig();
    if (!config.serverUrl || !config.groupId) {
      return { success: false, error: '请先配置服务器地址和群组码' };
    }

    const records = DataManager.getAll();
    if (records.length === 0) {
      return { success: false, error: '没有数据可同步' };
    }

    try {
      const resp = await fetch(`${config.serverUrl}/sync?group=${encodeURIComponent(config.groupId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, groupId: config.groupId })
      });
      const result = await resp.json();
      if (result.success) {
        config.lastSync = new Date().toISOString();
        config.lastSyncResult = `上传 ${records.length} 条`;
        this.saveConfig(config);
      }
      return result;
    } catch (e) {
      return { success: false, error: '连接服务器失败: ' + e.message };
    }
  },

  /**
   * 从服务器下载数据（获取远程记录并与本地合并）
   */
  async download() {
    const config = this.getConfig();
    if (!config.serverUrl || !config.groupId) {
      return { success: false, error: '请先配置服务器地址和群组码' };
    }

    try {
      const resp = await fetch(`${config.serverUrl}/sync?group=${encodeURIComponent(config.groupId)}`);
      const result = await resp.json();
      const serverData = result.records || result;

      if (!Array.isArray(serverData) || serverData.length === 0) {
        config.lastSync = new Date().toISOString();
        config.lastSyncResult = '无远程数据';
        this.saveConfig(config);
        return { success: true, count: 0, merged: 0 };
      }

      // 合并数据：本地和服务器按 ID 去重，优先保留最新的
      const localRecords = DataManager.getAll();
      const serverMap = new Map(serverData.map(r => [r.id, r]));
      const localWithoutServer = localRecords.filter(r => !serverMap.has(r.id));
      const allRecords = [...localWithoutServer, ...serverData];

      DataManager._save(allRecords);
      config.lastSync = new Date().toISOString();
      config.lastSyncResult = `下载 ${serverData.length} 条，合并后共 ${allRecords.length} 条`;
      this.saveConfig(config);

      return { success: true, count: serverData.length, merged: allRecords.length };
    } catch (e) {
      return { success: false, error: '连接服务器失败: ' + e.message };
    }
  },

  /**
   * 双向同步（先上传再下载）
   */
  async syncAll() {
    const config = this.getConfig();
    const uploadResult = await this.upload();
    if (!uploadResult.success) return uploadResult;
    const downloadResult = await this.download();
    return downloadResult;
  },

  /**
   * 测试与服务器的连接
   */
  async ping() {
    const config = this.getConfig();
    if (!config.serverUrl) {
      return { success: false, error: '请先配置服务器地址' };
    }
    try {
      const resp = await fetch(`${config.serverUrl}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      const result = await resp.json();
      return { success: true, message: result.message || '连接成功' };
    } catch (e) {
      return { success: false, error: '无法连接服务器: ' + e.message };
    }
  }
};
