#!/bin/bash

PACKAGE="DigitalWonderlab.BackofficeAnnouncement"
SOURCE="C:\Users\KevinTriggle\source\repos\DigitalWonderlab.BackofficeAnnouncement\bin\Release"
SITES=(
    "C:\Users\KevinTriggle\source\repos\v13-test-site\MyProject"
    "C:\Users\KevinTriggle\source\repos\v14-test-site\MyProject"
    "C:\Users\KevinTriggle\source\repos\v15-test-site\MyProject"
    "C:\Users\KevinTriggle\source\repos\v16-test-site\MyProject"
    "C:\Users\KevinTriggle\source\repos\v17-test-site\MyProject"
)

# Get version from .csproj
VERSION=$(grep -oP '(?<=<Version>)[^<]+' "C:\Users\KevinTriggle\source\repos\DigitalWonderlab.BackofficeAnnouncement\DigitalWonderlab.BackofficeAnnouncement.csproj")
echo "=== Package version: $VERSION ==="
echo ""

# Build and pack first
echo "=== Packing $PACKAGE v$VERSION ==="
dotnet pack "C:\Users\KevinTriggle\source\repos\DigitalWonderlab.BackofficeAnnouncement" -c Release --no-restore -v quiet
if [ $? -ne 0 ]; then
    echo "PACK FAILED - aborting"
    exit 1
fi
echo ""

# Clear cached version so dotnet doesn't use a stale copy
echo "=== Clearing NuGet cache for $PACKAGE ==="
CACHE_DIR="$(dotnet nuget locals global-packages -l | sed 's/.*: //')/${PACKAGE,,}/$VERSION"
if [ -d "$CACHE_DIR" ]; then
    rm -rf "$CACHE_DIR"
    echo "Cleared: $CACHE_DIR"
else
    echo "No cached version found"
fi
echo ""

for SITE in "${SITES[@]}"; do
    SITE_NAME=$(basename "$(dirname "$SITE")")
    echo "=== $SITE_NAME ==="

    # Remove (ignore error if not installed)
    dotnet remove "$SITE" package $PACKAGE 2>/dev/null

    # Clean App_Plugins/BackofficeAnnouncement left behind from previous install
    APP_PLUGINS="$SITE/App_Plugins/BackofficeAnnouncement"
    if [ -d "$APP_PLUGINS" ]; then
        rm -rf "$APP_PLUGINS"
        echo "  Cleaned old App_Plugins/BackofficeAnnouncement"
    fi

    # Install from local source
    dotnet add "$SITE" package $PACKAGE --version "$VERSION" --source "$SOURCE"

    if [ $? -eq 0 ]; then
        echo "  OK"
    else
        echo "  FAILED"
    fi
    echo ""
done

echo "=== Done. Restart each site to test. ==="
