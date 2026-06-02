/**
 * 预测引擎 - 基于历史喂养数据预测下一次喂养时间和奶量
 */

const Predictor = {
  /**
   * 预测下一次喂养
   * @param {number} lookbackDays - 回溯天数
   * @returns {{ nextTime: string, nextAmount: number, confidence: number, insight: string }}
   */
  predict(lookbackDays = 7) {
    const records = DataManager.getAll();
    if (records.length < 3) {
      return {
        nextTime: null,
        nextAmount: null,
        confidence: 0,
        insight: '数据不足，需要至少 3 条记录才能预测'
      };
    }

    // 按时间排序
    const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 过滤指定天数内的记录
    const cutoff = Date.now() - lookbackDays * 86400000;
    const recent = sorted.filter(r => new Date(r.timestamp).getTime() > cutoff);
    const workingSet = recent.length >= 3 ? recent : sorted;

    // --- 预测时间间隔 ---
    const intervals = [];
    for (let i = 1; i < workingSet.length; i++) {
      const diff = new Date(workingSet[i].timestamp) - new Date(workingSet[i - 1].timestamp);
      if (diff > 0 && diff < 8 * 3600000) { // 排除异常值：> 8小时
        intervals.push(diff);
      }
    }

    let predictedInterval = null;
    let timeConfidence = 0;

    if (intervals.length >= 2) {
      // 加权平均：最近的时间间隔权重更高
      let totalWeight = 0;
      let weightedSum = 0;
      for (let i = 0; i < intervals.length; i++) {
        const weight = (i + 1) / intervals.length; // 越近权重越高
        weightedSum += intervals[i] * weight;
        totalWeight += weight;
      }
      predictedInterval = weightedSum / totalWeight;

      // 置信度：标准差越小置信度越高
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      timeConfidence = Math.max(0, Math.min(1, 1 - stdDev / (mean * 0.5)));
    }

    // --- 预测奶量 ---
    const formulaRecords = workingSet.filter(r => r.amount > 0);
    let predictedAmount = null;
    let amountConfidence = 0;

    if (formulaRecords.length >= 2) {
      // 加权平均奶量
      let totalWeight = 0;
      let weightedSum = 0;
      for (let i = 0; i < formulaRecords.length; i++) {
        const weight = (i + 1) / formulaRecords.length;
        weightedSum += formulaRecords[i].amount * weight;
        totalWeight += weight;
      }
      predictedAmount = Math.round(weightedSum / totalWeight);

      const mean = formulaRecords.reduce((a, b) => a + b.amount, 0) / formulaRecords.length;
      const variance = formulaRecords.reduce((sum, val) => sum + (val.amount - mean) ** 2, 0) / formulaRecords.length;
      const stdDev = Math.sqrt(variance);
      amountConfidence = Math.max(0, Math.min(1, 1 - stdDev / (mean * 0.4)));
    }

    // 计算下一次时间
    let nextTime = null;
    if (predictedInterval !== null) {
      const lastFeed = new Date(workingSet[workingSet.length - 1].timestamp);
      nextTime = new Date(lastFeed.getTime() + predictedInterval).toISOString();
    }

    const overallConfidence = Math.round((timeConfidence + amountConfidence) / 2 * 100);

    // 生成洞察
    const insight = this._generateInsight(workingSet, intervals, predictedInterval, predictedAmount);

    return {
      nextTime,
      nextAmount: predictedAmount,
      confidence: overallConfidence,
      avgInterval: predictedInterval ? Math.round(predictedInterval / 60000) : null,
      avgAmount: predictedAmount,
      insight
    };
  },

  /**
   * 获取今日统计
   */
  getTodayStats() {
    const today = DataManager.getToday();
    const sorted = [...today].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (sorted.length === 0) {
      return { count: 0, totalAmount: 0, avgAmount: 0, avgInterval: null, firstTime: null, lastTime: null };
    }

    const totalAmount = sorted.reduce((sum, r) => sum + (r.amount || 0), 0);
    const avgAmount = Math.round(totalAmount / sorted.length);

    let intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(new Date(sorted[i].timestamp) - new Date(sorted[i - 1].timestamp));
    }
    const avgInterval = intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length / 60000)
      : null;

    return {
      count: sorted.length,
      totalAmount,
      avgAmount,
      avgInterval,
      firstTime: sorted[0].timestamp,
      lastTime: sorted[sorted.length - 1].timestamp
    };
  },

  /**
   * 获取过去 N 天的每日统计
   */
  getDailyStats(days = 7) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start.getTime() + 86400000);
      const records = DataManager.getByDateRange(start.toISOString(), end.toISOString());
      const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
      const count = records.length;
      result.push({
        date: start.toISOString().slice(0, 10),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        count,
        totalAmount,
        avgAmount: count > 0 ? Math.round(totalAmount / count) : 0
      });
    }
    return result;
  },

  _generateInsight(records, intervals, avgInterval, avgAmount) {
    if (records.length < 3) return '数据不足，继续记录以获取更准的预测';

    const parts = [];
    const now = new Date();
    const todayCount = DataManager.getToday().length;

    if (todayCount > 0) {
      parts.push(`今日已喂 ${todayCount} 次`);
    }

    if (avgInterval !== null) {
      const mins = Math.round(avgInterval / 60000);
      parts.push(`平均间隔约 ${mins} 分钟`);
    }

    if (avgAmount) {
      parts.push(`平均奶量 ${avgAmount}ml`);
    }

    // 判断趋势
    const mid = Math.floor(records.length / 2);
    const firstHalf = records.slice(0, mid);
    const secondHalf = records.slice(mid);
    const firstAvg = firstHalf.reduce((s, r) => s + (r.amount || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + (r.amount || 0), 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.1) {
      parts.push('奶量呈上升趋势 📈');
    } else if (secondAvg < firstAvg * 0.9) {
      parts.push('奶量呈下降趋势 📉');
    }

    return parts.join(' · ');
  }
};
