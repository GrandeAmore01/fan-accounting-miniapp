const budgetService = require('../../services/budgetService');

const budgetTypes = [
  { id: 'month', name: '月度预算' },
  { id: 'year', name: '年度预算' }
];
const chartColorClasses = ['green', 'gold', 'orange', 'blue', 'purple', 'rose'];

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function getMainCategoryName(categoryName = '') {
  return categoryName.split(' / ')[0] || categoryName;
}

function buildProgressView(progress) {
  const budgetAmount = Number(progress.budget.amount || 0);
  const hasBudget = budgetAmount > 0;
  const percent = Number(progress.percent || 0);
  const safePercent = hasBudget ? Math.min(percent, 100) : 0;
  let statusLevel = 'unset';
  let statusText = '暂未设置预算，当前仅展示已计入预算的消费统计。';

  if (hasBudget && progress.isOverBudget) {
    statusLevel = 'danger';
    statusText = '已超过预算，请注意后续支出。';
  } else if (hasBudget && progress.isOverThreshold) {
    statusLevel = 'warn';
    statusText = '已达到提醒阈值，建议关注预算使用情况。';
  } else if (hasBudget) {
    statusLevel = 'ok';
    statusText = '当前预算状态正常。';
  }

  return {
    hasBudget,
    amountText: hasBudget ? `￥${formatMoney(budgetAmount)}` : '未设置',
    totalAmountText: `￥${formatMoney(progress.totalAmount)}`,
    remainingAmountText: hasBudget ? `￥${formatMoney(progress.remainingAmount)}` : '未设置',
    percentText: hasBudget ? `${percent}%` : '--',
    safePercent,
    thresholdText: `${progress.thresholdPercent}%`,
    statusLevel,
    statusText,
    fillClass: hasBudget ? `${statusLevel}-fill` : 'unset-fill'
  };
}

function buildAnalysis(progress, categoryStats) {
  const progressView = buildProgressView(progress);
  if (!categoryStats.length) {
    return {
      title: '本期暂无消费记录',
      desc: progressView.hasBudget
        ? '当前周期还没有计入预算的消费，可以继续保持。'
        : '先设置预算后，这里会同步展示预算使用率和消费建议。'
    };
  }

  const topCategory = categoryStats[0];
  if (!progressView.hasBudget) {
    return {
      title: `最高消费分类：${topCategory.categoryName}`,
      desc: `本期已记录 ${categoryStats.length} 个消费分类，最高分类占比 ${topCategory.percent}%，建议先设置预算再观察使用进度。`
    };
  }

  return {
    title: `最高消费分类：${topCategory.categoryName}`,
    desc: `本期预算已使用 ${progress.percent}%，${topCategory.categoryName} 占比 ${topCategory.percent}%，剩余预算 ${progressView.remainingAmountText}。`
  };
}

function appendComparisonText(analysis, comparison, selectedType) {
  if (!comparison) {
    return analysis;
  }
  const label = selectedType === 'year' ? '上一年' : '上月';
  let changeText = '持平';
  if (comparison.trend === 'up') {
    changeText = `比${label}多 ￥${formatMoney(Math.abs(comparison.diffAmount))}`;
  } else if (comparison.trend === 'down') {
    changeText = `比${label}少 ￥${formatMoney(Math.abs(comparison.diffAmount))}`;
  }
  return {
    ...analysis,
    desc: `${analysis.desc}${label}消费 ￥${formatMoney(comparison.previousAmount)}，本期${changeText}。`
  };
}

function buildCategoryBudgetViews(categoryBudgetStats) {
  return categoryBudgetStats.map((item) => {
    const safePercent = item.isUnset ? 0 : Math.min(item.percent, 100);
    const statusLevel = item.isUnset ? 'unset' : item.isOverBudget ? 'danger' : item.percent >= 80 ? 'warn' : 'ok';
    return {
      ...item,
      budgetAmountText: item.isUnset ? '未设置' : `￥${formatMoney(item.budgetAmount)}`,
      usedAmountText: `￥${formatMoney(item.usedAmount)}`,
      remainingAmountText: item.isUnset ? '未设置' : `￥${formatMoney(item.remainingAmount)}`,
      percentText: item.isUnset ? '--' : `${item.percent}%`,
      safePercent,
      statusLevel,
      fillClass: `${statusLevel}-fill`
    };
  });
}

function buildWarningViews(warnings) {
  return warnings.map((item) => ({
    ...item,
    className: item.level === 'danger' ? 'danger-warning' : 'warn-warning'
  }));
}

