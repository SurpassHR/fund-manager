import React from 'react';
import {
  Home,
  LineChart,
  Newspaper,
  User,
  Layers,
  Search,
  MessageCircle,
  Eye,
  EyeOff,
  Settings,
  Bell,
  LayoutGrid,
  Menu,
  ScanLine,
  Plus,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Copy,
  Edit,
  Check,
  X,
  Trash2,
  Sun,
  Moon
} from 'lucide-react';

export const Icons = {
  Home,
  Chart: LineChart,
  News: Newspaper,
  User,
  Holdings: Layers,
  Search,
  Chat: MessageCircle,
  Eye,
  EyeOff,
  Settings,
  Bell,
  Grid: LayoutGrid,
  Menu,
  Scan: ScanLine,
  Plus,
  ArrowUp,
  ArrowDown,
  Refresh: RefreshCw,
  Copy,
  Edit,
  Check,
  X,
  Trash: Trash2,
  Sun,
  Moon,
  Member: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
    </svg>
  )
};