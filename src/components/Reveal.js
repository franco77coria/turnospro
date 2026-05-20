'use client';

import React, { useEffect } from 'react';

// ----- Reveal hook -----
export function useReveal(threshold = 0.12) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.in)');
    if (typeof window === 'undefined') return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold, rootMargin: '0px 0px -10% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ----- Reveal wrapper -----
export default function Reveal({ children, delay = 0, as: As = 'div', className = '', style = {}, ...rest }) {
  return (
    <As
      className={`reveal ${className}`}
      style={{ ...style, '--reveal-delay': `${delay}ms` }}
      {...rest}
    >
      {children}
    </As>
  );
}