function buildHistoryViews(history) {
  return history.map((item) => ({
    ...item,
    budgetAmountText: item.hasBudget ? `￥${formatMoney(item.budgetAmount)}` : '未设置',
    actualAmountText: `￥${formatMoney(item.actualAmount)}`,
    remainingAmountText: item.hasBudget ? `￥${formatMoney(item.remainingAmount)}` : '未设置',
    percentText: item.hasBudget ? `${item.percent}%` : '--',
    safePercent: item.hasBudget ? Math.min(item.percent, 100) : 0,
    fillClass: item.isOverBudget ? 'danger-fill' : item.percent >= 80 ? 'warn-fill' : item.hasBudget ? 'ok-fill' : 'unset-fill'
  }));
}

function buildInsightView(insight) {
  if (!insight) {
    return {
      score: 60,
      level: '需关注',
      mainReason: '暂无预算分析数据。',
      suggestion: '记录更多消费后会生成预算建议。',
      overspendReason: '暂无风险原因。',
      scoreClass: 'attention-health',
      riskCategories: [],
      unsetCategoryHints: []
    };
  }
  const scoreClass =
    insight.score >= 90
      ? 'excellent-health'
      : insight.score >= 80
        ? 'good-health'
        : insight.score >= 60
          ? 'attention-health'
          : 'risk-health';
  return {
    ...insight,
    scoreText: `${insight.score}分`,
    scoreClass,
    riskCategories: (insight.riskCategories || []).map((item) => ({
      ...item,
      usedAmountText: `￥${formatMoney(item.usedAmount)}`,
      budgetAmountText: `￥${formatMoney(item.budgetAmount)}`,
      safePercent: Math.min(item.percent, 100),
      fillClass: item.isOverBudget ? 'danger-fill' : item.percent >= 80 ? 'warn-fill' : 'ok-fill'
    })),
    unsetCategoryHints: (insight.unsetCategoryHints || []).map((item) => ({
      ...item,
      usedAmountText: `￥${formatMoney(item.usedAmount)}`
    }))
  };
}

