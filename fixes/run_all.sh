#!/bin/bash
# Runs baseline, each proposed fix alone, and all fixes together.
cd "$(dirname "$0")"
SRC=${1:-../../cleaned_review_src}
APP=${2:-../../icleaned_review_src}
rm -rf results; mkdir -p results
for c in baseline F01 F02 F03 F04 F05 F06 F07 F08 F09 ALL; do
  Rscript run_one.R "$c" "$SRC" results "$APP" > "results/$c.log" 2>&1
  tail -4 "results/$c.log" | tr '\n' ' '; echo
done
