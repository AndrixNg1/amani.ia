import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { CreateUserDto, DisplayNameDto } from '../common/dto';
import { UsersService } from './users.service';
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Post()
  @Operation('users.create', 'user')
  create(@CurrentActor() actor: Actor, @Body() body: CreateUserDto) {
    return this.users.create(actor, body);
  }
  @Get(':id')
  @Operation('users.read', 'user')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(actor, id);
  }
  @Patch('me')
  @Operation('users.update', 'user')
  update(@CurrentActor() actor: Actor, @Body() body: DisplayNameDto) {
    return this.users.updateSelf(actor, body.displayName);
  }
}