Page({
  data: {
    budgetTypes,
    budgetTypeIndex: 0,
    selectedType: 'month',
    selectedPeriod: '',
    formVisible: false,
    savingBudget: false,
    formData: {
      amount: '',
      thresholdPercent: 80,
      period: '',
      categoryBudgets: {}
    },
    progress: {
      budget: {
        amount: 0,
        threshold: 0.8,
        period: ''
      },
      totalAmount: 0,
      remainingAmount: 0,
      percent: 0,
      thresholdPercent: 80,
      isOverThreshold: false,
      isOverBudget: false
    },
    progressView: buildProgressView({
      budget: {
        amount: 0,
        threshold: 0.8,
        period: ''
      },
      totalAmount: 0,
      remainingAmount: 0,
      percent: 0,
      thresholdPercent: 80,
      isOverThreshold: false,
      isOverBudget: false
    }),
    analysis: {
      title: '本期暂无消费记录',
      desc: '先设置预算后，这里会同步展示预算使用率和消费建议。'
    },
    warnings: [],
    insight: buildInsightView(null),
    categoryStats: [],
    categoryBudgetStats: [],
    categoryBudgetFormItems: [],
    budgetHistory: [],
    monthTrend: []
  },

  onLoad() {
    this.setData({
      selectedPeriod: budgetService.getCurrentMonth()
    });
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    let dashboard;
    try {
      dashboard = await budgetService.getBudgetDashboardAsync(this.data.selectedType, this.data.selectedPeriod);
    } catch (error) {
      wx.showToast({
        title: error.message || '预算统计加载失败',
        icon: 'none'
      });
      return;
    }
    const categoryStats = dashboard.categoryStats.map((item, index) => ({
      ...item,
      categoryName: getMainCategoryName(item.categoryName),
      amountText: `￥${formatMoney(item.amount)}`,
      shareWidth: item.percent,
      colorClass: chartColorClasses[index % chartColorClasses.length],
      isTop: index === 0
    }));
    const monthTrend = dashboard.monthTrend.map((item) => ({
      ...item,
      shortMonth: item.month.replace('-', '/').slice(2),
      barPercent: item.amount > 0 ? Math.max(10, Math.min(72, Math.round((item.percent || 0) * 0.72))) : 0,
      amountText: `￥${formatMoney(item.amount)}`
    }));
    this.setData({
      progress: dashboard.progress,
      progressView: buildProgressView(dashboard.progress),
      analysis: appendComparisonText(
        buildAnalysis(dashboard.progress, categoryStats),
        dashboard.comparison,
        this.data.selectedType
      ),
      warnings: buildWarningViews(dashboard.warnings || []),
      insight: buildInsightView(dashboard.insight),
      categoryStats,
      categoryBudgetStats: buildCategoryBudgetViews(dashboard.categoryBudgetStats || []),
      budgetHistory: buildHistoryViews(dashboard.budgetHistory || []),
      monthTrend
    });
  },

  handleBudgetTypeChange(event) {
    const budgetTypeIndex = Number(event.detail.value);
    const selectedType = this.data.budgetTypes[budgetTypeIndex].id;
    this.setData({
      budgetTypeIndex,
      selectedType,
      selectedPeriod: budgetService.getDefaultPeriod(selectedType)
    }, () => {
      this.refreshPage();
    });
  },

  handleMonthChange(event) {
    this.setData({
      selectedPeriod: event.detail.value
    }, () => {
      this.refreshPage();
    });
  },

  handleYearInput(event) {
    const value = event.detail.value.slice(0, 4);
    if (value.length === 4) {
      this.setData({
        selectedPeriod: value
      }, () => {
        this.refreshPage();
      });
      return;
    }
    this.setData({
      selectedPeriod: value
    });
  },

  handleRefreshBudget() {
    this.refreshPage();
    wx.showToast({
      title: '已刷新预算统计',
      icon: 'none'
    });
  },

  handleOpenBudgetForm() {
    const budget = this.data.progress.budget;
    const categoryBudgets = budget.categoryBudgets || {};
    this.setData({
      formVisible: true,
      formData: {
        amount: budget.amount ? String(budget.amount) : '',
        thresholdPercent: typeof budget.threshold === 'number' ? Math.round(budget.threshold * 100) : 80,
        period: this.data.selectedPeriod,
        categoryBudgets: {
          ...categoryBudgets
        }
      },
      categoryBudgetFormItems: this.data.categoryBudgetStats.map((item) => ({
        ...item,
        inputValue: categoryBudgets[item.category] ? String(categoryBudgets[item.category]) : ''
      }))
    });
  },

  handleCloseBudgetForm() {
    this.setData({
      formVisible: false
    });
  },

  handleFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: event.detail.value
    });
  },

  handleFormMonthChange(event) {
    this.setData({
      'formData.period': event.detail.value
    });
  },

  handleCategoryBudgetInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({
      [`categoryBudgetFormItems[${index}].inputValue`]: event.detail.value
    });
  },

  handleSaveBudget() {
    if (this.data.savingBudget) {
      return;
    }

    const amount = Number(this.data.formData.amount);
    const thresholdPercent = this.data.formData.thresholdPercent === '' ? 80 : Number(this.data.formData.thresholdPercent);
    const period = (this.data.formData.period || this.data.selectedPeriod || '').trim();
    const categoryBudgets = (this.data.categoryBudgetFormItems || []).reduce((result, item) => {
      result[item.category] = Number(item.inputValue || 0);
      return result;
    }, {});

    if (!period || (this.data.selectedType === 'year' && period.length !== 4)) {
      wx.showToast({
        title: '请填写正确的预算周期',
        icon: 'none'
      });
      return;
    }

    if (!amount || amount <= 0) {
      wx.showToast({
        title: '请输入大于 0 的预算金额',
        icon: 'none'
      });
      return;
    }

    if (!thresholdPercent || thresholdPercent < 1 || thresholdPercent > 100) {
      wx.showToast({
        title: '提醒阈值需在 1% 到 100% 之间',
        icon: 'none'
      });
      return;
    }
    const categoryBudgetTotal = Object.keys(categoryBudgets).reduce(
      (sum, key) => sum + Number(categoryBudgets[key] || 0),
      0
    );
    if (categoryBudgetTotal > amount) {
      wx.showToast({
        title: '分类预算总额不能超过总预算',
        icon: 'none'
      });
      return;
    }

    this.setData({
      savingBudget: true
    });
    wx.showLoading({
      title: '保存中'
    });

    try {
      const result = budgetService.saveBudget({
        budgetType: this.data.selectedType,
        period,
        amount,
        threshold: thresholdPercent / 100,
        categoryBudgets
      });

      if (!result.valid) {
        wx.hideLoading();
        this.setData({
          savingBudget: false
        });
        wx.showToast({
          title: result.message,
          icon: 'none'
        });
        return;
      }

      wx.hideLoading();
      wx.showToast({
        title: '已保存预算',
        icon: 'success'
      });
      this.setData({
        formVisible: false,
        savingBudget: false,
        selectedPeriod: result.data.period
      }, () => {
        this.refreshPage();
      });
    } catch (error) {
      wx.hideLoading();
      this.setData({
        savingBudget: false
      });
      wx.showToast({
        title: error.message || '保存失败，请检查输入',
        icon: 'none'
      });
    }
  },

  noop() {}
});
