#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  deploy.sh — The African Oracle deploy script
#
#  WHAT THIS DOES:
#  1. Generates a version stamp from today's date + time
#  2. Updates ?v= query strings on ALL CSS/JS links in ALL HTML files
#  3. Commits and pushes to GitHub
#  4. Every user's browser sees new filenames → fetches fresh JS/CSS
#
#  HOW TO USE:
#  Instead of running "git push" manually, run this script:
#    bash deploy.sh "describe what you changed"
#
#  SETUP (one time only):
#    chmod +x deploy.sh
#
#  EXAMPLE:
#    bash deploy.sh "fix NSE broker links"
#    bash deploy.sh "update Safaricom EPS after results"
#    bash deploy.sh "add new JSE companies"
# ═══════════════════════════════════════════════════════════════

# ── Get commit message from argument ─────────────────────────
COMMIT_MSG="${1:-update}"

# ── Generate version stamp: YYYYMMDDHHMI ─────────────────────
VERSION=$(date +"%Y%m%d%H%M")

echo "🚀 The African Oracle — Deploy v$VERSION"
echo "📝 Commit: $COMMIT_MSG"
echo ""

# ── Stamp version into every HTML file ───────────────────────
# Replaces any existing ?v=XXXXXXXXXX with the new version
# Works on: style.css, stock.css, learn.css, static-page.css, app.js, stock.js

HTML_FILES=(
  "index.html"
  "stock.html"
  "learn.html"
  "about.html"
  "contact.html"
  "privacy.html"
)

echo "📌 Stamping version $VERSION into HTML files..."

for file in "${HTML_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Replace ?v=anything with ?v=VERSION on css and js links
    sed -i.bak "s/\.css?v=[0-9]*/\.css?v=$VERSION/g" "$file"
    sed -i.bak "s/\.js?v=[0-9]*/\.js?v=$VERSION/g" "$file"

    # First time: files won't have ?v= yet, add it
    # CSS links without version
    sed -i.bak "s/href=\"css\/style\.css\"/href=\"css\/style.css?v=$VERSION\"/g" "$file"
    sed -i.bak "s/href=\"css\/stock\.css\"/href=\"css\/stock.css?v=$VERSION\"/g" "$file"
    sed -i.bak "s/href=\"css\/learn\.css\"/href=\"css\/learn.css?v=$VERSION\"/g" "$file"
    sed -i.bak "s/href=\"css\/static-page\.css\"/href=\"css\/static-page.css?v=$VERSION\"/g" "$file"

    # JS links without version
    sed -i.bak "s/src=\"js\/app\.js\"/src=\"js\/app.js?v=$VERSION\"/g" "$file"
    sed -i.bak "s/src=\"js\/stock\.js\"/src=\"js\/stock.js?v=$VERSION\"/g" "$file"

    # Clean up .bak files (macOS sed creates them)
    rm -f "$file.bak"

    echo "  ✓ $file"
  else
    echo "  ⚠ $file not found — skipping"
  fi
done

echo ""
echo "🔁 Committing to GitHub..."

# ── Git add, commit, push ─────────────────────────────────────
git add .
git commit -m "$COMMIT_MSG [v$VERSION]"
git push

echo ""
echo "✅ Done! Site will update at africanoracle.info within 2 minutes."
echo "   All users will get fresh JS/CSS on their next page load."
echo "   Version: $VERSION"