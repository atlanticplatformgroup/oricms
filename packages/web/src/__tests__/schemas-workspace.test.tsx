import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { ContentType } from '@ori/shared';
import { SchemasWorkspace } from '../components/workspace/SchemasWorkspace';
import { SCHEMA_FIELD_TYPE_GROUPS, SCHEMA_FIELD_TYPE_OPTIONS } from '../lib/workspace/constants';
import { makeSchemaField } from '../lib/schemas/factory';

describe('Schemas workspace', () => {
  const baseSchema: ContentType = {
    $schema: 'content-type-v1',
    $id: 'post',
    name: 'post',
    plural: 'posts',
    label: 'Post',
    labelPlural: 'Posts',
    description: 'Post model',
    display: { primary: 'title' },
    fields: [
      { key: 'title', label: 'Title', type: 'string', required: true },
      { key: 'slug', label: 'Slug', type: 'uid', uidSource: 'title' },
      { key: 'category', label: 'Category', type: 'select', enumValues: [{ value: 'news', label: 'News' }], options: { allowCustomValue: true } },
      { key: 'author', label: 'Author', type: 'reference', options: { referenceCollection: 'authors', referenceKind: 'single' } },
      { key: 'hero', label: 'Hero', type: 'component', component: 'callout-block', repeatable: true },
      { key: 'contentBlocks', label: 'Content Blocks', type: 'blocks', options: { allowedComponents: ['callout-block'] } },
    ],
  };

  it('surfaces advanced settings for structured and relational fields', () => {
    render(
      <MantineProvider>
        <SchemasWorkspace
          activeSchemaMode="types"
          onCreateSchema={() => {}}
          onSaveSchema={() => {}}
          onOpenDeleteSchema={() => {}}
          onOpenSchemaJson={() => {}}
          onOpenSchemaHistory={() => {}}
          canDeleteSchema
          canSaveSchema
          isSchemaDirty
          saveSchemaPending={false}
          selectedSchemaDocument={{ path: 'schemas/types/post.json', schema: baseSchema }}
          effectiveSchema={baseSchema}
          effectiveSchemaFields={baseSchema.fields}
          schemaIssues={[]}
          fieldIssuesByKey={{}}
          validationIssueCount={0}
          newFieldGuidance="Use repeatable components for structured repeaters where every item follows the same schema."
          schemaBusy={false}
          schemaBlockingLock={null}
          schemaLockError={null}
          onSchemaMetaChange={() => {}}
          newSchemaFieldType="component"
          onNewSchemaFieldTypeChange={() => {}}
          onAddSchemaField={() => {}}
          onReorderSchemaField={() => {}}
          onSchemaFieldPatch={() => {}}
          onRemoveSchemaField={() => {}}
          componentSchemaOptions={[
            { value: 'callout-block', label: 'Callout Block' },
            { value: 'quote-block', label: 'Quote Block' },
          ]}
          collectionOptions={[
            { value: 'authors', label: 'Authors · authors' },
            { value: 'posts', label: 'Posts · posts' },
          ]}
          schemaFieldTypeOptions={SCHEMA_FIELD_TYPE_OPTIONS}
          schemaFieldTypeGroups={SCHEMA_FIELD_TYPE_GROUPS}
          toLabel={(value) => value}
          makeSchemaField={makeSchemaField}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('View JSON')).toBeInTheDocument();
    expect(screen.getByText('View history')).toBeInTheDocument();
    expect(screen.getByText('Delete schema')).toBeInTheDocument();
    expect(screen.getAllByText('Use repeatable components for structured repeaters where every item follows the same schema.').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Source field').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Allow custom values').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Reference kind').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Component').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Allowed components').length).toBeGreaterThan(0);
  });

  it('shows schema and field validation issues and blocks save', () => {
    const onSaveSchema = vi.fn();

    render(
      <MantineProvider>
        <SchemasWorkspace
          activeSchemaMode="types"
          onCreateSchema={() => {}}
          onSaveSchema={onSaveSchema}
          onOpenDeleteSchema={() => {}}
          onOpenSchemaJson={() => {}}
          onOpenSchemaHistory={() => {}}
          canDeleteSchema
          canSaveSchema={false}
          isSchemaDirty
          saveSchemaPending={false}
          selectedSchemaDocument={{ path: 'schemas/types/post.json', schema: baseSchema }}
          effectiveSchema={baseSchema}
          effectiveSchemaFields={baseSchema.fields}
          schemaIssues={['Schema label is required.']}
          fieldIssuesByKey={{ contentBlocks: ['Blocks fields need at least one allowed component.'] }}
          validationIssueCount={2}
          newFieldGuidance="Choose the simplest field that matches the authoring need."
          schemaBusy={false}
          schemaBlockingLock={null}
          schemaLockError={null}
          onSchemaMetaChange={() => {}}
          newSchemaFieldType="string"
          onNewSchemaFieldTypeChange={() => {}}
          onAddSchemaField={() => {}}
          onReorderSchemaField={() => {}}
          onSchemaFieldPatch={() => {}}
          onRemoveSchemaField={() => {}}
          componentSchemaOptions={[]}
          collectionOptions={[]}
          schemaFieldTypeOptions={SCHEMA_FIELD_TYPE_OPTIONS}
          schemaFieldTypeGroups={SCHEMA_FIELD_TYPE_GROUPS}
          toLabel={(value) => value}
          makeSchemaField={makeSchemaField}
        />
      </MantineProvider>,
    );

    const saveButton = screen.getByText('Save schema').closest('button');
    expect(screen.getByText('Schema validation')).toBeInTheDocument();
    expect(screen.getByText('Schema label is required.')).toBeInTheDocument();
    expect(screen.getByText('Blocks fields need at least one allowed component.')).toBeInTheDocument();
    expect(screen.getByText('2 issues')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    if (saveButton) fireEvent.click(saveButton);
    expect(onSaveSchema).not.toHaveBeenCalled();
  });
});
