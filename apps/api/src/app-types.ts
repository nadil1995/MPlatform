import type { Logger } from 'pino'
import type { Config } from './config'
import type { Db } from './lib/db'
import type { TokenVerifier } from './lib/auth'

/** The signed-in user, loaded from the database after the token is verified. */
export type Actor = {
  userId: string
  roles: readonly ('client' | 'musician' | 'admin')[]
  /** The live-or-not musician profile this user owns, if any. */
  profileId: string | null
}

/** Everything a request handler can reach. Passed in, so tests can swap parts. */
export type Deps = {
  config: Config
  db: Db
  log: Logger
  verifyToken: TokenVerifier
  /** Clock, injectable so tests control "now". */
  now: () => Date
}

export type AppEnv = {
  Variables: {
    deps: Deps
    requestId: string
    actor: Actor | null
  }
}
