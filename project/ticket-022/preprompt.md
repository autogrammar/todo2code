# Preprompt — ticket-022

Implement read-only, deterministic Git extraction for an umbrella workspace of
nested repositories. Preserve the single-repository contract, prefix nested
repository paths relative to the umbrella, never follow symlinks, stop walking
below a discovered repository, bound work, and degrade individual repository
failures to explicit warnings. Do not change public interfaces or execute any
repository mutation.
