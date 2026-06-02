/**
 * 图表模块 - 使用 Chart.js 可视化喂养数据
 */

const ChartModule = {
  chartInstances: {},

  /**
   * 渲染奶量趋势图
   */
  renderAmountTrend(canvasId, dailyStats) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    this._destroy(canvasId);

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyStats.map(d => d.label),
        datasets: [{
          label: '每日总奶量 (ml)',
          data: dailyStats.map(d => d.totalAmount),
          borderColor: '#4FACFE',
          backgroundColor: 'rgba(79, 172, 254, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4FACFE',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  /**
   * 渲染喂养次数趋势图
   */
  renderCountTrend(canvasId, dailyStats) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    this._destroy(canvasId);

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dailyStats.map(d => d.label),
        datasets: [{
          label: '喂养次数',
          data: dailyStats.map(d => d.count),
          backgroundColor: 'rgba(79, 172, 254, 0.6)',
          borderColor: '#4FACFE',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  /**
   * 渲染时间段分布热力图（按小时）
   */
  renderHourlyDist(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    this._destroy(canvasId);

    const records = DataManager.getAll();
    const hourly = new Array(24).fill(0);
    records.forEach(r => {
      const hour = new Date(r.timestamp).getHours();
      hourly[hour]++;
    });

    const labels = Array.from({ length: 24 }, (_, i) => `${i}时`);

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '喂养次数',
          data: hourly,
          backgroundColor: hourly.map(v => {
            const intensity = Math.min(v / Math.max(...hourly, 1), 1);
            return `rgba(79, 172, 254, ${0.2 + intensity * 0.6})`;
          }),
          borderRadius: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  _destroy(id) {
    if (this.chartInstances[id]) {
      this.chartInstances[id].destroy();
      delete this.chartInstances[id];
    }
  }
};
