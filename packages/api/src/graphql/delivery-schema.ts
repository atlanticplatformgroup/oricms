import {
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  Kind,
} from 'graphql';
import type { CollectionQuery } from '@ori/shared';
import { CollectionService } from '../collections/service';
import { DeliveryProjectionService } from '../delivery-projection/service';

export interface DeliveryGraphQlContext {
  projectId: string;
  repoUrl: string;
  defaultBranch: string;
}

interface ContentTypeNode {
  id: string;
  name: string;
  plural: string;
  label: string;
}

const JsonScalar: GraphQLScalarType = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast): unknown => {
    if (ast.kind === Kind.STRING) return ast.value;
    if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT) return Number(ast.value);
    if (ast.kind === Kind.BOOLEAN) return ast.value;
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

async function loadContentTypes(context: DeliveryGraphQlContext): Promise<ContentTypeNode[]> {
  const service = new CollectionService({
    projectId: context.projectId,
    repoUrl: context.repoUrl,
    branch: context.defaultBranch,
  });
  await service.init();

  const collections = await service.listCollections();
  const types: ContentTypeNode[] = [];
  for (const collection of collections) {
    const contentType = await service.getContentType(collection.contentType);
    if (!contentType) continue;

    types.push({
      id: collection.id,
      name: collection.id,
      plural: contentType.plural,
      label: collection.label,
    });
  }
  return types;
}

function createProjectionService(context: DeliveryGraphQlContext): DeliveryProjectionService {
  return new DeliveryProjectionService({
    projectId: context.projectId,
    repoUrl: context.repoUrl,
    branch: context.defaultBranch,
  });
}

function buildCollectionQuery(args: {
  search?: unknown;
  populate?: unknown;
  filter?: unknown;
  sort?: unknown;
  page?: unknown;
  limit?: unknown;
}): CollectionQuery {
  return {
    search: typeof args.search === 'string' ? args.search : undefined,
    populate: typeof args.populate === 'string' ? args.populate : undefined,
    filter: (args.filter ?? undefined) as Record<string, unknown> | undefined,
    sort: (args.sort ?? undefined) as Record<string, 'asc' | 'desc'> | undefined,
    page: typeof args.page === 'number' ? args.page : undefined,
    limit: typeof args.limit === 'number' ? args.limit : undefined,
  };
}

function mapProjectionRecord(record: Record<string, unknown>, fallbackType: unknown) {
  return {
    id: String(record.$id || ''),
    type: String(record.$type || fallbackType),
    data: record,
  };
}

function createCollectionQueryField(resultType: GraphQLObjectType) {
  return {
    type: new GraphQLNonNull(resultType),
    args: {
      type: { type: new GraphQLNonNull(GraphQLString) },
      search: { type: GraphQLString },
      page: { type: GraphQLInt },
      limit: { type: GraphQLInt },
      populate: { type: GraphQLString },
      filter: { type: JsonScalar },
      sort: { type: JsonScalar },
    },
    resolve: async (_source: unknown, args: Record<string, unknown>, context: DeliveryGraphQlContext) => {
      const result = await createProjectionService(context).listRecords(
        String(args.type),
        buildCollectionQuery(args),
      );
      return {
        entries: result.data.map((record) => mapProjectionRecord(record as Record<string, unknown>, args.type)),
        meta: result.meta,
      };
    },
  };
}

function createSingleRecordField(entryType: GraphQLObjectType) {
  return {
    type: entryType,
    args: {
      type: { type: new GraphQLNonNull(GraphQLString) },
      id: { type: new GraphQLNonNull(GraphQLID) },
      populate: { type: GraphQLString },
    },
    resolve: async (_source: unknown, args: Record<string, unknown>, context: DeliveryGraphQlContext) => {
      const record = await createProjectionService(context).getRecord(
        String(args.type),
        String(args.id),
        typeof args.populate === 'string' ? args.populate : undefined,
      );
      if (!record) {
        return null;
      }

      return mapProjectionRecord(record as Record<string, unknown>, args.type);
    },
  };
}

function buildSchema(contentTypes: ContentTypeNode[]) {
  const paginationType = new GraphQLObjectType({
    name: 'DeliveryPaginationMeta',
    fields: {
      page: { type: new GraphQLNonNull(GraphQLInt) },
      pageSize: { type: new GraphQLNonNull(GraphQLInt) },
      pageCount: { type: new GraphQLNonNull(GraphQLInt) },
      total: { type: new GraphQLNonNull(GraphQLInt) },
    },
  });

  const collectionMetaType = new GraphQLObjectType({
    name: 'DeliveryCollectionMeta',
    fields: {
      pagination: { type: new GraphQLNonNull(paginationType) },
    },
  });

  const collectionEntryType = new GraphQLObjectType({
    name: 'DeliveryCollectionEntry',
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      type: { type: new GraphQLNonNull(GraphQLString) },
      data: { type: new GraphQLNonNull(JsonScalar) },
    },
  });

  const collectionEntryQueryResultType = new GraphQLObjectType({
    name: 'DeliveryCollectionQueryResult',
    fields: {
      entries: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(collectionEntryType))) },
      records: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(collectionEntryType))),
        resolve: (source: { entries: unknown[] }) => source.entries,
      },
      meta: { type: new GraphQLNonNull(collectionMetaType) },
    },
  });

  const contentTypeType = new GraphQLObjectType({
    name: 'DeliveryContentTypeSchema',
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      plural: { type: new GraphQLNonNull(GraphQLString) },
      label: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'DeliveryQuery',
      fields: {
        contentTypes: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(contentTypeType))),
          resolve: () => contentTypes,
        },
        entries: createCollectionQueryField(collectionEntryQueryResultType),
        records: createCollectionQueryField(collectionEntryQueryResultType),
        entry: createSingleRecordField(collectionEntryType),
        record: createSingleRecordField(collectionEntryType),
      },
    }),
  });
}

export async function loadDeliverySchema(context: DeliveryGraphQlContext): Promise<GraphQLSchema> {
  return buildSchema(await loadContentTypes(context));
}
