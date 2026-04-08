## Summary

Improve UI consistency and mobile experience across the application.

### Changes

**Design System (`src/index.css`)**
- Add unified design tokens: radius (xs to full), shadow (xs to 2xl), spacing, transitions
- Add mobile accessibility utilities: `touch-target` (44px), `touch-target-lg` (48px)
- Add safe-area helpers for iOS notch/home indicator
- Optimize inputs (16px font to prevent iOS zoom)

**Components**
- `BottomNav`: Improved touch targets, icon sizing, spacing
- `Navbar`: Mobile menu uses rounded-xl/-lg, add touch feedback

**Pages**
- `Home`, `Forum`, `Wiki`, `Music`: Normalized card border-radius (rounded-xl mobile, rounded-2xl desktop), adjusted responsive padding

### Verification
- `npm run lint` - TypeScript check passed
- `npm run build` - Production build succeeded