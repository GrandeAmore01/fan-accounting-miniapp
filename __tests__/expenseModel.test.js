const expenseModel = require('../server/src/utils/expenseModel');

function validInput(overrides = {}) {
  return {
    expenseId: 'E001',
    userId: 'test-user',
    category: 'collection',
    subType: 'goods',
    itemName: ' 测试徽章 ',
    amount: '50',
    quantity: 2,
    date: '2026-07-10',
    location: ' 上海 ',
    seat: ' A区 ',
    remark: ' 测试 ',
    city: ' 上海 ',
    pricingMode: 'unit',
    includeInTotal: true,
    collectionId: 'C001',
    ...overrides
  };
}

describe('后端 - expenseModel 规范化与金额计算', () => {
  test('藏品单价模式按金额乘数量计算总额', () => {
    const result = expenseModel.normalizeExpense(
      validInput()
    );

    expect(result).toEqual(
      expect.objectContaining({
        expenseId: 'E001',
        userId: 'test-user',
        category: 'collection',
        amount: 50,
        quantity: 2,
        baseAmount: 100,
        totalAmount: 100,
        includedAmount: 100
      })
    );
  });

  test('非藏品分类数量固定为1且不计入总额时 includedAmount 为0', () => {
    const result = expenseModel.normalizeExpense(
      validInput({
        category: 'transport',
        subType: 'travel',
        quantity: 9,
        pricingMode: 'direct',
        amount: 88,
        includeInTotal: false,
        collectionId: ''
      })
    );

    expect(result.quantity).toBe(1);
    expect(result.totalAmount).toBe(88);
    expect(result.includedAmount).toBe(0);
  });

  test('文本字段去空格并补充默认字段', () => {
    const result = expenseModel.normalizeExpense(
      validInput()
    );

    expect(result.itemName).toBe('测试徽章');
    expect(result.location).toBe('上海');
    expect(result.seat).toBe('A区');
    expect(result.remark).toBe('测试');
    expect(result.city).toBe('上海');
    expect(result.images).toEqual([]);
    expect(result.fees).toEqual({
      premium: 0,
      travel: 0,
      hotel: 0,
      rental: 0,
      other: 0,
      shipping: 0
    });
  });
});

describe('后端 - expenseModel 输入校验', () => {
  test('名称、日期和见面日期缺失时分别返回校验错误', () => {
    expect(
      expenseModel.validateExpense(
        expenseModel.normalizeExpense(
          validInput({
            itemName: ''
          })
        )
      )
    ).toEqual({
      valid: false,
      message: '请填写消费项目名称'
    });

    expect(
      expenseModel.validateExpense(
        expenseModel.normalizeExpense(
          validInput({
            date: ''
          })
        )
      )
    ).toEqual({
      valid: false,
      message: '请选择消费日期'
    });

    expect(
      expenseModel.validateExpense(
        expenseModel.normalizeExpense(
          validInput({
            category: 'meet',
            subType: 'concert',
            collectionId: '',
            stageDate: ''
          })
        )
      )
    ).toEqual({
      valid: false,
      message: '请选择见面日期'
    });
  });

  test('金额精度、金额上限和非法分类均能拦截', () => {
    expect(
      expenseModel.validateExpense(
        expenseModel.normalizeExpense(
          validInput({
            amount: '12.345'
          })
        )
      )
    ).toEqual({
      valid: false,
      message: '金额最多保留两位小数'
    });

    expect(
      expenseModel.validateExpense(
        expenseModel.normalizeExpense(
          validInput({
            amount: '1000000.01'
          })
        )
      )
    ).toEqual({
      valid: false,
      message: '金额不能超过100万元'
    });

    expect(
      expenseModel.validateExpense(
        expenseModel.normalizeExpense(
          validInput({
            category: 'unknown'
          })
        )
      )
    ).toEqual({
      valid: false,
      message: '消费分类不正确'
    });
  });

  test.failing('已知缺陷 DEF-EXP-102：后端模型同样将藏品数量0默认转换为1', () => {
    const expense = expenseModel.normalizeExpense(
      validInput({
        quantity: 0
      })
    );

    expect(
      expenseModel.validateExpense(expense)
    ).toEqual({
      valid: false,
      message: '藏品数量必须是1至10之间的整数'
    });
  });
});

describe('后端 - expenseModel 数据库转换', () => {
  test('数据库行转换为消费对象并处理 JSON、日期和数值', () => {
    const result = expenseModel.rowToExpense({
      expense_id: 'E100',
      user_id: 'user-1',
      category: 'collection',
      sub_type: 'goods',
      item_name: '服务器徽章',
      amount: '39.90',
      quantity: '2',
      expense_date: '2026-07-10T00:00:00.000Z',
      payment_method: '微信',
      seat: '',
      location: '上海',
      remark: '',
      images_json: '["a.jpg"]',
      fees_json: '{"premium":99}',
      outfield_only: 0,
      include_in_total: 1,
      collection_id: 'C001',
      stage_id: null,
      stage_date: '',
      price_tier: '',
      city: '上海',
      purchase_channel: 'official',
      pricing_mode: 'unit',
      reference_price: '39.9',
      unit_price: '39.9',
      expense_source: 'manual',
      base_amount: '79.8',
      total_amount: '79.8',
      included_amount: '79.8',
      created_at: 'created',
      updated_at: 'updated'
    });

    expect(result).toEqual(
      expect.objectContaining({
        expenseId: 'E100',
        userId: 'user-1',
        amount: 39.9,
        quantity: 2,
        date: '2026-07-10',
        images: ['a.jpg'],
        includeInTotal: true,
        collectionId: 'C001',
        stageId: '',
        referencePrice: 39.9,
        unitPrice: 39.9,
        totalAmount: 79.8,
        includedAmount: 79.8
      })
    );

    expect(result.fees).toEqual({
      premium: 0,
      travel: 0,
      hotel: 0,
      rental: 0,
      other: 0,
      shipping: 0
    });
  });

  test('消费对象正确转换为数据库参数', () => {
    const expense = expenseModel.normalizeExpense(
      validInput({
        includeInTotal: false
      })
    );

    const params = expenseModel.expenseToParams(expense);

    expect(params).toEqual(
      expect.objectContaining({
        expenseId: 'E001',
        userId: 'test-user',
        category: 'collection',
        quantity: 2,
        imagesJson: '[]',
        feesJson: JSON.stringify({
          premium: 0,
          travel: 0,
          hotel: 0,
          rental: 0,
          other: 0,
          shipping: 0
        }),
        outfieldOnly: 0,
        includeInTotal: 0,
        collectionId: 'C001',
        totalAmount: 100,
        includedAmount: 0
      })
    );
  });
});

