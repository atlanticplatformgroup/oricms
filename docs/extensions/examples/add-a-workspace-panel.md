# Example: Add a Workspace Panel

1. Decide whether the feature belongs in a section, header action, toolbar slot, or secondary panel.
2. Register it through the workspace extension registry.
3. Keep permissions in the registration contract.
4. Put feature state in a provider or feature hook instead of `App.tsx`.
5. Add registry tests if ordering or resolution changed.
