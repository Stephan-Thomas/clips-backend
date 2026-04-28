import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateClipDto } from './create-clip.dto';

function makeValid(overrides: Partial<CreateClipDto> = {}): CreateClipDto {
  return plainToInstance(CreateClipDto, {
    videoId: 'vid-1',
    inputPath: '/tmp/input.mp4',
    outputPath: '/tmp/output.mp4',
    startTime: 0,
    endTime: 30,
    positionRatio: 0.5,
    ...overrides,
  });
}

describe('CreateClipDto validation', () => {
  it('passes with valid data', async () => {
    const errors = await validate(makeValid());
    expect(errors).toHaveLength(0);
  });

  it('fails when startTime is negative', async () => {
    const errors = await validate(makeValid({ startTime: -1, endTime: 30 }));
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('fails when endTime equals startTime', async () => {
    const dto = makeValid({ startTime: 10, endTime: 10 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when duration < 5 seconds', async () => {
    const dto = makeValid({ startTime: 0, endTime: 3 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when duration > 300 seconds', async () => {
    const dto = makeValid({ startTime: 0, endTime: 301 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes at boundary: exactly 5 seconds', async () => {
    const errors = await validate(makeValid({ startTime: 0, endTime: 5 }));
    expect(errors).toHaveLength(0);
  });

  it('passes at boundary: exactly 300 seconds', async () => {
    const errors = await validate(makeValid({ startTime: 0, endTime: 300 }));
    expect(errors).toHaveLength(0);
  });
});
