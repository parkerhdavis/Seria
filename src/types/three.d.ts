// Electrobun's bun-side API imports `three` for its WebGPU tag bindings. We
// never use three ourselves and don't want to add @types/three as a dep, so
// fall back to an untyped ambient module declaration — enough to satisfy tsc
// without pulling types we don't need.
declare module "three";
