/**
 * 库存清单页逻辑
 * 搜索、分类筛选、状态过滤、分页加载
 * 对接 productOps.list 云函数
 * 分类从云数据库 categories 集合动态加载
 */
const PAGE_SIZE = 20;

Page({
  data: {
    products: [],
    categories: [],
    keyword: '',
    activeCategory: '',
    activeStatus: '',
    loading: false,
    hasMore: true,
    page: 1,
    advanceDays: 30,
  },

  onShow() {
    // 每次页面展示时重新加载
    this.setData({ page: 1, products: [], hasMore: true });
    this.loadCategories();
    this.loadProducts();
  },

  // --- 加载用户自定义分类 ---
  loadCategories() {
    const db = wx.cloud.database();
    db.collection('categories')
      .orderBy('sortOrder', 'asc')
      .get()
      .then((res) => {
        this.setData({ categories: res.data || [] });
      })
      .catch(() => {
        this.setData({ categories: [] });
      });
  },

  // --- 搜索 ---
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.setData({ page: 1, products: [], hasMore: true });
    this.loadProducts();
  },

  // --- 分类筛选 ---
  onCategoryFilter(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      activeCategory: category,
      page: 1,
      products: [],
      hasMore: true,
    });
    this.loadProducts();
  },

  // --- 状态过滤 ---
  onStatusFilter(e) {
    const status = e.currentTarget.dataset.status;
    // 点击已选中的状态则取消筛选
    const newStatus = this.data.activeStatus === status ? '' : status;
    this.setData({
      activeStatus: newStatus,
      page: 1,
      products: [],
      hasMore: true,
    });
    this.loadProducts();
  },

  // --- 加载产品列表 ---
  loadProducts() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const params = {
      action: 'list',
      page: this.data.page,
      pageSize: PAGE_SIZE,
    };

    if (this.data.activeCategory) params.category = this.data.activeCategory;
    if (this.data.activeStatus) params.status = this.data.activeStatus;
    if (this.data.keyword.trim()) params.keyword = this.data.keyword.trim();

    wx.cloud.callFunction({
      name: 'productOps',
      data: params,
    }).then((res) => {
      const result = (res && res.result) || {};

      if (!result.success) {
        this.setData({ loading: false });
        wx.showToast({ title: result.error || '加载失败', icon: 'none' });
        return;
      }

      const payload = result.data || {};
      const newProducts = this.data.products.concat(payload.list || []);
      this.setData({
        products: newProducts,
        loading: false,
        hasMore: newProducts.length < (payload.total || 0),
      });
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // --- 加载更多 ---
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    this.loadProducts();
  },

  // --- 跳转添加页 ---
  goAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  },
});
