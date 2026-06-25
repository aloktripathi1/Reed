import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // pdf-parse depends on pdfjs-dist which spawns a worker and looks for its
  // own file via __filename-relative paths. Bundling breaks those paths.
  // Marking both packages as external keeps them in node_modules at runtime.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/extract-pdf': [
      './node_modules/pdf-parse/**/*',
      './node_modules/pdfjs-dist/**/*',
      './node_modules/@napi-rs/canvas/**/*',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
    ],
  },
}

export default nextConfig
