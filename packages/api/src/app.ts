import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authenticate } from './auth/middleware';
import authRoutes from './auth/routes';
import projectRoutes from './projects/routes';
import gitRoutes from './git/routes';
import assetRoutes from './assets/routes';
import globalAssetRoutes from './assets/global-routes';
import previewRoutes from './preview/routes';
import buildsRoutes from './builds/routes';
import webhooksRoutes from './webhooks/routes';
import cdnRoutes from './cdn/routes';
import contentTypeRoutes from './content-types/routes';
import collectionRoutes from './collections/routes';
import schemaAliasRoutes from './collections/schema-alias-routes';
import lockRoutes from './locks/routes';
import resourceRoutes from './resources/routes';
import publicCollectionRoutes from './collections/public-routes';
import graphqlRoutes from './graphql/routes';
import graphqlDeliveryRoutes from './graphql/delivery-routes';
import pluginRoutes from './plugins/routes';
import agentGatewayRoutes from './agent-gateway/routes';
import systemRoutes from './system/routes';
import { prisma } from './lib/prisma';
import { logger, requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/error';
import {
  applyTrustProxy,
  createRateLimitRuntime,
  type RateLimitRuntime,
  type RateLimitRuntimeOptions,
} from './rate-limit';

export interface ApiAppOptions {
  rateLimit?: RateLimitRuntimeOptions;
}

export interface ApiAppRuntime {
  app: express.Express;
  shutdown(): Promise<void>;
}

export async function createApiRuntime(options: ApiAppOptions = {}): Promise<ApiAppRuntime> {
  const app = express();
  const rateLimitRuntime = await createRateLimitRuntime(options.rateLimit);
  const isDevelopment = process.env.NODE_ENV !== 'production';

  applyTrustProxy(app, rateLimitRuntime.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }));

  const corsOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : ['http://localhost:5173'];
  const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (corsOrigins.includes(origin) || (isDevelopment && localhostOriginPattern.test(origin))) {
        callback(null, true);
      } else {
        logger.warn({ msg: 'CORS blocked request', origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));

  app.use(express.json({
    limit: '10mb',
    verify: (req: express.Request, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(requestLogger);

  app.get('/health', async (_req, res) => {
    const checks = {
      database: false,
      git: false,
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      logger.error({ msg: 'Health check database connection failed', error });
    }

    try {
      const { execSync } = await import('child_process');
      execSync('git --version', { stdio: 'ignore' });
      checks.git = true;
    } catch (error) {
      logger.error({ msg: 'Health check git not available', error });
    }

    const allHealthy = checks.database && checks.git;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  app.use('/api/v1/auth/login', rateLimitRuntime.middleware.authCredentials);
  app.use('/api/v1/auth/github', rateLimitRuntime.middleware.authCredentials);
  app.use('/api/v1/auth/register', rateLimitRuntime.middleware.authRegistration);
  app.use('/api/v1/auth/refresh', rateLimitRuntime.middleware.authRegistration);
  app.use('/api/v1/auth/logout', rateLimitRuntime.middleware.authSession);
  app.use('/api/v1/auth/me', rateLimitRuntime.middleware.authSession);
  app.use('/api/v1/auth/guest-token', rateLimitRuntime.middleware.authGuestToken);
  app.use('/api/v1/auth', authRoutes);

  const projectSubRouter = express.Router({ mergeParams: true });
  projectSubRouter.use(authenticate);
  projectSubRouter.use('/git', gitRoutes);
  projectSubRouter.use('/assets', assetRoutes);
  projectSubRouter.use('/global-assets', globalAssetRoutes);
  projectSubRouter.use('/preview', previewRoutes);
  projectSubRouter.use('/builds', buildsRoutes);
  projectSubRouter.use('/cdn', cdnRoutes);
  projectSubRouter.use(['/content-types', '/content-types/'], contentTypeRoutes);
  projectSubRouter.use(['/collections', '/collections/'], collectionRoutes);
  projectSubRouter.use(['/schemas', '/schemas/'], schemaAliasRoutes);
  projectSubRouter.use('/resources', resourceRoutes);
  projectSubRouter.use('/locks', lockRoutes);
  projectSubRouter.use('/graphql', graphqlRoutes);
  projectSubRouter.use('/plugins', pluginRoutes);

  app.use('/api/v1/projects/:projectId', rateLimitRuntime.middleware.api, projectSubRouter);
  app.use('/api/v1/projects', rateLimitRuntime.middleware.api, authenticate, projectRoutes);
  app.use('/api/v1/delivery/projects/:projectId/collections', rateLimitRuntime.middleware.delivery, publicCollectionRoutes);
  app.use('/api/v1/delivery/projects/:projectId/graphql', rateLimitRuntime.middleware.delivery, graphqlDeliveryRoutes);
  app.use('/api/v1/agent', rateLimitRuntime.middleware.agent, agentGatewayRoutes);
  app.use('/api/v1/system', rateLimitRuntime.middleware.system, systemRoutes);
  app.use('/api/v1/webhooks', rateLimitRuntime.middleware.webhooks, webhooksRoutes);

  app.use('/api/*', (req, res) => {
    logger.warn({ msg: 'API route not found', method: req.method, url: req.originalUrl });
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API route not found: ${req.method} ${req.originalUrl}`,
      },
    });
  });

  app.use(errorHandler);

  return {
    app,
    shutdown: () => shutdownRateLimitRuntime(rateLimitRuntime),
  };
}

async function shutdownRateLimitRuntime(rateLimitRuntime: RateLimitRuntime): Promise<void> {
  await rateLimitRuntime.shutdown();
}
