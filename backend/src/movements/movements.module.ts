import { Module } from '@nestjs/common';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { MovementShapeConstraint } from './dto/create-movement.dto';

@Module({
  controllers: [MovementsController],
  providers: [MovementsService, MovementShapeConstraint],
  exports: [MovementsService],
})
export class MovementsModule {}
