#!/bin/zsh
# Old name, kept so existing installs keep working: Nuqta is now moodots. Runs moodots-update.command.
exec "$(dirname "$0")/moodots-update.command" "$@"
