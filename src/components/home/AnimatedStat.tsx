import React from 'react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

interface AnimatedStatProps {
  value: number;
  suffix?: string;
  label: string;
  icon: React.ReactNode;
}

export const AnimatedStat: React.FC<AnimatedStatProps> = ({ value, suffix = "", label, icon }) => {
  const [ref, count, inView] = useAnimatedNumber<HTMLDivElement>(value);

  return (
    <div ref={ref} className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
      <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center text-gray-900">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold">
          {inView ? count.toLocaleString() : 0}
          {suffix}
        </p>
        <p className="text-xs text-gray-800/50">{label}</p>
      </div>
    </div>
  );
};

export default AnimatedStat;
