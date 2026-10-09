import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_DOC } from '../common/constants/messages.constant';

/** Tài liệu API tự động tại /docs (JSON tại /docs-json). */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(API_DOC.TITLE)
      .setDescription(API_DOC.DESCRIPTION)
      .setVersion('1.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
