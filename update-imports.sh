#!/bin/bash

# Find all Svelte files with svelte-lucide imports
FILES=$(find src -name "*.svelte" -exec grep -l "svelte-lucide" {} \;)

# Loop through each file and replace the import
for FILE in $FILES; do
  echo "Updating imports in $FILE"
  sed -i 's/from .svelte-lucide./from '\''lucide-svelte'\''/g' "$FILE"
done

echo "Migration complete. Files updated: $(echo "$FILES" | wc -l)"
