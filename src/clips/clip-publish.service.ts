import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AyrshareService } from './ayrshare.service';
import { UserPlatformService } from '../user-platform/user-platform.service';

const MAX_ATTEMPTS = 3;

@Injectable()
export class ClipPublishService {
  private readonly logger = new Logger(ClipPublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ayrshare: AyrshareService,
    private readonly userPlatformService: UserPlatformService,
  ) {}

  /**
   * POST /clips/:id/publish
   * Publishes a clip to the requested platforms via Ayrshare.
   * - Returns 400 if clip has no Cloudinary URL
   * - Returns 400 if none of the requested platforms are connected by the user
   * - Tracks each attempt in ClipPost table
   * - Retries failed platforms up to 3 times with exponential backoff
   */
  async publish(
    clipId: number,
    userId: number,
    targetPlatforms: string[],
  ): Promise<{ results: Array<{ platform: string; status: string; postId?: string; error?: string }> }> {
    const clip = await this.prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new NotFoundException(`Clip ${clipId} not found`);
    if (!clip.clipUrl) {
      throw new BadRequestException(
        'Clip has no Cloudinary URL. Upload the clip before publishing.',
      );
    }

    // Resolve which of the requested platforms the user has connected
    const connectedPlatforms = await this.userPlatformService.findAll(userId);
    const connectedNames = new Set(connectedPlatforms.map((p) => p.platform));
    const validPlatforms = targetPlatforms.filter((p) => connectedNames.has(p));

    if (validPlatforms.length === 0) {
      throw new BadRequestException(
        'None of the requested platforms are connected by this user.',
      );
    }

    // Upsert ClipPost rows to pending
    await Promise.all(
      validPlatforms.map((platform) =>
        this.prisma.clipPost.upsert({
          where: {
            // Use a compound unique if available; otherwise create
            id: 0, // force create path via update-or-create pattern below
          },
          update: {},
          create: { clipId, platform, status: 'pending', attempts: 0 },
        }).catch(() =>
          this.prisma.clipPost.create({
            data: { clipId, platform, status: 'pending', attempts: 0 },
          }),
        ),
      ),
    );

    const caption = clip.caption ?? clip.title ?? '';
    const results = await this.postWithRetry(
      clip.clipUrl,
      caption,
      validPlatforms,
      clipId,
    );

    return { results };
  }

  private async postWithRetry(
    mediaUrl: string,
    caption: string,
    platforms: string[],
    clipId: number,
  ): Promise<Array<{ platform: string; status: string; postId?: string; error?: string }>> {
    let remaining = [...platforms];
    const finalResults: Map<string, { platform: string; status: string; postId?: string; error?: string }> = new Map();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (remaining.length === 0) break;

      if (attempt > 1) {
        const delay = 1000 * Math.pow(2, attempt - 2); // 1s, 2s
        await new Promise((r) => setTimeout(r, delay));
      }

      const batchResults = await this.ayrshare.post(mediaUrl, caption, remaining);

      const stillFailing: string[] = [];
      for (const r of batchResults) {
        await this.prisma.clipPost.updateMany({
          where: { clipId, platform: r.platform },
          data: {
            status: r.success ? 'published' : 'failed',
            postId: r.postId ?? null,
            error: r.error ?? null,
            attempts: attempt,
          },
        });

        if (r.success) {
          finalResults.set(r.platform, {
            platform: r.platform,
            status: 'published',
            postId: r.postId,
          });
          this.logger.log(`Published clip ${clipId} to ${r.platform} (attempt ${attempt})`);
        } else {
          stillFailing.push(r.platform);
          finalResults.set(r.platform, {
            platform: r.platform,
            status: attempt < MAX_ATTEMPTS ? 'retrying' : 'failed',
            error: r.error,
          });
          this.logger.warn(
            `Failed to publish clip ${clipId} to ${r.platform} (attempt ${attempt}): ${r.error}`,
          );
        }
      }

      remaining = stillFailing;
    }

    return Array.from(finalResults.values());
  }

  /**
   * GET /clips/:id/posts
   * Returns per-platform post status for a clip.
   */
  async getPostStatus(clipId: number): Promise<any[]> {
    return this.prisma.clipPost.findMany({
      where: { clipId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
