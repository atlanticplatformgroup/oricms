import { Router } from 'express';
import { requirePermission } from '../permissions/middleware';
import { buildPluginUiContributionsSnapshot, parseEnabledPlugins } from './settings';
import { findPluginProject, loadValidatedManifestsOrRespond, respondProjectNotFound } from './shared';

const router = Router({ mergeParams: true });

router.get('/', requirePermission('schemas', 'read'), async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;
  const enabled = new Set(parseEnabledPlugins(project.settings));
  res.json({
    success: true,
    data: {
      plugins: manifests.map((manifest) => ({
        ...manifest,
        enabled: enabled.has(manifest.id),
      })),
    },
  });
});

router.get('/ui-contributions', requirePermission('schemas', 'read'), async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;
  const snapshot = buildPluginUiContributionsSnapshot({
    manifests,
    settings: project.settings,
  });

  res.json({ success: true, data: snapshot });
});

router.get('/id/:pluginId', requirePermission('schemas', 'read'), async (req, res) => {
  const { projectId, pluginId } = req.params as { projectId: string; pluginId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;
  const manifest = manifests.find((item) => item.id === pluginId);
  if (!manifest) {
    res.status(404).json({ success: false, error: { code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' } });
    return;
  }

  const enabled = new Set(parseEnabledPlugins(project.settings));
  res.json({
    success: true,
    data: {
      plugin: {
        ...manifest,
        enabled: enabled.has(manifest.id),
      },
    },
  });
});

export default router;
