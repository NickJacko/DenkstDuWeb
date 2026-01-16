module.exports = {
  // ===================================
  // CONTENT FILES
  // Alle Dateien die CSS-Klassen verwenden
  // ===================================
  content: [
    './index.html',
    './category-selection.html',
    './difficulty-selection.html',
    './gameplay.html',
    './player-setup.html',
    './join-game.html',
    './multiplayer-lobby.html',
    './multiplayer-category-selection.html',
    './multiplayer-difficulty-selection.html',
    './multiplayer-gameplay.html',
    './multiplayer-results.html',
    './imprint.html',
    './privacy.html',
    './404.html',
    './assets/js/**/*.js'
  ],

  // ===================================
  // CSS FILES
  // ===================================
  css: ['./assets/css/styles.css'],

  // ===================================
  // OUTPUT
  // ===================================
  output: './assets/css/styles.min.css',

  // ===================================
  // SAFELIST
  // Klassen die NICHT gelöscht werden dürfen
  // ===================================
  safelist: {
    // Standard-Klassen (exakt matching)
    standard: [
      // Utility Classes
      'hidden',
      'visible',
      'invisible',
      'fade-in',
      'fade-out',
      'sr-only',
      'cursor-pointer',
      'cursor-not-allowed',
      'pointer-events-none',
      'pointer-events-auto',

      // Dark Mode
      'dark-mode',

      // Modal States
      'modal-open',
      'modal-open-blur',

      // Loading States
      'loading',
      'loading-spinner',

      // Notification States
      'notification',
      'error',
      'success',
      'warning',
      'info',

      // Button States
      'active',
      'disabled',

      // Game States
      'correct',
      'incorrect',
      'winner',
      'host-badge',
      'active-player',

      // Form States
      'invalid',
      'valid',
      'required',

      // Layout
      'container',
      'legal-content',
      'background-particles'
    ],

    // Deep-Matching (Pattern-basiert)
    deep: [
      // Display Utilities
      /^d-/,           // d-none, d-block, d-flex, etc.
      /^flex-/,        // flex-column, flex-row
      /^align-/,       // align-center, align-start, align-end
      /^justify-/,     // justify-center, justify-between

      // Spacing Utilities
      /^m[tblr]?-/,    // margin: mt-sm, mb-lg, m-md
      /^p[tblr]?-/,    // padding: pt-sm, pb-lg, p-md

      // Text Utilities
      /^text-/,        // text-center, text-left, text-primary
      /^font-/,        // font-bold, font-medium

      // Background Utilities
      /^bg-/,          // bg-primary, bg-secondary

      // Button Variants
      /^btn-/,         // btn-primary, btn-secondary, btn-outline, etc.

      // Glass Morphism
      /^glass-/,       // glass-card, glass-bg, etc.

      // Components
      /^category-/,    // category-card, category-grid, etc.
      /^difficulty-/,  // difficulty-card, difficulty-grid, etc.
      /^player-/,      // player-card, player-list, etc.
      /^modal-/,       // modal-overlay, modal-content, etc.
      /^notification/, // notification, notification-error, etc.

      // Animations
      /^animate-/,     // animate-fade-in, animate-slide-in, etc.
      /^pulse/,        // pulse, pulse-slow
      /^shake/,        // shake
      /^bounce/,       // bounce
      /^spin/,         // spin, spin-slow

      // Grid
      /^col-/,         // col-1, col-2, etc.
      /^row-/,         // row-gap, etc.
      /^grid-/,        // grid-cols, etc.

      // Responsive
      /^sm:/,          // Tailwind-style responsive (falls verwendet)
      /^md:/,
      /^lg:/,
      /^xl:/
    ],

    // Greedy-Matching (gesamter Selektor)
    greedy: [
      // Pseudo-Klassen
      /:hover/,
      /:focus/,
      /:active/,
      /:disabled/,
      /:checked/,
      /:invalid/,
      /:valid/,
      /:placeholder/,
      /:focus-visible/,
      /:focus-within/,

      // Pseudo-Elemente
      /::before/,
      /::after/,
      /::placeholder/,
      /::selection/,

      // Dark Mode Selektoren
      /dark-mode/,

      // Media Queries (werden automatisch behalten)
      /@media/,
      /@keyframes/,

      // Responsive Breakpoints
      /responsive/,

      // Accessibility
      /sr-only/,
      /skip-link/,

      // Print
      /@page/
    ]
  },

  // ===================================
  // OPTIONS
  // ===================================

  // Keyframes behalten
  keyframes: true,

  // CSS-Variablen behalten
  variables: true,

  // Font-face Definitionen behalten
  fontFace: true,

  // Ungenutzte @font-face entfernen
  rejectedCss: false,

  // Standard-CSS-Eigenschaften behalten
  defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],

  // ===================================
  // DYNAMIC CLASS PATTERNS
  // JavaScript generierte Klassen
  // ===================================
  dynamicAttributes: [
    'class',
    'className',
    'classList'
  ],

  // ===================================
  // BLOCKLIST
  // Klassen die definitiv gelöscht werden sollen
  // ===================================
  blocklist: [
    // Beispiel: Alte/veraltete Klassen
    // 'old-button',
    // 'deprecated-class'
  ]
};

