import React from 'react';

export default function Background({ live }) {
  return (
    <div className="xb-bg" aria-hidden="true">
      <div className={`xb-amb${live ? ' off' : ''}`} />
      <div className={`xb-amb xb-amb-hot${live ? '' : ' off'}`} />
      {live && <div className="xb-scan" />}
    </div>
  );
}
