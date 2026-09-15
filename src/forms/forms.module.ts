import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { FormSchemaEntity } from './entities/form-schema.entity';
import { FormsController } from './forms.controller';
import { FormsRepository } from './forms.repository';
import { FormsService } from './forms.service';
import { PlatformFormsController } from './platform-forms.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormSchemaEntity]),
    AuthModule,
    forwardRef(() => AbacModule),
  ],
  controllers: [FormsController, PlatformFormsController],
  providers: [FormsRepository, FormsService],
  exports: [FormsService],
})
export class FormsModule {}
