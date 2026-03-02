import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RagService } from '../../rag/rag.service';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

@Controller('admin/knowledge')
export class AdminKnowledgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  @Get('documents')
  async listDocuments() {
    const docs = await this.prisma.knowledgeDocument.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: { _count: { select: { fragments: true } } },
    });
    return docs.map((d) => ({
      ...d,
      fragmentCount: d._count.fragments,
      _count: undefined,
    }));
  }

  @Post('documents')
  async createDocument(
    @Body() body: { filename: string; fileType?: string; content?: string },
  ) {
    const filename = (body?.filename ?? 'document').trim() || 'document';
    const fileType = body?.fileType === 'docx' ? 'docx' : 'md';
    const content = typeof body?.content === 'string' ? body.content : undefined;
    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        filename,
        fileType: fileType as any,
        storagePath: '',
        content: content ?? null,
        indexingStatus: content ? 'PENDING' : 'PENDING',
      },
    });
    if (content && content.trim()) {
      await this.indexDocumentContent(doc.id, content.trim());
    }
    const updated = await this.prisma.knowledgeDocument.findUnique({
      where: { id: doc.id },
      include: { _count: { select: { fragments: true } } },
    });
    return { ...updated, fragmentCount: updated!._count.fragments, _count: undefined };
  }

  @Get('documents/:id')
  async getDocument(@Param('id') id: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: { fragments: { orderBy: { updatedAt: 'asc' } } },
    });
    if (!doc) throw new HttpException({ message: 'Document not found' }, 404);
    return doc;
  }

  @Post('documents/:id/reindex')
  async reindexDocument(@Param('id') id: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new HttpException({ message: 'Document not found' }, 404);
    const content = doc.content?.trim();
    if (!content) {
      await this.prisma.knowledgeDocument.update({
        where: { id },
        data: { indexingStatus: 'FAILED', errorMessage: 'No content to index' },
      });
      return { ok: false, message: 'No content to index' };
    }
    await this.prisma.knowledgeFragment.deleteMany({ where: { documentId: id } });
    await this.indexDocumentContent(id, content);
    return { ok: true };
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    return { ok: true };
  }

  @Patch('fragments/:id')
  async updateFragment(
    @Param('id') id: string,
    @Body() body: { content?: string; topic?: string },
  ) {
    const data: { content?: string; topic?: string; manuallyEdited?: boolean } = {};
    if (typeof body?.content === 'string') data.content = body.content;
    if (typeof body?.topic === 'string') data.topic = body.topic;
    if (Object.keys(data).length > 0) data.manuallyEdited = true;
    const frag = await this.prisma.knowledgeFragment.update({
      where: { id },
      data,
    });
    return frag;
  }

  @Post('test-rag')
  async testRag(@Body() body: { query: string; topK?: number }) {
    const query = (body?.query ?? '').trim() || 'тест';
    const topK = Math.min(Math.max(Number(body?.topK) || 6, 1), 20);
    const results = await this.rag.search(query, topK);
    return { query, results };
  }

  private async indexDocumentContent(documentId: string, content: string): Promise<void> {
    const chunks = this.splitByMeaning(content);
    for (const chunk of chunks) {
      await this.prisma.knowledgeFragment.create({
        data: {
          documentId,
          content: chunk.trim(),
          sourceFile: null,
        },
      });
    }
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        indexingStatus: 'INDEXED',
        fragmentCount: chunks.length,
        errorMessage: null,
        indexedAt: new Date(),
      },
    });
  }

  /**
   * Режет документ по смыслу: по заголовкам (##, ###) и параграфам.
   * Не режет посередине предложения — только по границам разделов и абзацев.
   */
  private splitByMeaning(text: string): string[] {
    const MAX_CHUNK = CHUNK_SIZE;
    const trimmed = text.trim();
    if (!trimmed) return [];

    const sections = trimmed.split(/\n(?=#{1,6}\s)/).map((s) => s.trim()).filter(Boolean);
    const chunks: string[] = [];

    for (const section of sections) {
      if (section.length <= MAX_CHUNK) {
        chunks.push(section);
        continue;
      }
      const paragraphs = section.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      let current = '';
      for (const p of paragraphs) {
        const next = current ? current + '\n\n' + p : p;
        if (next.length <= MAX_CHUNK) {
          current = next;
        } else {
          if (current) chunks.push(current);
          if (p.length <= MAX_CHUNK) {
            current = p;
          } else {
            chunks.push(p.slice(0, MAX_CHUNK));
            current = p.slice(MAX_CHUNK);
          }
        }
      }
      if (current) chunks.push(current);
    }

    return chunks.length ? chunks : [trimmed];
  }
}
