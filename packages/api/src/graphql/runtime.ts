import { GraphQLBoolean, type GraphQLFieldConfigMap, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, type GraphQLOutputType, GraphQLScalarType, GraphQLSchema, GraphQLString, Kind } from 'graphql';
import { PLUGIN_EVENT_NAMES, type CollectionQuery } from '@ori/shared';
import { CollectionService } from '../collections/service';
import { checkPermission } from '../permissions/middleware';
import { createEntry } from '../application/entries/create-entry';
import { updateEntry } from '../application/entries/update-entry';
import { deleteEntry } from '../application/entries/delete-entry';

export interface GraphQlContext {
  projectId: string;
  defaultBranch: string;
  repoUrl: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface ContentTypeFieldNode { key: string; label: string; type: string; required: boolean; }
export interface ContentTypeNode { id: string; name: string; plural: string; label: string; labelPlural: string; description?: string; fields: ContentTypeFieldNode[]; }

const RESERVED_ROOT_FIELDS = new Set(['contentTypes', 'records', 'record']);
const RESERVED_MUTATION_FIELDS = new Set(['createEntry', 'updateEntry', 'deleteEntry']);

export const JsonScalar: GraphQLScalarType = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast): unknown => {
    if (ast.kind === Kind.STRING || ast.kind === Kind.BOOLEAN) return ast.value;
    if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT) return Number(ast.value);
    if (ast.kind === Kind.NULL) return null;
    if (ast.kind === Kind.LIST) return ast.values.map((value) => JsonScalar.parseLiteral(value, {}));
    if (ast.kind === Kind.OBJECT) {
      return ast.fields.reduce<Record<string, unknown>>((acc, field) => {
        acc[field.name.value] = JsonScalar.parseLiteral(field.value, {});
        return acc;
      }, {});
    }
    return null;
  },
});

function pascalCase(input: string): string {
  return input.split(/[^a-zA-Z0-9]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

export async function loadContentTypes(projectId: string, repoUrl: string, branch: string): Promise<ContentTypeNode[]> {
  const service = new CollectionService({ projectId, repoUrl, branch });
  await service.init();
  const collections = await service.listCollections();
  const types: ContentTypeNode[] = [];
  for (const coll of collections) {
    const contentType = await service.getContentType(coll.contentType);
    if (!contentType) continue;
    types.push({
      id: coll.id,
      name: coll.id,
      plural: contentType.plural,
      label: coll.label,
      labelPlural: contentType.labelPlural,
      description: coll.description || contentType.description,
      fields: contentType.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: !!f.required })),
    });
  }
  return types;
}

function getCollectionService(context: GraphQlContext): Promise<CollectionService> {
  const service = new CollectionService({ projectId: context.projectId, repoUrl: context.repoUrl, branch: context.defaultBranch });
  return service.init().then(() => service);
}

async function requireCollectionAction(context: GraphQlContext, action: 'create' | 'update' | 'delete') {
  const allowed = await checkPermission(context.userId, context.projectId, 'collections', action);
  if (!allowed) throw new Error(`Forbidden: missing collections:${action} permission`);
}

function toCollectionQuery(args: Record<string, unknown>): CollectionQuery {
  return {
    search: typeof args.search === 'string' ? args.search : undefined,
    page: typeof args.page === 'number' ? args.page : undefined,
    limit: typeof args.limit === 'number' ? args.limit : undefined,
    populate: typeof args.populate === 'string' ? args.populate : undefined,
    filter: (args.filter ?? undefined) as Record<string, unknown> | undefined,
    sort: (args.sort ?? undefined) as Record<string, 'asc' | 'desc'> | undefined,
  };
}

function mapFieldTypeToGraphql(fieldType: string) {
  switch (fieldType) {
    case 'number': return GraphQLFloat;
    case 'boolean': return GraphQLBoolean;
    case 'json': return JsonScalar;
    default: return GraphQLString;
  }
}

function buildDynamicRecordType(typeDef: ContentTypeNode): GraphQLObjectType {
  return new GraphQLObjectType({
    name: `${typeDef.name}Record`,
    fields: () => {
      const dynamicFields: Record<string, { type: GraphQLOutputType }> = {
        id: { type: new GraphQLNonNull(GraphQLID) },
        type: { type: new GraphQLNonNull(GraphQLString) },
        createdAt: { type: GraphQLString },
        updatedAt: { type: GraphQLString },
      };
      for (const field of typeDef.fields) {
        const fieldType = mapFieldTypeToGraphql(field.type);
        dynamicFields[field.key] = { type: field.required ? new GraphQLNonNull(fieldType) : fieldType };
      }
      return dynamicFields;
    },
  });
}

