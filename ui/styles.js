// Links Maker — Shared Style Utilities

export const COLORS = {
  border: '#e5e7eb',
  muted: '#6b7280',
  primary: '#111827',
  background: '#fff',
  backgroundMuted: '#f3f4f6',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
};

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
};

export const FONT_FAMILY = 'Poppins, Satoshi, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

export const SHADOWS = {
  sm: '0 8px 24px rgba(0,0,0,0.15)',
  lg: '0 24px 72px rgba(0,0,0,0.28)',
};

export const RADIUS = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  full: '999px',
};

// Common component styles
export const buttonBase = {
  padding: '8px 12px',
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.md,
  background: COLORS.background,
  cursor: 'pointer',
  fontFamily: FONT_FAMILY,
};

export const buttonPrimary = {
  ...buttonBase,
  background: COLORS.primary,
  color: COLORS.background,
  borderColor: COLORS.primary,
};

export const buttonPill = {
  ...buttonBase,
  borderRadius: RADIUS.full,
};

export const card = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: SPACING.md,
  background: COLORS.background,
};

export const cardMuted = {
  ...card,
  background: COLORS.backgroundMuted,
};

// Helper function to apply styles
export function applyStyles(element, styles) {
  Object.assign(element.style, styles);
  return element;
}

// Helper to create styled element
export function createStyledElement(tag, styles = {}, content = null) {
  const el = document.createElement(tag);
  applyStyles(el, styles);
  if (content !== null) {
    if (typeof content === 'string') {
      el.textContent = content;
    } else if (content instanceof Node) {
      el.appendChild(content);
    }
  }
  return el;
}

// Helper to create button
export function createButton(text, options = {}) {
  const { primary = false, pill = false, onClick = null, ...customStyles } = options;
  const btn = createStyledElement('button', {
    ...(primary ? buttonPrimary : pill ? buttonPill : buttonBase),
    ...customStyles,
  }, text);
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

// Helper to create card
export function createCard(content, muted = false) {
  const cardEl = createStyledElement('div', muted ? cardMuted : card);
  if (content) {
    if (typeof content === 'string') {
      cardEl.textContent = content;
    } else if (content instanceof Node) {
      cardEl.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (item instanceof Node) cardEl.appendChild(item);
      });
    }
  }
  return cardEl;
}

