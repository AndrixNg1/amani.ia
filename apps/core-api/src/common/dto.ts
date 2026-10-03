import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class NameDto {
  @IsString() @Length(1, 120) @Matches(/\S/) name!: string;
}
export class CreateOrganizationDto extends NameDto {
  @IsString() @Length(1, 80) @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) slug!: string;
}
export class DisplayNameDto {
  @IsString() @Length(1, 120) @Matches(/\S/) displayName!: string;
}
export class CreateUserDto extends DisplayNameDto {
  @IsEmail() @MaxLength(254) email!: string;
}
export class CreateTeamDto extends NameDto {
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class CreateRoleDto {
  @IsString() @Length(1, 80) @Matches(/^[a-z][a-z0-9_-]*$/) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class UserReferenceDto {
  @IsUUID() userId!: string;
}
export class MemberReferenceDto {
  @IsUUID() membershipId!: string;
}
export class RoleReferenceDto {
  @IsUUID() roleId!: string;
}
export class PermissionDto {
  @IsString()
  @Length(2, 120)
  @Matches(/^[a-z][a-z0-9_.-]+$/)
  permission!: string;
}
export class MembershipStatusDto {
  @IsIn(['active', 'inactive']) status!: 'active' | 'inactive';
}
export class InstallationRequestDto {
  @IsString() @Length(1, 80) @Matches(/^[a-z][a-z0-9-]*$/) pluginKey!: string;
  @IsUUID() versionId!: string;
}
export class InstallationStatusDto {
  @IsIn(['disabled', 'suspended']) status!: 'disabled' | 'suspended';
}
export class OrganizationQuery {
  @IsUUID() organizationId!: string;
}
export class AuthorizationCheckDto extends PermissionDto {
  @IsUUID() organizationId!: string;
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z][a-z0-9-]*$/)
  pluginKey?: string;
}
export class PluginKeyParam {
  @IsString() @Length(1, 80) @Matches(/^[a-z][a-z0-9-]*$/) pluginKey!: string;
}
