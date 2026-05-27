# Example: Add a Field Type

1. Add or update the shared field contract if the type needs new shared semantics.
2. Implement the renderer component in `packages/web/src/components/fields/renderers`.
3. Register the type in the field registry.
4. Add capability behavior if browse or readonly behavior differs from defaults.
5. Add registry or renderer tests.
6. Update field reference docs.
