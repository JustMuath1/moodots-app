import React from 'react';

export default function Skeleton({ w, h, className = '', style }) {
  return <div className={`xb-skel ${className}`} style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}

const ROW_WIDTHS = ['92%', '70%', '84%', '64%', '88%', '58%'];

export function SkeletonRows({ count = 6, className = 'skel-row' }) {
  return (
    <div className="skel-rows" role="status" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={className} w={ROW_WIDTHS[i % ROW_WIDTHS.length]} />
      ))}
    </div>
  );
}
