# Rapfi WebAssembly source and build information

This directory contains a WebAssembly build of Rapfi, licensed under GNU GPL v3.

- Rapfi source: https://github.com/dhbloo/rapfi/tree/3c94c2a976f24a0dd1c5517623e9ab6fffe66bd7
- Rapfi commit: `3c94c2a976f24a0dd1c5517623e9ab6fffe66bd7`
- Network source: https://github.com/dhbloo/rapfi-networks/tree/e32ad77a5364363b3e3a02b3f9e8610ade19ea98
- Network commit: `e32ad77a5364363b3e3a02b3f9e8610ade19ea98`
- Toolchain: Emscripten SDK 6.0.5
- License: `COPYING.txt`

The C++ engine source was not modified. To keep the web download small, the build preload manifest contained only:

```text
config-example/gomocalc-classical220723.toml@config.toml
classical/model220723.bin@model220723.bin
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
b7c5fc9019b34ad4211e1a6d41264f372500d245f8e5fc358411d51ed3948572  rapfi-single-simd128.data
bdc672297478341b7720d317718b4ccd5b67fb16d200392073f25a03482e2fce  rapfi-single-simd128.js
822a523c13425b42fc96d92550a971576adb37a92f3c94322aee88a07f8afacd  rapfi-single-simd128.wasm
```
