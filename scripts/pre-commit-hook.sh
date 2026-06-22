#!/bin/bash
# Pre-commit hook for Dombi Task Master
# This hook runs quality checks before allowing commits

set -e

echo "🔍 Running pre-commit checks..."

# Check for Python syntax errors
echo "  Checking Python syntax..."
find . -name "*.py" -not -path "./venv/*" -not -path "./.venv/*" | while read file; do
    python3 -m py_compile "$file" 2>/dev/null || {
        echo "❌ Syntax error in $file"
        exit 1
    }
done

# Check for TypeScript/JavaScript syntax
if command -v npx &> /dev/null; then
    echo "  Checking TypeScript/JavaScript..."
    if [ -f "tsconfig.json" ]; then
        npx tsc --noEmit 2>/dev/null || {
            echo "❌ TypeScript errors found"
            exit 1
        }
    fi
fi

# Run Python linter if available
if command -v ruff &> /dev/null; then
    echo "  Running ruff..."
    ruff check . 2>/dev/null || {
        echo "❌ Linting errors found"
        exit 1
    }
fi

# Run type checker if available
if command -v mypy &> /dev/null; then
    echo "  Running mypy..."
    mypy . 2>/dev/null || {
        echo "❌ Type errors found"
        exit 1
    }
fi

# Check for TODO/FIXME comments (warning only)
echo "  Checking for TODO/FIXME comments..."
if grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.py" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "venv\|node_modules\|.git"; then
    echo "⚠️  Found TODO/FIXME comments (not blocking commit)"
fi

echo "✅ Pre-commit checks passed!"
exit 0
