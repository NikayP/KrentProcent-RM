import React from 'react';

export const BrandLogo: React.FC = () => {
  return (
    <div className="flex items-center gap-2.5 select-none min-w-0">
      <img
        src="/favicon.svg"
        alt="KrentProcent logo"
        width={36}
        height={36}
        className="w-9 h-9 shrink-0"
      />
      <h1 className="font-sans text-xl sm:text-2xl font-extrabold tracking-[-0.03em] leading-none select-none whitespace-nowrap">
        <span className="text-[#18181B] dark:text-[#FFFFFF]">Krent</span><span className="text-[#F21B2D]">Procent</span>
      </h1>
    </div>
  );
};
