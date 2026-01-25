#!/bin/bash
set -e

echo "Installing type-inject for Claude Code..."

# Check for claude CLI
if ! command -v claude &> /dev/null; then
    echo "Error: 'claude' CLI not found. Install Claude Code first."
    exit 1
fi

# Add MCP server (ignore error if already exists)
echo "Adding MCP server..."
claude mcp add type-inject -s user -- npx -y @nick-vi/type-inject-mcp 2>/dev/null || true

# Merge hook into settings.json
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Configuring hooks..."

# Create settings file if it doesn't exist
if [ ! -f "$SETTINGS_FILE" ]; then
    mkdir -p "$(dirname "$SETTINGS_FILE")"
    echo '{}' > "$SETTINGS_FILE"
fi

# Use node/bun to merge the hook config
if command -v node &> /dev/null; then
    RUNNER="node"
elif command -v bun &> /dev/null; then
    RUNNER="bun"
else
    echo "Error: Neither 'node' nor 'bun' found. Cannot configure hook."
    echo "Please add the hook manually to ~/.claude/settings.json"
    exit 1
fi

$RUNNER --eval "
const fs = require('fs');
const settingsPath = '$SETTINGS_FILE';

let settings = {};
try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
} catch (e) {
    settings = {};
}

// Initialize hooks structure if needed
if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

const hookCommand = 'npx -y @nick-vi/claude-type-inject-hook';

// Add Read hook if not exists
const readExists = settings.hooks.PostToolUse.some(h =>
    h.matcher === 'Read' &&
    h.hooks?.some(hh => hh.command === hookCommand)
);

if (!readExists) {
    settings.hooks.PostToolUse.push({
        matcher: 'Read',
        hooks: [{
            type: 'command',
            command: hookCommand
        }]
    });
    console.log('Read hook added.');
} else {
    console.log('Read hook already configured.');
}

// Add Write hook if not exists
const writeExists = settings.hooks.PostToolUse.some(h =>
    h.matcher === 'Write' &&
    h.hooks?.some(hh => hh.command === hookCommand)
);

if (!writeExists) {
    settings.hooks.PostToolUse.push({
        matcher: 'Write',
        hooks: [{
            type: 'command',
            command: hookCommand
        }]
    });
    console.log('Write hook added.');
} else {
    console.log('Write hook already configured.');
}

// Save settings
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
"

echo ""
echo "✓ Installation complete!"
echo ""
echo "Restart Claude Code to activate. You'll get:"
echo "  • Automatic type injection when reading TS files"
echo "  • Type error feedback when writing TS files"
echo "  • lookup_type and list_types MCP tools"
