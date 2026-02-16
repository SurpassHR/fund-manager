import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import { MorningstarResponse, MorningstarFund, Fund } from '../types';

interface AddFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  editFund?: Fund; // Optional prop for editing mode
}

export const AddFundModal: React.FC<AddFundModalProps> = ({ isOpen, onClose, editFund }) => {
  const { t } = useTranslation();
  const accounts = useLiveQuery(() => db.accounts.toArray());
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MorningstarFund[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // For Edit Mode, we fake a MorningstarFund object or just skip the search step
  const [selectedFund, setSelectedFund] = useState<MorningstarFund | Fund | null>(null);
  const [currentNav, setCurrentNav] = useState<number>(0);
  
  // Form State
  const [amount, setAmount] = useState(''); // Holding Amount
  const [gain, setGain] = useState('');     // Total Gain
  const [selectedAccount, setSelectedAccount] = useState('Default');

  // Reset or Populate when opening/changing mode
  useEffect(() => {
    if (isOpen) {
        if (editFund) {
            setSelectedFund(editFund);
            setCurrentNav(editFund.currentNav);
            
            // Calculate initial Amount and Gain for display
            const initialAmount = editFund.holdingShares * editFund.currentNav;
            const initialGain = initialAmount - (editFund.holdingShares * editFund.costPrice);
            setAmount(initialAmount.toFixed(2));
            setGain(initialGain.toFixed(2));
            
            setSelectedAccount(editFund.platform);
        } else {
            // Reset for new entry
            setQuery('');
            setResults([]);
            setSelectedFund(null);
            setCurrentNav(0);
            setAmount('');
            setGain('');
            setSelectedAccount('Default');
        }
        setError('');
    }
  }, [isOpen, editFund]);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setError('');
    setResults([]);
    setSelectedFund(null);

    try {
      const response = await fetch(`https://www.morningstar.cn/cn-api/public/v1/fund-cache/${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data: MorningstarResponse = await response.json();
      if (data && data.data) {
        setResults(data.data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch funds. Ensure CORS is handled or try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (fund: MorningstarFund) => {
    setSelectedFund(fund);
    // Simulate getting latest NAV for a new fund so calculations work
    // In a real app, you would fetch the detail API here.
    const mockNav = parseFloat((Math.random() * 2 + 1).toFixed(4));
    setCurrentNav(mockNav);
  };

  const handleSave = async () => {
    if (!selectedFund) return;
    if (currentNav <= 0) {
        alert("Invalid NAV");
        return;
    }
    
    const valAmount = parseFloat(amount);
    const valGain = parseFloat(gain); // Can be negative, NaN if empty

    if (isNaN(valAmount) || valAmount <= 0) {
        alert("Please enter a valid holding amount.");
        return;
    }
    
    // Treat empty gain as 0
    const effectiveGain = isNaN(valGain) ? 0 : valGain;
    
    // 1. Calculate Shares = Amount / NAV
    const calculatedShares = valAmount / currentNav;
    
    // 2. Calculate Cost Price. 
    // Total Cost = Amount - Gain
    // Unit Cost = Total Cost / Shares
    const totalCost = valAmount - effectiveGain;
    const calculatedCostPrice = calculatedShares > 0 ? totalCost / calculatedShares : 0;

    // Check if we are updating existing or adding new
    if (editFund && editFund.id) {
        // UPDATE MODE
        await db.funds.update(editFund.id, {
            holdingShares: calculatedShares,
            costPrice: calculatedCostPrice,
            platform: selectedAccount,
        });
    } else {
        // ADD MODE
        const mockChangePct = (Math.random() * 4 - 2);
        
        // Handle type difference: selectedFund can be MorningstarFund (has symbol) or Fund (has code)
        const code = 'symbol' in selectedFund ? selectedFund.symbol : selectedFund.code;
        const name = 'fundNameArr' in selectedFund ? (selectedFund.fundNameArr || selectedFund.fundName) : selectedFund.name;

        await db.funds.add({
            code: code,
            name: name,
            platform: selectedAccount,
            holdingShares: calculatedShares,
            costPrice: calculatedCostPrice,
            currentNav: currentNav,
            lastUpdate: new Date().toISOString().split('T')[0],
            dayChangePct: mockChangePct,
            dayChangeVal: currentNav * (mockChangePct / 100)
        });
    }

    handleClose();
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setSelectedFund(null);
    setCurrentNav(0);
    setAmount('');
    setGain('');
    setError('');
    onClose();
  };

  const getGainColor = (val: string) => {
      if (!val) return 'text-gray-900';
      if (val === '-') return 'text-stock-green';
      const num = parseFloat(val);
      if (isNaN(num)) return 'text-gray-900';
      if (num > 0) return 'text-stock-red';
      if (num < 0) return 'text-stock-green';
      return 'text-gray-900';
  };

  // Tailwind utility to hide default browser spin buttons (arrows) on number inputs
  const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  // Helper to safely get name and code for display
  const displayInfo = () => {
      if (!selectedFund) return { name: '', code: '' };
      if ('fundNameArr' in selectedFund) {
          return { name: selectedFund.fundNameArr || selectedFund.fundName, code: selectedFund.symbol };
      }
      return { name: selectedFund.name, code: selectedFund.code };
  };

  const info = displayInfo();

  return (
    <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <h3 className="font-bold text-gray-800">
                {editFund ? t('common.editDetails') : (selectedFund ? t('common.fillDetails') : t('common.addFund'))}
            </h3>
            <button onClick={handleClose}><Icons.Plus className="transform rotate-45 text-gray-400" /></button>
        </div>

        {/* Content */}
        {!selectedFund ? (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 space-y-3 shrink-0">
                    <div className="relative">
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={t('common.searchFund')}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
                        />
                        <Icons.Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <button 
                            onClick={handleSearch}
                            className="absolute right-2 top-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                            Search
                        </button>
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                <div className="flex-1 overflow-y-auto p-4 pt-0">
                    {loading ? (
                        <div className="text-center text-gray-400 py-8">{t('common.searching')}</div>
                    ) : results.length > 0 ? (
                        <div className="space-y-2">
                            {results.map((fund) => (
                                <div 
                                    key={fund.fundClassId}
                                    onClick={() => handleSelect(fund)}
                                    className="p-3 border border-gray-100 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-gray-800 text-sm">{fund.fundNameArr}</div>
                                            <div className="text-xs text-gray-500 mt-1">{fund.symbol} · {fund.fundType}</div>
                                        </div>
                                        <Icons.Plus className="text-blue-500" size={16}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                             <Icons.Search size={48} className="text-gray-200 mb-2" strokeWidth={1} />
                             <p>{t('common.searchTip')}</p>
                         </div>
                    )}
                </div>
            </div>
        ) : (
            <div className="p-6 space-y-4 overflow-y-auto">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-blue-900 text-sm">{info.name}</div>
                        <div className="text-xs text-blue-600 mt-1">{info.code}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-blue-400">Current NAV</div>
                        <div className="font-mono font-bold text-blue-800">{currentNav.toFixed(4)}</div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.account')}</label>
                    <select 
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 text-gray-900"
                    >
                        {accounts?.map(acc => (
                            <option key={acc.id} value={acc.name}>
                                {t(`filters.${acc.name}`) === `filters.${acc.name}` ? acc.name : t(`filters.${acc.name}`)}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="grid grid-cols-2 gap-4 mb-1">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.holdingAmount')} (¥)</label>
                            <input 
                                type="number" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className={`w-full p-2 border border-gray-200 rounded-lg bg-white text-gray-900 font-bold font-mono focus:border-blue-500 outline-none ${noSpinnerClass}`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.totalGain')} (¥)</label>
                            <input 
                                type="number" 
                                value={gain}
                                onChange={(e) => setGain(e.target.value)}
                                placeholder="0.00"
                                className={`w-full p-2 border border-gray-200 rounded-lg bg-white font-bold font-mono focus:border-blue-500 outline-none ${noSpinnerClass} ${getGainColor(gain)}`}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => {
                            if (editFund) onClose(); // Just close if editing
                            else setSelectedFund(null); // Go back to search if adding
                        }}
                        className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
                    >
                        {t('common.confirm')}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};