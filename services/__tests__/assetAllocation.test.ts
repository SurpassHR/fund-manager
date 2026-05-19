/**
 * 资产分配服务单元测试
 *
 * 测试 services/assetAllocation.ts 中可用资产管理逻辑
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// 每个测试前清空 localStorage
beforeEach(() => {
  localStorage.clear();
});

// 动态导入以使用真实的 localStorage
const {
  getAvailableAssets,
  setAvailableAssets,
  isAssetConfigured,
  computeTotalAssets,
  setTotalAssets,
  deductAvailableForBuy,
  addAvailableForSell,
  resetAssetAllocation,
} = await import('../assetAllocation');

describe('getAvailableAssets', () => {
  it('未配置时返回 0', () => {
    expect(getAvailableAssets()).toBe(0);
  });

  it('返回已存储的可用资产', () => {
    localStorage.setItem('assetAllocation.availableAssets', '50000');
    localStorage.setItem('assetAllocation.configured', 'true');
    expect(getAvailableAssets()).toBe(50000);
  });

  it('存储的负数被钳位为 0', () => {
    localStorage.setItem('assetAllocation.availableAssets', '-100');
    localStorage.setItem('assetAllocation.configured', 'true');
    expect(getAvailableAssets()).toBe(0);
  });

  it('存储的非数字返回 0', () => {
    localStorage.setItem('assetAllocation.availableAssets', 'abc');
    localStorage.setItem('assetAllocation.configured', 'true');
    expect(getAvailableAssets()).toBe(0);
  });
});

describe('setAvailableAssets', () => {
  it('设置可用资产并标记为已配置', () => {
    setAvailableAssets(30000);
    expect(getAvailableAssets()).toBe(30000);
    expect(isAssetConfigured()).toBe(true);
  });

  it('负数被钳位为 0', () => {
    setAvailableAssets(-500);
    expect(getAvailableAssets()).toBe(0);
    expect(isAssetConfigured()).toBe(true);
  });

  it('设置 0 也标记为已配置', () => {
    setAvailableAssets(0);
    expect(isAssetConfigured()).toBe(true);
  });
});

describe('isAssetConfigured', () => {
  it('初始未配置', () => {
    expect(isAssetConfigured()).toBe(false);
  });

  it('设置可用资产后标记为已配置', () => {
    setAvailableAssets(10000);
    expect(isAssetConfigured()).toBe(true);
  });

  it('仅设置 configured 标记不改变返回值', () => {
    localStorage.setItem('assetAllocation.configured', 'true');
    expect(isAssetConfigured()).toBe(true);
    // 可用资产仍为 0（未单独设置）
    expect(getAvailableAssets()).toBe(0);
  });
});

describe('computeTotalAssets', () => {
  it('未配置时总资产等于基金资产', () => {
    expect(computeTotalAssets(100000)).toBe(100000);
  });

  it('已配置时总资产 = 基金资产 + 可用资产', () => {
    setAvailableAssets(40000);
    expect(computeTotalAssets(100000)).toBe(140000);
  });

  it('基金资产为 0 时仅返回可用资产', () => {
    setAvailableAssets(50000);
    expect(computeTotalAssets(0)).toBe(50000);
  });
});

describe('setTotalAssets', () => {
  it('通过总资产反推可用资产', () => {
    const available = setTotalAssets(150000, 100000);
    expect(available).toBe(50000);
    expect(getAvailableAssets()).toBe(50000);
  });

  it('总资产小于基金资产时可用资产为 0', () => {
    const available = setTotalAssets(50000, 100000);
    expect(available).toBe(0);
    expect(getAvailableAssets()).toBe(0);
  });

  it('总资产等于基金资产时可用资产为 0', () => {
    const available = setTotalAssets(100000, 100000);
    expect(available).toBe(0);
  });
});

describe('deductAvailableForBuy', () => {
  it('加仓时扣减可用资产', () => {
    setAvailableAssets(50000);
    deductAvailableForBuy(20000);
    expect(getAvailableAssets()).toBe(30000);
  });

  it('扣减金额超过可用资产时钳位为 0', () => {
    setAvailableAssets(10000);
    deductAvailableForBuy(20000);
    expect(getAvailableAssets()).toBe(0);
  });

  it('扣减 0 或负数不生效', () => {
    setAvailableAssets(50000);
    deductAvailableForBuy(0);
    expect(getAvailableAssets()).toBe(50000);
    deductAvailableForBuy(-100);
    expect(getAvailableAssets()).toBe(50000);
  });
});

describe('addAvailableForSell', () => {
  it('减仓时增加可用资产', () => {
    setAvailableAssets(30000);
    addAvailableForSell(15000);
    expect(getAvailableAssets()).toBe(45000);
  });

  it('增加 0 或负数不生效', () => {
    setAvailableAssets(30000);
    addAvailableForSell(0);
    expect(getAvailableAssets()).toBe(30000);
    addAvailableForSell(-100);
    expect(getAvailableAssets()).toBe(30000);
  });
});

describe('resetAssetAllocation', () => {
  it('重置后未配置且可用资产为 0', () => {
    setAvailableAssets(50000);
    expect(isAssetConfigured()).toBe(true);
    resetAssetAllocation();
    expect(isAssetConfigured()).toBe(false);
    expect(getAvailableAssets()).toBe(0);
  });
});
