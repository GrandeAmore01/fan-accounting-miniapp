const expenseService = require('../../services/expenseService');
const stageService = require('../../services/stageService');

function inferMeetStageType(stage) {
  const name = `${stage.stageName || ''}${stage.name || ''}`;
  if (name.indexOf('新年音乐会') >= 0) {
    return 'new_year_concert';
  }
  if (name.indexOf('运动会') >= 0) {
    return 'sports_day';
  }
  return stage.stageType || 'concert';
}

function isMeetStageType(subType) {
  return ['concert', 'new_year_concert', 'sports_day'].includes(subType);
}

function getMeetStageLabel(subType) {
  const match = expenseService.getSubType('meet', subType);
  return match ? match.name : '见面';
}

function getPositivePriceTiers(stage) {
  return (stage.priceTiers || [])
    .map((price) => Number(price))
    .filter((price) => Number.isFinite(price) && price > 0);
}

function buildHighlightedSegments(text, keyword) {
  const source = String(text || '');
  const target = String(keyword || '').trim();
  if (!source || !target) {
    return [{ text: source, matched: false }];
  }
  const lowerSource = source.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const segments = [];
  let cursor = 0;
  let index = lowerSource.indexOf(lowerTarget);
  while (index >= 0) {
    if (index > cursor) {
      segments.push({ text: source.slice(cursor, index), matched: false });
    }
    segments.push({ text: source.slice(index, index + target.length), matched: true });
    cursor = index + target.length;
    index = lowerSource.indexOf(lowerTarget, cursor);
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), matched: false });
  }
  return segments.length ? segments : [{ text: source, matched: false }];
}

function createDefaultFormData() {
  return {
    expenseId: '',
    category: 'meet',
    subType: 'concert',
    itemName: '',
    amount: '',
    quantity: 1,
    date: '',
    paymentMethod: '微信支付',
    seat: '',
    location: '',
    city: '',
    remark: '由舞台记录同步生成',
    fees: {
      premium: '',
      travel: '',
      hotel: '',
      rental: '',
      other: '',
      shipping: ''
    },
    outfieldOnly: false,
    includeInTotal: true,
    collectionId: '',
    stageId: '',
    stageDate: '',
    priceTier: '',
    purchaseChannel: 'official',
    pricingMode: 'official_unit',
    referencePrice: '',
    unitPrice: '',
    expenseSource: 'manual'
  };
}

