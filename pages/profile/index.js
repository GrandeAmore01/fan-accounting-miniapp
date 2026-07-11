const storageService = require('../../services/storageService');
const expenseService = require('../../services/expenseService');
const budgetService = require('../../services/budgetService');
const collectionService = require('../../services/collectionService');
const stageService = require('../../services/stageService');

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatSyncTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

Page({
  data: {
    profile: { nickname: '微信用户', loginStatus: false },
    loading: true,
    overview: {
      expenseCount: 0,
      totalAmountText: '0.00',
      collectionCount: 0,
      stageCount: 0
    },
    budget: {
      hasBudget: false,
      amountText: '0.00',
      usedAmountText: '0.00',
      remainingAmountText: '0.00',
      percent: 0,
      progressWidth: 0,
      statusText: '本月暂未设置预算'
    },
    sync: {
      state: 'syncing',
      label: '同步中',
      message: '正在读取你的云端数据',
      lastTime: ''
    }
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    const localSummary = storageService.getLocalDataSummary();
    this.setData({
      loading: true,
      profile: localSummary.profile,
      sync: {
        ...this.data.sync,
        state: 'syncing',
        label: '同步中',
        message: '正在读取你的云端数据'
      }
    });

    try {
      const [dashboard, collections] = await Promise.all([
        budgetService.getBudgetDashboardAsync('month', budgetService.getCurrentMonth()),
        collectionService.listCollections(),
        stageService.ensureStagesLoaded()
      ]);
      const expenseSummary = expenseService.getExpenseSummary();
      const stageStats = stageService.getStageStats();
      const progress = dashboard.progress;
      const hasBudget = Number(progress.budget.amount || 0) > 0;
      const percent = hasBudget ? Math.max(Number(progress.percent || 0), 0) : 0;

      this.setData({
        loading: false,
        profile: storageService.getLocalDataSummary().profile,
        overview: {
          expenseCount: Number(expenseSummary.count || 0),
          totalAmountText: formatMoney(expenseSummary.totalAmount),
          collectionCount: (collections || []).filter((item) => item.isOwned).length,
          stageCount: Number(stageStats.lightedCount || 0)
        },
        budget: {
          hasBudget,
          amountText: formatMoney(progress.budget.amount),
          usedAmountText: formatMoney(progress.totalAmount),
          remainingAmountText: formatMoney(progress.remainingAmount),
          percent,
          progressWidth: Math.min(percent, 100),
          statusText: hasBudget
            ? (progress.isOverBudget ? '本月预算已超支' : `本月预算已使用 ${percent}%`)
            : '本月暂未设置预算'
        },
        sync: {
          state: 'synced',
          label: '已同步',
          message: '消费、预算、藏品和舞台记录均已同步',
          lastTime: formatSyncTime()
        }
      });
    } catch (error) {
      console.warn('个人数据同步失败，显示最近缓存', error);
      const cached = storageService.getLocalDataSummary();
      const cachedExpenses = storageService.getCollection(null, 'expenses');
      this.setData({
        loading: false,
        profile: cached.profile,
        overview: {
          expenseCount: cached.counts.expenses,
          totalAmountText: formatMoney(
            cachedExpenses.reduce((sum, item) => sum + Number(item.includedAmount || 0), 0)
          ),
          collectionCount: cached.counts.lightedCollections,
          stageCount: cached.counts.lightedStages
        },
        sync: {
          state: 'offline',
          label: '暂时离线',
          message: '当前显示最近一次缓存，可点击重新同步',
          lastTime: this.data.sync.lastTime
        }
      });
    }
  },

  handleNavigate(event) {
    const url = event.currentTarget.dataset.url;
    if (url) wx.switchTab({ url });
  },

  handleSyncTap() {
    if (this.data.sync.state === 'syncing') return;
    this.refreshPage();
  },

  handlePrivacyTap() {
    wx.showModal({
      title: '数据与隐私',
      content: '你的消费、预算、藏品和舞台记录仅与当前微信账号关联，不会公开展示，也不会用于粉丝消费排名。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#b48a00'
    });
  },

  handleClearLocalData() {
    wx.showModal({
      title: '清理本机缓存',
      content: '只清理当前微信用户在本机的缓存，不会删除任何云端数据。清理后会重新从云端加载。',
      confirmText: '清理缓存',
      confirmColor: '#b48a00',
      success: (res) => {
        if (!res.confirm) return;
        storageService.resetUserData();
        wx.showToast({ title: '缓存已清理', icon: 'success' });
        this.refreshPage();
      }
    });
  }
});
