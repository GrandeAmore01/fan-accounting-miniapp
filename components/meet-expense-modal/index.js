const expenseService = require('../../services/expenseService');
const stageService = require('../../services/stageService');
const meetExpenseForm = require('../../services/meetExpenseFormService');

const MAX_SEARCH_LENGTH = 40;
const MAX_NAME_LENGTH = 80;
const MAX_TEXT_LENGTH = 120;
const MAX_REMARK_LENGTH = 160;
const MAX_CUSTOM_TAG_LENGTH = 12;
const MAX_AMOUNT = 1000000;

const TEXT_FIELD_LIMITS = {
  itemName: MAX_NAME_LENGTH,
  city: MAX_TEXT_LENGTH,
  location: MAX_TEXT_LENGTH,
  seat: MAX_TEXT_LENGTH,
  remark: MAX_REMARK_LENGTH
};

const TEXT_FIELD_NAMES = {
  itemName: '项目名称',
  city: '城市',
  location: '地点',
  seat: '座位',
  remark: '备注'
};

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
    formTouched: false,
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
    searchResults: [],
    meetSearchFocused: false,
    stageDateOptions: [],
    stageDateLabels: [],
    stageDateIndex: 0,
    today: meetExpenseForm.getTodayText(),
    expenseDateEnd: meetExpenseForm.getTodayText(),
    formData: meetExpenseForm.createDefaultFormData(),
    formErrors: {},
    formWarnings: {},
    focusedWarningField: '',
    quickRemarkTags: meetExpenseForm.getQuickRemarkTags(),
    selectedRemarkTags: [],
    formRemarkText: '',
    customRemarkTag: ''
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

    resetRemarkState(remark = '') {
      const remarkParts = meetExpenseForm.parseRemarkParts(remark);
      return {
        selectedRemarkTags: remarkParts.tags,
        formRemarkText: remarkParts.text,
        quickRemarkTags: meetExpenseForm.getQuickRemarkTags(remark),
        customRemarkTag: ''
      };
    },

    syncFormState(formData, extraState = {}) {
      const formTouched = this.data.formTouched || Boolean(extraState.formTouched);
      const nextState = {
        formData,
        formErrors: formTouched ? meetExpenseForm.getFormErrors(formData, this.data.today) : {},
        formWarnings: formTouched ? meetExpenseForm.getFormWarnings(formData) : {},
        expenseDateEnd: meetExpenseForm.getExpenseDateEnd(formData, this.data.today),
        ...extraState
      };
      this.setData(nextState);
    },

    async openWithStage(stageId) {
      const meetStages = await expenseService.listMeetStagesAsync();
      let stage = (meetStages || []).find((item) => item.stageId === stageId);
      if (!stage) {
        await stageService.ensureStagesLoaded({ refresh: true });
        const cached = stageService.getStageById(stageId);
        if (cached) {
          stage = {
            stageId: cached.stageId,
            stageName: cached.stageName,
            stageType: meetExpenseForm.inferMeetStageType(cached),
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

      const today = meetExpenseForm.getTodayText();
      const formData = meetExpenseForm.createDefaultFormData({
        date: today,
        remark: '由舞台记录同步生成',
        purchaseChannel: 'official',
        pricingMode: 'official_unit'
      });
      const remarkState = this.resetRemarkState(formData.remark);

      this.setData({
        meetStages,
        today,
        expenseDateEnd: today,
        categoryIndex: 0,
        paymentMethodIndex: 0,
        purchaseChannelIndex: 0,
        formTouched: false,
        formErrors: {},
        formWarnings: {},
        focusedWarningField: '',
        searchResults: [],
        meetSearchFocused: false,
        stageDateOptions: [],
        stageDateLabels: [],
        stageDateIndex: 0,
        formData,
        ...remarkState
      });
      this.applySelectedMeetStage(stage);
    },

    applySelectedMeetStage(stage, extraState = {}) {
      const priceTiers = meetExpenseForm.getPositivePriceTiers(stage);
      const priceTierLabels = priceTiers.map((price) => `${price} 元`);
      const shouldUseOfficialTier = this.data.formData.purchaseChannel === 'official';
      const stageType = meetExpenseForm.inferMeetStageType(stage);
      const category = this.data.categories[this.data.categoryIndex] || this.data.categories[0];
      const subTypes = category.subTypes || [];
      const subTypeIndex = Math.max(subTypes.findIndex((item) => item.id === stageType), 0);
      const concertStages = (this.data.meetStages || []).filter(
        (item) => meetExpenseForm.inferMeetStageType(item) === stageType
      );
      const today = this.data.today || meetExpenseForm.getTodayText();
      const formData = {
        ...this.data.formData,
        date: today,
        subType: stageType,
        stageId: stage.stageId,
        stageDate: stage.date,
        itemName: stage.stageName,
        city: stage.city || '',
        location: stage.venue || stage.location || '',
        expectedCity: stage.city || '',
        expectedLocation: stage.venue || stage.location || '',
        amount: shouldUseOfficialTier && priceTiers.length ? String(priceTiers[0]) : '',
        priceTier: priceTiers.length ? String(priceTiers[0]) : '',
        pricingMode: shouldUseOfficialTier && priceTiers.length ? 'official_unit' : 'total',
        paymentMethod: this.data.paymentMethods[this.data.paymentMethodIndex]
      };
      this.syncFormState(formData, {
        ...extraState,
        subTypes,
        subTypeIndex,
        concertStages,
        priceTiers,
        priceTierLabels,
        priceTierIndex: 0,
        matchedMeetStageName: stage.stageName,
        searchResults: [],
        meetSearchFocused: false
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
      const formData = {
        ...this.data.formData,
        category: category.id,
        subType: firstSubType.id || 'concert'
      };
      this.syncFormState(formData, {
        categoryIndex,
        subTypes: category.subTypes || [],
        subTypeIndex: 0,
        formTouched: true
      });
    },

    handleSubTypeChange(event) {
      const subTypeIndex = Number(event.detail.value);
      const subType = this.data.subTypes[subTypeIndex];
      const formData = {
        ...this.data.formData,
        subType: subType.id,
        itemName: subType.name,
        stageId: '',
        stageDate: '',
        amount: '',
        priceTier: '',
        expectedCity: '',
        expectedLocation: ''
      };
      this.syncFormState(formData, {
        subTypeIndex,
        priceTiers: [],
        priceTierLabels: [],
        matchedMeetStageName: '',
        stageDateOptions: [],
        stageDateLabels: [],
        stageDateIndex: 0,
        formTouched: true
      });
    },

    handleDateChange(event) {
      const formData = {
        ...this.data.formData,
        date: event.detail.value
      };
      this.syncFormState(formData, { formTouched: true });
    },

    handlePaymentMethodChange(event) {
      const paymentMethodIndex = Number(event.detail.value);
      const formData = {
        ...this.data.formData,
        paymentMethod: this.data.paymentMethods[paymentMethodIndex]
      };
      this.syncFormState(formData, { paymentMethodIndex, formTouched: true });
    },

    handlePurchaseChannelChange(event) {
      const purchaseChannelIndex = Number(event.detail.value);
      const purchaseChannel = this.data.purchaseChannels[purchaseChannelIndex];
      const hasPriceTier = this.data.priceTiers.length > 0;
      const pricingMode =
        purchaseChannel.id === 'official' && hasPriceTier ? 'official_unit' : 'total';
      const formData = {
        ...this.data.formData,
        purchaseChannel: purchaseChannel.id,
        pricingMode,
        amount:
          purchaseChannel.id === 'official' && hasPriceTier
            ? this.data.formData.priceTier
            : ''
      };
      this.syncFormState(formData, { purchaseChannelIndex, formTouched: true });
    },

    handleMeetDateChange(event) {
      const date = event.detail.value;
      if (!meetExpenseForm.isMeetStageType(this.data.formData.subType)) {
        const formData = { ...this.data.formData, stageDate: date };
        this.syncFormState(formData, { formTouched: true });
        return;
      }
      const matchedStage =
        (this.data.meetStages || []).find(
          (item) => meetExpenseForm.inferMeetStageType(item) === this.data.formData.subType && item.date === date
        ) || (this.data.meetStages || []).find((item) => item.date === date);
      if (matchedStage) {
        this.applySelectedMeetStage(matchedStage, {
          stageDateOptions: [],
          stageDateLabels: [],
          stageDateIndex: 0,
          formTouched: true
        });
        return;
      }
      const fallbackName = meetExpenseForm.getMeetStageLabel(this.data.formData.subType);
      const formData = {
        ...this.data.formData,
        stageId: '',
        stageDate: date,
        itemName: this.data.matchedMeetStageName ? fallbackName : this.data.formData.itemName || fallbackName,
        city: this.data.matchedMeetStageName ? '' : this.data.formData.city,
        location: this.data.matchedMeetStageName ? '' : this.data.formData.location,
        expectedCity: '',
        expectedLocation: '',
        priceTier: '',
        amount: this.data.formData.purchaseChannel === 'official' ? '' : this.data.formData.amount
      };
      this.syncFormState(formData, {
        priceTiers: [],
        priceTierLabels: [],
        priceTierIndex: 0,
        matchedMeetStageName: '',
        stageDateOptions: [],
        stageDateLabels: [],
        stageDateIndex: 0,
        formTouched: true
      });
    },

    handleStageDateOptionTap(event) {
      const stageDateIndex = Number(event.currentTarget.dataset.index);
      const stage = this.data.stageDateOptions[stageDateIndex];
      if (!stage) {
        return;
      }
      this.applySelectedMeetStage(stage, { stageDateIndex, formTouched: true });
    },

    handlePriceTierChange(event) {
      const priceTierIndex = Number(event.detail.value);
      const priceTier = this.data.priceTiers[priceTierIndex];
      if (typeof priceTier === 'undefined') {
        return;
      }
      const formData = {
        ...this.data.formData,
        amount:
          this.data.formData.purchaseChannel === 'official'
            ? String(priceTier)
            : this.data.formData.amount,
        priceTier: String(priceTier)
      };
      this.syncFormState(formData, { priceTierIndex, formTouched: true });
    },

    handleMeetNameFocus() {
      this.setData({ meetSearchFocused: true });
      this.updateMeetSearchResults(this.data.formData.itemName || '');
    },

    handleMeetNameBlur() {
      setTimeout(() => {
        this.setData({ meetSearchFocused: false });
      }, 160);
    },

    handleMeetNameInput(event) {
      const value = this.sanitizeFormInput('itemName', event.detail.value);
      const formData = {
        ...this.data.formData,
        itemName: value
      };
      this.setData({
        formTouched: true,
        formData,
        meetSearchFocused: true,
        formErrors: meetExpenseForm.getFormErrors(formData, this.data.today),
        formWarnings: meetExpenseForm.getFormWarnings(formData)
      });
      this.updateMeetSearchResults(value);
    },

    updateMeetSearchResults(value) {
      const keyword = String(value || '').trim();
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
              highlightSegments: meetExpenseForm.buildHighlightedSegments(stage.stageName, keyword),
              displayMeta: `${meetExpenseForm.getMeetStageLabel(meetExpenseForm.inferMeetStageType(stage))} · ${stage.city || ''} · ${stage.venue || stage.location || ''}`,
              stages: []
            };
            stageGroups.push(stageGroupMap[key]);
          }
          stageGroupMap[key].stages.push(stage);
        });
      this.setData({ searchResults: stageGroups.slice(0, 8) });
    },

    handleBundleCostToggle(event) {
      const field = event.currentTarget.dataset.field;
      const checked = event.detail.value;
      const amountField =
        field === 'includeTransportCost' ? 'transportAmount' : 'accommodationAmount';
      const formData = {
        ...this.data.formData,
        [field]: checked,
        [amountField]: checked ? this.data.formData[amountField] : ''
      };
      this.syncFormState(formData, { formTouched: true });
    },

    handleUseExpectedField(event) {
      const field = event.currentTarget.dataset.field;
      const expectedField = field === 'city' ? 'expectedCity' : 'expectedLocation';
      const formData = {
        ...this.data.formData,
        [field]: this.data.formData[expectedField] || ''
      };
      this.syncFormState(formData, { focusedWarningField: '', formTouched: true });
    },

    handleWarningFieldFocus(event) {
      this.setData({ focusedWarningField: event.currentTarget.dataset.field || '' });
    },

    handleWarningFieldBlur() {
      setTimeout(() => {
        this.setData({ focusedWarningField: '' });
      }, 160);
    },

    updateRemarkTags(nextTags, remarkText, extraData = {}) {
      const limitedRemark = this.sanitizeFormInput(
        'remark',
        meetExpenseForm.composeRemark(nextTags, remarkText)
      );
      const remarkParts = meetExpenseForm.parseRemarkParts(limitedRemark);
      const formData = {
        ...this.data.formData,
        remark: limitedRemark
      };
      this.setData({
        formTouched: true,
        formData,
        selectedRemarkTags: remarkParts.tags,
        formRemarkText: remarkParts.text,
        formErrors: meetExpenseForm.getFormErrors(formData, this.data.today),
        formWarnings: meetExpenseForm.getFormWarnings(formData),
        quickRemarkTags: meetExpenseForm.getQuickRemarkTags(formData.remark),
        ...extraData
      });
    },

    handleQuickRemarkTagTap(event) {
      const tag = event.currentTarget.dataset.tag;
      if (!tag) {
        return;
      }
      const selectedTags = this.data.selectedRemarkTags || [];
      const nextTags = selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag];
      this.updateRemarkTags(nextTags, this.data.formRemarkText);
    },

    handleRemoveRemarkTag(event) {
      const tag = event.currentTarget.dataset.tag;
      if (!tag) {
        return;
      }
      this.updateRemarkTags(
        (this.data.selectedRemarkTags || []).filter((item) => item !== tag),
        this.data.formRemarkText
      );
    },

    handleCustomRemarkTagInput(event) {
      const cleanedValue = String(event.detail.value || '').replace(/[#\s]/g, '');
      let value = cleanedValue;
      if (cleanedValue.length > MAX_CUSTOM_TAG_LENGTH) {
        this.showInputLimitToast(`标签上限为 ${MAX_CUSTOM_TAG_LENGTH} 个字`);
        value = this.data.customRemarkTag || '';
      }
      this.setData({ customRemarkTag: value });
    },

    handleAddCustomRemarkTag() {
      const tag = String(this.data.customRemarkTag || '').trim();
      if (!tag) {
        wx.showToast({ title: '请先输入标签', icon: 'none' });
        return;
      }
      const selectedTags = this.data.selectedRemarkTags || [];
      this.updateRemarkTags(
        selectedTags.includes(tag) ? selectedTags : [...selectedTags, tag],
        this.data.formRemarkText,
        { customRemarkTag: '' }
      );
    },

    handleFormInput(event) {
      const { field } = event.currentTarget.dataset;
      if (field === 'remark') {
        const composedRemark = meetExpenseForm.composeRemark(
          this.data.selectedRemarkTags,
          event.detail.value
        );
        const safeRemark = this.sanitizeFormInput('remark', composedRemark);
        const remarkParts = meetExpenseForm.parseRemarkParts(safeRemark);
        const formData = {
          ...this.data.formData,
          remark: safeRemark
        };
        this.setData({
          formTouched: true,
          formData,
          formRemarkText: remarkParts.text,
          selectedRemarkTags: remarkParts.tags,
          formErrors: meetExpenseForm.getFormErrors(formData, this.data.today),
          formWarnings: meetExpenseForm.getFormWarnings(formData),
          quickRemarkTags: meetExpenseForm.getQuickRemarkTags(formData.remark)
        });
        return;
      }
      const value = this.sanitizeFormInput(field, event.detail.value);
      const formData = {
        ...this.data.formData,
        [field]: value
      };
      this.syncFormState(formData, { formTouched: true });
    },

    handleIncludeChange(event) {
      const formData = {
        ...this.data.formData,
        includeInTotal: event.detail.value
      };
      this.syncFormState(formData, { formTouched: true });
    },

    handleSelectSearchItem(event) {
      const { id } = event.currentTarget.dataset;
      const group = this.data.searchResults.find((item) => item.id === id);
      if (!group || !group.stages || !group.stages.length) {
        return;
      }
      if (group.stages.length === 1) {
        this.applySelectedMeetStage(group.stages[0], { formTouched: true });
        return;
      }
      const stageDateOptions = group.stages;
      const stageDateLabels = group.stages.map((item) => `${item.date} · ${item.city || ''}`);
      this.applySelectedMeetStage(group.stages[0], {
        stageDateOptions,
        stageDateLabels,
        stageDateIndex: 0,
        searchResults: [],
        formTouched: true
      });
    },

    confirmFormWarnings(formWarnings) {
      return new Promise((resolve) => {
        wx.showModal({
          title: '继续保存？',
          content: `${meetExpenseForm.getFirstValidationMessage(formWarnings)}，是否继续保存？`,
          cancelText: '再检查',
          confirmText: '继续保存',
          confirmColor: '#9c6a00',
          success: (res) => resolve(Boolean(res.confirm)),
          fail: () => resolve(false)
        });
      });
    },

    async handleSubmit() {
      if (this.data.submitting) {
        return;
      }
      const formErrors = meetExpenseForm.getFormErrors(this.data.formData, this.data.today);
      if (Object.keys(formErrors).length) {
        this.setData({ formTouched: true, formErrors });
        wx.showToast({
          title: meetExpenseForm.getFirstValidationMessage(formErrors),
          icon: 'none'
        });
        return;
      }
      const formWarnings = meetExpenseForm.getFormWarnings(this.data.formData);
      if (Object.keys(formWarnings).length) {
        this.setData({ formWarnings });
        const confirmed = await this.confirmFormWarnings(formWarnings);
        if (!confirmed) {
          return;
        }
      }

      const payload = {
        ...this.data.formData,
        category: 'meet',
        paymentMethod: this.data.paymentMethods[this.data.paymentMethodIndex]
      };
      this.setData({ submitting: true });
      try {
        const result = await meetExpenseForm.addMeetExpenseBundle(payload);
        if (!result.valid) {
          wx.showToast({ title: result.message || '保存失败', icon: 'none' });
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
    },

    showInputLimitToast(title) {
      const now = Date.now();
      if (now - (this.inputLimitToastAt || 0) < 1200) {
        return;
      }
      this.inputLimitToastAt = now;
      wx.showToast({ title, icon: 'none' });
    },

    limitPlainText(value, previousValue, maxLength, fieldName) {
      const nextValue = String(value || '');
      if (nextValue.length <= maxLength) {
        return nextValue;
      }
      this.showInputLimitToast(`${fieldName}上限为 ${maxLength} 个字`);
      return String(previousValue || '');
    },

    sanitizeAmountInput(value, previousValue) {
      const nextValue = String(value || '');
      const previous = String(previousValue || '');
      if (!nextValue) {
        return '';
      }
      if (!/^\d*(\.\d{0,2})?$/.test(nextValue)) {
        this.showInputLimitToast('金额最多保留 2 位小数');
        return previous;
      }
      const amount = Number(nextValue);
      if (Number.isFinite(amount) && amount > MAX_AMOUNT) {
        this.showInputLimitToast(`金额上限为 ${MAX_AMOUNT}`);
        return previous;
      }
      return nextValue;
    },

    sanitizeFormInput(field, value) {
      const previousValue = this.data.formData[field];
      if (['amount', 'transportAmount', 'accommodationAmount'].includes(field)) {
        return this.sanitizeAmountInput(value, previousValue);
      }
      if (TEXT_FIELD_LIMITS[field]) {
        return this.limitPlainText(
          value,
          previousValue,
          TEXT_FIELD_LIMITS[field],
          TEXT_FIELD_NAMES[field] || field
        );
      }
      return value;
    }
  }
});
