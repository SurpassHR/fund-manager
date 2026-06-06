import { beforeEach, describe, expect, it, vi } from 'vitest';

import { groupFundsByInstitution, resolveInstitutions } from '../fundInstitution';

const mocked = vi.hoisted(() => ({
  fetchFundCommonData: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchFundCommonData: mocked.fetchFundCommonData,
}));

describe('resolveInstitutions', () => {
  beforeEach(() => {
    mocked.fetchFundCommonData.mockClear();
  });

  it('批量解析基金代码到机构名', async () => {
    mocked.fetchFundCommonData.mockImplementation((code: string) => {
      const data: Record<string, string> = {
        '000001': '永赢基金管理有限公司',
        '000002': '博时基金管理有限公司',
        '000003': '华夏基金管理有限公司',
      };
      if (data[code]) {
        return { data: { companyName: data[code] } };
      }
      return { data: {} };
    });

    const map = await resolveInstitutions(['000001', '000002', '000003']);
    expect(map.get('000001')).toBe('永赢基金');
    expect(map.get('000002')).toBe('博时基金');
    expect(map.get('000003')).toBe('华夏基金');
  });

  it('API 返回空时机构名为空字符串', async () => {
    mocked.fetchFundCommonData.mockResolvedValue({ data: {} });
    const map = await resolveInstitutions(['000001']);
    expect(map.get('000001')).toBe('');
  });

  it('API 失败时返回空字符串', async () => {
    mocked.fetchFundCommonData.mockRejectedValue(new Error('Network error'));
    const map = await resolveInstitutions(['000001']);
    expect(map.get('000001')).toBe('');
  });

  it('去重后只请求一次每个代码', async () => {
    mocked.fetchFundCommonData.mockResolvedValue({
      data: { companyName: '南方基金管理股份有限公司' },
    });
    await resolveInstitutions(['000001', '000001', '000001']);
    expect(mocked.fetchFundCommonData).toHaveBeenCalledTimes(1);
  });
});

describe('groupFundsByInstitution', () => {
  it('按 code→机构名 映射分组', () => {
    const items = [
      { code: '001', name: '基金A' },
      { code: '002', name: '基金B' },
      { code: '003', name: '基金C' },
    ];
    const map = new Map([
      ['001', '永赢基金'],
      ['002', '华夏基金'],
      ['003', '永赢基金'],
    ]);
    const groups = groupFundsByInstitution(items, map, (item) => item.code);
    expect(groups.get('永赢基金')).toEqual([
      { code: '001', name: '基金A' },
      { code: '003', name: '基金C' },
    ]);
    expect(groups.get('华夏基金')).toEqual([{ code: '002', name: '基金B' }]);
  });

  it('未在映射中找到的代码归入"其他"组', () => {
    const items = [{ code: '001', name: '基金A' }];
    const map = new Map<string, string>();
    const groups = groupFundsByInstitution(items, map, (item) => item.code);
    expect(groups.get('其他')).toEqual([{ code: '001', name: '基金A' }]);
  });

  it('映射中值为空字符串的归入"其他"组', () => {
    const items = [{ code: '001', name: '基金A' }];
    const map = new Map([['001', '']]);
    const groups = groupFundsByInstitution(items, map, (item) => item.code);
    expect(groups.get('其他')).toEqual([{ code: '001', name: '基金A' }]);
  });

  it('"其他"组始终排在最后', () => {
    const items = [
      { code: '001', name: '指数A' },
      { code: '002', name: '基金B' },
    ];
    const map = new Map([['002', '华夏基金']]);
    const groups = groupFundsByInstitution(items, map, (item) => item.code);
    const keys = [...groups.keys()];
    expect(keys[keys.length - 1]).toBe('其他');
  });

  it('多个机构按字母序排列', () => {
    const items = [
      { code: '001', name: '基金A' },
      { code: '002', name: '基金B' },
      { code: '003', name: '基金C' },
    ];
    const map = new Map([
      ['001', '招商基金'],
      ['002', '博时基金'],
      ['003', '永赢基金'],
    ]);
    const groups = groupFundsByInstitution(items, map, (item) => item.code);
    const keys = [...groups.keys()];
    expect(keys).toEqual(['博时基金', '永赢基金', '招商基金']);
  });

  it('空数组返回空 Map', () => {
    const groups = groupFundsByInstitution([], new Map(), (item: { code: string }) => item.code);
    expect(groups.size).toBe(0);
  });
});
