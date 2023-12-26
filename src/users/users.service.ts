import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  findOne(id: string) {
    return this.prismaService.user.findUnique({
      where: { id },
    });
  }

  async findByWalletAddress(walletAddress: string) {
    const wallet = await this.prismaService.user.findUnique({
      where: { walletAddress },
    });

    return wallet;
  }

  async getNonce(walletAddress: string) {
    const nonce = Math.floor(Math.random() * 900000) + 100000; // 6 digit nonce

    await this.prismaService.user.upsert({
      where: { walletAddress },
      update: {
        nonce,
      },
      create: {
        walletAddress,
        nonce,
      },
    });

    return nonce;
  }

  updateNonce(walletAddress: string, nonce: number | null) {
    return this.prismaService.user.update({
      where: { walletAddress },
      data: {
        nonce,
      },
    });
  }
}
