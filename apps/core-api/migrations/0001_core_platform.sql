-- Run only as amani_core_platform. Infrastructure already owns schema provisioning.
CREATE TABLE core_platform.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
 display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254)
);
CREATE TABLE core_platform.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','provisioning','active','failed','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core_platform.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES core_platform.organizations(id),
 user_id uuid NOT NULL REFERENCES core_platform.users(id),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
 joined_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id,user_id), UNIQUE (organization_id,id)
);
CREATE INDEX memberships_user_idx ON core_platform.memberships(user_id);
CREATE TABLE core_platform.teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES core_platform.organizations(id),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120), description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id,name), UNIQUE (organization_id,id)
);
CREATE TABLE core_platform.team_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 team_id uuid NOT NULL, membership_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id,team_id) REFERENCES core_platform.teams(organization_id,id),
 FOREIGN KEY (organization_id,membership_id) REFERENCES core_platform.memberships(organization_id,id),
 UNIQUE (organization_id,team_id,membership_id)
);
CREATE INDEX team_memberships_member_idx ON core_platform.team_memberships(organization_id,membership_id);
CREATE TABLE core_platform.roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES core_platform.organizations(id),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80), description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
 is_system boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id,name), UNIQUE (organization_id,id),
 CHECK (is_system = (name IN ('owner','admin','member')))
);
CREATE TABLE core_platform.plugins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9-]*$'),
 name text NOT NULL, description text NOT NULL,
 status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','disabled')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core_platform.plugin_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plugin_id uuid NOT NULL REFERENCES core_platform.plugins(id),
 version text NOT NULL, api_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (plugin_id,version), UNIQUE (plugin_id,id)
);
CREATE TABLE core_platform.permissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_.-]+$'),
 description text NOT NULL, plugin_key text REFERENCES core_platform.plugins(key),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (key NOT LIKE 'platform.%')
);
CREATE TABLE core_platform.role_permissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 role_id uuid NOT NULL, permission_id uuid NOT NULL REFERENCES core_platform.permissions(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id,role_id) REFERENCES core_platform.roles(organization_id,id),
 UNIQUE (organization_id,role_id,permission_id)
);
CREATE INDEX role_permissions_permission_idx ON core_platform.role_permissions(permission_id);
CREATE TABLE core_platform.membership_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, membership_id uuid NOT NULL, role_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id,membership_id) REFERENCES core_platform.memberships(organization_id,id),
 FOREIGN KEY (organization_id,role_id) REFERENCES core_platform.roles(organization_id,id),
 UNIQUE (organization_id,membership_id,role_id)
);
CREATE INDEX membership_roles_role_idx ON core_platform.membership_roles(organization_id,role_id);
CREATE TABLE core_platform.platform_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE CHECK (key IN ('platform_admin','platform_moderator')),
 description text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core_platform.user_platform_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES core_platform.users(id),
 role_id uuid NOT NULL REFERENCES core_platform.platform_roles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id,role_id)
);
CREATE TABLE core_platform.organization_plugin_installations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES core_platform.organizations(id),
 plugin_id uuid NOT NULL, version_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','provisioning','active','suspended','disabled','deprovisioning','failed')),
 installed_at timestamptz NOT NULL DEFAULT now(), activated_at timestamptz, disabled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (plugin_id,version_id) REFERENCES core_platform.plugin_versions(plugin_id,id), UNIQUE (organization_id,plugin_id)
);
CREATE INDEX installations_plugin_idx ON core_platform.organization_plugin_installations(plugin_id);
CREATE TABLE core_platform.plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE, name text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core_platform.plan_entitlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES core_platform.plans(id),
 capability text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (plan_id,capability)
);
CREATE TABLE core_platform.organization_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL UNIQUE REFERENCES core_platform.organizations(id),
 plan_id uuid NOT NULL REFERENCES core_platform.plans(id),
 status text NOT NULL CHECK (status IN ('trial','active','past_due','suspended','cancelled')),
 starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX subscriptions_plan_idx ON core_platform.organization_subscriptions(plan_id);
CREATE TABLE core_platform.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES core_platform.organizations(id),
 actor_user_id uuid REFERENCES core_platform.users(id), action text NOT NULL, target_type text NOT NULL, target_id uuid NOT NULL,
 correlation_id text NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
 outcome text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','denied')),
 metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_time_idx ON core_platform.audit_events(organization_id,created_at DESC,id);
CREATE INDEX audit_actor_idx ON core_platform.audit_events(actor_user_id);

-- Platform capabilities do not enter the tenant permission catalog.
INSERT INTO core_platform.platform_roles(key,description) VALUES
 ('platform_admin','Platform governance; no implicit tenant access'),
 ('platform_moderator','Reserved limited moderation role; no grants implemented');
INSERT INTO core_platform.permissions(key,description) VALUES
 ('organization.read','Read organization metadata'), ('organization.manage','Update organization metadata'),
 ('members.read','Read organization memberships'), ('members.manage','Manage organization memberships'),
 ('teams.read','Read teams'), ('teams.manage','Manage teams'),
 ('roles.read','Read tenant roles and assignments'), ('roles.manage','Manage delegated roles and permissions'),
 ('plugins.use','Use an entitled, active plugin'), ('plugins.manage','Request or disable plugin installations'),
 ('audit.read','Read organization audit metadata');
