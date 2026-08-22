#!/bin/bash
set -e

echo "🔨 Building MetaHuman Engine for GitHub Pages..."

# 注意: build:pages 已在 package.json 中调用了 tsc && vite build --mode pages
# 此脚本作为 post-build 步骤执行

# 注入构建时间戳
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "📅 Build timestamp: $BUILD_TIMESTAMP"

# 添加 .nojekyll 文件（禁用 Jekyll 处理）
touch dist/.nojekyll

# 生成简单的 sitemap.xml
echo "🗺️  Generating sitemap..."
cat > dist/sitemap.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://vibe-knight.github.io/meta-human/</loc>
    <lastmod>${BUILD_TIMESTAMP}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
EOF

echo "✅ Build complete! Pages ready at dist/"
echo "📊 Bundle size: $(du -sh dist/ | cut -f1)"
