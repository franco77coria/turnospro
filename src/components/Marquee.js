import React from 'react';

export default function Marquee({ items = [] }) {
  // Duplicate items to ensure smooth continuous scrolling
  const duplicatedItems = [...items, ...items, ...items, ...items];

  return (
    <div className="gu-marquee">
      <div className="gu-marquee-track">
        {duplicatedItems.map((item, idx) => (
          <span key={idx} className="gu-marquee-item">
            {item} <span className="gu-marquee-star">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
