import React from 'react';

function Icon({ d, size = 20, stroke = 2, fill = 'none', children, ...rest }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children || <path d={d} />}
    </svg>
  );
}

export const Icons = {
  Scissors:  (p) => <Icon size={p?.size} {...p}><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></Icon>,
  Sparkles:  (p) => <Icon size={p?.size} {...p}><path d="M9.94 14.34 12 22l2.06-7.66L22 12.5l-7.94-1.84L12 3 9.94 10.66 2 12.5z"/><path d="M19 4v4"/><path d="M21 6h-4"/></Icon>,
  Hand:      (p) => <Icon size={p?.size} {...p}><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-1.3-5.4-2.4l-3.7-5.3a2 2 0 0 1 .7-3 1.8 1.8 0 0 1 2.4.7l1.9 2.6"/></Icon>,
  Eye:       (p) => <Icon size={p?.size} {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>,
  Spa:       (p) => <Icon size={p?.size} {...p}><path d="M12 2C9 8 9 12 12 16c3-4 3-8 0-14z"/><path d="M2 12c6 3 10 3 14 0M22 12c-6 3-10 3-14 0"/></Icon>,
  Stethoscope: (p) => <Icon size={p?.size} {...p}><path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3h6v6a4 4 0 0 1-8 0V3z"/><path d="M8 11v3a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></Icon>,
  Paw:       (p) => <Icon size={p?.size} {...p}><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="7" cy="14" r="2"/><path d="M11 21a4 4 0 0 1-4-4c0-2 2-3 4-3s4 1 4 3a4 4 0 0 1-4 4z"/></Icon>,
  Wrench:    (p) => <Icon size={p?.size} {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></Icon>,
  Search:    (p) => <Icon size={p?.size} {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Icon>,
  MapPin:    (p) => <Icon size={p?.size} {...p}><path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></Icon>,
  Star:      (p) => <Icon size={p?.size} {...p}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z" fill={p?.solid ? 'currentColor' : 'none'}/></Icon>,
  Clock:     (p) => <Icon size={p?.size} {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></Icon>,
  Calendar:  (p) => <Icon size={p?.size} {...p}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></Icon>,
  ArrowRight:(p) => <Icon size={p?.size} {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Icon>,
  ArrowLeft: (p) => <Icon size={p?.size} {...p}><path d="M19 12H5M11 19l-7-7 7-7"/></Icon>,
  Check:     (p) => <Icon size={p?.size} stroke={p?.stroke || 3} {...p}><path d="M20 6 9 17l-5-5"/></Icon>,
  Phone:     (p) => <Icon size={p?.size} {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></Icon>,
  User:      (p) => <Icon size={p?.size} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>,
  Mail:      (p) => <Icon size={p?.size} {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></Icon>,
  Heart:     (p) => <Icon size={p?.size} {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill={p?.solid ? 'currentColor' : 'none'}/></Icon>,
  Bell:      (p) => <Icon size={p?.size} {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></Icon>,
  Wallet:    (p) => <Icon size={p?.size} {...p}><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M14 12a2 2 0 1 0 0 4h6v-4z"/></Icon>,
  Palette:   (p) => <Icon size={p?.size} {...p}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 1 0 0 20 4 4 0 0 1 0-8h2a4 4 0 0 0 4-4 8 8 0 0 0-6-8z"/></Icon>,
  Users:     (p) => <Icon size={p?.size} {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>,
  Zap:       (p) => <Icon size={p?.size} {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9z" fill={p?.solid ? 'currentColor' : 'none'}/></Icon>,
  Shield:    (p) => <Icon size={p?.size} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>,
  Plus:      (p) => <Icon size={p?.size} {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  X:         (p) => <Icon size={p?.size} {...p}><path d="M18 6 6 18M6 6l12 12"/></Icon>,
  Filter:    (p) => <Icon size={p?.size} {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></Icon>,
  Instagram: (p) => <Icon size={p?.size} {...p}><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/></Icon>,
  ChevronRight: (p) => <Icon size={p?.size} {...p}><path d="m9 18 6-6-6-6"/></Icon>,
  LogOut:    (p) => <Icon size={p?.size} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>,
  BarChart:  (p) => <Icon size={p?.size} {...p}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></Icon>,
  Tag:       (p) => <Icon size={p?.size} {...p}><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></Icon>,
};

export default Icons;
