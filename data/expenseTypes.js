const expenseTypes = [
  {
    id: 'meet',
    name: '见面',
    subTypes: [
      { id: 'concert', name: '演唱会' },
      { id: 'festival', name: '音乐节|拼盘' },
      { id: 'activity', name: '活动|综艺|盛典' },
      { id: 'other_meet', name: '其他' }
    ]
  },
  {
    id: 'album',
    name: '实体专辑',
    subTypes: [
      { id: 'album_utopia', name: '乌托邦少年' },
      { id: 'album_dream', name: '梦游记' },
      { id: 'album_growth', name: '少年成长纪念辑' }
    ]
  },
  {
    id: 'goods',
    name: '周边',
    subTypes: [
      { id: 'light_stick', name: '官方应援棒' },
      { id: 'photo_card', name: '小卡/拍立得' },
      { id: 'doll', name: '娃娃/挂件' },
      { id: 'magazine', name: '杂志/刊物' },
      { id: 'other_goods', name: '其他周边' }
    ]
  },
  {
    id: 'business',
    name: '商务',
    subTypes: [
      { id: 'brand_drink', name: '饮品品牌示例' },
      { id: 'brand_skincare', name: '护肤品牌示例' },
      { id: 'brand_fashion', name: '服饰品牌示例' },
      { id: 'brand_food', name: '食品品牌示例' }
    ]
  }
];

const searchableItems = [
  { id: 'goods_light_stick', mainType: 'goods', subType: 'light_stick', name: '官方应援棒' },
  { id: 'goods_photo_card', mainType: 'goods', subType: 'photo_card', name: '成员小卡套装' },
  { id: 'goods_doll', mainType: 'goods', subType: 'doll', name: '成员棉花娃娃' },
  { id: 'goods_magazine', mainType: 'goods', subType: 'magazine', name: '时代少年团封面杂志' },
  { id: 'business_drink', mainType: 'business', subType: 'brand_drink', name: '饮品品牌联名款' },
  { id: 'business_skincare', mainType: 'business', subType: 'brand_skincare', name: '护肤品牌代言套装' },
  { id: 'business_fashion', mainType: 'business', subType: 'brand_fashion', name: '服饰品牌同款' },
  { id: 'business_food', mainType: 'business', subType: 'brand_food', name: '食品品牌代言礼盒' }
];

module.exports = {
  expenseTypes,
  searchableItems
};
