import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Run multiple operations in a single database transaction.
   * All operations succeed or all are rolled back.
   *
   * @example
   * await this.prisma.withTransaction(async (tx) => {
   *   const earning = await tx.earning.create({ data: { ... } });
   *   await tx.payout.update({ where: { id }, data: { status: 'completed' } });
   *   return earning;
   * });
   */
  async withTransaction<T>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn);
  }

  /**
   * Run a batch of independent Prisma operations in a single transaction.
   * Useful when you have a fixed list of queries to execute atomically.
   *
   * @example
   * const [payout, earning] = await this.prisma.withBatch([
   *   this.prisma.payout.create({ data: { ... } }),
   *   this.prisma.earning.update({ where: { id }, data: { ... } }),
   * ]);
   */
  async withBatch<T extends readonly object[]>(
    queries: readonly [...{ [K in keyof T]: Promise<T[K]> }],
  ): Promise<T> {
    return this.$transaction(queries) as Promise<T>;
  }
}
