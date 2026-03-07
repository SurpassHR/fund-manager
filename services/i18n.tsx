import React, { createContext, useState, useContext, ReactNode } from 'react';

type Language = 'en' | 'zh';

const dictionary = {
  en: {
    common: {
      appTitle: "XiaoHuYangJi",
      loading: "Loading assets...",
      ocrProcessing: "Processing Image...",
      ocrComplete: "OCR Processing Complete (Simulated).",
      ocrPrivacy: "Powered by local Tesseract.js. No images are uploaded to the cloud. Privacy First.",
      simulate: "Simulate Scan",
      selectImage: "Select Image",
      analyzing: "Analyzing...",
      uploadTip: "Upload a screenshot of your holdings",
      smartEntry: "Smart Entry (OCR)",
      sync: "Sync Holdings",
      addFund: "Add Fund",
      batch: "Batch Add/Reduce",
      dayChg: "Day Chg",
      dayGain: "Day Gain",
      totalGain: "Total Gain",
      totalAssets: "Total Assets (CNY)",
      holdings: "Holdings",
      holdingAmount: "Holding Amt",
      watchlist: "Watchlist",
      market: "Market",
      news: "News",
      member: "Member",
      me: "Me",
      account: "Account",
      list: "List",
      rank: "Rank",
      underConstruction: "Module \"{module}\" is under construction.",
      return: "Return to Holdings",
      switchLang: "CN/EN",
      dayChgPct: "Day Chg %",
      nav: "NAV",
      cost: "Unit Cost",
      shares: "Shares",
      code: "Code",
      platform: "Platform",
      mktVal: "Mkt Val",
      manageAccounts: "Manage Accounts",
      addAccount: "Add Account",
      accountName: "Account Name",
      delete: "Delete",
      edit: "Edit Holding",
      save: "Save",
      cancel: "Cancel",
      searchFund: "Search Fund Name/Code",
      searching: "Searching...",
      noResults: "No results found",
      add: "Add",
      fillDetails: "Edit Holding Details",
      editDetails: "Edit Holding Details",
      confirm: "Confirm",
      success: "Success",
      searchTip: "Search via Morningstar API",
      fund: "Fund",
      menu: "Menu",
      autoCalcTip: "Fields are auto-calculated.",
      historyNav: "History NAV",
      date: "Date",
      unitNav: "Unit NAV",
      accNav: "Acc NAV",
      more: "More",
      settings: "Settings",
      theme: "Theme",
      themeSystem: "Follow System",
      themeLight: "Light",
      themeDark: "Dark",
      currentTheme: "Current",
      features: "Features",
      autoRefresh: "Auto Refresh Holdings",
      buyDate: "Buy Date",
      buyTime: "Buy Time",
      before15: "Before 15:00",
      after15: "After 15:00",
      addPosition: "Increase Position",
      reducePosition: "Reduce Position",
      adjustPosition: "Adjust Position",
      settlementDays: "Settlement (T+N)",
      pendingSettlement: "Pending",
      settlementDate: "Confirm Date",
      operationDate: "Operation Date",
      operationTime: "Operation Time",
      buyAmount: "Buy Amount (¥)",
      sellShares: "Sell Shares",
      inTransit: "In Transit",
      settled: "Settled",
      data: "Data",
      exportData: "Export Data",
      importData: "Import Data",
      exportSuccess: "Export successful!",
      importSuccess: "{added} added, {skipped} skipped (duplicate)",
      importError: "Import failed",
      welcome: "Welcome to XiaoHuYangJi",
      newFeatures: "What's New",
      gotIt: "Got it",
      transactionHistory: "Transaction History",
      noHistory: "No transaction history",
      cancelConfirm: "Are you sure you want to cancel this pending transaction?",
      undo: "Undo",
      all: "All",
      defaultAccount: "Default",
      addWatchlist: "Add to Watchlist",
      anchorPrice: "Anchor Price/Point",
      anchorDate: "Anchor Date",
      anchorGain: "Anchor Gain",
      type: "Type",
      indexOrSector: "Index/Sector",
      currentPrice: "Current Price",
      indexTip: "Tip: Indices use Tencent API (e.g. sh000001, sz399001).",
      fundTip: "Tip: Fund data will refresh automatically via API.",
      fetching: "Fetching...",
      autoFillDate: "Auto-filled based on date",
      noDataDate: "No data found for this date.",
      noWatchlistMsg: "No watchlist items. Click below to add.",
      currentLabel: "Cur",
      anchorLabel: "Anchor",
      indexBadge: "Index",
      fundBadge: "Fund",
      indexBadgeShort: "Idx",
      fundBadgeShort: "Fnd",
      searchPlaceholder: "e.g. 110011 or E Fund",
      indexCodePlaceholder: "sh000001",
      fundCodePlaceholder: "110011",
      indexNamePlaceholder: "SSE Composite",
      fundNamePlaceholder: "E Fund Blue Chip",
    }
  },
  zh: {
    common: {
      appTitle: "小胡养基",
      loading: "资产加载中...",
      ocrProcessing: "图像处理中...",
      ocrComplete: "OCR 处理完成 (模拟)。",
      ocrPrivacy: "由本地 Tesseract.js 支持。图片不上传云端，隐私优先。",
      simulate: "模拟扫描",
      selectImage: "选择图片",
      analyzing: "分析中...",
      uploadTip: "上传持仓截图",
      smartEntry: "智能录入 (OCR)",
      sync: "同步持仓",
      addFund: "添加基金",
      batch: "批量增减",
      dayChg: "日涨跌",
      dayGain: "日收益",
      totalGain: "持有收益",
      totalAssets: "总资产 (CNY)",
      holdings: "持有",
      holdingAmount: "持有金额",
      watchlist: "自选",
      market: "市场",
      news: "资讯",
      member: "会员",
      me: "我的",
      account: "账户",
      list: "榜单",
      rank: "排行",
      underConstruction: "\"{module}\" 模块建设中。",
      return: "返回持有",
      switchLang: "中/英",
      dayChgPct: "日涨幅",
      nav: "净值",
      cost: "持仓成本",
      shares: "持有份额",
      code: "代码",
      platform: "渠道",
      mktVal: "市值",
      manageAccounts: "管理账户",
      addAccount: "添加账户",
      accountName: "账户名称",
      delete: "删除",
      edit: "修改持仓",
      save: "保存",
      cancel: "取消",
      searchFund: "搜索基金名称/代码",
      searching: "搜索中...",
      noResults: "未找到相关基金",
      add: "添加",
      fillDetails: "填写持仓信息",
      editDetails: "修改持仓信息",
      confirm: "确认",
      success: "操作成功",
      searchTip: "通过晨星接口搜索",
      fund: "基金名称",
      menu: "管理菜单",
      autoCalcTip: "修改金额/收益会自动反算份额/成本",
      historyNav: "历史净值",
      date: "日期",
      unitNav: "单位净值",
      accNav: "累计净值",
      more: "更多",
      settings: "设置",
      theme: "主题",
      themeSystem: "跟随系统",
      themeLight: "浅色",
      themeDark: "深色",
      currentTheme: "当前",
      features: "功能",
      autoRefresh: "自动刷新持仓行情",
      buyDate: "买入日期",
      buyTime: "买入时间",
      before15: "15:00 前",
      after15: "15:00 后",
      addPosition: "加仓",
      reducePosition: "减仓",
      adjustPosition: "加减仓",
      settlementDays: "确认天数 (T+N)",
      pendingSettlement: "待确认",
      settlementDate: "确认日期",
      operationDate: "操作日期",
      operationTime: "操作时间",
      buyAmount: "加仓金额 (¥)",
      sellShares: "减仓份额",
      inTransit: "在途",
      settled: "已确认",
      data: "数据",
      exportData: "导出数据",
      importData: "导入数据",
      exportSuccess: "导出成功！",
      importSuccess: "新增 {added} 条，跳过 {skipped} 条重复",
      importError: "导入失败",
      welcome: "欢迎使用小胡养基",
      newFeatures: "最新功能",
      gotIt: "我知道了",
      transactionHistory: "交易记录",
      noHistory: "暂无交易记录",
      cancelConfirm: "确定要撤销这笔在途交易吗？",
      undo: "撤销",
      all: "全部",
      defaultAccount: "默认",
      addWatchlist: "添加自选",
      anchorPrice: "锚点价格/点数",
      anchorDate: "锚定日期",
      anchorGain: "锚点涨跌",
      type: "类型",
      indexOrSector: "指数/板块",
      currentPrice: "当前价格",
      indexTip: "提示：指数使用腾讯接口，代码如 sh000001, sz399001。",
      fundTip: "提示：基金数据将通过 API 自动刷新。",
      fetching: "获取中...",
      autoFillDate: "根据日期自动获取",
      noDataDate: "该日期暂未找到数据",
      noWatchlistMsg: "暂无自选，点击下方添加",
      currentLabel: "当前",
      anchorLabel: "锚点",
      indexBadge: "指数",
      fundBadge: "基金",
      indexBadgeShort: "指",
      fundBadgeShort: "基",
      searchPlaceholder: "例如：110011 或 易方达",
      indexCodePlaceholder: "sh000001",
      fundCodePlaceholder: "110011",
      indexNamePlaceholder: "上证指数",
      fundNamePlaceholder: "易方达蓝筹",
    }
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to Chinese as per requirements
  const [language, setLanguage] = useState<Language>('zh');

  const t = (path: string, params?: Record<string, string>) => {
    const keys = path.split('.');
    let value: any = dictionary[language];
    for (const key of keys) {
      if (value && value[key]) {
        value = value[key];
      } else {
        return path;
      }
    }

    if (typeof value === 'string' && params) {
      let result = value;
      Object.keys(params).forEach(key => {
        result = result.replace(`{${key}}`, params[key]);
      });
      return result;
    }

    // Fallback for dynamic keys (like custom account names)
    if (value === undefined) {
      return keys[keys.length - 1];
    }

    return value as string;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};