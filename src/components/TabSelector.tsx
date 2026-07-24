"use client";

import { SheetTab } from "@/lib/types";

interface TabSelectorProps {
  tabs: SheetTab[];
  activeTab: string;
  onTabChange: (tabName: string) => void;
  loading?: boolean;
}

export default function TabSelector({
  tabs,
  activeTab,
  onTabChange,
  loading,
}: TabSelectorProps) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-9 w-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.name)}
          className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
            activeTab === tab.name
              ? "bg-primary-600 text-white shadow-md shadow-primary-200"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
          }`}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}
