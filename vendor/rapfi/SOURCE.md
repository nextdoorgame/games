# Rapfi WebAssembly source and build information

This directory contains a WebAssembly build of Rapfi, licensed under GNU GPL v3.

- Rapfi source: https://github.com/dhbloo/rapfi/tree/3c94c2a976f24a0dd1c5517623e9ab6fffe66bd7
- Rapfi commit: `3c94c2a976f24a0dd1c5517623e9ab6fffe66bd7`
- Network source: https://github.com/dhbloo/rapfi-networks/tree/e32ad77a5364363b3e3a02b3f9e8610ade19ea98
- Network commit: `e32ad77a5364363b3e3a02b3f9e8610ade19ea98`
- Toolchain: Emscripten SDK 6.0.5
- License: `COPYING.txt`

The C++ engine source was not modified. This build uses the official Mix9sVQ freestyle neural network. The build preload manifest contained:

```text
config-example/gomocalc-mix9svq.toml@config.toml
classical/model210901.bin@model210901.bin
mix9svq/mix9svqfreestyle_bsmix.bin.lz4@mix9svqfreestyle_bsmix.bin.lz4
```

Build command, run from a clone with the Networks submodule initialized:

```sh
emcmake cmake -S Rapfi -B Rapfi/build/wasm-single-simd -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DNO_COMMAND_MODULES=ON \
  -DNO_MULTI_THREADING=ON \
  -DUSE_WASM_SIMD=ON \
  -DUSE_WASM_SIMD_RELAXED=OFF
cmake --build Rapfi/build/wasm-single-simd
```

SHA-256 checksums:

```text
abe8eac9439e0d5ea02c34b567c906620b5a8fd43bbd54dcdaf55885b1f37dbe  rapfi-single-simd128.data
5face6f75a76ff9b2481979747b2e759d66523970b6468e446620ac245861af9  rapfi-single-simd128.js
822a523c13425b42fc96d92550a971576adb37a92f3c94322aee88a07f8afacd  rapfi-single-simd128.wasm
```
