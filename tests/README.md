# Tests

`node tests/e2e.mjs` checks the backend against the Appwrite server named in tn.config.json before publishing:
campaign and invitation flow, permissions (GM notes, history, campaign settings, shared templates),
player gauge steps and their history, labelled and secret dice rolls, the GM-only dice log reset,
item stacks (equip / full or wrong spot / unequip / use / give) and character duplication.

It needs Node 18+ and the `appwrite` CLI logged in on this machine (run from any folder; it uses
`appwrite/` for the project config). It creates a throwaway admin account, campaign and player and
deletes them at the end, even when a check fails. Exit code 1 when a check fails.
