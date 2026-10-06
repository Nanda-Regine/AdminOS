/// <reference types="nativewind/types" />

// global.css is consumed by NativeWind's Metro transformer; TypeScript 6
// requires a declaration for side-effect style imports.
declare module '*.css'
