import { apiServices } from '../lib/api-services';
import { prisma } from '../lib/prisma';
import { DeliveryProjectionService } from './service';

export function queueDeliveryProjectionReconcile(params: {
  projectId: string;
  repoUrl?: string | null;
  branch?: string;
  label?: string;
}): void {
  apiServices.runBackgroundTask(
    params.label ?? 'delivery-projection-reconcile',
    (async () => {
      let branch = params.branch;
      let repoUrl = params.repoUrl ?? '';

      if (!branch || !repoUrl) {
        const project = await prisma.project.findUnique({
          where: { id: params.projectId },
          select: { defaultBranch: true, repoUrl: true },
        });
        branch = branch || project?.defaultBranch || 'main';
        repoUrl = repoUrl || project?.repoUrl || '';
      }

      return new DeliveryProjectionService({
        projectId: params.projectId,
        repoUrl,
        branch,
      }).reconcile();
    })(),
  );
}
