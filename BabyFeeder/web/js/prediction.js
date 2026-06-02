/**
 * 预测引擎 - 基于历史喂养数据和婴儿月龄预测下一次喂养
 *
 * 按月龄的喂养参考标准（WHO/中国儿科指南）：
 * - 新生儿（0-1月）：每 2-3 小时，30-90ml/次
 * - 1-2 个月：每 3-4 小时，60-120ml/次
 * - 2-4 个月：每 3-4 小时，90-150ml/次
 * - 4-6 个月：每 4-5 小时，120-180ml/次
 * - 6-12 个月：每 4-6 小时，150-240ml/次（已添加辅食）
 * - 12+ 个月：每 4-6 小时，180-300ml/次
 */

const Predictor = {
  /**
   * 根据婴儿月龄获取喂养参考范围
   */
  getAgeGuidelines() {
    const months = BabyProfile.getAgeMonths();
    if (months === null) return null;

    let guideline;
    if (months < 1) {
      guideline = { minInterval: 120, maxInterval: 180, minAmount: 30, maxAmount: 90, label: '新生儿期' };
    } else if (months < 2) {
      guideline = { minInterval: 150, maxInterval: 240, minAmount: 60, maxAmount: 120, label: '1个月' };
    } else if (months < 4) {
      guideline = { minInterval: 150, maxInterval: 240, minAmount: 90, maxAmount: 150, label: '2-3个月' };
    } else if (months < 6) {
      guideline = { minInterval: 180, maxInterval: 300, minAmount: 120, maxAmount: 180, label: '4-5个月' };
    } else if (months < 12) {
      guideline = { minInterval: 240, maxInterval: 360, minAmount: 150, maxAmount: 240, label: '6-11个月' };
    } else {
      guideline = { minInterval: 240, maxInterval: 360, minAmount: 180, maxAmount: 300, label: '1岁以上' };
    }

    return guideline;
  },

  /**
   * 预测下一次喂养
   * @param {number} lookbackDays - 回溯天数
   * @returns {{ nextTime: string, nextAmount: number, confidence: number, insight: string, guideline: object }}
   */
  predict(lookbackDays = 7) {
    const records = DataManager.getAll();
    if (records.length < 3) {
      return {
        nextTime: null,
        nextAmount: null,
        confidence: 0,
        avgInterval: null,
        avgAmount: null,
        insight: '数据不足，需要至少 3 条记录才能预测',
        guideline: this.getAgeGuidelines()
      };
    }

    // 按时间排序
    const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 过滤指定天数内的记录
    const cutoff = Date.now() - lookbackDays * 86400000;
    const recent = sorted.filter(r => new Date(r.timestamp).getTime() > cutoff);
    const workingSet = recent.length >= 3 ? recent : sorted;

    // --- 获取月龄参考标准 ---
    const guideline = this.getAgeGuidelines();

    // --- 预测时间间隔 ---
    const intervals = [];
    for (let i = 1; i < workingSet.length; i++) {
      const diff = new Date(workingSet[i].timestamp) - new Date(workingSet[i - 1].timestamp);
      const maxInterval = guideline ? guideline.maxInterval * 60000 : 8 * 3600000;
      const minInterval = guideline ? guideline.minInterval * 60000 : 1.5 * 3600000;
      if (diff > 0 && diff < maxInterval * 1.5 && diff > minInterval * 0.5) {
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
        const weight = (i + 1) / intervals.length;
        weightedSum += intervals[i] * weight;
        totalWeight += weight;
      }
      predictedInterval = weightedSum / totalWeight;

      // 如果月龄参考可用，将预测值向参考范围拉近
      if (guideline) {
        const refInterval = (guideline.minInterval + guideline.maxInterval) / 2 * 60000;
        const weightRef = Math.min(0.3, intervals.length * 0.05); // 数据越多越信任实际数据
        predictedInterval = predictedInterval * (1 - weightRef) + refInterval * weightRef;
      }

      // 置信度：标准差越小置信度越高
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      timeConfidence = Math.max(0, Math.min(1, 1 - stdDev / (mean * 0.5)));
    } else if (intervals.length === 1) {
      // 只有一条间隔时也尝试预测，但置信度较低
      predictedInterval = intervals[0];
      timeConfidence = 0.2;
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

      // 如果月龄参考可用，将预测奶量向参考范围拉近
      if (guideline && predictedAmount !== null) {
        const refAmount = (guideline.minAmount + guideline.maxAmount) / 2;
        const weightRef = Math.min(0.25, formulaRecords.length * 0.04);
        predictedAmount = Math.round(predictedAmount * (1 - weightRef) + refAmount * weightRef);
      }

      const mean = formulaRecords.reduce((a, b) => a + b.amount, 0) / formulaRecords.length;
      const variance = formulaRecords.reduce((sum, val) => sum + (val.amount - mean) ** 2, 0) / formulaRecords.length;
      const stdDev = Math.sqrt(variance);
      amountConfidence = Math.max(0, Math.min(1, 1 - stdDev / (mean * 0.4)));
    } else if (formulaRecords.length === 1) {
      predictedAmount = formulaRecords[0].amount;
      amountConfidence = 0.15;
    }

    // 如果没有任何记录但有月龄参考，给出默认推荐值
    if (predictedAmount === null && guideline && BabyProfile.hasBirthDate()) {
      predictedAmount = Math.round((guideline.minAmount + guideline.maxAmount) / 2);
      amountConfidence = 0.1;
    }

    // 计算下一次时间
    let nextTime = null;
    if (predictedInterval !== null) {
      const lastFeed = new Date(workingSet[workingSet.length - 1].timestamp);
      nextTime = new Date(lastFeed.getTime() + predictedInterval).toISOString();
    }

    const overallConfidence = Math.round((timeConfidence + amountConfidence) / 2 * 100);

    // 生成洞察
    const insight = this._generateInsight(workingSet, intervals, predictedInterval, predictedAmount, guideline);

    return {
      nextTime,
      nextAmount: predictedAmount,
      confidence: overallConfidence,
      avgInterval: predictedInterval ? Math.round(predictedInterval / 60000) : null,
      avgAmount: predictedAmount,
      insight,
      guideline
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

  /**
   * 根据月龄获取推荐每日总奶量（ml）
   */
  getRecommendedDailyAmount() {
    const months = BabyProfile.getAgeMonths();
    if (months === null) return null;

    // 基于体重的粗略估算：150ml/kg/天，但不同月龄有不同标准
    if (months < 1) return { min: 400, max: 600, label: '新生儿每日推荐 400-600ml' };
    if (months < 2) return { min: 500, max: 800, label: '1个月每日推荐 500-800ml' };
    if (months < 4) return { min: 600, max: 1000, label: '2-3个月每日推荐 600-1000ml' };
    if (months < 6) return { min: 700, max: 1100, label: '4-5个月每日推荐 700-1100ml' };
    if (months < 12) return { min: 800, max: 1200, label: '6-11个月每日推荐 800-1200ml（加辅食）' };
    return { min: 800, max: 1200, label: '1岁以上每日推荐 800-1200ml（加辅食）' };
  },

  _generateInsight(records, intervals, avgInterval, avgAmount, guideline) {
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

    // 添加月龄参考建议
    if (guideline) {
      parts.push(`【${guideline.label}参考】间隔 ${guideline.minInterval}-${guideline.maxInterval} 分钟，奶量 ${guideline.minAmount}-${guideline.maxAmount}ml`);
    }

    // 判断趋势
    const mid = Math.floor(records.length / 2);
    const firstHalf = records.slice(0, mid);
    const secondHalf = records.slice(mid);
    const firstAvg = firstHalf.reduce((s, r) => s + (r.amount || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + (r.amount || 0), 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.1) {
      parts.push('奶量呈上升趋势 ??');
    } else if (secondAvg < firstAvg * 0.9) {
      parts.push('奶量呈下降趋势 ??');
    }

    // 对比月龄推荐
    const todayTotal = DataManager.getToday().reduce((s, r) => s + (r.amount || 0), 0);
    if (guideline && todayTotal > 0) {
      const refDaily = this.getRecommendedDailyAmount();
      if (refDaily && todayCount >= 3) {
        if (todayTotal < refDaily.min) {
          parts.push(`今日总奶量(${todayTotal}ml)偏低，建议增加喂养`);
        } else if (todayTotal > refDaily.max) {
          parts.push(`今日总奶量(${todayTotal}ml)偏高，注意观察宝宝反应`);
        }
      }
    }

    return parts.join(' · ');
  }
};
