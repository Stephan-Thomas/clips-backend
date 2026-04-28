import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ClipsService } from './clips.service.js';
import type { ClipSortField, SortOrder } from './clips.service.js';
import { CreateClipDto } from './dto/create-clip.dto.js';
import type { BulkUpdateClipsDto } from './dto/bulk-update-clips.dto.js';
import { LoginGuard } from '../auth/guards/login.guard.js';
import { BulkDeleteClipsDto } from './dto/bulk-delete-clips.dto.js';

@UseGuards(LoginGuard)
@Controller('clips')
export class ClipsController {
  constructor(private readonly clipsService: ClipsService) {}

  /**
   * POST /clips/generate
   * Enqueue a clip-generation job. Limited to 10 req/min per authenticated user.
   * Validates: startTime >= 0, endTime > startTime, duration 5–300 seconds.
   */
  @Post('generate')
  @Throttle({ clipGenerate: { limit: 10, ttl: 60000 } })
  generate(@Body() dto: CreateClipDto) {
    const duration = dto.endTime - dto.startTime;
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('endTime must be greater than startTime');
    }
    if (duration < 5 || duration > 300) {
      throw new BadRequestException(
        'Clip duration must be between 5 and 300 seconds',
      );
    }
    return this.clipsService.enqueueClip(dto);
  }

  /**
   * GET /clips
   * List clips, sorted by viralityScore descending by default.
   */
  @Get()
  list(
    @Query('videoId') videoId?: string,
    @Query('sort') sort?: string,
    @Query('sortBy') sortBy?: ClipSortField,
    @Query('order') order?: SortOrder,
  ) {
    let finalSortBy = sortBy;
    let finalOrder = order;

    if (sort) {
      const [field, dir] = sort.split(':');
      if (field) finalSortBy = field as ClipSortField;
      if (dir) finalOrder = dir as SortOrder;
    }

    return this.clipsService.listClips({
      videoId,
      sortBy: finalSortBy,
      order: finalOrder,
    });
  }

  /** GET /clips/:id */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const clip = await this.clipsService.findById(id);
    if (!clip) throw new NotFoundException(`Clip ${id} not found`);
    return clip;
  }

  /**
   * POST /clips/bulk-update
   * Bulk update selected and/or postStatus for multiple clips in one transaction.
   */
  @Post('bulk-update')
  bulkUpdate(@Body() dto: BulkUpdateClipsDto, @Req() req: Request) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.bulkUpdate(userId, dto);
  }

  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteClipsDto, @Req() req: Request) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.bulkDeleteRejected(userId, dto.clipIds);
  }

  /**
   * POST /clips/:id/regenerate
   * Re-run FFmpeg cut for a single clip using original timestamps.
   */
  @Post(':id/regenerate')
  regenerate(@Param('id') id: string, @Req() req: Request) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.regenerate(userId, Number(id));
  }
}
