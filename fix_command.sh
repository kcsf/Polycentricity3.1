#!/bin/bash
# Direct replacement with awk
awk '{gsub(/export function subscribeToGame Wedges/, "export function subscribeToGameWedges"); print}' src/lib/services/gameService.ts > temp_file.ts
mv temp_file.ts src/lib/services/gameService.ts
echo "Fix applied with awk"