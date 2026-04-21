// 卡片悬浮菜单组件
import { useState, useEffect } from 'react';

export type FloatingMenuOption = {
  label: string;
  icon?: string;
  onClick: () => void;
};

type FloatingMenuProps = {
  x: number;
  y: number;
  options: FloatingMenuOption[];
  onClose: () => void;
};

export function FloatingMenu({ x, y, options, onClose }: FloatingMenuProps) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-floating-menu]')) {
        onClose();
      }
    };

    // 延迟添加监听，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      data-floating-menu
      className="fixed bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-2 px-1 flex flex-col gap-1"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 100000,
        minWidth: '180px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt, idx) => (
        <button
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            opt.onClick();
            onClose();
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all text-left"
        >
          {opt.icon && <span className="text-lg">{opt.icon}</span>}
          <span className="text-white text-sm">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
