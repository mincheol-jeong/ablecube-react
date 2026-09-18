#!/usr/bin/env bash
# Build an x86_64 RPM containing the pre-built Cockpit plugin assets.
set -euo pipefail

readonly PACKAGE_NAME="ablestack-cockpit-plugin"
readonly SPEC_FILE="packaging/ablestack-react.spec"
readonly PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly VERSION_FILE="$PROJECT_ROOT/VERSION"
readonly CHANGELOG_FILE="$PROJECT_ROOT/CHANGELOG.md"

cd -- "$PROJECT_ROOT"

usage() {
    cat <<'EOF'
Usage: ./rpm-builder.sh [--version VERSION] [--release RELEASE] [--dist DIST] [--output DIRECTORY]

Builds a source RPM and an x86_64 RPM. The plugin is built locally first, so the
RPM build itself does not need npm or network access.

Options:
  --version VERSION    RPM version (default: VERSION)
  --release RELEASE    RPM release (default: 1)
  --dist DIST          RPM distribution suffix, for example .el9 (default: system setting)
  --output DIRECTORY   Directory for the finished RPMs (default: ./artifacts/rpm)
  -h, --help           Show this help
EOF
}

version="${VERSION:-}"
release="${RELEASE:-1}"
dist_tag="${RPM_DIST:-}"
output_dir="${RPM_OUTPUT_DIR:-$PROJECT_ROOT/artifacts/rpm}"

while (($#)); do
    case "$1" in
        --version)
            version="${2:?--version requires a value}"
            shift 2
            ;;
        --release)
            release="${2:?--release requires a value}"
            shift 2
            ;;
        --dist)
            dist_tag="${2:?--dist requires a value}"
            shift 2
            ;;
        --output)
            output_dir="${2:?--output requires a value}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ -z "$version" ]]; then
    if [[ ! -f "$VERSION_FILE" ]]; then
        echo "Version file not found: $VERSION_FILE" >&2
        exit 1
    fi
    IFS= read -r version < "$VERSION_FILE" || true
    version="${version//$'\r'/}"
    version="${version//[[:space:]]/}"
fi

if [[ -z "$version" || ! "$version" =~ ^[A-Za-z0-9._+~^]+$ ]]; then
    echo "Invalid RPM version: ${version:-<empty>}" >&2
    echo "Use --version with letters, digits, '.', '_', '+', '~', or '^'." >&2
    exit 2
fi

if [[ ! "$release" =~ ^[A-Za-z0-9._+~^]+$ ]]; then
    echo "Invalid RPM release: $release" >&2
    exit 2
fi

if [[ -n "$dist_tag" && ! "$dist_tag" =~ ^\.[A-Za-z0-9._+~^]+$ ]]; then
    echo "Invalid RPM distribution suffix: $dist_tag (example: .el9)" >&2
    exit 2
fi

for command in make npm node rpmbuild tar; do
    command -v "$command" >/dev/null || {
        echo "Required command not found: $command" >&2
        exit 1
    }
done

if [[ ! -f "$PROJECT_ROOT/$SPEC_FILE" ]]; then
    echo "Spec file not found: $SPEC_FILE" >&2
    exit 1
fi

if [[ ! -f "$CHANGELOG_FILE" ]]; then
    echo "Changelog file not found: $CHANGELOG_FILE" >&2
    exit 1
fi

if ! grep -Fq "## [${version}]" "$CHANGELOG_FILE"; then
    echo "CHANGELOG.md must contain a release section for version ${version}" >&2
    exit 1
fi

source_dir="${PACKAGE_NAME}-${version}"
topdir="$(mktemp -d "${TMPDIR:-/tmp}/${PACKAGE_NAME}-rpmbuild.XXXXXX")"
trap 'rm -rf -- "$topdir"' EXIT

mkdir -p "$topdir"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
mkdir -p "$output_dir"

echo "==> Building ${PACKAGE_NAME} ${version}-${release}${dist_tag}"
echo "==> Creating production assets"
# -B guarantees that an earlier development build is not accidentally packaged.
# build.js replaces dist/ itself, so this preserves the developer's node_modules.
make -B -C "$PROJECT_ROOT" NODE_ENV=production
test -d "$PROJECT_ROOT/dist" || { echo "dist/ was not generated" >&2; exit 1; }

echo "==> Creating source archive"
tar -C "$PROJECT_ROOT" --xz -cf "$topdir/SOURCES/${source_dir}.tar.xz" \
    --exclude=.git \
    --exclude=artifacts \
    --exclude=package-lock.json \
    --exclude=metafile.json \
    --exclude=node_modules \
    --exclude=rpmbuild \
    --exclude=runtime-npm-modules.txt \
    --exclude=pkg \
    --transform "s,^,${source_dir}/," \
    .

sed \
    -e "s/^Version:[[:space:]].*/Version:        ${version}/" \
    -e "s/^Release:[[:space:]].*/Release:        ${release}%{?dist}/" \
    "$PROJECT_ROOT/$SPEC_FILE" > "$topdir/SPECS/${PACKAGE_NAME}.spec"

echo "==> Building RPMs"
rpmbuild_args=(--define "_topdir $topdir")
if [[ -n "$dist_tag" ]]; then
    rpmbuild_args+=(--define "dist $dist_tag")
fi
rpmbuild -ba "$topdir/SPECS/${PACKAGE_NAME}.spec" "${rpmbuild_args[@]}"

find "$topdir/RPMS" "$topdir/SRPMS" -type f \( -name '*.rpm' -o -name '*.src.rpm' \) \
    -exec cp -f {} "$output_dir"/ \;

echo
echo "Finished RPMs:"
find "$output_dir" -maxdepth 1 -type f \( -name '*.rpm' -o -name '*.src.rpm' \) -print | sort
