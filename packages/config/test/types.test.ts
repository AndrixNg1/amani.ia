import { createEnv } from '../src/index.js';

const env = createEnv({ PORT: '4000' });
declare function acceptsNumber(value: number): void;
declare function acceptsBoolean(value: boolean): void;
acceptsNumber(env.integer('PORT', { min: 1, max: 65535 }));
acceptsBoolean(env.boolean('ENABLED', { default: false }));
// @ts-expect-error Boolean defaults cannot silently coerce strings.
env.boolean('ENABLED', { default: 'false' });
// @ts-expect-error Environment names are explicit, not arbitrary strings.
env.environment('APP_ENV', { default: 'prod' });
// @ts-expect-error Configuration input values are environment strings.
createEnv({ PORT: 4000 });
