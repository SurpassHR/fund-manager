import React, { createContext, useState, useContext, ReactNode } from 'react';

type Language = 'en' | 'zh';

const dictionary = {
  en: {
    common: {
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
      more: "More"
    },
    filters: {
      All: "All",
      Default: "Default",
      Alipay: "Alipay",
      Tencent: "Tencent",
      Bank: "Bank",
      Others: "Others"
    }
  },
  zh: {
    common: {
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
      more: "更多"
    },
    filters: {
      All: "全部",
      Default: "默认",
      Alipay: "支付宝",
      Tencent: "腾讯理财",
      Bank: "银行系",
      Others: "其他"
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