import { fetchFundCommonData } from './api';

// 标准化公司名称：去除常见法律实体后缀，简洁展示
function normalizeCompanyName(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return '';

  return cleaned
    .replace(/基金管理股份有限公司$/, '基金')
    .replace(/基金管理有限责任公司$/, '基金')
    .replace(/基金管理有限公司$/, '基金')
    .replace(/资产管理有限公司$/, '资管')
    .replace(/资产管理$/, '资管')
    .replace(/股份有限公司$/, '')
    .replace(/有限责任公司$/, '')
    .replace(/有限公司$/, '');
}

// 按基金代码获取管理机构名称
export async function fetchFundInstitution(fundCode: string): Promise<string> {
  try {
    const data = await fetchFundCommonData(fundCode);
    if (data?.data?.companyName) {
      return normalizeCompanyName(data.data.companyName);
    }
  } catch {
    // 静默降级
  }
  return '';
}

// 批量解析基金代码 → 机构名称映射
export async function resolveInstitutions(codes: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniqueCodes = [...new Set(codes)];

  const results = await Promise.allSettled(uniqueCodes.map((code) => fetchFundInstitution(code)));

  let i = 0;
  for (const code of uniqueCodes) {
    const result = results[i++];
    map.set(code, result.status === 'fulfilled' ? result.value : '');
  }

  return map;
}

// 按机构名称分组，institutionMap 为 code→机构名 映射，getCode 从 item 中提取基金代码
export function groupFundsByInstitution<T>(
  items: T[],
  institutionMap: Map<string, string>,
  getCode: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const institution = institutionMap.get(getCode(item)) || '其他';
    const group = grouped.get(institution);
    if (group) {
      group.push(item);
    } else {
      grouped.set(institution, [item]);
    }
  }

  // 按机构名字母排序，"其他"始终置底
  const sorted = new Map<string, T[]>();
  const keys = [...grouped.keys()].sort((a, b) => {
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    return a.localeCompare(b, 'zh');
  });

  for (const key of keys) {
    sorted.set(key, grouped.get(key)!);
  }

  return sorted;
}