function createGraphqlRuntime() {
  const PaginationType = new GraphQLObjectType({ name: 'PaginationMeta', fields: { page: { type: new GraphQLNonNull(GraphQLInt) }, pageSize: { type: new GraphQLNonNull(GraphQLInt) }, pageCount: { type: new GraphQLNonNull(GraphQLInt) }, total: { type: new GraphQLNonNull(GraphQLInt) } } });
  const CollectionMetaType = new GraphQLObjectType({ name: 'CollectionMeta', fields: { pagination: { type: new GraphQLNonNull(PaginationType) } } });
  const CollectionEntryType = new GraphQLObjectType({ name: 'CollectionEntry', fields: { id: { type: new GraphQLNonNull(GraphQLID) }, type: { type: new GraphQLNonNull(GraphQLString) }, data: { type: new GraphQLNonNull(JsonScalar) } } });
  const CollectionEntryQueryResultType = new GraphQLObjectType({ name: 'CollectionEntryQueryResult', fields: { entries: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CollectionEntryType))) }, meta: { type: new GraphQLNonNull(CollectionMetaType) } } });
  const ContentTypeFieldType = new GraphQLObjectType({ name: 'ContentTypeField', fields: { key: { type: new GraphQLNonNull(GraphQLString) }, label: { type: new GraphQLNonNull(GraphQLString) }, type: { type: new GraphQLNonNull(GraphQLString) }, required: { type: new GraphQLNonNull(GraphQLBoolean) } } });
  const ContentTypeType = new GraphQLObjectType({ name: 'ContentTypeSchema', fields: { id: { type: new GraphQLNonNull(GraphQLID) }, name: { type: new GraphQLNonNull(GraphQLString) }, plural: { type: new GraphQLNonNull(GraphQLString) }, label: { type: new GraphQLNonNull(GraphQLString) }, labelPlural: { type: new GraphQLNonNull(GraphQLString) }, description: { type: GraphQLString }, fields: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ContentTypeFieldType))) } } });

  return {
    buildForContentTypes(contentTypes: ContentTypeNode[]) {
      const dynamicRecordTypes: Record<string, GraphQLObjectType> = {};
      for (const typeDef of contentTypes) dynamicRecordTypes[typeDef.name] = buildDynamicRecordType(typeDef);

      const rootFields: GraphQLFieldConfigMap<unknown, GraphQlContext> = {
        contentTypes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ContentTypeType))), resolve: () => contentTypes },
        entries: {
          type: new GraphQLNonNull(CollectionEntryQueryResultType),
          args: { type: { type: new GraphQLNonNull(GraphQLString) }, search: { type: GraphQLString }, page: { type: GraphQLInt }, limit: { type: GraphQLInt }, populate: { type: GraphQLString }, filter: { type: JsonScalar }, sort: { type: JsonScalar } },
          resolve: async (_source, args, context) => {
            const service = await getCollectionService(context);
            const result = await service.findMany(String(args.type), toCollectionQuery(args));
            return { entries: result.data.map((record) => ({ id: record.$id, type: record.$type, data: record })), meta: result.meta };
          },
        },
        entry: {
          type: CollectionEntryType,
          args: { type: { type: new GraphQLNonNull(GraphQLString) }, id: { type: new GraphQLNonNull(GraphQLID) }, populate: { type: GraphQLString } },
          resolve: async (_source, args, context) => {
            const service = await getCollectionService(context);
            const record = await service.findOne(String(args.type), String(args.id), typeof args.populate === 'string' ? args.populate : undefined);
            return record ? { id: record.$id, type: record.$type, data: record } : null;
          },
        },
      };

      for (const typeDef of contentTypes) {
        const recordType = dynamicRecordTypes[typeDef.name];
        if (!recordType) continue;
        if (!RESERVED_ROOT_FIELDS.has(typeDef.name)) {
          rootFields[typeDef.name] = {
            type: recordType,
            args: { id: { type: new GraphQLNonNull(GraphQLID) }, populate: { type: GraphQLString } },
            resolve: async (_source, args, context) => {
              const service = await getCollectionService(context);
              const record = await service.findOne(typeDef.name, String(args.id), typeof args.populate === 'string' ? args.populate : undefined);
              return record ? { id: record.$id, type: record.$type, createdAt: record.$createdAt, updatedAt: record.$updatedAt, ...record } : null;
            },
          };
        }
        if (!RESERVED_ROOT_FIELDS.has(typeDef.plural)) {
          rootFields[typeDef.plural] = {
            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(recordType))),
            args: { search: { type: GraphQLString }, page: { type: GraphQLInt }, limit: { type: GraphQLInt }, populate: { type: GraphQLString }, filter: { type: JsonScalar }, sort: { type: JsonScalar } },
            resolve: async (_source, args, context) => {
              const service = await getCollectionService(context);
              const result = await service.findMany(typeDef.name, toCollectionQuery(args));
              return result.data.map((record) => ({ id: record.$id, type: record.$type, createdAt: record.$createdAt, updatedAt: record.$updatedAt, ...record }));
            },
          };
        }
      }

      const createEntryByType = async (context: GraphQlContext, collectionId: string, data: Record<string, unknown>) => {
        await requireCollectionAction(context, 'create');
        const { entry } = await createEntry({ projectId: context.projectId, collectionId, repoUrl: context.repoUrl, branch: context.defaultBranch, actor: { id: context.userId, name: context.userName, email: context.userEmail } }, data, { audit: { userId: context.userId, action: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_CREATED }, plugin: { event: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_CREATED } });
        if (!entry) throw new Error('Entry creation returned no entry payload');
        return entry;
      };
      const updateEntryByType = async (context: GraphQlContext, collectionId: string, id: string, data: Record<string, unknown>) => {
        await requireCollectionAction(context, 'update');
        const { entry } = await updateEntry({ projectId: context.projectId, collectionId, repoUrl: context.repoUrl, branch: context.defaultBranch, actor: { id: context.userId, name: context.userName, email: context.userEmail } }, id, data, { audit: { userId: context.userId, action: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_UPDATED }, plugin: { event: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_UPDATED } });
        if (!entry) throw new Error('Entry update returned no entry payload');
        return entry;
      };
      const deleteEntryByType = async (context: GraphQlContext, collectionId: string, id: string) => {
        await requireCollectionAction(context, 'delete');
        await deleteEntry({ projectId: context.projectId, collectionId, repoUrl: context.repoUrl, branch: context.defaultBranch, actor: { id: context.userId, name: context.userName, email: context.userEmail } }, id, { audit: { userId: context.userId, action: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_DELETED }, plugin: { event: PLUGIN_EVENT_NAMES.COLLECTION_RECORD_DELETED } });
      };

      const mutationFields: GraphQLFieldConfigMap<unknown, GraphQlContext> = {
        createEntry: { type: new GraphQLNonNull(CollectionEntryType), args: { type: { type: new GraphQLNonNull(GraphQLString) }, data: { type: new GraphQLNonNull(JsonScalar) } }, resolve: async (_s, args, context) => { const created = await createEntryByType(context, String(args.type), (args.data as Record<string, unknown>) || {}); return { id: created.$id, type: created.$type, data: created }; } },
        updateEntry: { type: new GraphQLNonNull(CollectionEntryType), args: { type: { type: new GraphQLNonNull(GraphQLString) }, id: { type: new GraphQLNonNull(GraphQLID) }, data: { type: new GraphQLNonNull(JsonScalar) } }, resolve: async (_s, args, context) => { const updated = await updateEntryByType(context, String(args.type), String(args.id), (args.data as Record<string, unknown>) || {}); return { id: updated.$id, type: updated.$type, data: updated }; } },
        deleteEntry: { type: new GraphQLNonNull(GraphQLBoolean), args: { type: { type: new GraphQLNonNull(GraphQLString) }, id: { type: new GraphQLNonNull(GraphQLID) } }, resolve: async (_s, args, context) => { await deleteEntryByType(context, String(args.type), String(args.id)); return true; } },
      };

      for (const typeDef of contentTypes) {
        const recordType = dynamicRecordTypes[typeDef.name];
        if (!recordType) continue;
        const suffix = pascalCase(typeDef.name);
        if (!suffix) continue;
        const createMutationName = `create${suffix}`;
        if (!RESERVED_MUTATION_FIELDS.has(createMutationName)) {
          mutationFields[createMutationName] = { type: new GraphQLNonNull(recordType), args: { data: { type: new GraphQLNonNull(JsonScalar) } }, resolve: async (_s, args, context) => { const created = await createEntryByType(context, typeDef.name, (args.data as Record<string, unknown>) || {}); return { id: created.$id, type: created.$type, createdAt: created.$createdAt, updatedAt: created.$updatedAt, ...created }; } };
        }
        const updateMutationName = `update${suffix}`;
        if (!RESERVED_MUTATION_FIELDS.has(updateMutationName)) {
          mutationFields[updateMutationName] = { type: new GraphQLNonNull(recordType), args: { id: { type: new GraphQLNonNull(GraphQLID) }, data: { type: new GraphQLNonNull(JsonScalar) } }, resolve: async (_s, args, context) => { const updated = await updateEntryByType(context, typeDef.name, String(args.id), (args.data as Record<string, unknown>) || {}); return { id: updated.$id, type: updated.$type, createdAt: updated.$createdAt, updatedAt: updated.$updatedAt, ...updated }; } };
        }
        const deleteMutationName = `delete${suffix}`;
        if (!RESERVED_MUTATION_FIELDS.has(deleteMutationName)) {
          mutationFields[deleteMutationName] = { type: new GraphQLNonNull(GraphQLBoolean), args: { id: { type: new GraphQLNonNull(GraphQLID) } }, resolve: async (_s, args, context) => { await deleteEntryByType(context, typeDef.name, String(args.id)); return true; } };
        }
      }

      return new GraphQLSchema({ query: new GraphQLObjectType({ name: 'Query', fields: rootFields }), mutation: new GraphQLObjectType({ name: 'Mutation', fields: mutationFields }) });
    },
  };
}

export const graphqlRuntime = createGraphqlRuntime();

export async function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`GraphQL execution timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
