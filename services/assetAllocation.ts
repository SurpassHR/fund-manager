/**
 * 账户资产分配服务
 *
 * 管理用户的可用资产（类似余额宝的随时可取用资产），与基金持仓资产共同构成总资产。
 *
 * 核心逻辑：
 * - 未配置时：总资产 = 基金资产（可用资产为 0 且不计入）
 * - 已配置后：总资产 = 基金资产 + 可用资产
 * - 基金涨跌 → 基金资产变动 → 总资产自动跟随变动
 * - 加仓：可用资产减少，总资产不变（从可用转入基金）
 * - 减仓：可用资产增加，总资产不变（从基金转回可用）
 */

const STORAGE_KEY_AVAILABLE = 'assetAllocation.availableAssets';
const STORAGE_KEY_CONFIGURED = 'assetAllocation.configured';

/**
 * 获取可用资产（用户手动填写后的余额宝类资产）
 * @returns 可用资产金额，未配置时返回 0
 */
export function getAvailableAssets(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AVAILABLE);
    if (raw === null) return 0;
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  } catch {
    return 0;
  }
}

/**
 * 设置可用资产
 * 同时标记为已配置状态
 * @param value - 可用资产金额，负数会被钳位为 0
 */
export function setAvailableAssets(value: number): void {
  const clamped = Math.max(0, value);
  localStorage.setItem(STORAGE_KEY_AVAILABLE, String(clamped));
  localStorage.setItem(STORAGE_KEY_CONFIGURED, 'true');
}

/**
 * 是否已配置过资产分配（用户是否手动填写过总资产）
 */
export function isAssetConfigured(): boolean {
  return localStorage.getItem(STORAGE_KEY_CONFIGURED) === 'true';
}

/**
 * 根据基金资产计算总资产
 * - 未配置时：总资产 = 基金资产
 * - 已配置后：总资产 = 基金资产 + 可用资产
 * @param fundAssets - 当前基金持仓总市值
 * @returns 总资产
 */
export function computeTotalAssets(fundAssets: number): number {
  const available = isAssetConfigured() ? getAvailableAssets() : 0;
  return fundAssets + available;
}

/**
 * 通过总资产反推并设置可用资产
 * 用于用户编辑总资产时的计算：available = total - fund
 * @param totalAssets - 用户填写的总资产
 * @param fundAssets - 当前基金持仓总市值
 * @returns 计算得到的可用资产金额（若 total < fund 则返回 0）
 */
export function setTotalAssets(totalAssets: number, fundAssets: number): number {
  const available = Math.max(0, totalAssets - fundAssets);
  setAvailableAssets(available);
  return available;
}

/**
 * 调整可用资产（加仓时扣减可用资产）
 * 用于在创建买入交易时同步调整可用资产
 * @param amount - 加仓金额
 */
export function deductAvailableForBuy(amount: number): void {
  if (amount <= 0) return;
  const current = getAvailableAssets();
  setAvailableAssets(Math.max(0, current - amount));
}

/**
 * 调整可用资产（减仓/赎回时增加可用资产）
 * 用于在创建卖出交易时同步调整可用资产
 * @param amount - 赎回净到账金额
 */
export function addAvailableForSell(amount: number): void {
  if (amount <= 0) return;
  const current = getAvailableAssets();
  setAvailableAssets(current + amount);
}

/**
 * 清空配置（重置为未配置状态）
 * 可用于数据导入覆盖前的清理
 */
export function resetAssetAllocation(): void {
  localStorage.removeItem(STORAGE_KEY_AVAILABLE);
  localStorage.removeItem(STORAGE_KEY_CONFIGURED);
}
