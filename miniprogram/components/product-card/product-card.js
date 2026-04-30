/**
 * 产品卡片组件逻辑
 */
const { calcRemainingDays, getProductDisplayStatus } = require('../../utils/date');
const { calcProgressPercent, formatRemainingText, getStatusLabel, getStatusColorClass } = require('../../utils/display');

Component({
  properties: {
    product: {
      type: Object,
      value: {},
    },
    advanceDays: {
      type: Number,
      value: 30,
    },
  },

  observers: {
    'product, advanceDays': function (product, advanceDays) {
      if (!product || !product.expirationDate) return;

      const remainingDays = calcRemainingDays(product.expirationDate);
      const displayStatus = getProductDisplayStatus(remainingDays, advanceDays);

      this.setData({
        remainingText: formatRemainingText(remainingDays),
        statusLabel: getStatusLabel(product.status === 'used_up' || product.status === 'discarded' ? product.status : displayStatus),
        colorClass: getStatusColorClass(product.status === 'used_up' || product.status === 'discarded' ? product.status : displayStatus),
        progressPercent: calcProgressPercent(product.productionDate, product.expirationDate),
      });
    },
  },

  data: {
    remainingText: '',
    statusLabel: '',
    colorClass: 'safe',
    progressPercent: 0,
  },

  methods: {
    onCardTap() {
      const { product } = this.data;
      if (product && product._id) {
        wx.navigateTo({ url: `/pages/detail/detail?id=${product._id}` });
      }
    },
  },
});
