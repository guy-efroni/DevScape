import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import * as path from 'node:path';

describe('DevScape API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('/api/parse (POST)', () => {
    it('should parse a valid directory and return ICodeGraph', async () => {
      const targetDir = path.resolve(import.meta.dirname, '../../../packages/shared/src');

      const response = await request(app.getHttpServer())
        .post('/api/parse')
        .send({ directoryPath: targetDir })
        .expect(201);

      expect(response.body).toHaveProperty('nodes');
      expect(response.body).toHaveProperty('edges');
      expect(Array.isArray(response.body.nodes)).toBe(true);
      expect(Array.isArray(response.body.edges)).toBe(true);

      // Verify node structure
      const nodeNames = response.body.nodes.map((n: any) => n.name);
      expect(nodeNames).toContain('ICodeNode');
      expect(nodeNames).toContain('IGraphEdge');
      expect(nodeNames).toContain('ICodeGraph');

      // Verify node properties conform to ICodeNode
      const codeNode = response.body.nodes.find((n: any) => n.name === 'ICodeNode');
      expect(codeNode).toMatchObject({
        name: 'ICodeNode',
        type: 'interface',
      });
      expect(codeNode.id).toBeDefined();
      expect(codeNode.filePath).toBeDefined();
    });

    it('should return 400 when directoryPath does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/parse')
        .send({ directoryPath: '/invalid/non/existent/path' })
        .expect(400);
    });

    it('should return 400 when directoryPath is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/parse')
        .send({})
        .expect(400);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
