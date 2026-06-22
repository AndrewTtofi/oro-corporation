// Ambient declarations for non-code side-effect imports.
// TypeScript 6 (TS2882) requires a declaration for side-effect imports such as
// `import "./globals.css"`. The more-specific `*.module.css` typing that Next
// provides still wins for CSS modules.
declare module "*.css";
