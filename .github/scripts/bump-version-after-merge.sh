#!/usr/bin/env bash
set -euo pipefail

version_file="${VERSION_FILE:-VERSION}"
changelog_file="${CHANGELOG_FILE:-CHANGELOG.md}"
pr_title="${PR_TITLE:?PR_TITLE is required}"
pr_number="${PR_NUMBER:?PR_NUMBER is required}"
release_date="${RELEASE_DATE:-$(date -u +%F)}"

if [[ ! "$pr_number" =~ ^[0-9]+$ ]]; then
    echo "PR_NUMBER must be numeric: $pr_number" >&2
    exit 2
fi

current_version="$(tr -d '[:space:]' < "$version_file")"
if [[ ! "$current_version" =~ ^(v?)([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Unsupported VERSION format: $current_version" >&2
    exit 2
fi

if grep -Fq "(#${pr_number})" "$changelog_file"; then
    echo "PR #${pr_number} is already recorded in ${changelog_file}; skipping."
    exit 0
fi

prefix="${BASH_REMATCH[1]}"
major="$((10#${BASH_REMATCH[2]}))"
minor="$((10#${BASH_REMATCH[3]}))"
patch="$((10#${BASH_REMATCH[4]} + 1))"
next_version="${prefix}${major}.${minor}.${patch}"

if grep -Fq "## [${next_version}]" "$changelog_file"; then
    echo "CHANGELOG already contains ${next_version} without PR #${pr_number}." >&2
    exit 2
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

export PR_TITLE="$pr_title"
export PR_NUMBER="$pr_number"
awk -v heading="## [${next_version}] - ${release_date}" '
    !inserted && /^## \[/ {
        print heading
        print ""
        print "### Changed"
        print ""
        print "- " ENVIRON["PR_TITLE"] " (#" ENVIRON["PR_NUMBER"] ")"
        print ""
        inserted = 1
    }
    { print }
    END { if (!inserted) exit 1 }
' "$changelog_file" > "$tmp_file"

cat "$tmp_file" > "$changelog_file"
printf '%s\n' "$next_version" > "$version_file"

echo "Bumped VERSION from ${current_version} to ${next_version}."
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'version=%s\n' "$next_version" >> "$GITHUB_OUTPUT"
fi