function getTodayText() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    stageId: {
      type: String,
      value: ''
    },
    formTitle: {
      type: String,
      value: '新增消费记录'
    }
  },

  data: {
    submitting: false,
    categories: expenseService.expenseCategories,
    categoryIndex: 0,
    subTypes: expenseService.expenseCategories[0].subTypes || [],
    subTypeIndex: 0,
    paymentMethods: ['微信支付', '支付宝', '银行卡', '现金', '其他'],
    purchaseChannels: [
      { id: 'official', name: '官方渠道' },
      { id: 'other', name: '其他渠道' }
    ],
    paymentMethodIndex: 0,
    purchaseChannelIndex: 0,
    meetStages: [],
    concertStages: [],
    priceTiers: [],
    priceTierLabels: [],
    priceTierIndex: 0,
    matchedMeetStageName: '',
    searchKeyword: '',
    searchResults: [],
    stageDateOptions: [],
    stageDateLabels: [],
    stageDateIndex: 0,
    formData: createDefaultFormData()
  },

  observers: {
    'visible, stageId'(visible, stageId) {
      if (visible && stageId) {
        this.openWithStage(stageId);
      }
    }
  },

  methods: {
    noop() {},

    async openWithStage(stageId) {
      const meetStages = await expenseService.listMeetStagesAsync();
      let stage = (meetStages || []).find((item) => item.stageId === stageId);
      if (!stage) {
        await stageService.ensureStagesLoaded();
        const cached = stageService.getStageById(stageId);
        if (cached) {
          stage = {
            stageId: cached.stageId,
            stageName: cached.stageName,
            stageType: inferMeetStageType(cached),
            date: cached.date,
            city: cached.cityName || cached.city || '',
            venue: cached.venueName || cached.venue || '',
            location: cached.venueName || cached.location || '',
            priceTiers: cached.priceTiers || []
          };
        }
      }
      if (!stage) {
        wx.showToast({ title: '未找到对应场次', icon: 'none' });
        this.handleClose();
        return;
      }
      const formData = {
        ...createDefaultFormData(),
        date: getTodayText(),
        purchaseChannel: 'official',
        pricingMode: 'official_unit'
      };
      this.setData({
        meetStages,
        formData,
        categoryIndex: 0,
        paymentMethodIndex: 0,
        purchaseChannelIndex: 0,
        searchResults: [],
        stageDateOptions: [],
        stageDateLabels: [],
        stageDateIndex: 0
      });
      this.applySelectedMeetStage(stage);
    },

    applySelectedMeetStage(stage, extraState = {}) {
      const priceTiers = getPositivePriceTiers(stage);
      const priceTierLabels = priceTiers.map((price) => `${price} 元`);
      const shouldUseOfficialTier = this.data.formData.purchaseChannel === 'official';
      const stageType = inferMeetStageType(stage);
      const category = this.data.categories[this.data.categoryIndex] || this.data.categories[0];
      const subTypes = category.subTypes || [];
      const subTypeIndex = Math.max(subTypes.findIndex((item) => item.id === stageType), 0);
      const concertStages = (this.data.meetStages || []).filter(
        (item) => inferMeetStageType(item) === stageType
      );
      this.setData({
        ...extraState,
        subTypes,
        subTypeIndex,
        concertStages,
        priceTiers,
        priceTierLabels,
        priceTierIndex: 0,
        matchedMeetStageName: stage.stageName,
        searchKeyword: stage.stageName,
        formData: {
          ...this.data.formData,
          subType: stageType,
          stageId: stage.stageId,
          stageDate: stage.date,
          itemName: stage.stageName,
          city: stage.city || '',
          location: stage.venue || stage.location || '',
          amount: shouldUseOfficialTier && priceTiers.length ? String(priceTiers[0]) : '',
          priceTier: priceTiers.length ? String(priceTiers[0]) : '',
          pricingMode: shouldUseOfficialTier && priceTiers.length ? 'official_unit' : 'total',
          paymentMethod: this.data.paymentMethods[this.data.paymentMethodIndex]
        }
      });
    },

    handleClose() {
      this.triggerEvent('close');
    },

    handleCategoryChange(event) {
      const categoryIndex = Number(event.detail.value);
      const category = this.data.categories[categoryIndex];
      if (category.id !== 'meet') {
        wx.showToast({ title: '舞台联动仅支持见面消费', icon: 'none' });
        return;
      }
      const firstSubType = (category.subTypes || [])[0] || {};
      this.setData({
        categoryIndex,
        subTypes: category.subTypes || [],
        subTypeIndex: 0,
        'formData.category': category.id,
        'formData.subType': firstSubType.id || 'concert'
      });
    },

    handleSubTypeChange(event) {
      const subTypeIndex = Number(event.detail.value);
      const subType = this.data.subTypes[subTypeIndex];
      this.setData({
        subTypeIndex,
        'formData.subType': subType.id,
        'formData.itemName': subType.name,
        'formData.stageId': '',
        'formData.stageDate': '',
        'formData.amount': '',
        priceTiers: [],
        priceTierLabels: [],
        matchedMeetStageName: ''
      });
    },

    handleDateChange(event) {
      this.setData({ 'formData.date': event.detail.value });
    },

    handlePaymentMethodChange(event) {
      const paymentMethodIndex = Number(event.detail.value);
      this.setData({
        paymentMethodIndex,
        'formData.paymentMethod': this.data.paymentMethods[paymentMethodIndex]
      });
    },

    handlePurchaseChannelChange(event) {
      const purchaseChannelIndex = Number(event.detail.value);
      const purchaseChannel = this.data.purchaseChannels[purchaseChannelIndex];
      const hasPriceTier = this.data.priceTiers.length > 0;
      const pricingMode =
        purchaseChannel.id === 'official' && hasPriceTier ? 'official_unit' : 'total';
      this.setData({
        purchaseChannelIndex,
        'formData.purchaseChannel': purchaseChannel.id,
        'formData.pricingMode': pricingMode,
        'formData.amount':
          purchaseChannel.id === 'official' && hasPriceTier
            ? this.data.formData.priceTier
            : ''
      });
    },

    handleMeetDateChange(event) {
      const date = event.detail.value;
      if (!isMeetStageType(this.data.formData.subType)) {
        this.setData({ 'formData.stageDate': date });
        return;
      }
      const matchedStage =
        (this.data.meetStages || []).find(
          (item) => inferMeetStageType(item) === this.data.formData.subType && item.date === date
        ) || (this.data.meetStages || []).find((item) => item.date === date);
      if (matchedStage) {
        this.applySelectedMeetStage(matchedStage, {
          stageDateOptions: [],
          stageDateLabels: [],
          stageDateIndex: 0
        });
        return;
      }
      const fallbackName = getMeetStageLabel(this.data.formData.subType);
      this.setData({
        'formData.stageId': '',
        'formData.stageDate': date,
        'formData.itemName': this.data.matchedMeetStageName ? fallbackName : this.data.formData.itemName || fallbackName,
        'formData.city': this.data.matchedMeetStageName ? '' : this.data.formData.city,
        'formData.location': this.data.matchedMeetStageName ? '' : this.data.formData.location,
        'formData.amount': this.data.formData.purchaseChannel === 'official' ? '' : this.data.formData.amount,
        'formData.priceTier': '',
        priceTiers: [],
        priceTierLabels: [],
        priceTierIndex: 0,
        matchedMeetStageName: '',
        searchKeyword: '',
        stageDateOptions: [],
        stageDateLabels: [],
        stageDateIndex: 0
      });
    },

    handleStageDateOptionChange(event) {
      const stageDateIndex = Number(event.detail.value);
      const stage = this.data.stageDateOptions[stageDateIndex];
      if (!stage) {
        return;
      }
      this.applySelectedMeetStage(stage, { stageDateIndex });
    },

    handlePriceTierChange(event) {
      const priceTierIndex = Number(event.detail.value);
      const priceTier = this.data.priceTiers[priceTierIndex];
      if (typeof priceTier === 'undefined') {
        return;
      }
      this.setData({
        priceTierIndex,
        'formData.amount':
          this.data.formData.purchaseChannel === 'official'
            ? String(priceTier)
            : this.data.formData.amount,
        'formData.priceTier': String(priceTier)
      });
    },

    handleFormInput(event) {
      const { field } = event.currentTarget.dataset;
      this.setData({
        [`formData.${field}`]: event.detail.value
      });
    },

    handleIncludeChange(event) {
      this.setData({
        'formData.includeInTotal': event.detail.value
      });
    },

    handleItemSearchInput(event) {
      const searchKeyword = String(event.detail.value || '');
      this.setData({ searchKeyword });
      const keyword = searchKeyword.trim();
      if (!keyword) {
        this.setData({ searchResults: [] });
        return;
      }
      const stageGroups = [];
      const stageGroupMap = {};
      (this.data.meetStages || [])
        .filter((stage) => String(stage.stageName || '').indexOf(keyword) >= 0)
        .forEach((stage) => {
          const key = stage.stageName || stage.stageId;
          if (!stageGroupMap[key]) {
            stageGroupMap[key] = {
              id: key,
              stageName: stage.stageName,
              highlightSegments: buildHighlightedSegments(stage.stageName, keyword),
              displayMeta: `${getMeetStageLabel(inferMeetStageType(stage))} · ${stage.city || ''} · ${stage.venue || stage.location || ''}`,
              stages: []
            };
            stageGroups.push(stageGroupMap[key]);
          }
          stageGroupMap[key].stages.push(stage);
        });
      this.setData({
        searchResults: stageGroups.slice(0, 8)
      });
    },

    handleSelectSearchItem(event) {
      const { id } = event.currentTarget.dataset;
      const group = this.data.searchResults.find((item) => item.id === id);
      if (!group || !group.stages || !group.stages.length) {
        return;
      }
      if (group.stages.length === 1) {
        this.applySelectedMeetStage(group.stages[0]);
        this.setData({ searchResults: [] });
        return;
      }
      const stageDateOptions = group.stages;
      const stageDateLabels = group.stages.map((item) => `${item.date} · ${item.city || ''}`);
      this.applySelectedMeetStage(group.stages[0], {
        stageDateOptions,
        stageDateLabels,
        stageDateIndex: 0,
        searchResults: []
      });
    },

    async handleSubmit() {
      if (this.data.submitting) {
        return;
      }
      const payload = {
        ...this.data.formData,
        category: 'meet',
        paymentMethod: this.data.paymentMethods[this.data.paymentMethodIndex]
      };
      this.setData({ submitting: true });
      try {
        const result = await expenseService.addExpenseAsync(payload);
        if (!result.valid) {
          wx.showToast({ title: result.message, icon: 'none' });
          return;
        }
        if (payload.stageId) {
          await stageService.linkStageExpense(
            payload.stageId,
            result.data.expenseId,
            Number(payload.amount || 0)
          );
        }
        wx.showToast({ title: '已新增', icon: 'success' });
        this.triggerEvent('success', { expense: result.data });
      } catch (error) {
        wx.showToast({ title: error.message || '保存失败', icon: 'none' });
      } finally {
        this.setData({ submitting: false });
      }
    }
  }
});
